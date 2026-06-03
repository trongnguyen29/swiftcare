import type { Patient } from '../lib/supabase'

interface Props { patient: Patient }

function vitalCls(val: number | null, type: string) {
  if (val == null) return ''
  if (type === 'sbp')   return val >= 130 ? 'high' : 'ok'
  if (type === 'dbp')   return val >= 80  ? 'high' : 'ok'
  if (type === 'hr')    return val > 100 || val < 60 ? 'high' : 'ok'
  if (type === 'bmi')   return val >= 25  ? 'high' : 'ok'
  if (type === 'chol')  return val >= 200 ? 'high' : 'ok'
  if (type === 'ldl')   return val >= 130 ? 'high' : 'ok'
  if (type === 'hba1c') return val >= 5.7 ? 'high' : 'ok'
  return ''
}

function fmt(val: number | null, unit = '') {
  return val == null ? '—' : `${val}${unit ? ' ' + unit : ''}`
}

export default function PatientSummary({ patient: p }: Props) {
  const sccPct = p.scc ? Math.min(100, Math.round((p.scc / 172) * 100)) : 0
  const isLC   = p.label === 1

  const risks = [
    p.tobacco_status === 'former'                          && 'Former smoker',
    p.systolic_bp != null && p.systolic_bp >= 140          && `HTN (SBP ${p.systolic_bp})`,
    p.bmi != null && p.bmi >= 30                           && `Obese (BMI ${p.bmi})`,
    p.total_cholesterol != null && p.total_cholesterol >= 200 && `High chol (${p.total_cholesterol})`,
    p.hba1c != null && p.hba1c >= 5.7                     && `Elevated HbA1c (${p.hba1c}%)`,
    p.age != null && p.age > 60                            && `Age > 60`,
  ].filter(Boolean) as string[]

  return (
    <div className="summary-wrap">
      {/* Hero */}
      <div className="summary-hero">
        <div className="hero-avatar">{p.gender === 'm' ? '♂' : '♀'}</div>
        <div className="hero-info">
          <div className="hero-id">{p.ptnum}</div>
          <div className="hero-sub">
            {p.age ? `${p.age}y` : 'Age unknown'} · {p.gender === 'm' ? 'Male' : 'Female'} · {p.race ?? 'Unknown race'}
          </div>
          <div className="hero-badges">
            <span className={`badge ${isLC ? 'badge-danger' : 'badge-ok'}`}>
              {isLC ? '⚠ LC Positive' : '✓ Control'}
            </span>
            {p.scc != null && <span className="badge badge-blue">SCC {p.scc}</span>}
            {p.tobacco_status === 'former' && <span className="badge badge-warn">Former Smoker</span>}
          </div>
        </div>
        {/* SCC bar */}
        <div className="hero-scc">
          <div className="scc-label">SCC Score</div>
          <div className="scc-big">{p.scc ?? '—'}</div>
          <div className="scc-bar-wrap" style={{ width: 120 }}>
            <div className="scc-bar-fill" style={{ width: `${sccPct}%` }} />
          </div>
        </div>
      </div>

      {/* 3 columns: Vitals · Labs · Risk */}
      <div className="summary-cols">

        {/* Vitals */}
        <div className="card summary-card">
          <div className="card-header"><span className="card-title">Vital Signs</span></div>
          <div className="summary-fields">
            {[
              { label: 'Systolic BP',  val: p.systolic_bp,  unit: 'mmHg', type: 'sbp' },
              { label: 'Diastolic BP', val: p.diastolic_bp, unit: 'mmHg', type: 'dbp' },
              { label: 'Heart Rate',   val: p.heart_rate,   unit: 'bpm',  type: 'hr'  },
              { label: 'BMI',          val: p.bmi,          unit: '',     type: 'bmi' },
              { label: 'Pain Score',   val: p.pain_score,   unit: '/ 10', type: ''    },
            ].map(v => {
              const cls = vitalCls(v.val, v.type)
              return (
                <div key={v.label} className="info-field">
                  <span className="field-key">{v.label}</span>
                  <span className={`field-val ${cls === 'ok' ? 'val-ok' : cls === 'high' ? 'val-high' : ''}`}>
                    {fmt(v.val, v.unit)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Labs */}
        <div className="card summary-card">
          <div className="card-header"><span className="card-title">Labs</span></div>
          <div className="summary-fields">
            {[
              { label: 'Total Cholesterol', val: p.total_cholesterol, unit: 'mg/dL', type: 'chol'  },
              { label: 'LDL',               val: p.ldl,               unit: 'mg/dL', type: 'ldl'   },
              { label: 'HDL',               val: p.hdl,               unit: 'mg/dL', type: ''      },
              { label: 'Triglycerides',     val: p.triglycerides,     unit: 'mg/dL', type: ''      },
              { label: 'HbA1c',             val: p.hba1c,             unit: '%',     type: 'hba1c' },
              { label: 'Glucose',           val: p.glucose,           unit: 'mg/dL', type: ''      },
            ].map(v => {
              const cls = vitalCls(v.val, v.type)
              return (
                <div key={v.label} className="info-field">
                  <span className="field-key">{v.label}</span>
                  <span className={`field-val ${cls === 'ok' ? 'val-ok' : cls === 'high' ? 'val-high' : ''}`}>
                    {fmt(v.val, v.unit)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Risk */}
        <div className="card summary-card">
          <div className="card-header"><span className="card-title">Risk Factors</span></div>
          <div className="summary-fields">
            {risks.length === 0 && (
              <div style={{ padding: '12px 16px', color: 'var(--text-faint)', fontSize: 12 }}>No significant risk factors</div>
            )}
            {risks.map(r => (
              <div key={r} className="risk-item">
                <span className="risk-dot" />
                <span>{r}</span>
              </div>
            ))}
            <div className="info-field" style={{ marginTop: 8 }}>
              <span className="field-key">Marital</span>
              <span className="field-val" style={{ textTransform: 'capitalize' }}>
                {p.marital === 'm' ? 'Married' : p.marital === 's' ? 'Single' : p.marital ?? '—'}
              </span>
            </div>
            <div className="info-field">
              <span className="field-key">State</span>
              <span className="field-val" style={{ textTransform: 'capitalize' }}>{p.state ?? '—'}</span>
            </div>
            <div className="info-field">
              <span className="field-key">Ethnicity</span>
              <span className="field-val" style={{ textTransform: 'capitalize' }}>{p.ethnicity ?? '—'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
