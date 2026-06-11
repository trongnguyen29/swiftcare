import type React from 'react'
import { useState, useRef, useEffect, useMemo } from 'react'
import PatientSearch from './components/PatientSearch'
import PatientSummary from './components/PatientSummary'
import PatientCharts from './components/PatientCharts'
import PatientBanner from './components/PatientBanner'
import { AIChat } from './components/AIInsights'
import VoiceRecorder from './components/VoiceRecorder'
import TranscriptPanel from './components/TranscriptPanel'
import type { Patient } from './lib/supabase'
import './App.css'

type PatientTab = 'overview' | 'chart' | 'visit'

export default function App() {
  const [selected,   setSelected]   = useState<Patient | null>(null)
  const [transcript, setTranscript] = useState('')
  const [activeTab,  setActiveTab]  = useState<PatientTab>('overview')
  const [appFont, setAppFont]       = useState("'DM Sans', system-ui, sans-serif")
  const [fontScale, setFontScale]   = useState("1")
  const [showSettings, setShowSettings] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [recordSignal, setRecordSignal] = useState(0)
  const overviewCache = useRef<Map<string, string>>(new Map())
  const scrollRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})

  useEffect(() => {
    document.documentElement.style.setProperty('--font', appFont)
    // Use zoom to cleanly scale the entire UI in WebKit
    // @ts-ignore - zoom is non-standard but works perfectly in Tauri/Webkit
    document.body.style.zoom = fontScale
    // Expose the zoom so the shell can shrink its 100vh height to compensate —
    // otherwise zoom > 1 pushes the bottom of the scroll area off-screen.
    document.documentElement.style.setProperty('--zoom', fontScale)
  }, [appFont, fontScale])

  function selectPatient(p: Patient) {
    setSelected(p)
    setTranscript('')
    setActiveTab('overview')
    setShowChat(false)
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }

  const TABS: { id: PatientTab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: '⊡' },
    { id: 'chart',    label: 'Chart',    icon: '▦' },
    { id: 'visit',    label: 'Visit',    icon: '◉' },
  ]

  // Scrollspy: the active section is the last one whose top has scrolled past a
  // line ~30% down the viewport. Reading real positions each frame avoids the
  // IntersectionObserver "only changed entries" flicker.
  useEffect(() => {
    const root = scrollRef.current
    if (!root || !selected) return
    let raf = 0
    const update = () => {
      raf = 0
      const atBottom = root.scrollTop + root.clientHeight >= root.scrollHeight - 2
      let current: PatientTab = TABS[0].id
      if (atBottom) {
        current = TABS[TABS.length - 1].id  // bottom always activates the last section
      } else {
        // Active = the section that straddles a line ~30% down the viewport.
        // Spanning (top <= line < bottom) picks exactly one, so it never
        // flickers between two sections at a boundary.
        const line = root.getBoundingClientRect().top + root.clientHeight * 0.3
        for (const t of TABS) {
          const el = sectionRefs.current[t.id]
          if (!el) continue
          const r = el.getBoundingClientRect()
          if (r.top <= line && r.bottom > line) { current = t.id; break }
          if (r.top <= line) current = t.id  // fallback for gaps between sections
        }
      }
      setActiveTab(prev => (prev === current ? prev : current))
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update) }
    root.addEventListener('scroll', onScroll, { passive: true })
    update() // set initial state for the freshly selected patient
    return () => { root.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  function goToSection(id: PatientTab) {
    setActiveTab(id)
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function onTabKey(e: React.KeyboardEvent, idx: number) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const next = e.key === 'ArrowRight' ? (idx + 1) % TABS.length : (idx - 1 + TABS.length) % TABS.length
    goToSection(TABS[next].id)
  }

  // The scrolling sections don't depend on activeTab, so memoize them: a
  // scroll-driven highlight change won't re-render the heavy section content.
  const sections = useMemo(() => {
    if (!selected) return null
    return (
      <div className="pt-sections" ref={scrollRef}>
        <section className="pt-section" data-section="overview" ref={el => { sectionRefs.current.overview = el }}>
          <PatientSummary
            patient={selected}
            section="overview"
            cachedOverview={overviewCache.current.get(selected.ptnum)}
            onOverviewGenerated={text => overviewCache.current.set(selected.ptnum, text)}
          />
        </section>

        <section className="pt-section" data-section="chart" ref={el => { sectionRefs.current.chart = el }}>
          <div className="pt-section-label">Charts</div>
          <PatientCharts patient={selected} />
          <PatientSummary patient={selected} section="chart" />
        </section>

        <section className="pt-section" data-section="visit" ref={el => { sectionRefs.current.visit = el }}>
          <div className="pt-section-label">Visit</div>
          <VoiceRecorder patientId={selected.ptnum} onTranscript={setTranscript} startSignal={recordSignal} />
          <TranscriptPanel patient={selected} transcript={transcript} onClear={() => setTranscript('')} />
        </section>
      </div>
    )
  }, [selected, transcript, recordSignal])

  return (
    <div className="app-shell">
      <header className="ehr-header" data-tauri-drag-region>
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
        <button
          className="settings-btn"
          onClick={() => setShowSettings(!showSettings)}
        >
          {showSettings ? 'Close Settings' : 'Settings'}
        </button>
      </header>

      {showSettings && (
        <div className="settings-bar">
          <span className="settings-label">App Font:</span>
          <select
            className="settings-input"
            value={appFont}
            onChange={e => setAppFont(e.target.value)}
          >
            <option value="'DM Sans', system-ui, sans-serif">DM Sans (Default)</option>
            <option value="'Inter', system-ui, sans-serif">Inter</option>
            <option value="'Roboto', system-ui, sans-serif">Roboto</option>
            <option value="system-ui, sans-serif">System UI</option>
            <option value="ui-serif, Georgia, serif">Serif</option>
            <option value="'DM Mono', monospace">Monospace</option>
          </select>

          <span className="settings-label" style={{ marginLeft: 16 }}>UI Scale:</span>
          <select
            className="settings-input"
            style={{ maxWidth: 100 }}
            value={fontScale}
            onChange={e => setFontScale(e.target.value)}
          >
            <option value="0.85">Small</option>
            <option value="1">Medium</option>
            <option value="1.15">Large</option>
            <option value="1.3">X-Large</option>
          </select>
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
              {/* ── Patient banner (single source of identity) ── */}
              <PatientBanner
                patient={selected}
                onAskAI={() => setShowChat(true)}
                onStartRecording={() => { goToSection('visit'); setRecordSignal(n => n + 1) }}
              />

              {/* ── Section nav (scrollspy) ── */}
              <div className="pt-tabbar" role="tablist" aria-label="Patient sections">
                {TABS.map((t, i) => (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={activeTab === t.id}
                    tabIndex={activeTab === t.id ? 0 : -1}
                    className={`pt-tab ${activeTab === t.id ? 'pt-tab--active' : ''}`}
                    onClick={() => goToSection(t.id)}
                    onKeyDown={e => onTabKey(e, i)}
                  >
                    <span className="pt-tab-icon" aria-hidden>{t.icon}</span>
                    {t.label}
                  </button>
                ))}
              </div>

              {/* ── Continuous scrolling sections (memoized) ── */}
              {sections}
            </>
          )}
        </main>
      </div>

      {/* ── Ask AI chat drawer ── */}
      {selected && showChat && (
        <div className="ai-drawer-overlay" onClick={() => setShowChat(false)}>
          <aside className="ai-drawer" role="dialog" aria-label="Ask AI" onClick={e => e.stopPropagation()}>
            <div className="ai-drawer-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="ai-tag">AI</span>
                <span className="card-title">Ask AI</span>
              </div>
              <button className="btn-ghost-sm" onClick={() => setShowChat(false)}>✕ Close</button>
            </div>
            <AIChat key={selected.ptnum} patient={selected} />
          </aside>
        </div>
      )}
    </div>
  )
}
