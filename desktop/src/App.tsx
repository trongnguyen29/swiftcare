import { useState } from 'react'
import PatientSearch from './components/PatientSearch'
import PatientSummary from './components/PatientSummary'
import PatientCharts from './components/PatientCharts'
import AIInsights from './components/AIInsights'
import VoiceRecorder from './components/VoiceRecorder'
import TranscriptPanel from './components/TranscriptPanel'
import type { Patient } from './lib/supabase'
import './App.css'

type PatientTab = 'overview' | 'ai' | 'history' | 'charts' | 'visit'

export default function App() {
  const [selected,     setSelected]     = useState<Patient | null>(null)
  const [transcript,   setTranscript]   = useState('')
  const [apiKey,       setApiKey]       = useState(() => localStorage.getItem('openai_key') || '')
  const [showSettings, setShowSettings] = useState(false)
  const [activeTab,    setActiveTab]    = useState<PatientTab>('overview')

  function handleApiKey(k: string) {
    setApiKey(k)
    localStorage.setItem('openai_key', k)
  }

  function selectPatient(p: Patient) {
    setSelected(p)
    setTranscript('')
    setActiveTab('overview')
  }

  const isLC      = selected?.label === 1
  const name      = selected ? [selected.first_name, selected.last_name].filter(Boolean).join(' ') || selected.ptnum : ''
  const subline   = selected ? [selected.age ? `${selected.age}y` : null, selected.administrative_sex, selected.race].filter(Boolean).join(' · ') : ''

  const TABS: { id: PatientTab; label: string; icon: string }[] = [
    { id: 'overview',  label: 'Overview',    icon: '⊡' },
    { id: 'ai',        label: 'AI Insights', icon: '✦' },
    { id: 'history',   label: 'History',     icon: '📋' },
    { id: 'charts',    label: 'Charts',      icon: '📊' },
    { id: 'visit',     label: 'Visit',       icon: '🎙' },
  ]

  return (
    <div className="app-shell">
      <header className="ehr-header">
        <div className="header-logo">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
            <path d="M6 26 C6 26 4 14 10 9 C16 4 26 5 27 6 C28 7 26 18 20 22 C14 26 6 26 6 26Z" fill="url(#sc-grad)" />
            <path d="M9 23 C9 23 10 15 15 11 C20 7 25 8 25 8" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.5"/>
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
            <span className={`badge ${isLC ? 'badge-danger' : 'badge-ok'}`} style={{ fontSize: 10 }}>
              {isLC ? 'LC+' : 'Ctrl'}
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
        <PatientSearch selected={selected} onSelect={selectPatient} />

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
              {/* ── Patient strip — always visible ── */}
              <div className="pt-strip">
                <div className="pt-strip-avatar">
                  {selected.administrative_sex === 'Male' ? '♂' : selected.administrative_sex === 'Female' ? '♀' : '⊕'}
                </div>
                <div className="pt-strip-info">
                  <div className="pt-strip-name">{name}</div>
                  <div className="pt-strip-sub">{subline}</div>
                </div>
                <div className="pt-strip-badges">
                  <span className={`badge ${isLC ? 'badge-danger' : 'badge-ok'}`}>
                    {isLC ? '⚠ LC+' : '✓ Control'}
                  </span>
                  {selected.scc != null && <span className="badge badge-blue">SCC {selected.scc}</span>}
                  {selected.tobacco_status === 'former' && <span className="badge badge-warn">Former Smoker</span>}
                </div>
                {selected.scc != null && (
                  <div className="pt-strip-scc">
                    <div className="pt-scc-label">SCC</div>
                    <div className="pt-scc-val">{selected.scc}</div>
                  </div>
                )}
              </div>

              {/* ── Tab bar ── */}
              <div className="pt-tabbar">
                {TABS.map(t => (
                  <button
                    key={t.id}
                    className={`pt-tab ${activeTab === t.id ? 'pt-tab--active' : ''}`}
                    onClick={() => setActiveTab(t.id)}
                  >
                    <span className="pt-tab-icon">{t.icon}</span>
                    {t.label}
                    {t.id === 'ai' && <span className="pt-tab-ai-dot" />}
                  </button>
                ))}
              </div>

              {/* ── Tab content ── */}
              <div className="pt-tab-content">
                {activeTab === 'overview' && (
                  <PatientSummary patient={selected} section="overview" />
                )}
                {activeTab === 'ai' && (
                  <AIInsights patient={selected} />
                )}
                {activeTab === 'history' && (
                  <PatientSummary patient={selected} section="history" />
                )}
                {activeTab === 'charts' && (
                  <PatientCharts patient={selected} />
                )}
                {activeTab === 'visit' && (
                  <>
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
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
