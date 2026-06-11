import type { Patient } from './supabase'

/** Stable 32-bit FNV-1a hash of a string, hex-encoded.
 *  Used to fingerprint the summary's input so we know when to regenerate. */
export function fingerprint(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16)
}

export function buildPatientContext(p: Patient): string {
  const name  = [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' ').replace(/\d+/g, '').trim() || p.ptnum
  const meds  = (p.medications ?? []).filter(m => m.status === 'active')
    .map(m => `${m.name} ${m.dose ?? ''} (${m.frequency ?? ''})`).join(', ') || 'None'
  const probs = (p.problems ?? []).filter(pr => pr.status === 'active')
    .map(pr => `${pr.display} (${pr.icd10_code})`).join(', ') || 'None'
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
