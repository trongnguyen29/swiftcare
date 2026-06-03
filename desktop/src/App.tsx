import { useState } from 'react'
import PatientSearch from './components/PatientSearch'
import PatientSummary from './components/PatientSummary'
import PatientCharts from './components/PatientCharts'
import AIInsights from './components/AIInsights'
import VoiceRecorder from './components/VoiceRecorder'
import TranscriptPanel from './components/TranscriptPanel'
import type { Patient } from './lib/supabase'
import './App.css'

export default function App() {
  const [selected,     setSelected]     = useState<Patient | null>(null)
  const [transcript,   setTranscript]   = useState('')
  const [apiKey,       setApiKey]       = useState(() => localStorage.getItem('openai_key') || '')
  const [showSettings, setShowSettings] = useState(false)

  function handleApiKey(k: string) {
    setApiKey(k)
    localStorage.setItem('openai_key', k)
  }

  return (
    <div className="app-shell">
      <header className="ehr-header">
        <div className="header-logo">
          <div className="logo-mark">SC</div>
          SwiftCare Desktop
        </div>
        <div className="header-divider" />
        <span className="header-subtitle">EHR Visit Assistant</span>
        <div className="header-spacer" />
        {selected && (
          <div className="dr-chip" style={{ marginRight: 8 }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{selected.ptnum}</span>
            <span
              className={`badge ${selected.label === 1 ? 'badge-danger' : 'badge-ok'}`}
              style={{ fontSize: 10 }}
            >
              {selected.label === 1 ? 'LC+' : 'Ctrl'}
            </span>
          </div>
        )}
        <button className="settings-btn" onClick={() => setShowSettings(s => !s)}>
          {showSettings ? 'Close' : 'Settings'}
        </button>
      </header>

      {showSettings && (
        <div className="settings-bar">
          <label className="settings-label">OpenAI API Key (Whisper transcription)</label>
          <input
            type="password"
            className="settings-input"
            placeholder="sk-..."
            value={apiKey}
            onChange={e => handleApiKey(e.target.value)}
          />
          <button className="btn-ghost" onClick={() => setShowSettings(false)}>Done</button>
        </div>
      )}

      <div className="body-layout">
        <PatientSearch
          selected={selected}
          onSelect={p => { setSelected(p); setTranscript('') }}
        />

        <main className="main-content">
          {!selected ? (
            <div className="empty-state">
              <div className="empty-icon">SC</div>
              <div className="empty-title">Select a patient</div>
              <div className="empty-sub">
                Choose a patient from the sidebar to view their EHR summary and start recording a visit.
              </div>
            </div>
          ) : (
            <>
              <PatientSummary patient={selected} />
              <AIInsights patient={selected} />
              <PatientCharts patient={selected} />
              <VoiceRecorder
                patientId={selected.ptnum}
                onTranscript={setTranscript}
                apiKey={apiKey}
              />
              <TranscriptPanel
                patientId={selected.ptnum}
                transcript={transcript}
                onClear={() => setTranscript('')}
              />
            </>
          )}
        </main>
      </div>
    </div>
  )
}
