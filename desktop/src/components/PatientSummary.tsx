import { useState, useEffect, useRef, type ReactNode } from 'react'
import { chatWithPatientContext, getPatientSummary, savePatientSummary } from '../lib/api'
import { buildPatientContext, fingerprint } from '../lib/patientContext'
import { RANGES, vitalStatus, statusClass, statusVar, formatRef, type VitalStatus } from '../lib/clinicalRanges'
import { RiskRings } from './PatientCharts'
import { AIFindings } from './AIInsights'
import type { Patient } from '../lib/supabase'

interface Props {
  patient: Patient
  section?: 'overview' | 'chart'
  cachedOverview?: string
  onOverviewGenerated?: (text: string) => void
}

const SEV_COLOR: Record<string, string> = {
  mild: 'var(--warn)', moderate: 'var(--warn)', severe: 'var(--danger)',
}

/* Vital/lab fields that have reference ranges, in scan order. */
const FLAG_FIELDS = [
  'systolic_bp', 'diastolic_bp', 'heart_rate', 'oxygen_saturation', 'bmi',
  'total_cholesterol', 'ldl', 'hdl', 'triglycerides', 'hba1c', 'glucose', 'egfr',
] as const

function statusRank(s: VitalStatus): number {
  return s === 'critical' ? 2 : s === 'borderline' ? 1 : 0
}

/* Reverse-chronological sort (newest first); nullish dates sort last. */
function byDateDesc<T>(items: T[], getDate: (t: T) => string | null | undefined): T[] {
  return [...items].sort((a, b) => (getDate(b) ?? '').localeCompare(getDate(a) ?? ''))
}

/* A plain titled detail card. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card summary-card">
      <div className="card-header"><span className="card-title">{title}</span></div>
      {children}
    </div>
  )
}

/* Shows the first `max` items with a Show all / Show less toggle. */
function CollapsibleList<T>({ items, max = 5, render }: { items: T[]; max?: number; render: (item: T, i: number) => ReactNode }) {
  const [open, setOpen] = useState(false)
  const shown = open ? items : items.slice(0, max)
  return (
    <>
      {shown.map(render)}
      {items.length > max && (
        <button type="button" className="expand-btn" onClick={() => setOpen(o => !o)}>
          {open ? 'Show less' : `Show all ${items.length}`}
        </button>
      )}
    </>
  )
}

/* A single labelled value with 3-tier coloring; nulls collapse to "Not recorded". */
function ValueField({ label, val, unit, statusKey }: { label: string; val: number | null; unit?: string; statusKey?: string }) {
  const status = statusKey ? vitalStatus(statusKey, val) : 'unknown'
  const abnormal = status === 'borderline' || status === 'critical'
  return (
    <div className="info-field">
      <span className="field-key">{label}</span>
      {val == null ? (
        <span className="not-recorded">Not recorded</span>
      ) : (
        <span className={`field-val ${statusClass(status)}`}>
          {val}{unit ? ` ${unit}` : ''}
          {abnormal && formatRef(statusKey!) && <span className="field-ref">{formatRef(statusKey!)}</span>}
        </span>
      )}
    </div>
  )
}

export default function PatientSummary({ patient: p, section = 'overview', cachedOverview, onOverviewGenerated }: Props) {
  const [aiOverview, setAiOverview] = useState<string | null>(cachedOverview ?? null)
  const [aiLoading,  setAiLoading]  = useState(false)
  const [aiError,    setAiError]    = useState<string | null>(null)
  const requestedFor = useRef<string | null>(cachedOverview ? p.ptnum : null)

  const isOverview = section === 'overview'

  // Resolve the brief for this patient:
  //   session cache → stored summary (if clinical data unchanged) → generate.
  // It is regenerated ONLY when the patient's clinical data changes — i.e. the
  // fingerprint of the record differs from the stored one.
  useEffect(() => {
    if (!isOverview) return
    if (cachedOverview) {
      setAiOverview(cachedOverview); setAiError(null)
      requestedFor.current = p.ptnum
      return
    }
    if (requestedFor.current === p.ptnum) return  // already handling this patient (also dedupes StrictMode)
    const myPtnum = p.ptnum
    requestedFor.current = myPtnum
    setAiOverview(null); setAiError(null); setAiLoading(true)

    ;(async () => {
      let stored: Awaited<ReturnType<typeof getPatientSummary>> = null
      try { stored = await getPatientSummary(myPtnum) } catch { /* e.g. pre-migration — generate instead */ }
      if (requestedFor.current !== myPtnum) return  // a newer patient took over

      const fp = fingerprint(buildPatientContext(p))
      if (stored && stored.hash === fp) {
        // Clinical data unchanged → reuse the stored summary, no generation.
        setAiOverview(stored.summary); setAiLoading(false)
        onOverviewGenerated?.(stored.summary)
        return
      }
      await generateOverview()  // data changed or none stored → generate + persist
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.ptnum])

  async function generateOverview() {
    const myPtnum = p.ptnum
    const context = buildPatientContext(p)
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
        context,
      )
      if (requestedFor.current !== myPtnum) return  // patient switched mid-flight
      setAiOverview(reply)
      onOverviewGenerated?.(reply)
      // Persist with the fingerprint of the data it was built from, so it is
      // reused until that data changes (fire-and-forget — UI already updated).
      savePatientSummary(myPtnum, reply, fingerprint(context)).catch(() => {})
    } catch (e: unknown) {
      if (requestedFor.current !== myPtnum) return
      setAiError(e instanceof Error ? e.message : String(e))
    } finally {
      if (requestedFor.current === myPtnum) setAiLoading(false)
    }
  }

  /* ── Exception-first flags: only abnormal measured values ── */
  const flags = FLAG_FIELDS
    .map(key => ({ key, label: RANGES[key].label, unit: RANGES[key].unit, val: p[key] as number | null, status: vitalStatus(key, p[key] as number | null) }))
    .filter(f => f.status === 'borderline' || f.status === 'critical')
    .sort((a, b) => statusRank(b.status) - statusRank(a.status))

  const measuredCount = FLAG_FIELDS.filter(k => (p[k] as number | null) != null).length

  /* Compact vitals/labs — only measured fields are shown (Overview). */
  const vitals = ([
    { label: 'Systolic BP',  val: p.systolic_bp,       unit: 'mmHg', key: 'systolic_bp'      },
    { label: 'Diastolic BP', val: p.diastolic_bp,      unit: 'mmHg', key: 'diastolic_bp'     },
    { label: 'Heart Rate',   val: p.heart_rate,        unit: 'bpm',  key: 'heart_rate'       },
    { label: 'Resp. Rate',   val: p.respiratory_rate,  unit: '/min', key: undefined          },
    { label: 'SpO₂',         val: p.oxygen_saturation, unit: '%',    key: 'oxygen_saturation'},
    { label: 'Temp.',        val: p.temperature_c,     unit: '°C',   key: undefined          },
    { label: 'BMI',          val: p.bmi,               unit: '',     key: 'bmi'              },
    { label: 'Pain Score',   val: p.pain_score,        unit: '/ 10', key: undefined          },
  ] as const).filter(v => v.val != null)

  const labs = ([
    { label: 'Total Cholesterol', val: p.total_cholesterol, unit: 'mg/dL', key: 'total_cholesterol' },
    { label: 'LDL',               val: p.ldl,               unit: 'mg/dL', key: 'ldl'               },
    { label: 'HDL',               val: p.hdl,               unit: 'mg/dL', key: 'hdl'               },
    { label: 'Triglycerides',     val: p.triglycerides,     unit: 'mg/dL', key: 'triglycerides'     },
    { label: 'HbA1c',             val: p.hba1c,             unit: '%',     key: 'hba1c'             },
    { label: 'Glucose',           val: p.glucose,           unit: 'mg/dL', key: 'glucose'           },
    { label: 'Creatinine',        val: p.creatinine,        unit: 'mg/dL', key: undefined           },
    { label: 'eGFR',              val: p.egfr,              unit: 'mL/min',key: 'egfr'              },
    { label: 'Hemoglobin',        val: p.hemoglobin,        unit: 'g/dL',  key: undefined           },
  ] as const).filter(v => v.val != null)

  const activeProblems = byDateDesc((p.problems ?? []).filter(pr => pr.status === 'active'), x => x.onset_date)

  /* ───────────────────────── Overview ───────────────────────── */
  if (isOverview) {
    return (
      <div className="summary-wrap">

        {/* Clinical attention bar — slim, reads well with 1 or many flags */}
        <div className={`attention attention--${flags.some(f => f.status === 'critical') ? 'critical' : flags.length ? 'warn' : 'ok'}`}>
          <span className="attention-icon">{flags.length ? '⚠' : '✓'}</span>
          <span className="attention-title">
            {flags.length
              ? `${flags.length} value${flags.length > 1 ? 's' : ''} need${flags.length > 1 ? '' : 's'} attention`
              : measuredCount > 0 ? 'All measured values within range' : 'No vitals or labs recorded'}
          </span>
          {flags.length > 0 && (
            <div className="attention-items">
              {flags.map(f => (
                <span key={f.key} className="attention-item" style={{ color: statusVar(f.status) }}>
                  <span className="attention-item-label">{f.label}</span>
                  {f.val}{f.unit ? ` ${f.unit}` : ''}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* AI handoff brief */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="ai-tag">AI</span>
              <span className="card-title">Patient Overview</span>
            </div>
            {aiLoading && <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>Generating…</span>}
          </div>
          {aiError && <div className="inline-error">⚠ {aiError}</div>}
          {aiLoading && !aiOverview && <div className="ai-skeleton"><span /><span /><span /></div>}
          {aiOverview && (
            <div style={{ padding: '4px 20px 16px' }}>
              <p className="ai-brief-text">{aiOverview}</p>
              <div className="ai-disclaimer">AI-generated clinical summary — for decision support only. Always apply professional judgment.</div>
            </div>
          )}
          {!aiOverview && !aiLoading && !aiError && (
            <div className="card-empty">Preparing clinical summary…</div>
          )}
        </div>

        {/* Overview cards — 3 columns × 2 rows */}
        <div className="summary-cols">
          <div className="card risk-rings-card">
            <div className="card-header"><span className="card-title">Risk Overview</span></div>
            <div className="risk-rings-row">
              <RiskRings patient={p} />
              <div className="risk-rings-legend">
                <div className="rings-legend-item"><span style={{ color: 'var(--ok)' }}>●</span> Low (0–29)</div>
                <div className="rings-legend-item"><span style={{ color: 'var(--warn)' }}>●</span> Moderate (30–59)</div>
                <div className="rings-legend-item"><span style={{ color: 'var(--danger)' }}>●</span> High (60+)</div>
                <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-faint)' }}>Scores derived from current vitals &amp; labs</div>
              </div>
            </div>
          </div>

          <AIFindings patient={p} />

          <div className="card summary-card">
            <div className="card-header"><span className="card-title">Active Problems</span></div>
            <div className="summary-fields">
              {activeProblems.length === 0 && <div className="card-empty-sm">No active problems recorded</div>}
              <CollapsibleList
                items={activeProblems}
                render={(prob, i) => (
                  <div key={i} className="risk-item"><span className="risk-dot" /><span>{prob.display}</span></div>
                )}
              />
            </div>
          </div>

          <div className="card summary-card">
            <div className="card-header"><span className="card-title">Vital Signs</span></div>
            <div className="summary-fields">
              {vitals.length === 0 && <div className="card-empty-sm">Not recorded</div>}
              {vitals.map(v => <ValueField key={v.label} label={v.label} val={v.val} unit={v.unit} statusKey={v.key} />)}
            </div>
          </div>

          <div className="card summary-card">
            <div className="card-header"><span className="card-title">Labs</span></div>
            <div className="summary-fields">
              {labs.length === 0 && <div className="card-empty-sm">Not recorded</div>}
              {labs.map(v => <ValueField key={v.label} label={v.label} val={v.val} unit={v.unit} statusKey={v.key} />)}
            </div>
          </div>

          <div className="card summary-card">
            <div className="card-header"><span className="card-title">Allergies</span></div>
            <div className="summary-fields">
              {(p.allergies ?? []).length === 0 && <div className="card-empty-sm" style={{ color: 'var(--ok)' }}>✓ No known allergies</div>}
              {(p.allergies ?? []).map((a, i) => (
                <div key={i} className="info-field">
                  <span className="field-key" style={{ fontWeight: 600 }}>{a.substance}</span>
                  <span style={{ fontSize: 11, color: SEV_COLOR[a.severity] ?? 'var(--text-muted)', fontWeight: 600 }}>{a.severity}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* ───────────────────────── Chart (full detail) ───────────────────────── */
  return (
    <div className="summary-wrap">

      {/* Problems · Medications · Allergies */}
      <div className="summary-cols">
        <Section title="Problems / Conditions">
          <div className="summary-fields">
            {(p.problems ?? []).length === 0 && <div className="card-empty-sm">No data for this patient</div>}
            <CollapsibleList
              items={byDateDesc(p.problems ?? [], x => x.onset_date)}
              render={(prob, i) => (
                <div key={i} className="info-field" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <span className="field-key" style={{ maxWidth: '70%' }}>{prob.display}</span>
                    <span className={`badge ${prob.status === 'active' ? 'badge-danger' : 'badge-ok'}`} style={{ fontSize: 9 }}>{prob.status}</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>
                    {prob.icd10_code} · since {prob.onset_date?.substring(0, 7)}
                  </div>
                </div>
              )}
            />
          </div>
        </Section>

        <Section title="Medications">
          <div className="summary-fields">
            {(p.medications ?? []).length === 0 && <div className="card-empty-sm">No data for this patient</div>}
            <CollapsibleList
              items={byDateDesc(p.medications ?? [], x => x.start_date)}
              render={(med, i) => (
                <div key={i} className="info-field" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <span className="field-key" style={{ fontWeight: 600 }}>{med.name} {med.dose}</span>
                    <span className={`badge ${med.status === 'active' ? 'badge-blue' : 'badge-ok'}`} style={{ fontSize: 9 }}>{med.status}</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>{med.route} · {med.frequency}</div>
                </div>
              )}
            />
          </div>
        </Section>

        <Section title="Allergies & Intolerances">
          <div className="summary-fields">
            {(p.allergies ?? []).length === 0 && <div className="card-empty-sm" style={{ color: 'var(--ok)' }}>✓ No known allergies</div>}
            <CollapsibleList
              items={byDateDesc(p.allergies ?? [], x => x.onset_date)}
              render={(a, i) => (
                <div key={i} className="info-field" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <span className="field-key" style={{ fontWeight: 600 }}>{a.substance}</span>
                    <span style={{ fontSize: 10, color: SEV_COLOR[a.severity] ?? 'var(--text-muted)', fontWeight: 600 }}>{a.severity}</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>{a.reaction} · {a.type}</div>
                </div>
              )}
            />
          </div>
        </Section>
      </div>

      {/* SDOH · Insurance · Care Team */}
      <div className="summary-cols">
        <Section title="Social Determinants (SDOH)">
          <div className="summary-fields">
            {(() => {
              const rows = ([
                { label: 'Education',        val: p.sdoh_education_level },
                { label: 'Financial strain', val: p.sdoh_financial_strain },
                { label: 'Housing',          val: p.sdoh_housing_status },
                { label: 'Transport',        val: p.sdoh_transportation_insecurity === true ? 'Insecure' : p.sdoh_transportation_insecurity === false ? 'Secure' : null },
                { label: 'Social isolation', val: p.sdoh_social_isolation },
                { label: 'Veteran',          val: p.sdoh_veteran_status === true ? 'Yes' : p.sdoh_veteran_status === false ? 'No' : null },
                { label: 'Functional',       val: p.functional_status },
                { label: 'Mental/Cognitive', val: p.mental_cognitive_status },
              ]).filter(r => r.val != null) as { label: string; val: string }[]
              if (rows.length === 0) return <div className="card-empty-sm">No data for this patient</div>
              return rows.map(r => (
                <div key={r.label} className="info-field">
                  <span className="field-key">{r.label}</span>
                  <span className="field-val" style={{ fontFamily: 'var(--font)', fontSize: 11, textAlign: 'right', maxWidth: '55%' }}>{r.val}</span>
                </div>
              ))
            })()}
          </div>
        </Section>

        <Section title="Health Insurance">
          <div className="summary-fields">
            {!p.insurance && <div className="card-empty-sm">No data for this patient</div>}
            {p.insurance && ([
              { label: 'Status',       val: p.insurance.coverage_status },
              { label: 'Type',         val: p.insurance.coverage_type },
              { label: 'Payer',        val: p.insurance.payer },
              { label: 'Member ID',    val: p.insurance.member_id },
              { label: 'Group ID',     val: p.insurance.group_id },
              { label: 'Relationship', val: p.insurance.relationship_to_subscriber },
            ]).filter(r => r.val != null && r.val !== '').map(r => (
              <div key={r.label} className="info-field">
                <span className="field-key">{r.label}</span>
                <span className="field-val" style={{ fontFamily: 'var(--font)', fontSize: 11, textAlign: 'right', maxWidth: '55%', textTransform: 'capitalize' }}>{r.val}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Care Team">
          <div className="summary-fields">
            {(p.care_team ?? []).length === 0 && <div className="card-empty-sm">No data for this patient</div>}
            <CollapsibleList
              items={p.care_team ?? []}
              render={(ct, i) => (
                <div key={i} className="info-field" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <span className="field-key" style={{ fontWeight: 600 }}>{ct.name}</span>
                    <span className="badge badge-blue" style={{ fontSize: 9 }}>{ct.role}</span>
                  </div>
                  {ct.phone && <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>{ct.phone}</div>}
                  {ct.organization && <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>{ct.organization}</div>}
                </div>
              )}
            />
          </div>
        </Section>
      </div>

      {/* Goals · Assessment & Plan */}
      <div className="summary-cols">
        <Section title="Patient Goals">
          <div className="summary-fields">
            {(p.goals ?? []).length === 0 && <div className="card-empty-sm">No data for this patient</div>}
            {(p.goals ?? []).map((g, i) => (
              <div key={i} className="risk-item" style={{ color: 'var(--navy-600)' }}>
                <span style={{ color: 'var(--teal-500)' }}>→</span>
                <span style={{ fontSize: 11 }}>{g}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Assessment & Plan">
          {p.assessment_plan
            ? <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-body)', lineHeight: 1.6 }}>{p.assessment_plan}</div>
            : <div className="summary-fields"><div className="card-empty-sm">No data for this patient</div></div>}
        </Section>
      </div>
    </div>
  )
}
