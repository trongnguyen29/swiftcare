use serde::{Deserialize, Serialize};
use std::fs;
use tauri::Manager;

// ── Supabase (Synthea patients, anon key) ──
const SUPABASE_URL: &str = "https://ujqrxhhshxgqqjkblorh.supabase.co";
const SUPABASE_KEY: &str = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqcXJ4aGhzaHhncXFqa2Jsb3JoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDU3NjAsImV4cCI6MjA5NTM4MTc2MH0.t4CgUYE5oPLhocC2YtRF-WW6tMWu2Cvd0mYB_A1jWhk";
const TABLE: &str = "synthea_pt30k_lc_data_sel_convert";
const COLS: &str = r#"ptnum,label,scc,"C-424144002","C-263495000","C-103579009","C-8480-6","C-8462-4","C-8867-4","C-39156-5","C-72166-2","C-2093-3","C-18262-6","C-2085-9","C-4548-4","C-2345-7","C-2571-8","C-186034007","C-125680007","C-398070004","C-72514-3""#;

// ── Worker URL — baked in at compile time, not a secret ──
// For production builds: WORKER_URL=https://swiftcare.workers.dev npm run tauri build
// Defaults to local wrangler dev server; no env var needed for development.
const WORKER_URL: &str = match option_env!("WORKER_URL") {
    Some(url) => url,
    None => "http://localhost:8787",
};

/// POST JSON to a Worker AI endpoint and return the `text` field from the response.
async fn worker_post(path: &str, body: serde_json::Value) -> Result<String, String> {
    let url = format!("{}{}", WORKER_URL, path);
    let res = reqwest::Client::new()
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Worker request failed: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("Worker error ({}): {}", res.status(), res.text().await.unwrap_or_default()));
    }
    let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    Ok(data["text"].as_str().unwrap_or("").to_string())
}

// ── Helpers ──
fn data_dir(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

// ── Commands ──

/// Query Synthea patient data from Supabase.
#[tauri::command]
async fn query_patients(query: String, filter: String) -> Result<Vec<serde_json::Value>, String> {
    let mut params: Vec<(&str, String)> = vec![
        ("select", COLS.to_string()),
        ("order", "scc.desc".to_string()),
        ("limit", "50".to_string()),
    ];
    if !query.trim().is_empty() {
        params.push(("ptnum", format!("ilike.*{}*", query.trim())));
    }
    match filter.as_str() {
        "positive" => params.push(("label", "eq.1".to_string())),
        "control"  => params.push(("label", "eq.0".to_string())),
        _          => {}
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

/// Send audio to OpenAI Whisper via the Worker (key stays in Worker).
/// Audio is passed as base64 from the frontend over Tauri IPC.
#[tauri::command]
async fn transcribe_audio(
    audio_b64: String,
    mime_type: String,
    patient_id: String,
) -> Result<String, String> {
    worker_post("/api/ai/transcribe", serde_json::json!({
        "audio_b64": audio_b64,
        "mime_type": mime_type,
        "patient_id": patient_id
    })).await
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SavedNote {
    id: String,
    patient_id: String,
    transcript: String,
    notes: String,
    created_at: String,
}

/// Persist a visit note to the app data directory (local filesystem).
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
    list.insert(
        0,
        SavedNote {
            id: id.clone(),
            patient_id,
            transcript,
            notes,
            created_at: chrono::Utc::now().to_rfc3339(),
        },
    );
    list.truncate(50);
    fs::write(&path, serde_json::to_string(&list).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    Ok(id)
}

/// Load saved notes for a patient from the app data directory.
#[tauri::command]
fn load_notes(app: tauri::AppHandle, patient_id: String) -> Result<Vec<SavedNote>, String> {
    let path = data_dir(&app)?.join(format!("notes_{}.json", patient_id));
    if !path.exists() {
        return Ok(vec![]);
    }
    serde_json::from_str(&fs::read_to_string(&path).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())
}

/// Generate a SOAP clinical note via the Worker → OpenAI.
#[tauri::command]
async fn summarize_transcript(
    transcript: String,
    patient_context: String,
) -> Result<String, String> {
    worker_post("/api/ai/soap", serde_json::json!({
        "transcript": transcript,
        "patient_context": patient_context
    })).await
}

/// Clinical decision-support chat via the Worker → OpenAI.
/// `messages` is a JSON array of {role, content} objects.
#[tauri::command]
async fn chat_with_patient_context(
    messages: serde_json::Value,
    patient_context: String,
) -> Result<String, String> {
    worker_post("/api/ai/patient-chat", serde_json::json!({
        "messages": messages,
        "patient_context": patient_context
    })).await
}

/// Generate cohort AI insights via the Worker → OpenAI.
/// `stats_json` is a JSON string of cohort statistics from the frontend.
#[tauri::command]
async fn generate_cohort_insights(stats_json: String) -> Result<String, String> {
    let stats: serde_json::Value =
        serde_json::from_str(&stats_json).map_err(|e| format!("Invalid stats JSON: {}", e))?;
    worker_post("/api/ai/cohort", stats).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_deep_link::init())
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
