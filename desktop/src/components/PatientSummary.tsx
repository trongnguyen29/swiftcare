import { useState, useEffect } from 'react'
import { chatWithPatientContext } from '../lib/api'
import { buildPatientContext } from '../lib/patientContext'
import type { Patient } from '../lib/supabase'

interface Props {
  patient: Patient
  section?: 'overview' | 'history'
  cachedOverview?: string
  onOverviewGenerated?: (text: string) => void
}

function vitalCls(val: number | null, type: string) {
  if (val == null) return ''
  if (type === 'sbp')   return val >= 130 ? 'high' : 'ok'
  if (type === 'dbp')   return val >= 80  ? 'high' : 'ok'
  if (type === 'hr')    return val > 100 || val < 60 ? 'high' : 'ok'
  if (type === 'bmi')   return val >= 25  ? 'high' : 'ok'
  if (type === 'chol')  return val >= 200 ? 'high' : 'ok'
  if (type === 'ldl')   return val >= 130 ? 'high' : 'ok'
  if (type === 'hba1c') return val >= 5.7 ? 'high' : 'ok'
  if (type === 'egfr')  return val < 60   ? 'high' : 'ok'
  if (type === 'spo2')  return val < 95   ? 'high' : 'ok'
  return ''
}

function fmt(val: number | null, unit = '') {
  return val == null ? '—' : `${val}${unit ? ' ' + unit : ''}`
}

const SEV_COLOR: Record<string, string> = {
  mild: 'var(--warn)', moderate: 'var(--warn)', severe: 'var(--danger)',
}

export default function PatientSummary({ patient: p, section, cachedOverview, onOverviewGenerated }: Props) {
  const [aiOverview, setAiOverview]   = useState<string | null>(cachedOverview ?? null)
  const [aiLoading,  setAiLoading]    = useState(false)
  const [aiError,    setAiError]      = useState<string | null>(null)
  const [generated,  setGenerated]    = useState(!!cachedOverview)

  const showOverview = !section || section === 'overview'

  useEffect(() => {
    if (!cachedOverview && showOverview) {
      generateOverview()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])


  async function generateOverview() {
    setAiLoading(true); setAiError(null)
    try {
      const reply = await chatWithPatientContext(
        [{ role: 'user', content: `Write a clinical handoff brief for a physician seeing this patient for the first time today. They have 60 seconds to read it before entering the room.

Write exactly 3 sentences in this order:
1. THE MOST URGENT CONCERN: The single most critical clinical fact right now. If LC+, lead with diagnosis status and SCC score. If not LC+, lead with the most dangerous risk factor or abnormal value.
2. CLINICAL CONTEXT: The 2–3 most important comorbidities, active conditions, or risk factors shaping clinical decisions — include specific values (e.g., "HbA1c 7.4%", "BMI 34", "SBP 148 mmHg").
3. PRIORITY ACTION: One specific, actionable instruction — what the clinician must do or verify in this visit.

STRICT RULES:
- Use actual numbers from the record — do not be vague
- Physician-level clinical language — not patient-facing
- No hedging ("it appears", "may be") — be direct and assertive
- No headers, no bullets — three sentences of flowing prose only
- Under 90 words total` }],
        buildPatientContext(p),
      )
      setAiOverview(reply)
      setGenerated(true)
      onOverviewGenerated?.(reply)
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : String(e))
    } finally {
      setAiLoading(false)
    }
  }

  const showHistory  = !section || section === 'history'
  const sccPct = p.scc ? Math.min(100, Math.round((p.scc / 172) * 100)) : 0
  const isLC   = p.label === 1

  const risks = [
    p.tobacco_status === 'former'                              && 'Former smoker',
    p.systolic_bp != null && p.systolic_bp >= 140             && `HTN (SBP ${p.systolic_bp})`,
    p.bmi != null && p.bmi >= 30                              && `Obese (BMI ${p.bmi})`,
    p.total_cholesterol != null && p.total_cholesterol >= 200 && `High chol. (${p.total_cholesterol})`,
    p.hba1c != null && p.hba1c >= 5.7                        && `Elevated HbA1c (${p.hba1c}%)`,
    p.egfr != null && p.egfr < 60                            && `CKD (eGFR ${p.egfr})`,
    p.age != null && p.age > 60                              && `Age > 60`,
    p.sdoh_veteran_status                                     && 'Veteran',
  ].filter(Boolean) as string[]

  const displayName = [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' ').replace(/\d+/g, '').trim() || p.ptnum

  return (
    <div className="summary-wrap">



      {/* ── AI Overview (overview only) ── */}
      {showOverview && (
        <div className="card" style={{ marginBottom: 2 }}>
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ background: 'var(--blue-600)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, letterSpacing: '.5px' }}>AI</span>
              <span className="card-title">Patient Overview</span>
            </div>
            <button
              onClick={generateOverview}
              disabled={aiLoading}
              style={{ padding: '5px 12px', fontSize: 11, fontWeight: 600, borderRadius: 7, border: 'none', cursor: aiLoading ? 'not-allowed' : 'pointer', background: aiLoading ? 'var(--bg-muted)' : 'var(--blue-600)', color: aiLoading ? 'var(--text-faint)' : '#fff' }}
            >
              {aiLoading ? 'Generating…' : generated ? 'Regenerate' : '✦ Generate Overview'}
            </button>
          </div>
          {aiError && (
            <div style={{ margin: '0 16px 12px', padding: '8px 12px', background: 'var(--danger-bg)', border: '1px solid var(--danger-bdr)', borderRadius: 6, fontSize: 12, color: 'var(--danger)' }}>
              ⚠ {aiError}
            </div>
          )}
          {aiOverview && !aiLoading && (
            <div style={{ padding: '4px 20px 16px' }}>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: 'var(--text-body)' }}>{aiOverview}</p>
              <div style={{ marginTop: 10, fontSize: 10, color: 'var(--text-faint)' }}>
                AI-generated clinical summary — for decision support only. Always apply professional judgment.
              </div>
            </div>
          )}
          {!aiOverview && !aiLoading && !aiError && (
            <div style={{ padding: '16px 20px', fontSize: 12, color: 'var(--text-faint)', textAlign: 'center' }}>
              Click <strong style={{ color: 'var(--text-muted)' }}>Generate Overview</strong> for an AI-drafted clinical summary of this patient.
            </div>
          )}
        </div>
      )}

      {/* ── Vitals · Labs · Risk (overview) ── */}
      {showOverview && <div className="summary-cols">
        <div className="card summary-card">
          <div className="card-header"><span className="card-title">Vital Signs</span></div>
          <div className="summary-fields">
            {([
              { label: 'Systolic BP',   val: p.systolic_bp,      unit: 'mmHg', type: 'sbp'  },
              { label: 'Diastolic BP',  val: p.diastolic_bp,     unit: 'mmHg', type: 'dbp'  },
              { label: 'Heart Rate',    val: p.heart_rate,       unit: 'bpm',  type: 'hr'   },
              { label: 'Resp. Rate',    val: p.respiratory_rate, unit: '/min', type: ''     },
              { label: 'SpO₂',          val: p.oxygen_saturation,unit: '%',   type: 'spo2' },
              { label: 'Temp.',         val: p.temperature_c,    unit: '°C',   type: ''     },
              { label: 'BMI',           val: p.bmi,              unit: '',     type: 'bmi'  },
              { label: 'Height',        val: p.height_cm,        unit: 'cm',   type: ''     },
              { label: 'Weight',        val: p.weight_kg,        unit: 'kg',   type: ''     },
              { label: 'Pain Score',    val: p.pain_score,       unit: '/ 10', type: ''     },
            ] as const).map(v => {
              const cls = vitalCls(v.val as number | null, v.type)
              return (
                <div key={v.label} className="info-field">
                  <span className="field-key">{v.label}</span>
                  <span className={`field-val ${cls === 'ok' ? 'val-ok' : cls === 'high' ? 'val-high' : ''}`}>
                    {fmt(v.val as number | null, v.unit)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="card summary-card">
          <div className="card-header"><span className="card-title">Labs</span></div>
          <div className="summary-fields">
            {([
              { label: 'Total Cholesterol', val: p.total_cholesterol, unit: 'mg/dL', type: 'chol'  },
              { label: 'LDL',               val: p.ldl,               unit: 'mg/dL', type: 'ldl'   },
              { label: 'HDL',               val: p.hdl,               unit: 'mg/dL', type: ''      },
              { label: 'Triglycerides',     val: p.triglycerides,     unit: 'mg/dL', type: ''      },
              { label: 'HbA1c',             val: p.hba1c,             unit: '%',     type: 'hba1c' },
              { label: 'Glucose',           val: p.glucose,           unit: 'mg/dL', type: ''      },
              { label: 'Creatinine',        val: p.creatinine,        unit: 'mg/dL', type: ''      },
              { label: 'eGFR',              val: p.egfr,              unit: 'mL/min',type: 'egfr'  },
              { label: 'Hemoglobin',        val: p.hemoglobin,        unit: 'g/dL',  type: ''      },
              { label: 'WBC',               val: p.wbc,               unit: 'K/µL',  type: ''      },
              { label: 'Platelets',         val: p.platelets,         unit: 'K/µL',  type: ''      },
            ] as const).map(v => {
              const cls = vitalCls(v.val as number | null, v.type)
              return (
                <div key={v.label} className="info-field">
                  <span className="field-key">{v.label}</span>
                  <span className={`field-val ${cls === 'ok' ? 'val-ok' : cls === 'high' ? 'val-high' : ''}`}>
                    {fmt(v.val as number | null, v.unit)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

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
            <div className="info-field" style={{ marginTop: 4 }}>
              <span className="field-key">Marital</span>
              <span className="field-val" style={{ textTransform: 'capitalize', fontFamily: 'var(--font)' }}>
                {p.marital === 'm' ? 'Married' : p.marital === 's' ? 'Single' : p.marital ?? '—'}
              </span>
            </div>
            <div className="info-field">
              <span className="field-key">Language</span>
              <span className="field-val" style={{ fontFamily: 'var(--font)' }}>{p.preferred_language ?? '—'}</span>
            </div>
            <div className="info-field">
              <span className="field-key">State</span>
              <span className="field-val" style={{ fontFamily: 'var(--font)' }}>{p.state ?? '—'}</span>
            </div>
            <div className="info-field">
              <span className="field-key">Ethnicity</span>
              <span className="field-val" style={{ fontFamily: 'var(--font)', textTransform: 'capitalize' }}>{p.ethnicity ?? '—'}</span>
            </div>
          </div>
        </div>
      </div>}

      {/* ── Problems · Medications · Allergies (history) ── */}
      {showHistory && <div className="summary-cols">

        {/* Active Problems */}
        <div className="card summary-card">
          <div className="card-header"><span className="card-title">Problems / Conditions</span></div>
          <div className="summary-fields">
            {(p.problems ?? []).length === 0 && (
              <div style={{ padding: '10px 14px', color: 'var(--text-faint)', fontSize: 12 }}>No problems recorded</div>
            )}
            {(p.problems ?? []).map((prob, i) => (
              <div key={i} className="info-field" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <span className="field-key" style={{ maxWidth: '70%' }}>{prob.display}</span>
                  <span className={`badge ${prob.status === 'active' ? 'badge-danger' : 'badge-ok'}`} style={{ fontSize: 9 }}>
                    {prob.status}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>
                  {prob.icd10_code} · since {prob.onset_date?.substring(0, 7)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Medications */}
        <div className="card summary-card">
          <div className="card-header"><span className="card-title">Medications</span></div>
          <div className="summary-fields">
            {(p.medications ?? []).length === 0 && (
              <div style={{ padding: '10px 14px', color: 'var(--text-faint)', fontSize: 12 }}>No medications recorded</div>
            )}
            {(p.medications ?? []).map((med, i) => (
              <div key={i} className="info-field" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <span className="field-key" style={{ fontWeight: 600 }}>{med.name} {med.dose}</span>
                  <span className={`badge ${med.status === 'active' ? 'badge-blue' : 'badge-ok'}`} style={{ fontSize: 9 }}>
                    {med.status}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>
                  {med.route} · {med.frequency}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Allergies */}
        <div className="card summary-card">
          <div className="card-header"><span className="card-title">Allergies &amp; Intolerances</span></div>
          <div className="summary-fields">
            {(p.allergies ?? []).length === 0 && (
              <div style={{ padding: '10px 14px', color: 'var(--ok)', fontSize: 12 }}>✓ No known allergies</div>
            )}
            {(p.allergies ?? []).map((a, i) => (
              <div key={i} className="info-field" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <span className="field-key" style={{ fontWeight: 600 }}>{a.substance}</span>
                  <span style={{ fontSize: 10, color: SEV_COLOR[a.severity] ?? 'var(--text-muted)', fontWeight: 600 }}>
                    {a.severity}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>
                  {a.reaction} · {a.type}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>}

      {/* ── SDOH · Insurance · Care Team (history) ── */}
      {showHistory && <div className="summary-cols">

        {/* SDOH */}
        <div className="card summary-card">
          <div className="card-header"><span className="card-title">Social Determinants (SDOH)</span></div>
          <div className="summary-fields">
            {([
              { label: 'Education',       val: p.sdoh_education_level },
              { label: 'Financial strain',val: p.sdoh_financial_strain },
              { label: 'Housing',         val: p.sdoh_housing_status },
              { label: 'Transport',       val: p.sdoh_transportation_insecurity === true ? 'Insecure' : p.sdoh_transportation_insecurity === false ? 'Secure' : '—' },
              { label: 'Social isolation',val: p.sdoh_social_isolation },
              { label: 'Veteran',         val: p.sdoh_veteran_status === true ? 'Yes' : p.sdoh_veteran_status === false ? 'No' : '—' },
              { label: 'Functional',      val: p.functional_status },
              { label: 'Mental/Cognitive',val: p.mental_cognitive_status },
            ]).map(r => (
              <div key={r.label} className="info-field">
                <span className="field-key">{r.label}</span>
                <span className="field-val" style={{ fontFamily: 'var(--font)', fontSize: 11, textAlign: 'right', maxWidth: '55%' }}>
                  {r.val ?? '—'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Insurance */}
        <div className="card summary-card">
          <div className="card-header"><span className="card-title">Health Insurance</span></div>
          <div className="summary-fields">
            {!p.insurance && (
              <div style={{ padding: '10px 14px', color: 'var(--text-faint)', fontSize: 12 }}>No insurance on file</div>
            )}
            {p.insurance && ([
              { label: 'Status',        val: p.insurance.coverage_status },
              { label: 'Type',          val: p.insurance.coverage_type },
              { label: 'Payer',         val: p.insurance.payer },
              { label: 'Member ID',     val: p.insurance.member_id },
              { label: 'Group ID',      val: p.insurance.group_id ?? '—' },
              { label: 'Relationship',  val: p.insurance.relationship_to_subscriber },
            ]).map(r => (
              <div key={r.label} className="info-field">
                <span className="field-key">{r.label}</span>
                <span className="field-val" style={{ fontFamily: 'var(--font)', fontSize: 11, textAlign: 'right', maxWidth: '55%', textTransform: 'capitalize' }}>
                  {r.val}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Care Team */}
        <div className="card summary-card">
          <div className="card-header"><span className="card-title">Care Team</span></div>
          <div className="summary-fields">
            {(p.care_team ?? []).length === 0 && (
              <div style={{ padding: '10px 14px', color: 'var(--text-faint)', fontSize: 12 }}>No care team recorded</div>
            )}
            {(p.care_team ?? []).map((ct, i) => (
              <div key={i} className="info-field" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <span className="field-key" style={{ fontWeight: 600 }}>{ct.name}</span>
                  <span className="badge badge-blue" style={{ fontSize: 9 }}>{ct.role}</span>
                </div>
                {ct.phone && <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>{ct.phone}</div>}
                {ct.organization && <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>{ct.organization}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>}

      {/* ── Goals · Assessment Plan (history) ── */}
      {showHistory && (p.goals?.length || p.assessment_plan) && (
        <div className="summary-cols" style={{ gridTemplateColumns: p.goals?.length ? '1fr 2fr' : '1fr' }}>
          {p.goals?.length > 0 && (
            <div className="card summary-card">
              <div className="card-header"><span className="card-title">Patient Goals</span></div>
              <div className="summary-fields">
                {p.goals.map((g, i) => (
                  <div key={i} className="risk-item" style={{ color: 'var(--navy-600, var(--blue-600))' }}>
                    <span style={{ color: 'var(--teal-500)' }}>→</span>
                    <span style={{ fontSize: 11 }}>{g}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {p.assessment_plan && (
            <div className="card summary-card">
              <div className="card-header"><span className="card-title">Assessment &amp; Plan</span></div>
              <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-body)', lineHeight: 1.6 }}>
                {p.assessment_plan}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
