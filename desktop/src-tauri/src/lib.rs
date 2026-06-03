use base64::{engine::general_purpose, Engine as _};
use reqwest::multipart;
use serde::{Deserialize, Serialize};
use std::fs;
use tauri::Manager;

// ── Credentials live in the Rust binary, not the JS bundle ──
const SUPABASE_URL: &str = "https://ujqrxhhshxgqqjkblorh.supabase.co";
const SUPABASE_KEY: &str = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqcXJ4aGhzaHhncXFqa2Jsb3JoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDU3NjAsImV4cCI6MjA5NTM4MTc2MH0.t4CgUYE5oPLhocC2YtRF-WW6tMWu2Cvd0mYB_A1jWhk";
const TABLE: &str = "synthea_pt30k_lc_data_sel_convert";
const COLS: &str = r#"ptnum,label,scc,"C-424144002","C-263495000","C-103579009","C-8480-6","C-8462-4","C-8867-4","C-39156-5","C-72166-2","C-2093-3","C-18262-6","C-2085-9","C-4548-4","C-2345-7","C-2571-8","C-186034007","C-125680007","C-398070004","C-72514-3""#;

// ── Helpers ──
fn data_dir(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

// ── Commands ──

/// Query live patient data from Supabase. Returns raw JSON rows;
/// the frontend normalises column codes into field names.
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
        "control" => params.push(("label", "eq.0".to_string())),
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

/// Send audio to OpenAI Whisper for transcription.
/// Audio is passed as base64 so it stays within the Tauri IPC channel.
#[tauri::command]
async fn transcribe_audio(
    audio_b64: String,
    mime_type: String,
    patient_id: String,
    api_key: String,
) -> Result<String, String> {
    let bytes = general_purpose::STANDARD
        .decode(&audio_b64)
        .map_err(|e| format!("base64 decode: {}", e))?;

    let ext = if mime_type.contains("webm") { "webm" } else { "wav" };
    let file_part = multipart::Part::bytes(bytes)
        .file_name(format!("recording.{}", ext))
        .mime_str(&mime_type)
        .map_err(|e| e.to_string())?;

    let form = multipart::Form::new()
        .part("file", file_part)
        .text("model", "whisper-1")
        .text("prompt", format!("Patient ID: {}. Medical consultation.", patient_id));

    let res = reqwest::Client::new()
        .post("https://api.openai.com/v1/audio/transcriptions")
        .header("Authorization", format!("Bearer {}", api_key))
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
    id: String,
    patient_id: String,
    transcript: String,
    notes: String,
    created_at: String,
}

/// Persist a visit note to the app data directory.
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

/// Read the OpenAI API key from the app config file.
#[tauri::command]
fn get_api_key(app: tauri::AppHandle) -> Result<String, String> {
    let path = data_dir(&app)?.join("config.json");
    if !path.exists() {
        return Ok(String::new());
    }
    let v: serde_json::Value =
        serde_json::from_str(&fs::read_to_string(&path).map_err(|e| e.to_string())?)
            .unwrap_or_default();
    Ok(v["openai_key"].as_str().unwrap_or("").to_string())
}

/// Write the OpenAI API key to the app config file.
#[tauri::command]
fn set_api_key(app: tauri::AppHandle, key: String) -> Result<(), String> {
    let path = data_dir(&app)?.join("config.json");
    fs::write(
        &path,
        serde_json::to_string(&serde_json::json!({ "openai_key": key })).unwrap(),
    )
    .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            query_patients,
            transcribe_audio,
            save_note,
            load_notes,
            get_api_key,
            set_api_key,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
