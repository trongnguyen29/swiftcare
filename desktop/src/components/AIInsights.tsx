import { useState } from 'react'
import type { Patient } from '../lib/supabase'

interface Props { patient: Patient }

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

  /* ── Lung cancer flag ── */
  if (p.label === 1) {
    findings.push({
      severity: 'critical',
      category: 'Oncology',
      title: 'Lung Cancer — Positive (LC+)',
      detail: `SCC score ${p.scc ?? 'N/A'}. Patient is flagged as lung-cancer positive in the dataset. Verify imaging and pathology confirmation.`,
      action: 'Review CT/PET reports and confirm staging.',
    })
  }

  /* ── Hypertension ── */
  if (p.systolic_bp != null && p.systolic_bp >= 140) {
    findings.push({
      severity: 'critical',
      category: 'Cardiovascular',
      title: `Stage 2 Hypertension — SBP ${p.systolic_bp} mmHg`,
      detail: `Systolic BP ≥ 140 mmHg. DBP: ${p.diastolic_bp ?? '—'} mmHg. Significantly elevated cardiovascular and stroke risk.`,
      action: 'Consider antihypertensive intensification. Evaluate renal function and sodium intake.',
    })
  } else if (p.systolic_bp != null && p.systolic_bp >= 130) {
    findings.push({
      severity: 'warning',
      category: 'Cardiovascular',
      title: `Stage 1 Hypertension — SBP ${p.systolic_bp} mmHg`,
      detail: `SBP 130–139 mmHg falls in Stage 1 HTN per ACC/AHA 2017 guidelines.`,
      action: 'Lifestyle modification; reassess in 3 months.',
    })
  }

  /* ── Abnormal heart rate ── */
  if (p.heart_rate != null && p.heart_rate > 100) {
    findings.push({
      severity: 'warning',
      category: 'Cardiovascular',
      title: `Tachycardia — HR ${p.heart_rate} bpm`,
      detail: 'Resting heart rate > 100 bpm. Rule out thyroid disorder, anemia, or arrhythmia.',
      action: 'ECG, TSH, CBC.',
    })
  } else if (p.heart_rate != null && p.heart_rate < 60) {
    findings.push({
      severity: 'warning',
      category: 'Cardiovascular',
      title: `Bradycardia — HR ${p.heart_rate} bpm`,
      detail: 'Resting heart rate < 60 bpm. May be physiological in athletes; rule out conduction disease or medication effect.',
    })
  }

  /* ── Cholesterol ── */
  if (p.total_cholesterol != null && p.total_cholesterol >= 240) {
    findings.push({
      severity: 'critical',
      category: 'Lipids',
      title: `High Cholesterol — ${p.total_cholesterol} mg/dL`,
      detail: `Total cholesterol ≥ 240 mg/dL is classified as high. LDL: ${p.ldl ?? '—'}, HDL: ${p.hdl ?? '—'}, Triglycerides: ${p.triglycerides ?? '—'}.`,
      action: 'Initiate or intensify statin therapy. Dietary counseling.',
    })
  } else if (p.total_cholesterol != null && p.total_cholesterol >= 200) {
    findings.push({
      severity: 'warning',
      category: 'Lipids',
      title: `Borderline Cholesterol — ${p.total_cholesterol} mg/dL`,
      detail: `Total cholesterol 200–239 mg/dL (borderline high). Evaluate 10-year ASCVD risk.`,
    })
  }

  if (p.ldl != null && p.ldl >= 160) {
    findings.push({
      severity: 'warning',
      category: 'Lipids',
      title: `Elevated LDL — ${p.ldl} mg/dL`,
      detail: 'LDL ≥ 160 mg/dL. High-intensity statin therapy indicated for most patients.',
      action: 'Consider rosuvastatin 20–40 mg or atorvastatin 40–80 mg.',
    })
  }

  if (p.hdl != null && p.hdl < 40 && p.gender === 'm') {
    findings.push({
      severity: 'warning',
      category: 'Lipids',
      title: `Low HDL — ${p.hdl} mg/dL`,
      detail: 'HDL < 40 mg/dL in males is an independent cardiovascular risk factor.',
    })
  } else if (p.hdl != null && p.hdl < 50 && p.gender === 'f') {
    findings.push({
      severity: 'warning',
      category: 'Lipids',
      title: `Low HDL — ${p.hdl} mg/dL`,
      detail: 'HDL < 50 mg/dL in females is an independent cardiovascular risk factor.',
    })
  }

  /* ── HbA1c / Glucose ── */
  if (p.hba1c != null && p.hba1c >= 6.5) {
    findings.push({
      severity: 'critical',
      category: 'Endocrine',
      title: `Diabetes — HbA1c ${p.hba1c}%`,
      detail: `HbA1c ≥ 6.5% meets ADA criteria for diabetes. Glucose: ${p.glucose ?? '—'} mg/dL.`,
      action: 'Initiate metformin, patient education, and nutritional referral. Recheck HbA1c in 3 months.',
    })
  } else if (p.hba1c != null && p.hba1c >= 5.7) {
    findings.push({
      severity: 'warning',
      category: 'Endocrine',
      title: `Prediabetes — HbA1c ${p.hba1c}%`,
      detail: 'HbA1c 5.7–6.4% is consistent with prediabetes. Risk of progression to T2DM ~10% per year without intervention.',
      action: 'Intensive lifestyle intervention. Recheck HbA1c in 6–12 months.',
    })
  }

  if (p.glucose != null && p.glucose >= 126) {
    findings.push({
      severity: 'warning',
      category: 'Endocrine',
      title: `Fasting Glucose Elevated — ${p.glucose} mg/dL`,
      detail: 'Fasting plasma glucose ≥ 126 mg/dL consistent with diabetes; confirm with repeat testing.',
    })
  } else if (p.glucose != null && p.glucose >= 100 && p.glucose < 126) {
    findings.push({
      severity: 'info',
      category: 'Endocrine',
      title: `Impaired Fasting Glucose — ${p.glucose} mg/dL`,
      detail: 'Fasting glucose 100–125 mg/dL indicates impaired fasting glucose (IFG). Monitor closely.',
    })
  }

  /* ── BMI ── */
  if (p.bmi != null && p.bmi >= 35) {
    findings.push({
      severity: 'critical',
      category: 'Metabolic',
      title: `Severe Obesity — BMI ${p.bmi}`,
      detail: 'BMI ≥ 35 (Class II/III obesity). High risk for T2DM, CVD, sleep apnea, and NASH.',
      action: 'Structured weight management program. Consider GLP-1 agonist or bariatric evaluation.',
    })
  } else if (p.bmi != null && p.bmi >= 30) {
    findings.push({
      severity: 'warning',
      category: 'Metabolic',
      title: `Obesity — BMI ${p.bmi}`,
      detail: 'BMI 30–34.9 (Class I obesity). Increased metabolic and cardiovascular risk.',
      action: 'Behavioral weight loss intervention; target ≥5% weight reduction.',
    })
  } else if (p.bmi != null && p.bmi >= 25) {
    findings.push({
      severity: 'info',
      category: 'Metabolic',
      title: `Overweight — BMI ${p.bmi}`,
      detail: 'BMI 25–29.9. Counsel on diet, physical activity, and weight management.',
    })
  }

  /* ── Tobacco ── */
  if (p.tobacco_status === 'former') {
    findings.push({
      severity: 'info',
      category: 'Oncology / Respiratory',
      title: 'Former Smoker',
      detail: 'Former tobacco use remains a significant risk factor for lung cancer, COPD, and cardiovascular disease.',
      action: 'Annual low-dose CT (LDCT) lung cancer screening if within eligibility criteria (age 50–80, ≥20 pack-year history).',
    })
  }

  /* ── Age ── */
  if (p.age != null && p.age >= 65) {
    findings.push({
      severity: 'info',
      category: 'Geriatric',
      title: `Age ${p.age} — Geriatric Considerations`,
      detail: 'Patients ≥ 65 warrant assessment for polypharmacy, fall risk, cognitive screening, and vaccine status.',
    })
  }

  /* ── Pain ── */
  if (p.pain_score != null && p.pain_score >= 7) {
    findings.push({
      severity: 'warning',
      category: 'Pain Management',
      title: `Severe Pain — Score ${p.pain_score}/10`,
      detail: 'Pain score ≥ 7 indicates severe pain requiring prompt assessment and management.',
      action: 'Evaluate pain etiology, consider analgesic escalation or specialist referral.',
    })
  } else if (p.pain_score != null && p.pain_score >= 4) {
    findings.push({
      severity: 'info',
      category: 'Pain Management',
      title: `Moderate Pain — Score ${p.pain_score}/10`,
      detail: 'Moderate pain (4–6/10). Ensure adequate pain management and monitor response.',
    })
  }

  /* ── CKD / Renal ── */
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

  /* ── SpO₂ ── */
  if (p.oxygen_saturation != null && p.oxygen_saturation < 92) {
    findings.push({
      severity: 'critical', category: 'Respiratory',
      title: `Low Oxygen Saturation — SpO₂ ${p.oxygen_saturation}%`,
      detail: 'SpO₂ < 92% is clinically significant hypoxemia. Urgent assessment required.',
      action: 'Supplemental O₂, ABG, chest X-ray. Consider pulmonology.',
    })
  } else if (p.oxygen_saturation != null && p.oxygen_saturation < 95) {
    findings.push({
      severity: 'warning', category: 'Respiratory',
      title: `Borderline SpO₂ — ${p.oxygen_saturation}%`,
      detail: 'SpO₂ 92–94% warrants close monitoring, especially in COPD or lung cancer patients.',
    })
  }

  /* ── Severe allergies ── */
  const severeAllergies = (p.allergies ?? []).filter(a => a.severity === 'severe' && a.status === 'active')
  if (severeAllergies.length > 0) {
    findings.push({
      severity: 'critical', category: 'Allergies',
      title: `${severeAllergies.length} Severe Active Allerg${severeAllergies.length > 1 ? 'ies' : 'y'}`,
      detail: severeAllergies.map(a => `${a.substance} → ${a.reaction}`).join('; '),
      action: 'Ensure allergy list is flagged in all prescribing systems. Verify no current medications are contraindicated.',
    })
  }

  /* ── SDOH flags ── */
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

  /* ── Active problem count ── */
  const activeProblems = (p.problems ?? []).filter(pr => pr.status === 'active')
  if (activeProblems.length >= 5) {
    findings.push({
      severity: 'info', category: 'Care Coordination',
      title: `High Complexity — ${activeProblems.length} Active Conditions`,
      detail: `Patient has ${activeProblems.length} active conditions requiring coordinated care across multiple specialties.`,
      action: 'Consider multidisciplinary care conference. Review for polypharmacy.',
    })
  }

  /* ── Medication count (polypharmacy) ── */
  const activeMeds = (p.medications ?? []).filter(m => m.status === 'active')
  if (activeMeds.length >= 7) {
    findings.push({
      severity: 'warning', category: 'Medications',
      title: `Polypharmacy — ${activeMeds.length} Active Medications`,
      detail: 'Patients on 7+ medications have significantly elevated risk of adverse drug interactions and non-adherence.',
      action: 'Medication reconciliation. Consider deprescribing review.',
    })
  }

  /* ── All clear items ── */
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

  /* Sort: critical → warning → info → good */
  const order: Record<Severity, number> = { critical: 0, warning: 1, info: 2, good: 3 }
  return findings.sort((a, b) => order[a.severity] - order[b.severity])
}

const SEV_STYLE: Record<Severity, { bg: string; border: string; color: string; icon: string; dot: string }> = {
  critical: { bg: 'var(--danger-bg)',  border: 'var(--danger-bdr)',  color: 'var(--danger)', icon: '⚠', dot: 'dot-critical' },
  warning:  { bg: 'var(--warn-bg)',    border: 'var(--warn-bdr)',    color: 'var(--warn)',   icon: '!', dot: 'dot-warning'  },
  info:     { bg: 'var(--blue-50)',    border: 'var(--blue-200)',    color: 'var(--blue-600)', icon: 'i', dot: 'dot-info'  },
  good:     { bg: 'var(--ok-bg)',      border: 'var(--ok-bdr)',      color: 'var(--ok)',     icon: '✓', dot: 'dot-good'    },
}

export default function AIInsights({ patient: p }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null)
  const findings = derive(p)
  const critical = findings.filter(f => f.severity === 'critical').length
  const warning  = findings.filter(f => f.severity === 'warning').length

  return (
    <div className="card ai-card">
      <div className="card-header ai-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="ai-badge">AI</span>
          <span className="card-title">Clinical Insights</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {critical > 0 && <span className="badge badge-danger">{critical} Critical</span>}
          {warning  > 0 && <span className="badge badge-warn">{warning} Warning{warning > 1 ? 's' : ''}</span>}
        </div>
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
    </div>
  )
}
