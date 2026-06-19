use serde::{Deserialize, Serialize};
use serde_json::json;
use std::fs;
use std::time::Duration;
use tauri::Manager;

// ── Credentials ───────────────────────────────────────────────────────────────
const SUPABASE_URL:   &str = "https://ujqrxhhshxgqqjkblorh.supabase.co";
const SUPABASE_KEY:   &str = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqcXJ4aGhzaHhncXFqa2Jsb3JoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDU3NjAsImV4cCI6MjA5NTM4MTc2MH0.t4CgUYE5oPLhocC2YtRF-WW6tMWu2Cvd0mYB_A1jWhk";
// All AI — chat, summaries, and transcription — goes through the Cloudflare
// Worker, which holds the provider keys. No API keys are baked into the binary.
const WORKER_URL:     &str = "https://swiftcare.tnn-040.workers.dev";

const TABLE: &str = "patient_summary";
// Generated summaries live in their own table — `patient_summary` is a
// materialized view (read-only, can't add columns or write to it).
const SUMMARY_TABLE: &str = "patient_ai_summary";
const COLS:  &str = "ptnum,label,scc,first_name,last_name,age,administrative_sex,race,ethnicity,state,systolic_bp,diastolic_bp,heart_rate,bmi,total_cholesterol,ldl,hdl,triglycerides,hba1c,glucose,creatinine,egfr,hemoglobin,wbc,platelets,problems";

const MAX_RETRIES: u32 = 5;

// ── Helpers ───────────────────────────────────────────────────────────────────
fn data_dir(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn recordings_dir(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = data_dir(app)?.join("recordings");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

async fn post_worker_with_retry(url: &str, body: serde_json::Value) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let mut last_err = String::new();
    for attempt in 0..MAX_RETRIES {
        if attempt > 0 {
            let secs = 2u64.pow(attempt).min(30);
            tokio::time::sleep(Duration::from_secs(secs)).await;
        }
        match client.post(url).json(&body).send().await {
            Ok(res) if res.status().is_success() => {
                return res.json::<serde_json::Value>().await.map_err(|e| e.to_string());
            }
            Ok(res) => {
                last_err = format!("Worker error: {}", res.text().await.unwrap_or_default());
            }
            Err(e) => {
                last_err = e.to_string();
            }
        }
    }
    Err(last_err)
}

// ── Commands ──────────────────────────────────────────────────────────────────

#[tauri::command]
async fn query_patients(query: String, filter: String) -> Result<Vec<serde_json::Value>, String> {
    let mut params: Vec<(&str, String)> = vec![
        ("select", COLS.to_string()),
        ("order",  "last_name.asc,first_name.asc".to_string()),
        ("limit",  "150".to_string()),
    ];
    if !query.trim().is_empty() {
        params.push(("ptnum", format!("ilike.*{}*", query.trim())));
    }
    match filter.as_str() {
        "positive" => params.push(("label", "eq.1".to_string())),
        "control"  => params.push(("label", "eq.0".to_string())),
        _ => {}
    }
    let res = reqwest::Client::new()
        .get(format!("{}/rest/v1/{}", SUPABASE_URL, TABLE))
        .query(&params)
        .header("apikey", SUPABASE_KEY)
        .header("Authorization", format!("Bearer {}", SUPABASE_KEY))
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("Supabase error: {}", res.text().await.unwrap_or_default()));
    }
    res.json::<Vec<serde_json::Value>>().await.map_err(|e| e.to_string())
}

// ── Persisted AI patient summary ──────────────────────────────────────────────

/// Fetch the stored AI summary + data fingerprint for one patient.
/// Returns None if there's no row, no summary yet, or the columns don't exist
/// (so the app keeps working before the migration is applied).
#[tauri::command]
async fn get_patient_summary(ptnum: String) -> Result<Option<serde_json::Value>, String> {
    let params: Vec<(&str, String)> = vec![
        ("select", "ai_summary,ai_summary_hash,ai_summary_at".to_string()),
        ("ptnum",  format!("eq.{}", ptnum)),
        ("limit",  "1".to_string()),
    ];
    let res = reqwest::Client::new()
        .get(format!("{}/rest/v1/{}", SUPABASE_URL, SUMMARY_TABLE))
        .query(&params)
        .header("apikey", SUPABASE_KEY)
        .header("Authorization", format!("Bearer {}", SUPABASE_KEY))
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Ok(None);
    }
    let rows: Vec<serde_json::Value> = res.json().await.map_err(|e| e.to_string())?;
    Ok(rows
        .into_iter()
        .next()
        .filter(|r| !r.get("ai_summary").map(|v| v.is_null()).unwrap_or(true)))
}

/// Persist a generated summary and the fingerprint of the clinical data it was
/// built from, so it is only regenerated when that data changes.
#[tauri::command]
async fn save_patient_summary(ptnum: String, summary: String, hash: String) -> Result<(), String> {
    let body = serde_json::json!({
        "ptnum":           ptnum,
        "ai_summary":      summary,
        "ai_summary_hash": hash,
        "ai_summary_at":   chrono::Utc::now().to_rfc3339(),
    });
    // Upsert: the row may not exist yet, so POST with merge-duplicates on ptnum.
    let res = reqwest::Client::new()
        .post(format!("{}/rest/v1/{}", SUPABASE_URL, SUMMARY_TABLE))
        .header("apikey", SUPABASE_KEY)
        .header("Authorization", format!("Bearer {}", SUPABASE_KEY))
        .header("Content-Type", "application/json")
        .header("Prefer", "resolution=merge-duplicates,return=minimal")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("Supabase error: {}", res.text().await.unwrap_or_default()));
    }
    Ok(())
}

// Audio is forwarded (base64) to the Worker, which runs Whisper with its own
// key — same pattern as the chat/summary calls, so no key lives in the binary.
#[tauri::command]
async fn transcribe_audio(
    audio_b64: String,
    mime_type: String,
    patient_id: String,
) -> Result<String, String> {
    let data = post_worker_with_retry(
        &format!("{}/api/transcribe", WORKER_URL),
        serde_json::json!({ "audioB64": audio_b64, "mimeType": mime_type, "patientId": patient_id }),
    ).await?;
    let text = data["text"].as_str().or_else(|| data["transcript"].as_str()).unwrap_or("");
    Ok(text.to_string())
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SavedNote {
    id:         String,
    patient_id: String,
    transcript: String,
    notes:      String,
    created_at: String,
}

#[tauri::command]
fn save_note(
    app: tauri::AppHandle,
    patient_id: String,
    transcript: String,
    notes: String,
) -> Result<String, String> {
    let path = data_dir(&app)?.join(format!("notes_{}.json", patient_id));
    let mut list: Vec<SavedNote> = if path.exists() {
        serde_json::from_str(&fs::read_to_string(&path).map_err(|e| e.to_string())?)
            .unwrap_or_default()
    } else {
        vec![]
    };
    let id = uuid::Uuid::new_v4().to_string();
    list.insert(0, SavedNote {
        id: id.clone(), patient_id, transcript, notes,
        created_at: chrono::Utc::now().to_rfc3339(),
    });
    list.truncate(50);
    fs::write(&path, serde_json::to_string(&list).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
fn load_notes(app: tauri::AppHandle, patient_id: String) -> Result<Vec<SavedNote>, String> {
    let path = data_dir(&app)?.join(format!("notes_{}.json", patient_id));
    if !path.exists() { return Ok(vec![]); }
    serde_json::from_str(&fs::read_to_string(&path).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())
}

// ── LLM via Cloudflare Worker (no API key needed in binary) ───────────────────

#[tauri::command]
async fn summarize_transcript(
    transcript: String,
    patient_context: String,
) -> Result<String, String> {
    let res = reqwest::Client::new()
        .post(format!("{}/api/soap-note", WORKER_URL))
        .json(&serde_json::json!({ "transcript": transcript, "patientContext": patient_context }))
        .send().await.map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("Worker error: {}", res.text().await.unwrap_or_default()));
    }
    let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    Ok(data["note"].as_str().unwrap_or("").to_string())
}

#[tauri::command]
async fn chat_with_patient_context(
    messages: serde_json::Value,
    patient_context: String,
) -> Result<String, String> {
    let res = reqwest::Client::new()
        .post(format!("{}/api/patient-chat", WORKER_URL))
        .json(&serde_json::json!({
            "messages":       messages,
            "patientContext": patient_context,
            "maxTokens":      1000
        }))
        .send().await.map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("Worker error: {}", res.text().await.unwrap_or_default()));
    }
    let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    Ok(data["reply"].as_str().unwrap_or("").to_string())
}

#[tauri::command]
async fn generate_cohort_insights(stats_json: String) -> Result<String, String> {
    let stats: serde_json::Value =
        serde_json::from_str(&stats_json).map_err(|e| format!("Invalid stats JSON: {}", e))?;

    let total      = stats["total"].as_u64().unwrap_or(0);
    let pos        = stats["pos"].as_u64().unwrap_or(0);
    let neg        = stats["neg"].as_u64().unwrap_or(0);
    let avg_age    = stats["avgAge"].as_f64().unwrap_or(0.0);
    let avg_bmi    = stats["avgBmi"].as_f64().unwrap_or(0.0);
    let avg_scc    = stats["avgScc"].as_f64().unwrap_or(0.0);
    let prevalence = if total > 0 { pos as f64 / total as f64 * 100.0 } else { 0.0 };
    let sys_bp     = stats["vitals"]["avg_systolic"].as_f64().unwrap_or(0.0);
    let dia_bp     = stats["vitals"]["avg_diastolic"].as_f64().unwrap_or(0.0);
    let chol       = stats["vitals"]["avg_chol"].as_f64().unwrap_or(0.0);
    let hba1c      = stats["vitals"]["avg_hba1c"].as_f64().unwrap_or(0.0);

    let prompt = format!(
        "Analyze this lung cancer cohort. Produce exactly 5 numbered insights (1–5), 2–3 sentences each.\n\n\
         Topics: (1) disease burden ({:.1}% prevalence, {pos}/{total}), \
         (2) tobacco risk stratification, \
         (3) age distribution and screening implications (mean age {:.1}y), \
         (4) comorbidity profile (BP {:.0}/{:.0} mmHg, chol {:.0} mg/dL, HbA1c {:.1}%, BMI {:.1}), \
         (5) one actionable recommendation.\n\n\
         Control: {neg} | Mean SCC: {:.1}",
        prevalence, avg_age, sys_bp, dia_bp, chol, hba1c, avg_bmi, avg_scc
    );

    let res = reqwest::Client::new()
        .post(format!("{}/api/cohort-insights-desktop", WORKER_URL))
        .json(&serde_json::json!({ "prompt": prompt }))
        .send().await.map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("Worker error: {}", res.text().await.unwrap_or_default()));
    }
    let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    Ok(data["insights"].as_str().unwrap_or("").to_string())
}

// ── Visit model ───────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Visit {
    id:            String,
    patient_ptnum: Option<String>,
    transcript:    String,
    note:          String,
    template_name: Option<String>,
    language:      Option<String>,
    audio_path:    Option<String>,
    status:        String,
    created_at:    String,
    updated_at:    String,
}

impl Visit {
    fn from_json(v: &serde_json::Value) -> Option<Visit> {
        Some(Visit {
            id:            v["id"].as_str()?.to_string(),
            patient_ptnum: v["patient_ptnum"].as_str().map(String::from),
            transcript:    v["transcript"].as_str().unwrap_or("").to_string(),
            note:          v["note"].as_str().unwrap_or("").to_string(),
            template_name: v["template_name"].as_str().map(String::from),
            language:      v["language"].as_str().map(String::from),
            audio_path:    v["audio_path"].as_str().map(String::from),
            status:        v["status"].as_str().unwrap_or("complete").to_string(),
            created_at:    v["created_at"].as_str().unwrap_or("").to_string(),
            updated_at:    v["updated_at"].as_str().unwrap_or("").to_string(),
        })
    }
}

// ── Recording temp-file commands ──────────────────────────────────────────────

/// Write base64 audio to a unique temp file; return its path string.
#[tauri::command]
fn save_recording(app: tauri::AppHandle, audio_b64: String, mime_type: String) -> Result<String, String> {
    let ext = if mime_type.contains("webm") { "webm" }
              else if mime_type.contains("wav") { "wav" }
              else { "webm" };
    let path = recordings_dir(&app)?.join(format!("{}.{}", uuid::Uuid::new_v4(), ext));
    let bytes = base64_decode(&audio_b64)?;
    fs::write(&path, bytes).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

/// Delete a temp recording file.
#[tauri::command]
fn delete_recording(file_path: String) -> Result<(), String> {
    let p = std::path::Path::new(&file_path);
    if p.exists() { fs::remove_file(p).map_err(|e| e.to_string())?; }
    Ok(())
}

fn base64_decode(s: &str) -> Result<Vec<u8>, String> {
    use base64::{Engine, engine::general_purpose::STANDARD};
    // Strip data-URL prefix if present
    let b64 = if let Some(idx) = s.find(',') { &s[idx+1..] } else { s };
    let b64_clean: String = b64.chars().filter(|c| !c.is_whitespace()).collect();
    STANDARD.decode(&b64_clean).map_err(|e| e.to_string())
}

// ── Visit CRUD commands (proxied through Worker) ──────────────────────────────

#[tauri::command]
async fn save_visit(
    visit_id:     Option<String>,
    patient_ptnum: Option<String>,
    transcript:   String,
    note:         String,
    template_name: Option<String>,
    language:     Option<String>,
    audio_path:   Option<String>,
    status:       String,
) -> Result<Visit, String> {
    let mut body = json!({
        "transcript": transcript,
        "note":       note,
        "language":   language.as_deref().unwrap_or("en"),
        "status":     status,
    });
    if let Some(id) = &visit_id { body["id"] = json!(id); }
    if let Some(ptnum) = &patient_ptnum { body["patient_ptnum"] = json!(ptnum); }
    if let Some(tn) = &template_name { body["template_name"] = json!(tn); }
    if let Some(ap) = &audio_path { body["audio_path"] = json!(ap); }

    let data = post_worker_with_retry(&format!("{}/api/visits", WORKER_URL), body).await?;
    Visit::from_json(&data).ok_or_else(|| "Invalid visit response".to_string())
}

#[tauri::command]
async fn update_visit(visit_id: String, fields: serde_json::Value) -> Result<Visit, String> {
    let client = reqwest::Client::new();
    let res = client
        .patch(format!("{}/api/visits/{}", WORKER_URL, visit_id))
        .json(&fields)
        .send().await.map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("Worker error: {}", res.text().await.unwrap_or_default()));
    }
    let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    Visit::from_json(&data).ok_or_else(|| "Invalid visit response".to_string())
}

#[tauri::command]
async fn load_visits(patient_ptnum: String) -> Result<Vec<Visit>, String> {
    let client = reqwest::Client::new();
    let res = client
        .get(format!("{}/api/visits?ptnum={}", WORKER_URL, patient_ptnum))
        .send().await.map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("Worker error: {}", res.text().await.unwrap_or_default()));
    }
    let data: Vec<serde_json::Value> = res.json().await.map_err(|e| e.to_string())?;
    Ok(data.iter().filter_map(Visit::from_json).collect())
}

#[tauri::command]
async fn load_unassigned_visits() -> Result<Vec<Visit>, String> {
    let client = reqwest::Client::new();
    let res = client
        .get(format!("{}/api/visits?unassigned=true", WORKER_URL))
        .send().await.map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("Worker error: {}", res.text().await.unwrap_or_default()));
    }
    let data: Vec<serde_json::Value> = res.json().await.map_err(|e| e.to_string())?;
    Ok(data.iter().filter_map(Visit::from_json).collect())
}

#[tauri::command]
async fn upload_visit_audio(visit_id: String, audio_b64: String, mime_type: String) -> Result<String, String> {
    let data = post_worker_with_retry(
        &format!("{}/api/visit-audio", WORKER_URL),
        json!({ "audioB64": audio_b64, "mimeType": mime_type, "visitId": visit_id }),
    ).await?;
    data["path"].as_str().map(String::from)
        .ok_or_else(|| "No path in audio upload response".to_string())
}

#[tauri::command]
async fn get_visit_audio_url(path: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    let encoded = urlencoding::encode(&path);
    let res = client
        .get(format!("{}/api/visit-audio-url?path={}", WORKER_URL, encoded))
        .send().await.map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("Worker error: {}", res.text().await.unwrap_or_default()));
    }
    let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    data["url"].as_str().map(String::from)
        .ok_or_else(|| "No url in audio URL response".to_string())
}

// ── Push note to EHR (proxied via Worker → Epic FHIR) ────────────────────────

#[tauri::command]
async fn push_note_to_ehr(
    note_text:    String,
    patient_id:   String,
    patient_name: Option<String>,
    template_name: Option<String>,
) -> Result<serde_json::Value, String> {
    let mut body = json!({
        "noteText":  note_text,
        "patientId": patient_id,
        "date":      chrono::Utc::now().to_rfc3339(),
    });
    if let Some(n) = patient_name   { body["patientName"]  = json!(n); }
    if let Some(t) = template_name  { body["templateName"] = json!(t); }

    let client = reqwest::Client::new();
    let res = client
        .post(format!("{}/api/push-note-to-ehr", WORKER_URL))
        .json(&body)
        .send().await.map_err(|e| e.to_string())?;

    let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    if data.get("error").is_some() {
        return Err(data["error"].as_str().unwrap_or("EHR push failed").to_string());
    }
    Ok(data)
}

// ── App entry ─────────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            query_patients,
            get_patient_summary,
            save_patient_summary,
            transcribe_audio,
            save_note,
            load_notes,
            summarize_transcript,
            chat_with_patient_context,
            generate_cohort_insights,
            save_recording,
            delete_recording,
            save_visit,
            update_visit,
            load_visits,
            load_unassigned_visits,
            upload_visit_audio,
            get_visit_audio_url,
            push_note_to_ehr,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
