use base64::{engine::general_purpose, Engine as _};
use reqwest::multipart;
use serde::{Deserialize, Serialize};
use std::fs;
use tauri::Manager;

// ── Credentials live in the Rust binary, not the JS bundle ──
const SUPABASE_URL:     &str = "https://ujqrxhhshxgqqjkblorh.supabase.co";
const SUPABASE_KEY:     &str = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqcXJ4aGhzaHhncXFqa2Jsb3JoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDU3NjAsImV4cCI6MjA5NTM4MTc2MH0.t4CgUYE5oPLhocC2YtRF-WW6tMWu2Cvd0mYB_A1jWhk";
const OPENAI_API_KEY: &str = env!("OPENAI_API_KEY");
const OPENAI_MODEL:   &str = "gpt-4o-mini"; // swap to hospital endpoint/model here
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
) -> Result<String, String> {
    let bytes = general_purpose::STANDARD
        .decode(&audio_b64)
        .map_err(|e| format!("base64 decode: {}", e))?;

    let ext = if mime_type.contains("webm") { "webm" }
              else if mime_type.contains("mp4") || mime_type.contains("m4a") { "mp4" }
              else if mime_type.contains("ogg") { "ogg" }
              else { "wav" };
    let file_part = multipart::Part::bytes(bytes)
        .file_name(format!("recording.{}", ext))
        .mime_str(&mime_type)
        .map_err(|e| e.to_string())?;

    let form = multipart::Form::new()
        .part("file", file_part)
        .text("model", "whisper-1")
        .text("prompt", format!(
            "Clinical encounter for patient {}. This recording contains medical terminology: diagnoses, medications, dosages, vital signs, lab values, and anatomical terms. Expected vocabulary includes: lung cancer, SCC score, hypertension, HbA1c, systolic, diastolic, metformin, atorvastatin, lisinopril, COPD, spirometry, oncology, chemotherapy, imaging, CT scan, PET scan, biopsy, staging, remission.",
            patient_id
        ));

    let res = reqwest::Client::new()
        .post("https://api.openai.com/v1/audio/transcriptions")
        .header("Authorization", format!("Bearer {}", OPENAI_API_KEY))
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


/// Generate a SOAP clinical note from a visit transcript using an LLM.
#[tauri::command]
async fn summarize_transcript(
    transcript: String,
    patient_context: String,
) -> Result<String, String> {
    let system = "\
You are a board-certified clinical documentation specialist generating SOAP progress notes from physician visit transcripts for an EHR system.

ABSOLUTE RULES:
- Document ONLY what is explicitly stated or clearly implied in the transcript
- OBJECTIVE section: include only vitals/exam findings mentioned in the visit — do not copy the entire patient record
- Never fabricate symptoms, diagnoses, medications, or examination findings
- If the transcript is unclear, too brief, or does not represent a clinical encounter, state this clearly before the note
- Use hedged diagnostic language: \"consistent with,\" \"suggestive of,\" \"rule out\" — never definitive diagnoses
- End every note with the required physician attestation line

OUTPUT FORMAT — use these exact bold headers with a blank line between sections:

**SUBJECTIVE**
Chief complaint in the patient's own words. HPI covering: onset, duration, severity, character, associated symptoms, aggravating/relieving factors, pertinent negatives mentioned in the visit.

**OBJECTIVE**
Vitals and physical examination findings discussed during the visit. Reference patient record data only if it was explicitly reviewed or mentioned.

**ASSESSMENT**
Clinical impression. Lead with the primary concern. Address oncology status explicitly for LC+ patients. Use hedged diagnostic language throughout.

**PLAN**
Numbered list of all treatments, medication changes, referrals, orders, patient education, and follow-up timing discussed.

---
⚠ AI-GENERATED DRAFT — Requires physician review, editing, and attestation before filing.";

    let user_prompt = format!(
        "PATIENT RECORD (use only what was discussed in the visit):\n{}\n\nVISIT TRANSCRIPT:\n{}",
        patient_context, transcript
    );

    let res = reqwest::Client::new()
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", OPENAI_API_KEY))
        .json(&serde_json::json!({
            "model": OPENAI_MODEL,
            "max_tokens": 1000,
            "messages": [
                { "role": "system", "content": system },
                { "role": "user",   "content": user_prompt }
            ]
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("OpenAI API error: {}", res.text().await.unwrap_or_default()));
    }
    let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    Ok(data["choices"][0]["message"]["content"].as_str().unwrap_or("").to_string())
}

/// Chat with an LLM using the full patient record as context.
/// `messages` is a JSON array of {role, content} objects (user/assistant turns only).
#[tauri::command]
async fn chat_with_patient_context(
    messages: serde_json::Value,
    patient_context: String,
) -> Result<String, String> {
    let system = format!(
        "You are a clinical decision support AI embedded at the point of care in SwiftCare EHR. You assist physicians with evidence-based clinical reasoning during patient encounters.\n\nPATIENT RECORD:\n{}\n\nCORE CAPABILITIES:\n• Differential diagnosis support with likelihood ranking\n• Drug interaction and contraindication checking against this patient's active medications\n• Care gap identification based on age, diagnoses, risk factors, and guidelines\n• Lab and vital sign interpretation in this patient's specific clinical context\n• Evidence-based guideline retrieval (ACC/AHA, NCCN, ADA, USPSTF, and others)\n• Treatment option comparison with patient-specific contraindications flagged\n\nRESPONSE RULES:\n1. Frame every response as decision support — the clinician makes the final call\n2. Always cite this patient's specific values when relevant (e.g., \"given this patient's eGFR of X...\")\n3. Use hedged diagnostic language: \"consider,\" \"may suggest,\" \"consistent with,\" \"rule out\"\n4. For LC+ patients, integrate oncology context into every recommendation\n5. Lead with the most important point — clinicians are time-constrained\n6. Use bullet points for lists; prose for explanations\n7. PROACTIVE SAFETY: If you identify a critical issue not asked about — dangerous drug interaction, critical lab value, urgent vital sign — append it at the end under: \"⚠ Unsolicited Flag:\"\n8. If a question falls outside clinical scope, redirect to what the patient record can inform",
        patient_context
    );

    let mut msgs = match messages {
        serde_json::Value::Array(arr) => arr,
        _ => return Err("messages must be a JSON array".to_string()),
    };
    msgs.insert(0, serde_json::json!({ "role": "system", "content": system }));

    let res = reqwest::Client::new()
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", OPENAI_API_KEY))
        .json(&serde_json::json!({
            "model": OPENAI_MODEL,
            "max_tokens": 1000,
            "messages": msgs
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("OpenAI API error: {}", res.text().await.unwrap_or_default()));
    }
    let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    Ok(data["choices"][0]["message"]["content"].as_str().unwrap_or("").to_string())
}

/// Call the Anthropic Claude API to generate AI insights for a patient cohort.
/// `stats_json` is a JSON string of cohort statistics computed on the frontend.
#[tauri::command]
async fn generate_cohort_insights(stats_json: String) -> Result<String, String> {
    let stats: serde_json::Value =
        serde_json::from_str(&stats_json).map_err(|e| format!("Invalid stats JSON: {}", e))?;

    let total   = stats["total"].as_u64().unwrap_or(0);
    let pos     = stats["pos"].as_u64().unwrap_or(0);
    let neg     = stats["neg"].as_u64().unwrap_or(0);
    let avg_age = stats["avgAge"].as_f64().unwrap_or(0.0);
    let avg_bmi = stats["avgBmi"].as_f64().unwrap_or(0.0);
    let avg_scc = stats["avgScc"].as_f64().unwrap_or(0.0);
    let prevalence = if total > 0 { (pos as f64 / total as f64 * 100.0) } else { 0.0 };

    let sys_bp  = stats["vitals"]["avg_systolic"].as_f64().unwrap_or(0.0);
    let dia_bp  = stats["vitals"]["avg_diastolic"].as_f64().unwrap_or(0.0);
    let chol    = stats["vitals"]["avg_chol"].as_f64().unwrap_or(0.0);
    let hba1c   = stats["vitals"]["avg_hba1c"].as_f64().unwrap_or(0.0);

    let system_msg = "You are a clinical epidemiologist and population health expert reviewing a synthetic lung cancer research cohort. Your analysis is read by clinical researchers and hospital administrators who make screening and resource allocation decisions.\n\nProduce insights that are analytical, not merely descriptive. Every insight must lead with clinical or public health significance — not a raw statistic. Distinguish what the data shows from what it implies clinically. Flag anything unexpected or counter-intuitive.";

    let prompt = format!(
        "Analyze this lung cancer research cohort. Produce exactly 5 numbered insights (1–5), each 2–3 sentences.\n\nRequired topics — one insight each:\n1. Disease burden: what a {:.1}% LC prevalence ({} positive / {} total) means for this population\n2. Tobacco risk stratification: interpret the differential LC rates between former and never smokers, and what it means for screening\n3. Age distribution and screening implications given the cohort's mean age of {:.1} years\n4. Cardiovascular/metabolic comorbidity profile: interpret BP ({:.0}/{:.0} mmHg), cholesterol ({:.0} mg/dL), HbA1c ({:.1}%), and BMI ({:.1}) in an oncology population\n5. One specific, evidence-grounded population health or screening protocol recommendation derived from the data patterns\n\nCOHORT SUMMARY:\n- Total: {} patients | LC Positive: {} ({:.1}%) | Control: {}\n- Mean age {:.1}y | Mean BMI {:.1} | Mean SCC score {:.1}\n- Avg vitals: SBP {:.0} | DBP {:.0} | Chol {:.0} mg/dL | HbA1c {:.1}%",
        prevalence, pos, total,
        avg_age,
        sys_bp, dia_bp, chol, hba1c, avg_bmi,
        total, pos, prevalence, neg,
        avg_age, avg_bmi, avg_scc,
        sys_bp, dia_bp, chol, hba1c
    );

    let res = reqwest::Client::new()
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", OPENAI_API_KEY))
        .json(&serde_json::json!({
            "model": OPENAI_MODEL,
            "max_tokens": 1000,
            "messages": [
                { "role": "system", "content": system_msg },
                { "role": "user",   "content": prompt }
            ]
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("OpenAI API error: {}", res.text().await.unwrap_or_default()));
    }

    let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    Ok(data["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .to_string())
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
            generate_cohort_insights,
            summarize_transcript,
            chat_with_patient_context,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
