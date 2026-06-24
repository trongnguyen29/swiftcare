use serde::{Deserialize, Serialize};
use std::fs;
use tauri::Manager;

// ── Credentials ───────────────────────────────────────────────────────────────
const SUPABASE_URL:   &str = "https://zbnvigxkforwbmphghpg.supabase.co";
const SUPABASE_KEY:   &str = "sb_publishable_U3hegesGlIhrENKOreNbuQ_WIKcYrOL";
// All AI — chat, summaries, and transcription — goes through the Cloudflare
// Worker, which holds the provider keys. No API keys are baked into the binary.
const WORKER_URL:     &str = "https://swiftcare.tnn-040.workers.dev";

const TABLE:         &str = "fhir_patient";
const SUMMARY_TABLE: &str = "patient_ai_summary";
const COLS:          &str = "fhir_id,resource";

// ── Helpers ───────────────────────────────────────────────────────────────────
fn data_dir(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

// ── Commands ──────────────────────────────────────────────────────────────────

#[tauri::command]
async fn query_patients(query: String, filter: String) -> Result<Vec<serde_json::Value>, String> {
    let mut params: Vec<(&str, String)> = vec![
        ("select", COLS.to_string()),
        ("order",  "last_name.asc,first_name.asc".to_string()),
        ("limit",  "150".to_string()),
    ];
    // Search and label filtering are handled in the frontend after parsing FHIR resources
    let _ = query;
    let _ = filter;
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
        ("select",     "ai_summary,ai_summary_hash,ai_summary_at".to_string()),
        ("patient_id", format!("eq.{}", ptnum)),
        ("limit",      "1".to_string()),
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
        "patient_id":      ptnum,
        "ai_summary":      summary,
        "ai_summary_hash": hash,
        "ai_summary_at":   chrono::Utc::now().to_rfc3339(),
    });
    // Upsert: the row may not exist yet, so POST with merge-duplicates on patient_id.
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
    let res = reqwest::Client::new()
        .post(format!("{}/api/transcribe", WORKER_URL))
        .json(&serde_json::json!({
            "audioB64":  audio_b64,
            "mimeType":  mime_type,
            "patientId": patient_id,
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("Worker error: {}", res.text().await.unwrap_or_default()));
    }
    let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
