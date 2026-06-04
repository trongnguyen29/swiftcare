// ProblemsTab — shows comorbidity patterns from the real Synthea dataset
// The Synthea data has ICD-coded conditions as C-code columns.
// We surface the known comorbidities relevant to lung cancer.

import { useState, useEffect } from 'react'
import { supabase, TABLES, type Patient, normalizeRow } from '../../lib/supabase'

// Known comorbidity C-codes in the Synthea LC dataset
const COMORBIDITY_CODES: { code: string; name: string; icd: string; category: string }[] = [
  { code: 'C-44465007', name: 'Hypertension',              icd: 'I10',    category: 'Cardiovascular' },
  { code: 'C-392091000',name: 'Hyperlipidemia',            icd: 'E78.5',  category: 'Metabolic'      },
  { code: 'C-248595008',name: 'Obesity',                   icd: 'E66',    category: 'Metabolic'      },
  { code: 'C-197927001',name: 'Diabetes Type 2',           icd: 'E11',    category: 'Metabolic'      },
  { code: 'C-234262008',name: 'CKD / Renal Disease',       icd: 'N18',    category: 'Renal'          },
  { code: 'C-6246-3',   name: 'Coronary Artery Disease',   icd: 'I25',    category: 'Cardiovascular' },
]

const categoryBadge: Record<string, string> = {
  Cardiovascular: 'badge-danger',
  Metabolic:      'badge-warn',
  Renal:          'badge-blue',
}

type ComorbidityRow = {
  code: string; name: string; icd: string; category: string;
  total: number; lcPositive: number; control: number; rate: number
}

export default function ProblemsTab() {
  const [rows,    setRows]    = useState<ComorbidityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [sample,  setSample]  = useState<Patient[]>([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        // Fetch a sample to compute comorbidity counts
        const selectCols = ['ptnum', 'label', ...COMORBIDITY_CODES.map(c => `"${c.code}"`)].join(',')
        const { data, error: err } = await supabase
          .from(TABLES[0])
          .select(selectCols)
          .limit(1000)

        if (err) throw err
        const patients = ((data || []) as unknown as Record<string, unknown>[]).map(normalizeRow)
        setSample(patients)

        // Count how many patients have each condition (non-null value = condition present)
        const comorbRows: ComorbidityRow[] = COMORBIDITY_CODES.map(c => {
          const present    = patients.filter((p: Patient) => (p as Record<string,unknown>)[c.code] != null && (p as Record<string,unknown>)[c.code] !== '')
          const lcPositive = present.filter((p: Patient) => p.label === 1).length
          const control    = present.filter((p: Patient) => p.label === 0).length
          return {
            ...c,
            total:      present.length,
            lcPositive,
            control,
            rate: present.length > 0 ? Math.round((lcPositive / present.length) * 100) : 0,
          }
        }).sort((a, b) => b.total - a.total)

        setRows(comorbRows)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Tobacco breakdown from sample
  const former = sample.filter(p => p.tobacco_status === 'former')
  const never  = sample.filter(p => p.tobacco_status === 'never')
  const formerLCRate = former.length > 0 ? ((former.filter(p => p.label === 1).length / former.length) * 100).toFixed(1) : '—'
  const neverLCRate  = never.length  > 0 ? ((never.filter(p => p.label === 1).length  / never.length)  * 100).toFixed(1) : '—'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Tobacco risk — the #1 problem in this dataset */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Primary Risk Factor — Tobacco History</span>
          <span className="badge badge-danger">Key LC Driver</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
          {[
            { label: 'Former Smokers',  count: former.length, lcRate: formerLCRate, badge: 'badge-danger', icon: '🚬', desc: 'Significantly elevated LC risk' },
            { label: 'Never Smoked',    count: never.length,  lcRate: neverLCRate,  badge: 'badge-ok',    icon: '✓',  desc: 'Baseline LC risk' },
          ].map(t => (
            <div key={t.label} style={{ padding: '20px 24px', borderRight: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 22 }}>{t.icon}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-heading)' }}>{t.label}</span>
              </div>
              <div style={{ fontSize: 32, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text-heading)' }}>
                {t.count.toLocaleString()}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>patients in sample</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <span className={`badge ${t.badge}`}>LC rate: {t.lcRate}%</span>
                <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{t.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Comorbidities table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Comorbidity Prevalence (Sample: 1,000 patients)</span>
          {loading && <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>Loading…</span>}
        </div>

        {error && (
          <div style={{ padding: '16px 20px', color: 'var(--danger)', fontSize: 13 }}>⚠ {error}</div>
        )}

        {!loading && (
          <table className="ehr-table">
            <thead>
              <tr>
                <th>Condition</th>
                <th>ICD Code</th>
                <th>Category</th>
                <th>Patients w/ Condition</th>
                <th>LC Positive</th>
                <th>Control</th>
                <th>LC Rate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.code}>
                  <td style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{r.name}</td>
                  <td><span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-faint)' }}>{r.icd}</span></td>
                  <td><span className={`badge ${categoryBadge[r.category]}`}>{r.category}</span></td>
                  <td>
                    <span style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{r.total.toLocaleString()}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-faint)', marginLeft: 6 }}>
                      ({Math.round(r.total / sample.length * 100)}%)
                    </span>
                  </td>
                  <td><span style={{ fontFamily: 'var(--mono)', color: 'var(--danger)' }}>{r.lcPositive}</span></td>
                  <td><span style={{ fontFamily: 'var(--mono)', color: 'var(--ok)' }}>{r.control}</span></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden', minWidth: 60 }}>
                        <div style={{ height: '100%', width: `${r.rate}%`, background: r.rate > 30 ? 'var(--danger)' : r.rate > 20 ? 'var(--warn)' : 'var(--ok)', borderRadius: 3 }} />
                      </div>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: r.rate > 30 ? 'var(--danger)' : r.rate > 20 ? 'var(--warn)' : 'var(--ok)' }}>
                        {r.rate}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.every(r => r.total === 0) && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-faint)', padding: 24, fontSize: 13 }}>
                    Comorbidity codes not found in this table — they may be in the convert tables.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Cohort-level known stats */}
      <div className="card">
        <div className="card-header"><span className="card-title">Known Cohort Risk Profile</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 0 }}>
          {[
            { label: 'No cases under 40',      detail: 'LC onset starts at age 40+',         icon: '📅', color: 'var(--blue-600)' },
            { label: 'Peak: Age 60–70',         detail: '1,910 LC positive in this bracket',  icon: '📈', color: 'var(--warn)'     },
            { label: '34.8% of former smokers', detail: 'develop lung cancer in this cohort', icon: '🚬', color: 'var(--danger)'   },
            { label: 'Avg BMI: 28.9',           detail: 'Overweight range — a risk factor',   icon: '⚖️', color: 'var(--warn)'     },
            { label: 'Avg HbA1c: 5.8%',         detail: 'Pre-diabetic range on average',      icon: '🩸', color: 'var(--warn)'     },
            { label: 'Avg SCC: 103.8',          detail: 'Mid-range severity across cohort',   icon: '📊', color: 'var(--blue-600)' },
          ].map((f, i) => (
            <div key={f.label} style={{ padding: '16px 20px', borderRight: i % 3 !== 2 ? '1px solid var(--border)' : 'none', borderBottom: i < 3 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>{f.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: f.color }}>{f.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{f.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
