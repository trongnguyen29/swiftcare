import { useState, useEffect, useCallback } from 'react'
import { supabase, TABLES, normalizeRow, type Patient } from '../lib/supabase'

interface Props {
  selected: Patient | null
  onSelect: (p: Patient) => void
}

const COLS = 'ptnum,label,scc,"C-424144002","C-263495000","C-103579009","C-8480-6","C-8462-4","C-8867-4","C-39156-5","C-72166-2","C-2093-3","C-18262-6","C-2085-9","C-4548-4","C-2345-7","C-2571-8","C-186034007","C-125680007","C-398070004","C-72514-3"'

export default function PatientSearch({ selected, onSelect }: Props) {
  const [query, setQuery]     = useState('')
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<'all' | 'positive' | 'control'>('all')

  const load = useCallback(async (q: string, f: typeof filter) => {
    setLoading(true)
    let req = supabase.from(TABLES[0]).select(COLS).order('scc', { ascending: false }).limit(50)
    if (q.trim()) req = req.ilike('ptnum', `%${q.trim()}%`)
    if (f === 'positive') req = req.eq('label', 1)
    if (f === 'control')  req = req.eq('label', 0)
    const { data } = await req
    setPatients((data || []).map(normalizeRow))
    setLoading(false)
  }, [])

  useEffect(() => { load(query, filter) }, [query, filter, load])

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title">Patients</div>
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
        {!loading && patients.length === 0 && (
          <div className="list-empty">No patients found</div>
        )}
        {!loading && patients.map(p => (
          <button
            key={p.ptnum}
            className={`patient-row ${selected?.ptnum === p.ptnum ? 'active' : ''}`}
            onClick={() => onSelect(p)}
          >
            <div className="patient-row-top">
              <span className="patient-id">{p.ptnum}</span>
              <span className={`badge ${p.label === 1 ? 'badge-danger' : 'badge-ok'}`}>
                {p.label === 1 ? 'LC+' : 'Control'}
              </span>
            </div>
            <div className="patient-row-sub">
              {p.age ? `${p.age}y` : '—'} · {p.gender === 'm' ? 'Male' : p.gender === 'f' ? 'Female' : '—'}
              {p.scc != null ? ` · SCC ${p.scc}` : ''}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
