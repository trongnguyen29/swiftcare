import { useState, useEffect, useCallback } from 'react'
import { queryPatients, type Patient } from '../lib/api'
import { MOCK_PATIENTS } from '../lib/mockPatients'

interface Props {
  selected: Patient | null
  onSelect: (p: Patient) => void
}

export default function PatientSearch({ selected, onSelect }: Props) {
  const [query, setQuery]       = useState('')
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading]   = useState(false)
  const [filter, setFilter]     = useState<'all' | 'positive' | 'control'>('all')
  const [source, setSource]     = useState<'mock' | 'live'>('mock')
  const [error,  setError]      = useState<string | null>(null)

  // ── Live fetch via Rust → Supabase ──
  const loadLive = useCallback(async (q: string, f: typeof filter) => {
    setLoading(true)
    setError(null)
    try {
      const data = await queryPatients(q, f)
      setPatients(data)
    } catch (e: unknown) {
      setPatients([])
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Mock (local) filter ──
  const loadMock = useCallback((q: string, f: typeof filter) => {
    setPatients(MOCK_PATIENTS.filter(p => {
      if (f === 'positive' && p.label !== 1) return false
      if (f === 'control'  && p.label !== 0) return false
      if (q.trim()) {
        const needle = q.trim().toLowerCase()
        const fullName = [p.first_name, p.last_name].filter(Boolean).join(' ').toLowerCase()
        if (!p.ptnum.toLowerCase().includes(needle) && !fullName.includes(needle)) return false
      }
      return true
    }))
  }, [])

  useEffect(() => {
    if (source === 'live') loadLive(query, filter)
    else                   loadMock(query, filter)
  }, [query, filter, source, loadLive, loadMock])

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title">Patients</div>

        {/* Source toggle */}
        <div className="source-toggle">
          <button
            className={`source-btn ${source === 'mock' ? 'active' : ''}`}
            onClick={() => setSource('mock')}
          >Demo</button>
          <button
            className={`source-btn ${source === 'live' ? 'active' : ''}`}
            onClick={() => setSource('live')}
          >Live</button>
        </div>

        <div className="filter-pills">
          {(['all', 'positive', 'control'] as const).map(f => (
            <button
              key={f}
              className={`filter-pill ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : f === 'positive' ? 'LC+' : 'Control'}
            </button>
          ))}
        </div>
      </div>

      <div className="sidebar-search">
        <input
          className="search-input"
          placeholder="Search by patient ID…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      <div className="patient-list">
        {loading && <div className="list-empty">Loading…</div>}
        {!loading && error && <div className="list-empty" style={{ color: 'var(--danger)', fontSize: 11, padding: 12 }}>⚠ {error}</div>}
        {!loading && !error && patients.length === 0 && <div className="list-empty">No patients found</div>}
        {!loading && patients.map(p => (
          <button
            key={p.ptnum}
            className={`patient-row ${selected?.ptnum === p.ptnum ? 'active' : ''}`}
            onClick={() => onSelect(p)}
          >
            <div className="patient-row-top">
              <span className="patient-id">
                {[p.first_name, p.last_name].filter(Boolean).join(' ') || p.ptnum}
              </span>
              <span className={`badge ${p.label === 1 ? 'badge-danger' : 'badge-ok'}`}>
                {p.label === 1 ? 'LC+' : 'Control'}
              </span>
            </div>
            <div className="patient-row-sub">
              {p.age ? `${p.age}y` : '—'} · {p.administrative_sex ?? '—'}
              {p.scc != null ? ` · SCC ${p.scc}` : ''}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
