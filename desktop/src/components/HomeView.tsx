import { useState, useEffect, useCallback, useMemo } from 'react'
import { loadUnassignedVisits, updateVisit, type Visit } from '../lib/visits'
import type { Patient } from '../lib/supabase'
import { queryPatients } from '../lib/api'
import { getRecents, type RecentPatient } from '../lib/recents'

interface Props {
  onSelectPatient: (p: Patient) => void
  onQuickRecord: () => void
  onGoToVisit: () => void
}

const patientName = (p: Patient) =>
  [p.first_name, p.last_name].filter(Boolean).join(' ') || p.ptnum

export default function HomeView({ onSelectPatient, onQuickRecord, onGoToVisit }: Props) {
  const [unassigned, setUnassigned]     = useState<Visit[]>([])
  const [loading, setLoading]           = useState(false)
  const [assignTarget, setAssignTarget] = useState<Visit | null>(null)
  const [searchQuery, setSearchQuery]   = useState('')
  const [searchResults, setSearchResults] = useState<Patient[]>([])
  const [searching, setSearching]       = useState(false)

  // Home patient search (separate from the assign-panel search)
  const [homeQuery, setHomeQuery]       = useState('')
  const [homeResults, setHomeResults]   = useState<Patient[]>([])
  const [homeSearching, setHomeSearching] = useState(false)

  const [recents] = useState<RecentPatient[]>(() => getRecents())

  const loadUnassigned = useCallback(async () => {
    setLoading(true)
    try { setUnassigned(await loadUnassignedVisits()) } catch { /* silent */ }
    setLoading(false)
  }, [])

  useEffect(() => { loadUnassigned() }, [loadUnassigned])

  // Assign-panel patient search
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      try { setSearchResults(await queryPatients(searchQuery, 'all')) } catch { /* silent */ }
      setSearching(false)
    }, 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  // Home patient search
  useEffect(() => {
    if (!homeQuery.trim()) { setHomeResults([]); return }
    const t = setTimeout(async () => {
      setHomeSearching(true)
      try { setHomeResults(await queryPatients(homeQuery, 'all')) } catch { /* silent */ }
      setHomeSearching(false)
    }, 300)
    return () => clearTimeout(t)
  }, [homeQuery])

  const stats = useMemo(() => ({
    total:    unassigned.length,
    ready:    unassigned.filter(v => v.status === 'complete').length,
    failed:   unassigned.filter(v => v.status === 'failed').length,
  }), [unassigned])

  async function doAssign(visit: Visit, patient: Patient) {
    try {
      await updateVisit(visit.id, { patient_ptnum: patient.ptnum })
      setAssignTarget(null)
      setSearchQuery('')
      onSelectPatient(patient)
      loadUnassigned()
    } catch (e) {
      console.error('Assign failed', e)
    }
  }

  async function openRecent(ptnum: string) {
    try {
      const results = await queryPatients(ptnum, 'all')
      const match = results.find(p => p.ptnum === ptnum) ?? results[0]
      if (match) onSelectPatient(match)
    } catch { /* silent */ }
  }

  const fmtDate = (iso: string) => {
    try { return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
    catch { return iso }
  }

  const initials = (name: string) =>
    name.split(' ').slice(0, 2).map(s => s[0]).join('').toUpperCase()

  return (
    <div className="home-view">
      {/* ── Quick Record hero ───────────────────────────────────────────────── */}
      <div className="home-hero">
        <div className="home-hero-inner">
          <div className="home-hero-copy">
            <h2 className="home-hero-title">Ready to record?</h2>
            <p className="home-hero-sub">
              Start a visit recording without selecting a patient first.
              Assign it to a patient afterward from the Unassigned list below.
            </p>
          </div>
          <button className="btn-quick-record" onClick={() => { onQuickRecord(); onGoToVisit() }}>
            <span className="rec-dot-btn" style={{ marginRight: 8 }} />
            Quick Record
          </button>
        </div>
      </div>

      {/* ── Stat cards ──────────────────────────────────────────────────────── */}
      <div className="home-stats">
        <StatCard tint="#0d9488" value={stats.total}  label="Unassigned visits" />
        <StatCard tint="#16a34a" value={stats.ready}  label="Ready to assign" />
        <StatCard tint="#dc2626" value={stats.failed} label="Need attention" />
      </div>

      {/* ── Inline patient search ───────────────────────────────────────────── */}
      <section className="home-section">
        <h3 className="home-section-title">Find a patient</h3>
        <input
          className="home-search"
          placeholder="Search patients by ID or name…"
          value={homeQuery}
          onChange={e => setHomeQuery(e.target.value)}
        />
        {homeQuery.trim() && (
          <div className="home-search-results">
            {homeSearching ? (
              <div className="home-empty">Searching…</div>
            ) : homeResults.length === 0 ? (
              <div className="home-empty">No matches.</div>
            ) : (
              homeResults.slice(0, 6).map(p => (
                <button key={p.ptnum} className="home-search-item" onClick={() => { setHomeQuery(''); onSelectPatient(p) }}>
                  <span className="home-search-name">{patientName(p)}</span>
                  <span className="home-search-id">{p.ptnum}</span>
                  {p.label === 1 && <span className="home-lc-badge">LC+</span>}
                </button>
              ))
            )}
          </div>
        )}
      </section>

      {/* ── Recent patients ─────────────────────────────────────────────────── */}
      {recents.length > 0 && (
        <section className="home-section">
          <h3 className="home-section-title">Recent patients</h3>
          <div className="home-recents">
            {recents.map(r => (
              <button key={r.ptnum} className="home-recent-card" onClick={() => openRecent(r.ptnum)}>
                <span className="home-recent-avatar">{initials(r.name)}</span>
                <span className="home-recent-name">{r.name}</span>
                <span className="home-recent-id">{r.ptnum}</span>
                {r.label === 1 && <span className="home-lc-badge home-recent-lc">LC+</span>}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ── Unassigned visits ───────────────────────────────────────────────── */}
      <section className="home-section">
        <div className="home-section-header">
          <h3 className="home-section-title">Unassigned Visits</h3>
          <button className="btn-ghost-sm" onClick={loadUnassigned}>↺ Refresh</button>
        </div>

        {loading ? (
          <p className="home-empty">Loading…</p>
        ) : unassigned.length === 0 ? (
          <p className="home-empty">No unassigned visits — all caught up!</p>
        ) : (
          <div className="home-visits-list">
            {unassigned.map(v => (
              <div key={v.id} className="home-visit-card">
                <div className="home-visit-meta">
                  <span className="home-visit-date">{fmtDate(v.created_at)}</span>
                  <StatusPill status={v.status} />
                </div>
                {v.transcript && (
                  <p className="home-visit-excerpt">{v.transcript.slice(0, 200)}{v.transcript.length > 200 ? '…' : ''}</p>
                )}
                <div className="home-visit-actions">
                  {assignTarget?.id === v.id ? (
                    <AssignPanel
                      query={searchQuery}
                      onQueryChange={setSearchQuery}
                      searching={searching}
                      results={searchResults}
                      onAssign={p => doAssign(v, p)}
                      onCancel={() => { setAssignTarget(null); setSearchQuery('') }}
                    />
                  ) : (
                    <button className="btn-assign" onClick={() => setAssignTarget(v)}>
                      Assign to Patient
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function StatCard({ tint, value, label }: { tint: string; value: number; label: string }) {
  return (
    <div className="home-stat-card">
      <div className="home-stat-value" style={{ color: tint }}>{value}</div>
      <div className="home-stat-label">{label}</div>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, string> = {
    complete: '#16a34a',
    failed: '#dc2626',
    processing: '#d97706',
  }
  const color = colors[status] ?? '#64748b'
  return (
    <span style={{ background: `${color}18`, color, fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 99 }}>
      {status}
    </span>
  )
}

interface AssignPanelProps {
  query: string
  onQueryChange: (q: string) => void
  searching: boolean
  results: Patient[]
  onAssign: (p: Patient) => void
  onCancel: () => void
}

function AssignPanel({ query, onQueryChange, searching, results, onAssign, onCancel }: AssignPanelProps) {
  return (
    <div className="assign-panel">
      <input
        className="assign-search"
        placeholder="Search patient by ID or name…"
        value={query}
        onChange={e => onQueryChange(e.target.value)}
        autoFocus
      />
      {searching && <span className="assign-searching">Searching…</span>}
      {results.length > 0 && (
        <ul className="assign-results">
          {results.slice(0, 5).map(p => (
            <li key={p.ptnum} className="assign-result-item" onClick={() => onAssign(p)}>
              <span className="assign-result-name">{p.first_name} {p.last_name}</span>
              <span className="assign-result-id">{p.ptnum}</span>
            </li>
          ))}
        </ul>
      )}
      <button className="btn-ghost-sm" onClick={onCancel}>Cancel</button>
    </div>
  )
}
