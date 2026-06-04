use base64::{engine::general_purpose, Engine as _};
use reqwest::multipart;
use serde::{Deserialize, Serialize};
use std::fs;
use tauri::Manager;

// ── Credentials ───────────────────────────────────────────────────────────────
const SUPABASE_URL:   &str = "https://ujqrxhhshxgqqjkblorh.supabase.co";
const SUPABASE_KEY:   &str = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqcXJ4aGhzaHhncXFqa2Jsb3JoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDU3NjAsImV4cCI6MjA5NTM4MTc2MH0.t4CgUYE5oPLhocC2YtRF-WW6tMWu2Cvd0mYB_A1jWhk";
// LLM calls go through the Cloudflare Worker — no key needed in the binary.
// Whisper transcription only uses OPENAI_API_KEY (set in .cargo/config.toml).
const OPENAI_API_KEY: Option<&str> = option_env!("OPENAI_API_KEY");
const WORKER_URL:     &str = "https://swiftcare.tnn-040.workers.dev";

const TABLE: &str = "patient_summary";
const COLS:  &str = "ptnum,label,scc,first_name,last_name,age,administrative_sex,race,ethnicity,state,systolic_bp,diastolic_bp,heart_rate,bmi,total_cholesterol,ldl,hdl,triglycerides,hba1c,glucose,creatinine,egfr,hemoglobin,wbc,platelets,problems";

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
        ("order",  "age.desc".to_string()),
        ("limit",  "50".to_string()),
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

#[tauri::command]
async fn transcribe_audio(
    audio_b64: String,
    mime_type: String,
    patient_id: String,
) -> Result<String, String> {
    let key = OPENAI_API_KEY.unwrap_or("");
    if key.is_empty() {
        return Err("Whisper requires an OpenAI API key. Add OPENAI_API_KEY to desktop/src-tauri/.cargo/config.toml".to_string());
    }
    let bytes = general_purpose::STANDARD
        .decode(&audio_b64)
        .map_err(|e| format!("base64 decode: {}", e))?;

    let ext = if mime_type.contains("webm")                          { "webm" }
              else if mime_type.contains("mp4") || mime_type.contains("m4a") { "mp4"  }
              else if mime_type.contains("ogg")                       { "ogg"  }
              else                                                     { "wav"  };

    let file_part = multipart::Part::bytes(bytes)
        .file_name(format!("recording.{}", ext))
        .mime_str(&mime_type)
        .map_err(|e| e.to_string())?;

    let form = multipart::Form::new()
        .part("file", file_part)
        .text("model", "whisper-1")
        .text("prompt", format!(
            "Clinical encounter for patient {}. Medical terminology: diagnoses, medications, \
             dosages, vital signs, lab values. Terms: lung cancer, SCC score, hypertension, \
             HbA1c, systolic, diastolic, metformin, atorvastatin, COPD, oncology, CT scan.",
            patient_id
        ));

    let res = reqwest::Client::new()
        .post("https://api.openai.com/v1/audio/transcriptions")
        .header("Authorization", format!("Bearer {}", key))
        .multipart(form)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(res.text().await.unwrap_or_default());
    }
    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    Ok(json["text"].as_str().unwrap_or("").to_string())
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
