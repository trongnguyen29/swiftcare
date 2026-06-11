import { invoke } from '@tauri-apps/api/core'
import { normalizeRow } from './supabase'
import type { Patient, SavedNote } from './supabase'

export type { Patient, SavedNote }

// ── Live patient data (Rust → Supabase) ──
export async function queryPatients(
  query: string,
  filter: 'all' | 'positive' | 'control',
): Promise<Patient[]> {
  const rows = await invoke<Record<string, unknown>[]>('query_patients', { query, filter })
  return rows.map(normalizeRow)
}

// ── Persisted AI patient summary (Rust → Supabase) ──
export async function getPatientSummary(
  ptnum: string,
): Promise<{ summary: string; hash: string; at: string | null } | null> {
  const row = await invoke<Record<string, unknown> | null>('get_patient_summary', { ptnum })
  if (!row || row['ai_summary'] == null) return null
  return {
    summary: String(row['ai_summary']),
    hash:    String(row['ai_summary_hash'] ?? ''),
    at:      (row['ai_summary_at'] as string) ?? null,
  }
}

export async function savePatientSummary(ptnum: string, summary: string, hash: string): Promise<void> {
  await invoke('save_patient_summary', { ptnum, summary, hash })
}

// ── Voice transcription (Rust → OpenAI Whisper) ──
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export async function transcribeAudio(blob: Blob, patientId: string): Promise<string> {
  const audioB64 = await blobToBase64(blob)
  return invoke<string>('transcribe_audio', {
    audioB64,
    mimeType: blob.type || 'audio/webm',
    patientId,
  })
}

// ── Visit notes (Rust → app data dir JSON) ──
export async function saveNote(
  patientId: string,
  transcript: string,
  notes: string,
): Promise<string> {
  return invoke<string>('save_note', { patientId, transcript, notes })
}

export async function loadNotes(patientId: string): Promise<SavedNote[]> {
  return invoke<SavedNote[]>('load_notes', { patientId })
}

// ── Cohort AI insights (Rust → Anthropic Claude) ──
export async function generateCohortInsights(statsJson: string): Promise<string> {
  return invoke<string>('generate_cohort_insights', { statsJson })
}

// ── Visit transcript → SOAP note (Rust → Claude) ──
export async function summarizeTranscript(
  transcript: string,
  patientContext: string,
): Promise<string> {
  return invoke<string>('summarize_transcript', { transcript, patientContext })
}

// ── Per-patient AI chat (Rust → Claude) ──
export async function chatWithPatientContext(
  messages: { role: string; content: string }[],
  patientContext: string,
): Promise<string> {
  return invoke<string>('chat_with_patient_context', { messages, patientContext })
}
