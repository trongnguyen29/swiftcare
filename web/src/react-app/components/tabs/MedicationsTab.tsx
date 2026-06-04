// MedicationsTab — medication relevance in the Synthea LC cohort
// The raw dataset doesn't have a medications table, but tobacco status
// is the closest proxy. We show medication-relevant lab context instead.

import { useState, useEffect } from 'react'
import { supabase, TABLES, normalizeRow, type Patient } from '../../lib/supabase'

// Medications commonly associated with LC comorbidities in this cohort
const RELEVANT_MEDS = [
  {
    name:        'Metformin',
    indication:  'Type 2 Diabetes / Elevated HbA1c',
    trigger:     'hba1c',
    threshold:   6.5,
    operator:    '>=' as const,
    note:        'HbA1c ≥ 6.5% suggests diabetes — Metformin likely indicated',
    category:    'Metabolic',
  },
  {
    name:        'Statin (Atorvastatin / Rosuvastatin)',
    indication:  'Hyperlipidemia',
    trigger:     'total_cholesterol',
    threshold:   200,
    operator:    '>=' as const,
    note:        'Total cholesterol ≥ 200 mg/dL — statin likely indicated',
    category:    'Cardiovascular',
  },
  {
    name:        'ACE Inhibitor / ARB',
    indication:  'Hypertension',
    trigger:     'systolic_bp',
    threshold:   140,
    operator:    '>=' as const,
    note:        'Systolic BP ≥ 140 mmHg — antihypertensive likely indicated',
    category:    'Cardiovascular',
  },
  {
    name:        'Aspirin (81mg)',
    indication:  'Cardiovascular risk reduction',
    trigger:     'total_cholesterol',
    threshold:   180,
    operator:    '>=' as const,
    note:        'Elevated cholesterol — low-dose aspirin may be indicated',
    category:    'Cardiovascular',
  },
  {
    name:        'Nicotine Replacement Therapy',
    indication:  'Smoking cessation support',
    trigger:     'tobacco_status',
    threshold:   'former',
    operator:    '==' as const,
    note:        'Former smoker — cessation support / NRT history likely',
    category:    'Pulmonary',
  },
  {
    name:        'Bronchodilator / Inhaler',
    indication:  'COPD / Pulmonary comorbidity',
    trigger:     'tobacco_status',
    threshold:   'former',
    operator:    '==' as const,
    note:        'Former smoker — pulmonary medications often co-prescribed',
    category:    'Pulmonary',
  },
]

const categoryBadge: Record<string, string> = {
  Metabolic:      'badge-warn',
  Cardiovascular: 'badge-danger',
  Pulmonary:      'badge-info',
}

export default function MedicationsTab() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const { data, error: err } = await supabase
          .from(TABLES[0])
          .select('ptnum,label,"C-2093-3","C-4548-4","C-8480-6","C-72166-2","C-18262-6","C-2085-9"')
          .limit(500)
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

  // Compute how many patients in the sample likely need each medication
  function countIndicated(med: typeof RELEVANT_MEDS[0]): { total: number; lcPos: number; ctrl: number } {
    const indicated = patients.filter(p => {
      const val = p[med.trigger as keyof Patient]
      if (val == null) return false
      if (med.operator === '>=') return Number(val) >= (med.threshold as number)
      if (med.operator === '==') return val === med.threshold
      return false
    })
    return {
      total: indicated.length,
      lcPos: indicated.filter(p => p.label === 1).length,
      ctrl:  indicated.filter(p => p.label === 0).length,
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      <div style={{ background: 'var(--info-bg)', border: '1px solid var(--info-bdr)', borderRadius: 'var(--radius-lg)', padding: '12px 18px', fontSize: 12, color: 'var(--info)', display: 'flex', gap: 10 }}>
        <span style={{ fontSize: 16 }}>ℹ</span>
        <span>
          The Synthea dataset does not include a medications table. This tab infers likely medication needs
          from lab values and risk factors in the real patient data.
        </span>
      </div>

      {error && (
        <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-bdr)', borderRadius: 'var(--radius)', padding: '12px 16px', color: 'var(--danger)', fontSize: 13 }}>⚠ {error}</div>
      )}

      {/* Medication indication table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Likely Medication Indications — 500 Patient Sample</span>
          {loading && <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>Loading…</span>}
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-faint)' }}>Querying Supabase…</div>
        ) : (
          <table className="ehr-table">
            <thead>
              <tr>
                <th>Medication</th>
                <th>Indication</th>
                <th>Category</th>
                <th>Patients Indicated</th>
                <th>LC Positive</th>
                <th>Control</th>
                <th>Clinical Note</th>
              </tr>
            </thead>
            <tbody>
              {RELEVANT_MEDS.map(med => {
                const counts = countIndicated(med)
                const pct = patients.length > 0 ? Math.round((counts.total / patients.length) * 100) : 0
                return (
                  <tr key={med.name}>
                    <td style={{ fontWeight: 700, color: 'var(--text-heading)' }}>{med.name}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{med.indication}</td>
                    <td><span className={`badge ${categoryBadge[med.category]}`}>{med.category}</span></td>
                    <td>
                      <span style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{counts.total}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-faint)', marginLeft: 6 }}>({pct}%)</span>
                    </td>
                    <td><span style={{ fontFamily: 'var(--mono)', color: 'var(--danger)' }}>{counts.lcPos}</span></td>
                    <td><span style={{ fontFamily: 'var(--mono)', color: 'var(--ok)' }}>{counts.ctrl}</span></td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 260 }}>{med.note}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* LC-specific medication context */}
      <div className="card">
        <div className="card-header"><span className="card-title">Lung Cancer Treatment Context</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 0 }}>
          {[
            { name: 'Chemotherapy',         desc: 'Platinum-based regimens (Cisplatin, Carboplatin)',                     cat: 'First-line treatment', color: 'var(--danger)'   },
            { name: 'Immunotherapy',         desc: 'PD-1/PD-L1 inhibitors (Pembrolizumab, Nivolumab)',                   cat: 'Targeted therapy',     color: 'var(--blue-600)' },
            { name: 'Targeted Therapy',      desc: 'EGFR/ALK inhibitors for mutation-positive cases',                    cat: 'Precision medicine',   color: 'var(--teal-500)' },
            { name: 'Radiation Sensitizers', desc: 'Concurrent with thoracic radiotherapy',                              cat: 'Adjunct therapy',      color: 'var(--warn)'     },
            { name: 'Antiemetics',           desc: 'Ondansetron, Metoclopramide — chemo side effects',                   cat: 'Supportive care',      color: 'var(--ok)'       },
            { name: 'Growth Factors',        desc: 'G-CSF (Filgrastim) for neutropenia prevention',                      cat: 'Supportive care',      color: 'var(--ok)'       },
          ].map((m, i) => (
            <div key={m.name} style={{ padding: '16px 20px', borderRight: i % 3 !== 2 ? '1px solid var(--border)' : 'none', borderBottom: i < 3 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: m.color, marginBottom: 4 }}>{m.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 6 }}>{m.desc}</div>
              <span className="badge badge-muted" style={{ fontSize: 10 }}>{m.cat}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
