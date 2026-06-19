import { useState, useEffect, useRef } from 'react'
import { saveNote as apiSaveNote, loadNotes as apiLoadNotes, summarizeTranscript, pushNoteToEhr } from '../lib/api'
import { buildPatientContext } from '../lib/patientContext'
import { saveVisit } from '../lib/visits'
import Markdown from './Markdown'
import type { SavedNote, Patient } from '../lib/supabase'

interface Props {
  patient: Patient | null
  transcript: string
  onClear: () => void
}

type EhrStatus = 'idle' | 'pushing' | 'success' | 'error'

export default function TranscriptPanel({ patient, transcript, onClear }: Props) {
  const [editedTranscript, setEditedTranscript] = useState('')
  const [notes,            setNotes]            = useState('')
  const [saved,            setSaved]            = useState(false)
  const [history,          setHistory]          = useState<SavedNote[]>([])
  const [showHistory,      setShowHistory]      = useState(false)
  const [showTranscript,   setShowTranscript]   = useState(false)
  const [noteLoading,      setNoteLoading]      = useState(false)
  const [noteError,        setNoteError]        = useState<string | null>(null)
  const [editingNote,      setEditingNote]      = useState(false)
  const [ehrStatus,        setEhrStatus]        = useState<EhrStatus>('idle')
  const [ehrMessage,       setEhrMessage]       = useState<string | null>(null)

  const patientId   = patient?.ptnum ?? null
  const autoGenDone = useRef('')  // tracks the transcript we last auto-generated for

  // Sync transcript in from parent; reset note each new recording
  useEffect(() => {
    if (transcript && transcript !== editedTranscript) {
      setEditedTranscript(transcript)
      setSaved(false)
      setNotes('')
      setNoteError(null)
      setShowTranscript(false)
      setEhrStatus('idle')
      setEhrMessage(null)
      setEditingNote(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript])

  // Auto-generate note when a new transcript arrives
  useEffect(() => {
    if (!transcript || !patient || autoGenDone.current === transcript) return
    autoGenDone.current = transcript
    void autoGenerateNote(transcript)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript, patient])

  useEffect(() => {
    if (patientId) apiLoadNotes(patientId).then(setHistory).catch(() => {})
  }, [patientId])

  async function autoGenerateNote(tx: string) {
    if (!tx.trim() || !patient) return
    setNoteLoading(true)
    setNoteError(null)
    try {
      const context = buildPatientContext(patient)
      const note = await summarizeTranscript(tx, context)
      setNotes(note)
      setSaved(false)
      // Persist the auto-generated note to the visit immediately
      if (patientId) {
        saveVisit({ patientPtnum: patientId, transcript: tx, note, status: 'complete' }).catch(() => {})
      }
    } catch (e: unknown) {
      setNoteError(e instanceof Error ? e.message : 'Failed to generate note')
    } finally {
      setNoteLoading(false)
    }
  }

  async function handleRegenerateNote() {
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

  async function handleSave() {
    if (!patientId || !editedTranscript.trim()) return
    await apiSaveNote(patientId, editedTranscript, notes).catch(() => {})
    apiLoadNotes(patientId).then(setHistory).catch(() => {})
    setSaved(true)
  }

  async function handlePushToEhr() {
    if (!notes.trim() || !patientId) return
    setEhrStatus('pushing')
    setEhrMessage(null)
    try {
      const result = await pushNoteToEhr({
        noteText:    notes,
        patientId,
        patientName: patient ? `${patient.last_name}, ${patient.first_name}` : patientId,
        templateName: 'Clinical Note',
      })
      setEhrStatus('success')
      setEhrMessage(result.resourceId ? `Posted — ID: ${result.resourceId}` : 'Posted to EHR')
    } catch (e: unknown) {
      setEhrStatus('error')
      setEhrMessage(e instanceof Error ? e.message : 'EHR push failed')
    }
  }

  function handleClear() {
    setEditedTranscript(''); setNotes(''); setSaved(false)
    setNoteError(null); setEhrStatus('idle'); setEhrMessage(null)
    autoGenDone.current = ''
    onClear()
  }

  const hasTranscript = editedTranscript.trim().length > 0
  const hasNote       = notes.trim().length > 0

  return (
    <div className="card transcript-card">
      <div className="card-header">
        <span className="card-title">Clinical Note</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {patientId && (
            <button className="btn-ghost-sm" onClick={() => setShowHistory(!showHistory)}>
              {showHistory ? 'Hide History' : `History (${history.length})`}
            </button>
          )}
          {hasTranscript && !showHistory && (
            <button className="btn-ghost-sm" onClick={() => setShowTranscript(s => !s)}>
              {showTranscript ? 'Hide Transcript' : 'Show Transcript'}
            </button>
          )}
          {hasNote && !showHistory && (
            <button
              className="btn-ghost-sm"
              onClick={handleRegenerateNote}
              disabled={noteLoading || !patient}
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <span style={{ fontSize: 10 }}>↺</span>
              {noteLoading ? 'Generating…' : 'Regenerate'}
            </button>
          )}
          {hasTranscript && !saved && !showHistory && (
            <button className="btn-save" onClick={handleSave}>Save</button>
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
                {/* ── Transcript (collapsed by default) ── */}
                {showTranscript && (
                  <div style={{ marginBottom: 14 }}>
                    <div className="transcript-label">Transcript</div>
                    <textarea
                      className="transcript-text"
                      value={editedTranscript}
                      onChange={e => { setEditedTranscript(e.target.value); setSaved(false) }}
                      rows={5}
                    />
                  </div>
                )}

                {/* ── Note (primary content) ── */}
                <div className="transcript-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  Clinical Note
                  {hasNote && (
                    <span style={{ fontSize: 9, background: 'var(--blue-600)', color: '#fff', padding: '1px 5px', borderRadius: 3, fontWeight: 700, letterSpacing: '.3px' }}>
                      AI DRAFT
                    </span>
                  )}
                  {hasNote && !noteLoading && (
                    <button
                      className="btn-ghost-sm"
                      style={{ marginLeft: 'auto' }}
                      onClick={() => setEditingNote(e => !e)}
                    >
                      {editingNote ? '✓ Done' : '✎ Edit'}
                    </button>
                  )}
                </div>

                {noteLoading && (
                  <div style={{ padding: '12px 0', color: 'var(--text-faint)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--teal-500)', borderRadius: 2, animation: 'pulse .8s ease-in-out infinite' }} />
                    Generating clinical note…
                  </div>
                )}

                {noteError && (
                  <div style={{ fontSize: 11, color: 'var(--danger)', marginBottom: 6 }}>⚠ {noteError}</div>
                )}

                {hasNote && !editingNote && !noteLoading ? (
                  <div className="note-rendered"><Markdown text={notes} /></div>
                ) : (
                  <textarea
                    className="transcript-notes"
                    placeholder={noteLoading ? '' : 'AI note will appear here, or type manually…'}
                    value={notes}
                    onChange={e => { setNotes(e.target.value); setSaved(false) }}
                    rows={hasNote ? 12 : 3}
                    style={{ opacity: noteLoading ? 0.4 : 1 }}
                  />
                )}

                {hasNote && (
                  <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 4, marginBottom: 10 }}>
                    AI-drafted — review and edit before filing. Not a substitute for physician judgment.
                  </div>
                )}

                {/* ── Push to EHR ── */}
                {hasNote && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                    <button
                      className="btn-push-ehr"
                      onClick={handlePushToEhr}
                      disabled={ehrStatus === 'pushing' || !hasNote}
                    >
                      {ehrStatus === 'pushing' ? '⏳ Pushing…'
                       : ehrStatus === 'success' ? '✓ Pushed to EHR'
                       : '⇪ Push to EHR'}
                    </button>
                    {ehrMessage && (
                      <span style={{ fontSize: 11, color: ehrStatus === 'error' ? 'var(--danger)' : 'var(--ok)' }}>
                        {ehrMessage}
                      </span>
                    )}
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
