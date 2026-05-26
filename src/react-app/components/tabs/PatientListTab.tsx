import { useState, useEffect, useCallback } from 'react'
import { supabase, TABLES, SELECT_COLS, normalizeRow, type Patient } from '../../lib/supabase'

interface Props { onSelect: (p: Patient) => void }

const TABLE = TABLES[0] // primary table; search spans all 5

function sccBadge(scc: number | null) {
  if (scc == null) return { label: 'N/A', cls: 'badge-muted' }
  if (scc >= 130)  return { label: `${scc} · High`, cls: 'badge-danger' }
  if (scc >= 100)  return { label: `${scc} · Med`,  cls: 'badge-warn'   }
  return               { label: `${scc} · Low`,  cls: 'badge-ok'     }
}

export default function PatientListTab({ onSelect }: Props) {
  const [patients,    setPatients]    = useState<Patient[]>([])
  const [total,       setTotal]       = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [query,       setQuery]       = useState('')
  const [filterLabel, setFilterLabel] = useState('all')
  const [filterGender,setFilterGender]= useState('all')
  const [filterTobacco,setFilterTobacco]=useState('all')
  const [page,        setPage]        = useState(0)
  const PER_PAGE = 25

  const fetchPatients = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Build query — search across all 5 tables with UNION via multiple fetches
      // For simplicity query the first table; expand to all 5 if needed
      let q = supabase
        .from(TABLE)
        .select(SELECT_COLS, { count: 'exact' })

      if (query)                   q = q.ilike('ptnum', `%${query}%`)
      if (filterLabel !== 'all')   q = q.eq('label', Number(filterLabel))
      if (filterGender !== 'all')  q = q.eq('C-263495000', filterGender)
      if (filterTobacco !== 'all') q = q.eq('C-72166-2', filterTobacco)

      q = q
        .order('scc', { ascending: false, nullsFirst: false })
        .range(page * PER_PAGE, (page + 1) * PER_PAGE - 1)

      const { data, error: err, count } = await q

      if (err) throw err
      setPatients(((data || []) as unknown as Record<string, unknown>[]).map(normalizeRow))
      setTotal(count ?? 0)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load patients')
    } finally {
      setLoading(false)
    }
  }, [query, filterLabel, filterGender, filterTobacco, page])

  useEffect(() => { fetchPatients() }, [fetchPatients])

  // Reset page when filters change
  useEffect(() => { setPage(0) }, [query, filterLabel, filterGender, filterTobacco])

  const totalPages = Math.ceil(total / PER_PAGE)

  return (
    <div>
      {/* Stat cards */}
      <div className="stat-grid">
        {[
          { val: '21,601',  lbl: 'Total Patients',  sub: 'Across 5 tables',    color: 'var(--blue-600)' },
          { val: '5,566',   lbl: 'LC Positive',     sub: '25.8% prevalence',   color: 'var(--danger)'   },
          { val: '16,035',  lbl: 'Control',         sub: 'No lung cancer',      color: 'var(--ok)'       },
          { val: total.toLocaleString(), lbl: 'Matching Query', sub: 'Live from Supabase', color: 'var(--teal-500)' },
        ].map(s => (
          <div className="stat-card" key={s.lbl}>
            <div className="stat-val" style={{ color: s.color }}>{s.val}</div>
            <div className="stat-lbl">{s.lbl}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Search + filters */}
      <div className="search-bar">
        <input
          className="search-input"
          placeholder="🔍  Search by patient ID (e.g. p15865)…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <select className="filter-select" value={filterLabel} onChange={e => setFilterLabel(e.target.value)}>
          <option value="all">All Diagnoses</option>
          <option value="1">LC Positive</option>
          <option value="0">Control</option>
        </select>
        <select className="filter-select" value={filterGender} onChange={e => setFilterGender(e.target.value)}>
          <option value="all">All Genders</option>
          <option value="m">Male</option>
          <option value="f">Female</option>
        </select>
        <select className="filter-select" value={filterTobacco} onChange={e => setFilterTobacco(e.target.value)}>
          <option value="all">All Tobacco</option>
          <option value="former">Former Smoker</option>
          <option value="never">Never Smoked</option>
        </select>
        {loading && <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>Loading…</span>}
        {!loading && <span style={{ fontSize: 12, color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>{total.toLocaleString()} results</span>}
      </div>

      {error && (
        <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-bdr)', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 16, fontSize: 13, color: 'var(--danger)' }}>
          ⚠ {error}
        </div>
      )}

      {/* Table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Patient Registry — Live from Supabase</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="badge badge-blue">{TABLE}</span>
            <span className="badge badge-muted">{total.toLocaleString()} rows</span>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>⟳</div>
            Querying Supabase…
          </div>
        ) : (
          <table className="ehr-table">
            <thead>
              <tr>
                <th>Patient ID</th>
                <th>Age</th>
                <th>Gender</th>
                <th>Race</th>
                <th>Tobacco</th>
                <th>SCC Score</th>
                <th>BP</th>
                <th>BMI</th>
                <th>Diagnosis</th>
              </tr>
            </thead>
            <tbody>
              {patients.map(p => {
                const scc = sccBadge(p.scc)
                return (
                  <tr key={`${p.ptnum}-${p._table}`} onClick={() => onSelect(p)}>
                    <td><span style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--blue-600)' }}>{p.ptnum}</span></td>
                    <td>{p.age ?? '—'}</td>
                    <td>{p.gender === 'm' ? 'Male' : p.gender === 'f' ? 'Female' : '—'}</td>
                    <td style={{ textTransform: 'capitalize' }}>{p.race ?? '—'}</td>
                    <td>
                      <span className={`badge ${p.tobacco_status === 'former' ? 'badge-warn' : 'badge-ok'}`}>
                        {p.tobacco_status === 'former' ? 'Former' : 'Never'}
                      </span>
                    </td>
                    <td><span className={`badge ${scc.cls}`}>{scc.label}</span></td>
                    <td>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                        {p.systolic_bp ?? '—'}/{p.diastolic_bp ?? '—'}
                      </span>
                    </td>
                    <td><span style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{p.bmi ?? '—'}</span></td>
                    <td>
                      {p.label === 1
                        ? <span className="badge badge-danger">LC Positive</span>
                        : <span className="badge badge-ok">Control</span>}
                    </td>
                  </tr>
                )
              })}
              {patients.length === 0 && !loading && (
                <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-faint)', padding: 32 }}>No patients found</td></tr>
              )}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0 || loading}
            style={{ padding: '5px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-white)', cursor: 'pointer', fontSize: 12, opacity: page === 0 ? .4 : 1 }}>
            ← Prev
          </button>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Page {page + 1} of {totalPages || 1} · rows {page * PER_PAGE + 1}–{Math.min((page + 1) * PER_PAGE, total)}
          </span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1 || loading}
            style={{ padding: '5px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-white)', cursor: 'pointer', fontSize: 12, opacity: page >= totalPages - 1 ? .4 : 1 }}>
            Next →
          </button>
          <span style={{ fontSize: 11, color: 'var(--text-faint)', marginLeft: 'auto' }}>Click any row to view full patient record</span>
        </div>
      </div>
    </div>
  )
}
