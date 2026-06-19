import { invoke } from '@tauri-apps/api/core'

export interface Visit {
  id: string
  patient_ptnum: string | null
  transcript: string
  note: string
  template_name: string | null
  language: string | null
  audio_path: string | null
  status: 'processing' | 'complete' | 'failed'
  created_at: string
  updated_at: string
}

// ── Visit CRUD via Rust proxy commands ────────────────────────────────────────

export async function saveVisit(params: {
  id?: string
  patientPtnum?: string | null
  transcript: string
  note: string
  templateName?: string | null
  language?: string
  audioPath?: string | null
  status?: string
}): Promise<Visit> {
  return invoke<Visit>('save_visit', {
    visitId:      params.id ?? null,
    patientPtnum: params.patientPtnum ?? null,
    transcript:   params.transcript,
    note:         params.note,
    templateName: params.templateName ?? null,
    language:     params.language ?? 'en',
    audioPath:    params.audioPath ?? null,
    status:       params.status ?? 'complete',
  })
}

export async function updateVisit(id: string, fields: Partial<Visit>): Promise<Visit> {
  return invoke<Visit>('update_visit', { visitId: id, fields })
}

export async function loadVisits(patientPtnum: string): Promise<Visit[]> {
  return invoke<Visit[]>('load_visits', { patientPtnum })
}

export async function loadUnassignedVisits(): Promise<Visit[]> {
  return invoke<Visit[]>('load_unassigned_visits', {})
}

export async function uploadVisitAudio(params: {
  visitId: string
  audioB64: string
  mimeType: string
}): Promise<string> {
  return invoke<string>('upload_visit_audio', params)
}

export async function getVisitAudioUrl(path: string): Promise<string> {
  return invoke<string>('get_visit_audio_url', { path })
}

// ── Local recording temp files ────────────────────────────────────────────────

export async function saveRecording(params: {
  audioB64: string
  mimeType: string
}): Promise<string> {
  return invoke<string>('save_recording', params)
}

export async function deleteRecording(filePath: string): Promise<void> {
  return invoke<void>('delete_recording', { filePath })
}
