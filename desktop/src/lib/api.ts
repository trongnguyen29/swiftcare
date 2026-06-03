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

// ── Voice transcription (Rust → OpenAI Whisper) ──
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export async function transcribeAudio(
  blob: Blob,
  patientId: string,
  apiKey: string,
): Promise<string> {
  const audioB64 = await blobToBase64(blob)
  return invoke<string>('transcribe_audio', {
    audioB64,
    mimeType: blob.type || 'audio/webm',
    patientId,
    apiKey,
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

// ── API key (Rust → config.json in app data dir) ──
export async function getApiKey(): Promise<string> {
  return invoke<string>('get_api_key')
}

export async function setApiKey(key: string): Promise<void> {
  return invoke('set_api_key', { key })
}
