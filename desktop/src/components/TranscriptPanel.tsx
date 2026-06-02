import { useState, useEffect } from 'react'
import type { SavedNote } from '../lib/supabase'

interface Props {
  patientId: string | null
  transcript: string
  onClear: () => void
}

function loadNotes(patientId: string): SavedNote[] {
  try {
    const raw = localStorage.getItem(`notes_${patientId}`)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveNote(note: SavedNote) {
  const notes = loadNotes(note.patientId)
  notes.unshift(note)
  localStorage.setItem(`notes_${note.patientId}`, JSON.stringify(notes.slice(0, 50)))
}

export default function TranscriptPanel({ patientId, transcript, onClear }: Props) {
  const [editedTranscript, setEditedTranscript] = useState('')
  const [notes, setNotes]       = useState('')
  const [saved, setSaved]       = useState(false)
  const [history, setHistory]   = useState<SavedNote[]>([])
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    if (transcript) {
      setEditedTranscript(transcript)
      setSaved(false)
    }
  }, [transcript])

  useEffect(() => {
    if (patientId) setHistory(loadNotes(patientId))
  }, [patientId])

  function handleSave() {
    if (!patientId || !editedTranscript.trim()) return
    const note: SavedNote = {
      id:         crypto.randomUUID(),
      patientId,
      transcript: editedTranscript,
      notes,
      createdAt:  new Date().toISOString(),
    }
    saveNote(note)
    setHistory(loadNotes(patientId))
    setSaved(true)
    setNotes('')
  }

  function handleClear() {
    setEditedTranscript('')
    setNotes('')
    setSaved(false)
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
                <div className="history-meta">
                  {new Date(n.createdAt).toLocaleString()}
                </div>
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
                <div className="transcript-label" style={{ marginTop: 12 }}>Additional Notes</div>
                <textarea
                  className="transcript-notes"
                  placeholder="Add clinical notes, observations, or follow-up actions…"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                />
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
