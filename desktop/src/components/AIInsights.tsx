import { useState, useRef, useEffect } from 'react'
import type { Patient } from '../lib/supabase'

interface Props { patient: Patient }

/* ─────────────────────────────────────────
   INSIGHTS TAB — rule-based findings
───────────────────────────────────────── */

type Severity = 'critical' | 'warning' | 'info' | 'good'

interface Finding {
  severity: Severity
  category: string
  title: string
  detail: string
  action?: string
}

function derive(p: Patient): Finding[] {
  const findings: Finding[] = []

  if (p.label === 1) {
    findings.push({
      severity: 'critical', category: 'Oncology',
      title: 'Lung Cancer — Positive (LC+)',
      detail: `SCC score ${p.scc ?? 'N/A'}. Patient is flagged as lung-cancer positive in the dataset. Verify imaging and pathology confirmation.`,
      action: 'Review CT/PET reports and confirm staging.',
    })
  }

  if (p.systolic_bp != null && p.systolic_bp >= 140) {
    findings.push({
      severity: 'critical', category: 'Cardiovascular',
      title: `Stage 2 Hypertension — SBP ${p.systolic_bp} mmHg`,
      detail: `Systolic BP ≥ 140 mmHg. DBP: ${p.diastolic_bp ?? '—'} mmHg. Significantly elevated cardiovascular and stroke risk.`,
      action: 'Consider antihypertensive intensification. Evaluate renal function and sodium intake.',
    })
  } else if (p.systolic_bp != null && p.systolic_bp >= 130) {
    findings.push({
      severity: 'warning', category: 'Cardiovascular',
      title: `Stage 1 Hypertension — SBP ${p.systolic_bp} mmHg`,
      detail: `SBP 130–139 mmHg falls in Stage 1 HTN per ACC/AHA 2017 guidelines.`,
      action: 'Lifestyle modification; reassess in 3 months.',
    })
  }

  if (p.heart_rate != null && p.heart_rate > 100) {
    findings.push({
      severity: 'warning', category: 'Cardiovascular',
      title: `Tachycardia — HR ${p.heart_rate} bpm`,
      detail: 'Resting heart rate > 100 bpm. Rule out thyroid disorder, anemia, or arrhythmia.',
      action: 'ECG, TSH, CBC.',
    })
  } else if (p.heart_rate != null && p.heart_rate < 60) {
    findings.push({
      severity: 'warning', category: 'Cardiovascular',
      title: `Bradycardia — HR ${p.heart_rate} bpm`,
      detail: 'Resting heart rate < 60 bpm. May be physiological in athletes; rule out conduction disease or medication effect.',
    })
  }

  if (p.total_cholesterol != null && p.total_cholesterol >= 240) {
    findings.push({
      severity: 'critical', category: 'Lipids',
      title: `High Cholesterol — ${p.total_cholesterol} mg/dL`,
      detail: `Total cholesterol ≥ 240 mg/dL is classified as high. LDL: ${p.ldl ?? '—'}, HDL: ${p.hdl ?? '—'}, Triglycerides: ${p.triglycerides ?? '—'}.`,
      action: 'Initiate or intensify statin therapy. Dietary counseling.',
    })
  } else if (p.total_cholesterol != null && p.total_cholesterol >= 200) {
    findings.push({
      severity: 'warning', category: 'Lipids',
      title: `Borderline Cholesterol — ${p.total_cholesterol} mg/dL`,
      detail: `Total cholesterol 200–239 mg/dL (borderline high). Evaluate 10-year ASCVD risk.`,
    })
  }

  if (p.ldl != null && p.ldl >= 160) {
    findings.push({
      severity: 'warning', category: 'Lipids',
      title: `Elevated LDL — ${p.ldl} mg/dL`,
      detail: 'LDL ≥ 160 mg/dL. High-intensity statin therapy indicated for most patients.',
      action: 'Consider rosuvastatin 20–40 mg or atorvastatin 40–80 mg.',
    })
  }

  if (p.hdl != null && p.hdl < 40 && p.gender === 'm') {
    findings.push({ severity: 'warning', category: 'Lipids', title: `Low HDL — ${p.hdl} mg/dL`, detail: 'HDL < 40 mg/dL in males is an independent cardiovascular risk factor.' })
  } else if (p.hdl != null && p.hdl < 50 && p.gender === 'f') {
    findings.push({ severity: 'warning', category: 'Lipids', title: `Low HDL — ${p.hdl} mg/dL`, detail: 'HDL < 50 mg/dL in females is an independent cardiovascular risk factor.' })
  }

  if (p.hba1c != null && p.hba1c >= 6.5) {
    findings.push({
      severity: 'critical', category: 'Endocrine',
      title: `Diabetes — HbA1c ${p.hba1c}%`,
      detail: `HbA1c ≥ 6.5% meets ADA criteria for diabetes. Glucose: ${p.glucose ?? '—'} mg/dL.`,
      action: 'Initiate metformin, patient education, and nutritional referral. Recheck HbA1c in 3 months.',
    })
  } else if (p.hba1c != null && p.hba1c >= 5.7) {
    findings.push({
      severity: 'warning', category: 'Endocrine',
      title: `Prediabetes — HbA1c ${p.hba1c}%`,
      detail: 'HbA1c 5.7–6.4% is consistent with prediabetes. Risk of progression to T2DM ~10% per year without intervention.',
      action: 'Intensive lifestyle intervention. Recheck HbA1c in 6–12 months.',
    })
  }

  if (p.glucose != null && p.glucose >= 126) {
    findings.push({ severity: 'warning', category: 'Endocrine', title: `Fasting Glucose Elevated — ${p.glucose} mg/dL`, detail: 'Fasting plasma glucose ≥ 126 mg/dL consistent with diabetes; confirm with repeat testing.' })
  } else if (p.glucose != null && p.glucose >= 100 && p.glucose < 126) {
    findings.push({ severity: 'info', category: 'Endocrine', title: `Impaired Fasting Glucose — ${p.glucose} mg/dL`, detail: 'Fasting glucose 100–125 mg/dL indicates impaired fasting glucose (IFG). Monitor closely.' })
  }

  if (p.bmi != null && p.bmi >= 35) {
    findings.push({
      severity: 'critical', category: 'Metabolic',
      title: `Severe Obesity — BMI ${p.bmi}`,
      detail: 'BMI ≥ 35 (Class II/III obesity). High risk for T2DM, CVD, sleep apnea, and NASH.',
      action: 'Structured weight management program. Consider GLP-1 agonist or bariatric evaluation.',
    })
  } else if (p.bmi != null && p.bmi >= 30) {
    findings.push({
      severity: 'warning', category: 'Metabolic',
      title: `Obesity — BMI ${p.bmi}`,
      detail: 'BMI 30–34.9 (Class I obesity). Increased metabolic and cardiovascular risk.',
      action: 'Behavioral weight loss intervention; target ≥5% weight reduction.',
    })
  } else if (p.bmi != null && p.bmi >= 25) {
    findings.push({ severity: 'info', category: 'Metabolic', title: `Overweight — BMI ${p.bmi}`, detail: 'BMI 25–29.9. Counsel on diet, physical activity, and weight management.' })
  }

  if (p.tobacco_status === 'former') {
    findings.push({
      severity: 'info', category: 'Oncology / Respiratory',
      title: 'Former Smoker',
      detail: 'Former tobacco use remains a significant risk factor for lung cancer, COPD, and cardiovascular disease.',
      action: 'Annual low-dose CT (LDCT) lung cancer screening if within eligibility criteria (age 50–80, ≥20 pack-year history).',
    })
  }

  if (p.age != null && p.age >= 65) {
    findings.push({ severity: 'info', category: 'Geriatric', title: `Age ${p.age} — Geriatric Considerations`, detail: 'Patients ≥ 65 warrant assessment for polypharmacy, fall risk, cognitive screening, and vaccine status.' })
  }

  if (p.pain_score != null && p.pain_score >= 7) {
    findings.push({
      severity: 'warning', category: 'Pain Management',
      title: `Severe Pain — Score ${p.pain_score}/10`,
      detail: 'Pain score ≥ 7 indicates severe pain requiring prompt assessment and management.',
      action: 'Evaluate pain etiology, consider analgesic escalation or specialist referral.',
    })
  } else if (p.pain_score != null && p.pain_score >= 4) {
    findings.push({ severity: 'info', category: 'Pain Management', title: `Moderate Pain — Score ${p.pain_score}/10`, detail: 'Moderate pain (4–6/10). Ensure adequate pain management and monitor response.' })
  }

  if (p.egfr != null && p.egfr < 30) {
    findings.push({
      severity: 'critical', category: 'Renal',
      title: `Severe CKD — eGFR ${p.egfr} mL/min (Stage 4–5)`,
      detail: 'eGFR < 30 indicates Stage 4–5 CKD. High risk for dialysis requirement. Avoid nephrotoxic agents.',
      action: 'Nephrology referral. Review all medications for renal dosing. Discuss AV fistula/dialysis planning.',
    })
  } else if (p.egfr != null && p.egfr < 60) {
    findings.push({
      severity: 'warning', category: 'Renal',
      title: `Moderate CKD — eGFR ${p.egfr} mL/min (Stage 3)`,
      detail: 'eGFR 30–59 indicates Stage 3 CKD. Avoid NSAIDs and nephrotoxic contrast agents.',
      action: 'Monitor creatinine and potassium quarterly. BP target < 130/80.',
    })
  }

  if (p.oxygen_saturation != null && p.oxygen_saturation < 92) {
    findings.push({
      severity: 'critical', category: 'Respiratory',
      title: `Low Oxygen Saturation — SpO₂ ${p.oxygen_saturation}%`,
      detail: 'SpO₂ < 92% is clinically significant hypoxemia. Urgent assessment required.',
      action: 'Supplemental O₂, ABG, chest X-ray. Consider pulmonology.',
    })
  } else if (p.oxygen_saturation != null && p.oxygen_saturation < 95) {
    findings.push({ severity: 'warning', category: 'Respiratory', title: `Borderline SpO₂ — ${p.oxygen_saturation}%`, detail: 'SpO₂ 92–94% warrants close monitoring, especially in COPD or lung cancer patients.' })
  }

  const severeAllergies = (p.allergies ?? []).filter(a => a.severity === 'severe' && a.status === 'active')
  if (severeAllergies.length > 0) {
    findings.push({
      severity: 'critical', category: 'Allergies',
      title: `${severeAllergies.length} Severe Active Allerg${severeAllergies.length > 1 ? 'ies' : 'y'}`,
      detail: severeAllergies.map(a => `${a.substance} → ${a.reaction}`).join('; '),
      action: 'Ensure allergy list is flagged in all prescribing systems. Verify no current medications are contraindicated.',
    })
  }

  if (p.sdoh_housing_status && p.sdoh_housing_status.toLowerCase().includes('unstable')) {
    findings.push({
      severity: 'warning', category: 'Social Determinants',
      title: 'Unstable Housing',
      detail: `Patient housing status: "${p.sdoh_housing_status}". Unstable housing adversely impacts medication adherence and follow-up.`,
      action: 'Social work referral. Connect to local housing assistance programs.',
    })
  }
  if (p.sdoh_financial_strain === 'Severe' || p.sdoh_financial_strain === 'Moderate') {
    findings.push({
      severity: 'info', category: 'Social Determinants',
      title: `Financial Strain — ${p.sdoh_financial_strain}`,
      detail: 'Financial insecurity may impact medication adherence and access to care.',
      action: 'Review medication cost burden. Explore patient assistance programs.',
    })
  }
  if (p.sdoh_transportation_insecurity) {
    findings.push({
      severity: 'info', category: 'Social Determinants',
      title: 'Transportation Insecurity',
      detail: 'Patient reports difficulty accessing transportation to appointments.',
      action: 'Explore telehealth options and transportation assistance programs.',
    })
  }

  const activeProblems = (p.problems ?? []).filter(pr => pr.status === 'active')
  if (activeProblems.length >= 5) {
    findings.push({
      severity: 'info', category: 'Care Coordination',
      title: `High Complexity — ${activeProblems.length} Active Conditions`,
      detail: `Patient has ${activeProblems.length} active conditions requiring coordinated care across multiple specialties.`,
      action: 'Consider multidisciplinary care conference. Review for polypharmacy.',
    })
  }

  const activeMeds = (p.medications ?? []).filter(m => m.status === 'active')
  if (activeMeds.length >= 7) {
    findings.push({
      severity: 'warning', category: 'Medications',
      title: `Polypharmacy — ${activeMeds.length} Active Medications`,
      detail: 'Patients on 7+ medications have significantly elevated risk of adverse drug interactions and non-adherence.',
      action: 'Medication reconciliation. Consider deprescribing review.',
    })
  }

  if (p.systolic_bp != null && p.systolic_bp < 130 && p.diastolic_bp != null && p.diastolic_bp < 80) {
    findings.push({ severity: 'good', category: 'Cardiovascular', title: 'Blood Pressure — Normal', detail: `BP ${p.systolic_bp}/${p.diastolic_bp} mmHg is within normal range.` })
  }
  if (p.hba1c != null && p.hba1c < 5.7) {
    findings.push({ severity: 'good', category: 'Endocrine', title: 'HbA1c — Normal', detail: `HbA1c ${p.hba1c}% — no evidence of diabetes or prediabetes.` })
  }
  if (p.bmi != null && p.bmi >= 18.5 && p.bmi < 25) {
    findings.push({ severity: 'good', category: 'Metabolic', title: 'BMI — Healthy Range', detail: `BMI ${p.bmi} is within the normal range (18.5–24.9).` })
  }
  if ((p.allergies ?? []).length === 0) {
    findings.push({ severity: 'good', category: 'Allergies', title: 'No Known Allergies', detail: 'No allergies or intolerances documented for this patient.' })
  }
  if (p.egfr != null && p.egfr >= 60) {
    findings.push({ severity: 'good', category: 'Renal', title: `Renal Function — Normal (eGFR ${p.egfr})`, detail: 'eGFR ≥ 60 mL/min indicates adequate renal function.' })
  }

  const order: Record<Severity, number> = { critical: 0, warning: 1, info: 2, good: 3 }
  return findings.sort((a, b) => order[a.severity] - order[b.severity])
}

const SEV_STYLE: Record<Severity, { bg: string; border: string; color: string; icon: string }> = {
  critical: { bg: 'var(--danger-bg)',  border: 'var(--danger-bdr)',  color: 'var(--danger)',   icon: '⚠' },
  warning:  { bg: 'var(--warn-bg)',    border: 'var(--warn-bdr)',    color: 'var(--warn)',     icon: '!' },
  info:     { bg: 'var(--blue-50)',    border: 'var(--blue-200)',    color: 'var(--blue-600)', icon: 'i' },
  good:     { bg: 'var(--ok-bg)',      border: 'var(--ok-bdr)',      color: 'var(--ok)',       icon: '✓' },
}

function InsightsTab({ patient: p }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null)
  const findings = derive(p)
  const critical = findings.filter(f => f.severity === 'critical').length
  const warning  = findings.filter(f => f.severity === 'warning').length

  return (
    <>
      <div className="ai-tab-subheader">
        <div style={{ display: 'flex', gap: 6 }}>
          {critical > 0 && <span className="badge badge-danger">{critical} Critical</span>}
          {warning  > 0 && <span className="badge badge-warn">{warning} Warning{warning > 1 ? 's' : ''}</span>}
          {critical === 0 && warning === 0 && <span className="badge badge-ok">All Clear</span>}
        </div>
        <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{findings.length} finding{findings.length !== 1 ? 's' : ''}</span>
      </div>

      {findings.length === 0 && (
        <div className="ai-empty">No significant clinical findings. All reviewed parameters are within normal limits.</div>
      )}

      <div className="ai-findings">
        {findings.map((f, i) => {
          const s = SEV_STYLE[f.severity]
          const open = expanded === i
          return (
            <div
              key={i}
              className={`ai-finding ${open ? 'ai-finding--open' : ''}`}
              style={{ borderLeft: `3px solid ${s.color}`, background: open ? s.bg : undefined }}
              onClick={() => setExpanded(open ? null : i)}
            >
              <div className="ai-finding-row">
                <span className="ai-finding-icon" style={{ background: s.color }}>{s.icon}</span>
                <div className="ai-finding-main">
                  <span className="ai-finding-cat">{f.category}</span>
                  <span className="ai-finding-title">{f.title}</span>
                </div>
                <span className="ai-finding-chevron" style={{ color: s.color }}>{open ? '▲' : '▼'}</span>
              </div>
              {open && (
                <div className="ai-finding-detail" style={{ borderTop: `1px solid ${s.border}` }}>
                  <p className="ai-detail-text">{f.detail}</p>
                  {f.action && (
                    <div className="ai-action">
                      <span className="ai-action-label">Suggested Action</span>
                      <p className="ai-action-text">{f.action}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="ai-footer">
        AI Insights are generated from structured EHR data using evidence-based clinical thresholds.
        Always apply clinical judgment. Not a substitute for professional medical advice.
      </div>
    </>
  )
}

/* ─────────────────────────────────────────
   CHAT TAB — LM Studio (fully local, OpenAI-compatible API)
   Download: https://lmstudio.ai
   1. Open LM Studio → search "qwen" → Download any Qwen model
   2. Go to Local Server tab → Start Server
   That's it — no terminal needed.
───────────────────────────────────────── */

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const LM_STUDIO_URL = 'http://localhost:1234'
const DEFAULT_MODEL = 'local-model' // LM Studio uses whatever model is loaded

function buildPatientContext(p: Patient): string {
  const name  = [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' ') || p.ptnum
  const meds  = (p.medications ?? []).filter(m => m.status === 'active').map(m => `${m.name} ${m.dose ?? ''} (${m.frequency ?? ''})`).join(', ') || 'None'
  const probs = (p.problems ?? []).filter(pr => pr.status === 'active').map(pr => `${pr.display} (${pr.icd10_code})`).join(', ') || 'None'
  const allgs = (p.allergies ?? []).map(a => `${a.substance} [${a.severity}]`).join(', ') || 'NKDA'

  return `PATIENT RECORD — CONFIDENTIAL
Patient: ${name} | ID: ${p.ptnum}
Age: ${p.age ?? '—'} | Sex: ${p.administrative_sex ?? '—'} | Race: ${p.race ?? '—'}
LC Status: ${p.label === 1 ? 'Lung Cancer Positive (LC+)' : 'Control'} | SCC Score: ${p.scc ?? '—'}
Tobacco: ${p.tobacco_status ?? '—'}

VITALS
BP: ${p.systolic_bp ?? '—'}/${p.diastolic_bp ?? '—'} mmHg | HR: ${p.heart_rate ?? '—'} bpm | SpO₂: ${p.oxygen_saturation ?? '—'}% | BMI: ${p.bmi ?? '—'} | Pain: ${p.pain_score ?? '—'}/10

LABS
Total Cholesterol: ${p.total_cholesterol ?? '—'} | LDL: ${p.ldl ?? '—'} | HDL: ${p.hdl ?? '—'} | TG: ${p.triglycerides ?? '—'}
HbA1c: ${p.hba1c ?? '—'}% | Glucose: ${p.glucose ?? '—'} | eGFR: ${p.egfr ?? '—'} | Creatinine: ${p.creatinine ?? '—'}
Hemoglobin: ${p.hemoglobin ?? '—'} | WBC: ${p.wbc ?? '—'} | Platelets: ${p.platelets ?? '—'}

ACTIVE PROBLEMS: ${probs}
ACTIVE MEDICATIONS: ${meds}
ALLERGIES: ${allgs}

SDOH: Education: ${p.sdoh_education_level ?? '—'} | Housing: ${p.sdoh_housing_status ?? '—'} | Financial: ${p.sdoh_financial_strain ?? '—'} | Transport insecurity: ${p.sdoh_transportation_insecurity ? 'Yes' : 'No'}

${p.assessment_plan ? `ASSESSMENT & PLAN:\n${p.assessment_plan}` : ''}`
}

const SYSTEM_PROMPT = (ctx: string) =>
`You are a clinical AI assistant embedded in SwiftCare EHR. You have access to the following patient record and can help clinicians think through differential diagnoses, treatment considerations, drug interactions, care gaps, and evidence-based guidelines.

Rules:
- Decision-support only. Always remind clinicians to apply their own judgment.
- Never make definitive diagnoses — use language like "consider," "may suggest," "consistent with."
- Keep responses concise and clinically focused. Use bullet points when listing items.
- All inference runs locally on this device — patient data never leaves the machine.

${ctx}`

function ChatTab({ patient: p }: Props) {
  const [messages, setMessages]   = useState<ChatMessage[]>([])
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [serverOk, setServerOk]   = useState<boolean | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef  = useRef<AbortController | null>(null)

  // Check LM Studio health — plain timeout via Promise.race, no AbortSignal.timeout
  useEffect(() => {
    setMessages([])
    setError(null)
    setServerOk(null)

    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 3000)

    fetch(`${LM_STUDIO_URL}/v1/models`, { signal: ctrl.signal })
      .then(r => setServerOk(r.ok))
      .catch(() => setServerOk(false))
      .finally(() => clearTimeout(timer))

    return () => { ctrl.abort(); clearTimeout(timer) }
  }, [p.ptnum])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setError(null)

    const userMsg: ChatMessage = { role: 'user', content: text }
    const history = [...messages, userMsg]
    setMessages(history)
    setLoading(true)

    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      const res = await fetch(`${LM_STUDIO_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          model: DEFAULT_MODEL,
          stream: true,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT(buildPatientContext(p)) },
            ...history.map(m => ({ role: m.role, content: m.content })),
          ],
        }),
      })

      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        throw new Error(`Server returned ${res.status}${txt ? ': ' + txt.slice(0, 120) : ''}`)
      }
      if (!res.body) throw new Error('No response body')

      // Add empty assistant bubble to stream into
      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let assistantText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        for (const line of chunk.split('\n')) {
          const trimmed = line.trim()
          if (!trimmed || trimmed === 'data: [DONE]') continue
          const jsonStr = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed
          try {
            const json = JSON.parse(jsonStr)
            const token: string = json.choices?.[0]?.delta?.content ?? ''
            assistantText += token
            setMessages(prev => {
              const updated = [...prev]
              updated[updated.length - 1] = { role: 'assistant', content: assistantText }
              return updated
            })
          } catch {
            // skip non-JSON lines
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') {
        // user stopped — keep partial response
      } else {
        setError(`${(err as Error).message}. Is LM Studio running with a model loaded and server started?`)
        // remove empty bubble if nothing came through
        setMessages(prev => {
          const last = prev[prev.length - 1]
          return last?.role === 'assistant' && !last.content ? prev.slice(0, -1) : prev
        })
      }
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }

  function stop() { abortRef.current?.abort() }

  function clearChat() {
    abortRef.current?.abort()
    setMessages([])
    setError(null)
  }

  const suggestions = [
    "Summarize this patient's key clinical concerns",
    'What drug interactions should I watch for?',
    'Are there any care gaps based on current data?',
    'What does the SCC score indicate here?',
  ]

  const statusLabel = serverOk === null ? 'Checking LM Studio…' : serverOk ? 'LM Studio connected' : 'LM Studio offline'

  return (
    <div className="ai-chat-wrap">
      {/* Status bar */}
      <div className="ai-chat-statusbar">
        <div className="ai-chat-status-left">
          <span className={`ollama-dot ${serverOk === true ? 'ollama-dot--ok' : serverOk === false ? 'ollama-dot--err' : 'ollama-dot--checking'}`} />
          <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{statusLabel}</span>
          <span className="ai-privacy-chip">🔒 On-device · No data sent externally</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {messages.length > 0 && (
            <button className="btn-ghost-sm" onClick={clearChat}>Clear</button>
          )}
        </div>
      </div>

      {/* Offline notice */}
      {serverOk === false && (
        <div className="ai-chat-offline">
          <strong>LM Studio not detected.</strong> To get started:
          <ol style={{ marginTop: 6, paddingLeft: 18, lineHeight: 1.8 }}>
            <li>Download <strong>LM Studio</strong> at <span style={{ fontFamily: 'var(--mono)' }}>lmstudio.ai</span> (free, Mac app)</li>
            <li>Search for a <strong>Qwen</strong> model (e.g. <em>Qwen2.5 7B</em>) and download it</li>
            <li>Go to the <strong>Local Server</strong> tab → click <strong>Start Server</strong></li>
            <li>Come back here and reload</li>
          </ol>
        </div>
      )}

      {/* Messages */}
      <div className="ai-chat-messages">
        {messages.length === 0 && serverOk !== false && (
          <div className="ai-chat-empty">
            <div className="ai-chat-empty-icon">
              <span style={{ fontSize: 18 }}>🤖</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 4 }}>
              Ask anything about this patient
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 12 }}>
              Powered by LM Studio — runs entirely on your Mac
            </div>
            <div className="ai-suggested-questions">
              {suggestions.map(q => (
                <button key={q} className="ai-suggested-q" onClick={() => setInput(q)}>{q}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`ai-chat-msg ai-chat-msg--${m.role}`}>
            <div className="ai-chat-msg-label">{m.role === 'user' ? 'You' : 'AI'}</div>
            <div className="ai-chat-msg-bubble">
              {m.content
                ? m.content.split('\n').map((line, li, arr) => (
                    <span key={li}>{line}{li < arr.length - 1 ? <br /> : null}</span>
                  ))
                : <span className="ai-typing-cursor" />
              }
            </div>
          </div>
        ))}

        {error && <div className="ai-chat-error">⚠ {error}</div>}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="ai-chat-input-row">
        <textarea
          className="ai-chat-input"
          placeholder={serverOk === false ? 'Start LM Studio to enable chat…' : 'Ask about this patient… (Enter to send, Shift+Enter for newline)'}
          value={input}
          disabled={serverOk === false}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          rows={2}
        />
        {loading
          ? <button className="ai-send-btn ai-send-btn--stop" onClick={stop} title="Stop">■</button>
          : <button className="ai-send-btn" onClick={send} disabled={!input.trim() || serverOk === false} title="Send (Enter)">↑</button>
        }
      </div>
      <div className="ai-footer">
        All AI inference runs locally via LM Studio. Patient data never leaves this device.
        Clinical output is for decision support only — always apply professional judgment.
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────
   ROOT COMPONENT — tabbed container
───────────────────────────────────────── */

type Tab = 'insights' | 'chat'

export default function AIInsights({ patient: p }: Props) {
  const [tab, setTab] = useState<Tab>('insights')

  const findings = derive(p)
  const critical = findings.filter(f => f.severity === 'critical').length
  const warning  = findings.filter(f => f.severity === 'warning').length

  return (
    <div className="card ai-card">
      {/* Header */}
      <div className="card-header ai-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="ai-badge">AI</span>
          <div className="ai-tab-pills">
            <button
              className={`ai-tab-pill ${tab === 'insights' ? 'ai-tab-pill--active' : ''}`}
              onClick={() => setTab('insights')}
            >
              Clinical Insights
              {critical > 0 && <span className="ai-tab-pill-dot ai-tab-pill-dot--danger">{critical}</span>}
              {critical === 0 && warning > 0 && <span className="ai-tab-pill-dot ai-tab-pill-dot--warn">{warning}</span>}
            </button>
            <button
              className={`ai-tab-pill ${tab === 'chat' ? 'ai-tab-pill--active' : ''}`}
              onClick={() => setTab('chat')}
            >
              AI Chat
              <span className="ai-tab-pill-local">local</span>
            </button>
          </div>
        </div>
      </div>

      {tab === 'insights' ? <InsightsTab patient={p} /> : <ChatTab patient={p} />}
    </div>
  )
}
