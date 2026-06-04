import { useState, useEffect } from 'react'
import { saveNote as apiSaveNote, loadNotes as apiLoadNotes, summarizeTranscript } from '../lib/api'
import { buildPatientContext } from '../lib/patientContext'
import type { SavedNote, Patient } from '../lib/supabase'

interface Props {
  patient: Patient | null
  transcript: string
  onClear: () => void
}

export default function TranscriptPanel({ patient, transcript, onClear }: Props) {
  const [editedTranscript, setEditedTranscript] = useState('')
  const [notes,            setNotes]            = useState('')
  const [saved,            setSaved]            = useState(false)
  const [history,          setHistory]          = useState<SavedNote[]>([])
  const [showHistory,      setShowHistory]      = useState(false)
  const [noteLoading,      setNoteLoading]      = useState(false)
  const [noteError,        setNoteError]        = useState<string | null>(null)

  const patientId = patient?.ptnum ?? null

  useEffect(() => {
    if (transcript) {
      setEditedTranscript(transcript)
      setSaved(false)
      setNotes('')
      setNoteError(null)
    }
  }, [transcript])

  useEffect(() => {
    if (patientId) apiLoadNotes(patientId).then(setHistory).catch(() => {})
  }, [patientId])

  async function handleSave() {
    if (!patientId || !editedTranscript.trim()) return
    await apiSaveNote(patientId, editedTranscript, notes).catch(() => {})
    apiLoadNotes(patientId).then(setHistory).catch(() => {})
    setSaved(true)
    setNotes('')
  }

  async function handleGenerateNote() {
    if (!editedTranscript.trim() || !patient) return
    setNoteLoading(true)
    setNoteError(null)
    try {
      const context = buildPatientContext(patient)
      const note = await summarizeTranscript(editedTranscript, context)
      setNotes(note)
      setSaved(false)
    } catch (e: unknown) {
      setNoteError(e instanceof Error ? e.message : 'Failed to generate note')
    } finally {
      setNoteLoading(false)
    }
  }

  function handleClear() {
    setEditedTranscript('')
    setNotes('')
    setSaved(false)
    setNoteError(null)
    onClear()
  }

  const hasTranscript = editedTranscript.trim().length > 0

  return (
    <div className="card transcript-card">
      <div className="card-header">
        <span className="card-title">Transcript & Notes</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {patientId && (
            <button className="btn-ghost-sm" onClick={() => setShowHistory(!showHistory)}>
              {showHistory ? 'Hide History' : `History (${history.length})`}
            </button>
          )}
          {hasTranscript && !showHistory && (
            <button
              className="btn-ghost-sm"
              onClick={handleGenerateNote}
              disabled={noteLoading || !patient}
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <span style={{ fontSize: 10 }}>✦</span>
              {noteLoading ? 'Generating…' : 'Generate Note'}
            </button>
          )}
          {hasTranscript && !saved && (
            <button className="btn-save" onClick={handleSave}>Save Note</button>
          )}
          {saved && <span className="saved-badge">Saved</span>}
          {hasTranscript && (
            <button className="btn-ghost-sm" onClick={handleClear}>Clear</button>
          )}
        </div>
      </div>

      <div className="transcript-body">
        {showHistory ? (
          <div className="history-list">
            {history.length === 0 && (
              <div className="transcript-empty">No saved notes for this patient.</div>
            )}
            {history.map(n => (
              <div key={n.id} className="history-item">
                <div className="history-meta">{new Date(n.createdAt).toLocaleString()}</div>
                <div className="history-transcript">{n.transcript}</div>
                {n.notes && <div className="history-notes">{n.notes}</div>}
              </div>
            ))}
          </div>
        ) : (
          <>
            {!hasTranscript && (
              <div className="transcript-empty">
                Transcription will appear here after recording stops.
              </div>
            )}
            {hasTranscript && (
              <>
                <div className="transcript-label">Transcription</div>
                <textarea
                  className="transcript-text"
                  value={editedTranscript}
                  onChange={e => { setEditedTranscript(e.target.value); setSaved(false) }}
                  rows={6}
                />

                {noteError && (
                  <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 6 }}>
                    ⚠ {noteError}
                  </div>
                )}

                <div className="transcript-label" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  Clinical Note
                  {notes && (
                    <span style={{ fontSize: 9, background: 'var(--blue-600)', color: '#fff', padding: '1px 5px', borderRadius: 3, fontWeight: 700, letterSpacing: '.3px' }}>
                      AI DRAFT
                    </span>
                  )}
                </div>
                <textarea
                  className="transcript-notes"
                  placeholder={noteLoading ? 'Generating clinical note…' : 'Click ✦ Generate Note to create an AI-drafted SOAP note, or type manually…'}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={notes ? 10 : 3}
                  style={{ opacity: noteLoading ? 0.5 : 1 }}
                />
                {notes && (
                  <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 4 }}>
                    AI-drafted — review and edit before saving. Not a substitute for physician judgment.
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}