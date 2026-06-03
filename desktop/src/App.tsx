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
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
            {/* Leaf-wing shape */}
            <path d="M6 26 C6 26 4 14 10 9 C16 4 26 5 27 6 C28 7 26 18 20 22 C14 26 6 26 6 26Z" fill="url(#sc-grad)" />
            {/* Inner wing line */}
            <path d="M9 23 C9 23 10 15 15 11 C20 7 25 8 25 8" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.5"/>
            {/* Medical cross */}
            <rect x="10.5" y="14" width="2" height="6" rx="0.8" fill="#ffffff"/>
            <rect x="8" y="16.5" width="7" height="2" rx="0.8" fill="#ffffff"/>
            <defs>
              <linearGradient id="sc-grad" x1="4" y1="26" x2="27" y2="5" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#0d9488"/>
                <stop offset="100%" stopColor="#2dd4bf"/>
              </linearGradient>
            </defs>
          </svg>
          <span style={{ color: 'var(--navy-600)', fontWeight: 700, letterSpacing: '-.3px' }}>SwiftCare</span>
          <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 13 }}>Desktop</span>
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
