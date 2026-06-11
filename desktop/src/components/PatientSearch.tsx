import type React from 'react'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { queryPatients, type Patient } from '../lib/api'
import { MOCK_PATIENTS } from '../lib/mockPatients'
import { RANGES, vitalStatus } from '../lib/clinicalRanges'
import { overallScore } from './PatientCharts'

interface Props {
  selected: Patient | null
  onSelect: (p: Patient) => void
}

type SortKey = 'name' | 'risk'

function displayName(p: Patient): string {
  return [p.first_name, p.last_name].filter(Boolean).join(' ').replace(/\d+/g, '').trim() || p.ptnum
}

/* The most informative one-liner for a list row: top active problem,
   else the worst abnormal vital/lab, else null. */
function rowSignal(p: Patient): { text: string; critical: boolean } | null {
  const active = (p.problems ?? []).find(pr => pr.status === 'active') ?? (p.problems ?? [])[0]
  if (active) return { text: active.display, critical: false }
  let worst: { text: string; critical: boolean } | null = null
  for (const key of Object.keys(RANGES)) {
    const val = p[key as keyof Patient] as number | null
    const st = vitalStatus(key, val)
    if (st === 'critical') return { text: `${RANGES[key].label} ${val}`, critical: true }
    if (st === 'borderline' && !worst) worst = { text: `${RANGES[key].label} ${val}`, critical: false }
  }
  return worst
}

export default function PatientSearch({ selected, onSelect }: Props) {
  const [query, setQuery]       = useState('')
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading]   = useState(false)
  const [sort, setSort]         = useState<SortKey>('name')
  const [source]                = useState<'mock' | 'live'>('live')
  const [error,  setError]      = useState<string | null>(null)
  const [activeIdx, setActiveIdx] = useState(0)
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Load the full list once; searching/sorting happen client-side so name
  // search works regardless of how the backend indexes records.
  const loadLive = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setPatients(await queryPatients('', 'all'))
    } catch (e: unknown) {
      setPatients([])
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (source === 'live') loadLive()
    else                   setPatients(MOCK_PATIENTS)
  }, [source, loadLive])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = patients
    if (q) {
      list = list.filter(p =>
        displayName(p).toLowerCase().includes(q) || p.ptnum.toLowerCase().includes(q),
      )
    }
    list = [...list]
    if (sort === 'name') list.sort((a, b) => displayName(a).localeCompare(displayName(b)))
    else list.sort((a, b) => overallScore(b) - overallScore(a))
    return list
  }, [patients, query, sort])

  // Keep keyboard cursor in sync with the current selection / list changes.
  useEffect(() => {
    const i = visible.findIndex(p => p.ptnum === selected?.ptnum)
    setActiveIdx(i >= 0 ? i : 0)
  }, [visible, selected])

  function onListKey(e: React.KeyboardEvent) {
    if (visible.length === 0) return
    let next = activeIdx
    if (e.key === 'ArrowDown')      next = Math.min(visible.length - 1, activeIdx + 1)
    else if (e.key === 'ArrowUp')   next = Math.max(0, activeIdx - 1)
    else if (e.key === 'Home')      next = 0
    else if (e.key === 'End')       next = visible.length - 1
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(visible[activeIdx]); return }
    else return
    e.preventDefault()
    setActiveIdx(next)
    rowRefs.current[next]?.focus()
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title">Patients</div>
        <input
          className="search-input"
          placeholder="Search by name or ID…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <div className="sort-row">
          <span className="sort-label">Sort</span>
          {(['name', 'risk'] as const).map(s => (
            <button
              key={s}
              className={`sort-btn ${sort === s ? 'active' : ''}`}
              onClick={() => setSort(s)}
            >
              {s === 'name' ? 'Name' : 'Risk'}
            </button>
          ))}
        </div>
      </div>

      <div className="patient-list" role="listbox" aria-label="Patients" onKeyDown={onListKey}>
        {loading && <div className="list-empty">Loading…</div>}
        {!loading && error && <div className="list-empty" style={{ color: 'var(--danger)', fontSize: 11, padding: 12 }}>⚠ {error}</div>}
        {!loading && !error && visible.length === 0 && <div className="list-empty">No patients found</div>}
        {!loading && visible.map((p, i) => {
          const isLC = p.label === 1
          const signal = rowSignal(p)
          const isSel = selected?.ptnum === p.ptnum
          return (
            <button
              key={p.ptnum}
              ref={el => { rowRefs.current[i] = el }}
              role="option"
              aria-selected={isSel}
              tabIndex={i === activeIdx ? 0 : -1}
              className={`patient-row ${isSel ? 'active' : ''}`}
              onClick={() => onSelect(p)}
              onFocus={() => setActiveIdx(i)}
            >
              <div className="patient-row-top">
                <span className="patient-name">{displayName(p)}</span>
                {isLC && <span className="badge badge-danger" style={{ fontSize: 10 }}>LC+</span>}
              </div>
              <div className="patient-row-sub">
                {p.age != null ? `${p.age}y` : '—'} · {p.administrative_sex ?? '—'}
              </div>
              {signal && (
                <div className={`patient-row-signal ${signal.critical ? 'critical' : ''}`}>{signal.text}</div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
