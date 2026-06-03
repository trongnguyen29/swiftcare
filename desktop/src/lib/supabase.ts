import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://ujqrxhhshxgqqjkblorh.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqcXJ4aGhzaHhncXFqa2Jsb3JoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDU3NjAsImV4cCI6MjA5NTM4MTc2MH0.t4CgUYE5oPLhocC2YtRF-WW6tMWu2Cvd0mYB_A1jWhk'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export const TABLES = [
  'synthea_pt30k_lc_data_sel_convert',
  'synthea_pt30k1_lc_data_sel_convert',
  'synthea_pt30k2_lc_data_sel_convert',
  'synthea_pt30k3_lc_data_sel_convert',
  'synthea_pt30k4_lc_data_sel_convert',
]

export const CODE_MAP: Record<string, string> = {
  'C-424144002': 'age',
  'C-263495000': 'gender',
  'C-103579009': 'race',
  'C-186034007': 'ethnicity',
  'C-125680007': 'marital',
  'C-398070004': 'state',
  'C-8480-6':    'systolic_bp',
  'C-8462-4':    'diastolic_bp',
  'C-8867-4':    'heart_rate',
  'C-39156-5':   'bmi',
  'C-72166-2':   'tobacco_status',
  'C-72514-3':   'pain_score',
  'C-2093-3':    'total_cholesterol',
  'C-18262-6':   'ldl',
  'C-2085-9':    'hdl',
  'C-2571-8':    'triglycerides',
  'C-4548-4':    'hba1c',
  'C-2345-7':    'glucose',
}

export function normalizeRow(row: Record<string, unknown>): Patient {
  const p: Record<string, unknown> = {
    ptnum:  row['ptnum'],
    label:  Number(row['label']),
    scc:    row['scc'] != null ? Number(row['scc']) : null,
    _table: row['_table'],
  }
  for (const [code, name] of Object.entries(CODE_MAP)) {
    const v = row[code]
    if (v == null) { p[name] = null; continue }
    const numeric = Number(v)
    // Keep numeric values; discard non-numeric strings (e.g. "normal"/"abnormal") as null
    p[name] = (!isNaN(numeric) && String(v).trim() !== '') ? numeric : null
  }
  return p as unknown as Patient
}

/* ─────────────────────────────────────────────
   USCDI v3 — Sub-types
───────────────────────────────────────────── */

/** USCDI v3 · Allergies and Intolerances */
export type Allergy = {
  substance: string           // drug name, food, environmental
  type: 'medication' | 'drug-class' | 'non-medication'
  reaction: string            // e.g. "Hives", "Anaphylaxis"
  severity: 'mild' | 'moderate' | 'severe'
  onset_date: string | null
  status: 'active' | 'inactive' | 'resolved'
}

/** USCDI v3 · Medications */
export type Medication = {
  name: string
  rxnorm_code: string | null  // RxNorm code
  dose: string
  route: string
  frequency: string
  indication: string | null
  start_date: string
  status: 'active' | 'discontinued' | 'on-hold'
}

/** USCDI v3 · Problems / Conditions */
export type Problem = {
  display: string
  icd10_code: string          // ICD-10-CM code
  snomed_code: string | null  // SNOMED CT code
  onset_date: string
  status: 'active' | 'resolved' | 'inactive'
  category: 'encounter-diagnosis' | 'problem-list-item'
}

/** USCDI v3 · Immunizations */
export type Immunization = {
  vaccine: string
  cvx_code: string            // CVX vaccine code
  date: string
  status: 'completed' | 'not-done' | 'entered-in-error'
  lot_number: string | null
}

/** USCDI v3 · Care Team Members */
export type CareTeamMember = {
  name: string
  role: string                // e.g. "PCP", "Cardiologist"
  npi: string | null
  phone: string | null
  organization: string | null
}

/** USCDI v3 · Health Insurance */
export type Insurance = {
  coverage_status: 'active' | 'cancelled' | 'draft'
  coverage_type: string       // e.g. "Medicare", "Medicaid", "Commercial"
  payer: string
  payer_id: string | null
  member_id: string
  subscriber_id: string | null
  group_id: string | null
  relationship_to_subscriber: 'self' | 'spouse' | 'child' | 'other'
}

/** USCDI v3 · Encounter */
export type Encounter = {
  encounter_type: string      // e.g. "Office Visit", "Telehealth"
  date: string
  reason: string
  facility: string | null
  performing_provider: string | null
  disposition: string | null
}

/** USCDI v3 · Clinical Notes */
export type ClinicalNote = {
  note_type: 'progress-note' | 'discharge-summary' | 'history-physical' | 'consultation' | 'procedure-note' | 'lab-report' | 'imaging-narrative'
  date: string
  author: string
  text: string
}

/** USCDI v3 · Procedures */
export type Procedure = {
  display: string
  cpt_code: string | null
  snomed_code: string | null
  date: string
  status: 'completed' | 'in-progress' | 'not-done'
  performer: string | null
}

/* ─────────────────────────────────────────────
   USCDI v3 — Main Patient type
   (19 data classes, 94 data elements)
───────────────────────────────────────────── */
export type Patient = {
  // Legacy fields (Supabase / SCC model)
  ptnum: string
  label: number
  scc: number | null
  _table?: string

  // ── 1. Patient Demographics / Information (USCDI v3) ──
  first_name: string | null
  last_name: string | null
  middle_name: string | null
  date_of_birth: string | null
  age: number | null
  administrative_sex: string | null   // M / F / Unknown
  birth_sex: string | null            // Male / Female / Unknown
  gender_identity: string | null
  preferred_language: string | null
  race: string | null
  ethnicity: string | null
  tribal_affiliation: string | null
  marital: string | null
  address_line: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  phone: string | null
  email: string | null

  // ── 2. Vital Signs (USCDI v3) ──
  systolic_bp: number | null          // LOINC 8480-6
  diastolic_bp: number | null         // LOINC 8462-4
  heart_rate: number | null           // LOINC 8867-4
  respiratory_rate: number | null     // LOINC 9279-1
  temperature_c: number | null        // LOINC 8310-5
  oxygen_saturation: number | null    // LOINC 2708-6
  height_cm: number | null            // LOINC 8302-2
  weight_kg: number | null            // LOINC 29463-7
  bmi: number | null                  // LOINC 39156-5
  pain_score: number | null           // LOINC 72514-3

  // ── 3. Laboratory (USCDI v3) ──
  total_cholesterol: number | null    // LOINC 2093-3
  ldl: number | null                  // LOINC 18262-6
  hdl: number | null                  // LOINC 2085-9
  triglycerides: number | null        // LOINC 2571-8
  hba1c: number | null                // LOINC 4548-4
  glucose: number | null              // LOINC 2345-7
  creatinine: number | null           // LOINC 2160-0
  egfr: number | null                 // LOINC 62238-1
  hemoglobin: number | null           // LOINC 718-7
  wbc: number | null                  // LOINC 6690-2
  platelets: number | null            // LOINC 777-3

  // ── 4. Problems / Conditions (USCDI v3) ──
  problems: Problem[]

  // ── 5. Medications (USCDI v3) ──
  medications: Medication[]

  // ── 6. Allergies and Intolerances (USCDI v3) ──
  allergies: Allergy[]

  // ── 7. Immunizations (USCDI v3) ──
  immunizations: Immunization[]

  // ── 8. Procedures (USCDI v3) ──
  procedures: Procedure[]

  // ── 9. Care Team Members (USCDI v3) ──
  care_team: CareTeamMember[]

  // ── 10. Health Insurance Information (USCDI v3) ──
  insurance: Insurance | null

  // ── 11. Encounter Information (USCDI v3) ──
  encounters: Encounter[]

  // ── 12. Clinical Notes (USCDI v3) ──
  clinical_notes: ClinicalNote[]

  // ── 13. Health Status / Assessments (USCDI v3) ──
  functional_status: string | null    // e.g. "Independent", "Requires assistance"
  mental_cognitive_status: string | null
  disability_status: string | null
  pregnancy_status: string | null

  // ── 14. Social Determinants of Health (USCDI v3) ──
  sdoh_education_level: string | null
  sdoh_financial_strain: string | null  // "None" | "Mild" | "Moderate" | "Severe"
  sdoh_housing_status: string | null
  sdoh_transportation_insecurity: boolean | null
  sdoh_veteran_status: boolean | null
  sdoh_social_isolation: string | null  // "None" | "Mild" | "Moderate" | "Severe"

  // ── 15. Smoking / Tobacco (existing) ──
  tobacco_status: string | null

  // ── 16. Assessment and Plan (USCDI v3) ──
  assessment_plan: string | null

  // ── 17. Goals (USCDI v3) ──
  goals: string[]

  // ── 18. Diagnostic Imaging (USCDI v3) ──
  imaging_results: { study: string; date: string; finding: string }[]

  // ── 19. Provenance (USCDI v3) ──
  provenance_author: string | null
  provenance_organization: string | null
  provenance_timestamp: string | null

  // Legacy gender field
  gender: string | null
}

export type SavedNote = {
  id: string
  patientId: string
  transcript: string
  notes: string
  createdAt: string
}
