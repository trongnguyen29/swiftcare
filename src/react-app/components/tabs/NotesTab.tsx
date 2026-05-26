// NotesTab — clinical notes derived from real Supabase patient data
// Generates contextual notes based on actual patient values

import { useState, useEffect } from 'react'
import { supabase, TABLES, normalizeRow, type Patient } from '../../lib/supabase'

function generateNote(p: Patient): { type: string; author: string; date: string; content: string } {
  const isPositive = p.label === 1
  const highBP     = p.systolic_bp != null && p.systolic_bp >= 140
  const highChol   = p.total_cholesterol != null && p.total_cholesterol >= 200
  const highBMI    = p.bmi != null && p.bmi >= 30
  const highHbA1c  = p.hba1c != null && p.hba1c >= 5.7
  const former     = p.tobacco_status === 'former'

  const risks = [
    former     && 'former smoker status (primary LC risk factor)',
    highBP     && `hypertension (SBP ${p.systolic_bp} mmHg)`,
    highChol   && `hyperlipidemia (total cholesterol ${p.total_cholesterol} mg/dL)`,
    highBMI    && `obesity (BMI ${p.bmi})`,
    highHbA1c  && `elevated HbA1c (${p.hba1c}%)`,
  ].filter(Boolean)

  const content = isPositive
    ? `Patient ${p.ptnum} presents as lung cancer positive (SCC score ${p.scc ?? 'N/A'}). ` +
      `Age ${p.age ?? 'unknown'}, ${p.gender === 'm' ? 'male' : 'female'}, ${p.race ?? 'unknown race'}. ` +
      (risks.length > 0 ? `Notable risk factors: ${risks.join('; ')}. ` : '') +
      `Vitals: BP ${p.systolic_bp ?? '—'}/${p.diastolic_bp ?? '—'} mmHg, HR ${p.heart_rate ?? '—'} bpm, BMI ${p.bmi ?? '—'}. ` +
      `Labs: Cholesterol ${p.total_cholesterol ?? '—'} mg/dL, LDL ${p.ldl ?? '—'}, HDL ${p.hdl ?? '—'}, HbA1c ${p.hba1c ?? '—'}%. ` +
      `Recommend oncology referral, staging workup, and pulmonology consultation given tobacco history.`
    : `Patient ${p.ptnum} is a control subject (LC negative, SCC score ${p.scc ?? 'N/A'}). ` +
      `Age ${p.age ?? 'unknown'}, ${p.gender === 'm' ? 'male' : 'female'}. ` +
      (risks.length > 0 ? `Risk factors noted: ${risks.join('; ')}. ` : 'No significant risk factors identified. ') +
      `Vitals: BP ${p.systolic_bp ?? '—'}/${p.diastolic_bp ?? '—'} mmHg, BMI ${p.bmi ?? '—'}. ` +
      `Continue routine surveillance given age and risk profile. Annual screening recommended.`

  return {
    type:    isPositive ? 'Oncology Note' : 'Preventive Care Note',
    author:  isPositive ? 'Dr. James R. Okafor, MD · Oncology' : 'Dr. Sarah Kim, MD · Primary Care',
    date:    'May 26, 2024',
    content,
  }
}

const typeColors: Record<string, string> = {
  'Oncology Note':        'var(--danger)',
  'Preventive Care Note': 'var(--ok)',
  'Research Note':        'var(--blue-600)',
}

export default function NotesTab() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [filter,   setFilter]   = useState<'all' | 'positive' | 'control'>('all')

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const { data, error: err } = await supabase
          .from(TABLES[0])
          .select('ptnum,label,scc,"C-424144002","C-263495000","C-103579009","C-8480-6","C-8462-4","C-8867-4","C-39156-5","C-72166-2","C-2093-3","C-18262-6","C-2085-9","C-4548-4","C-2345-7","C-2571-8","C-29463-7","C-8302-2","C-186034007","C-125680007","C-398070004","C-72514-3"')
          .order('scc', { ascending: false })
          .limit(20)
        if (err) throw err
        setPatients((data || []).map(normalizeRow))
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = patients.filter(p =>
    filter === 'all'      ? true :
    filter === 'positive' ? p.label === 1 :
    p.label === 0
  )

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all','positive','control'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '6px 14px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                background: filter === f ? 'var(--blue-600)' : 'var(--bg-white)',
                color: filter === f ? '#fff' : 'var(--text-muted)',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'var(--font)',
              }}
            >
              {f === 'all' ? 'All Notes' : f === 'positive' ? '⚠ LC Positive' : '✓ Control'}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {loading ? 'Loading…' : `${filtered.length} notes · top 20 by SCC score`}
        </span>
      </div>

      {error && (
        <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-bdr)', borderRadius: 'var(--radius)', padding: '12px 16px', color: 'var(--danger)', fontSize: 13, marginBottom: 16 }}>⚠ {error}</div>
      )}

      {loading && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-faint)' }}>Querying Supabase…</div>
      )}

      {!loading && filtered.map(p => {
        const note = generateNote(p)
        return (
          <div className="note-card" key={p.ptnum}>
            <div className="note-header">
              <div>
                <div className="note-type" style={{ color: typeColors[note.type] || 'var(--blue-600)' }}>
                  {note.type}
                </div>
                <div className="note-author">{note.author}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <div className="note-date">{note.date}</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-faint)' }}>{p.ptnum}</span>
                  {p.label === 1
                    ? <span className="badge badge-danger" style={{ fontSize: 10 }}>LC+</span>
                    : <span className="badge badge-ok" style={{ fontSize: 10 }}>Control</span>}
                </div>
              </div>
            </div>
            <div className="note-body">{note.content}</div>
          </div>
        )
      })}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-faint)', fontSize: 13 }}>
          No notes match this filter.
        </div>
      )}
    </div>
  )
}
