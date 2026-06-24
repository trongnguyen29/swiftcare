// Supabase credentials and queries are handled by the Rust backend (src-tauri/src/lib.rs).
// This file contains FHIR resource types and the normaliser used by api.ts.


function findExtension(extensions: any[], url: string): any | null {
  return extensions?.find((e: any) => e.url === url) ?? null
}

function computeAge(birthDate: string | null): number | null {
  if (!birthDate) return null
  const birth = new Date(birthDate)
  const now = new Date()
  return now.getFullYear() - birth.getFullYear() -
    (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0)
}

export function normalizeRow(row: Record<string, unknown>): Patient {
  const r = (row['resource'] as Record<string, any>) ?? {}
  const fhirId = String(row['fhir_id'] ?? r['id'] ?? '')

  const officialName = (r['name'] as any[])?.find((n: any) => n.use === 'official')
    ?? (r['name'] as any[])?.[0]
  const addr = (r['address'] as any[])?.[0]
  const exts: any[] = r['extension'] ?? []

  const raceExt    = findExtension(exts, 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-race')
  const ethExt     = findExtension(exts, 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity')
  const birthSex   = findExtension(exts, 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-birthsex')?.valueCode ?? null
  const genderIdExt = findExtension(exts, 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-genderIdentity')

  const race     = raceExt?.extension?.find((e: any) => e.url === 'text')?.valueString ?? null
  const ethnicity = ethExt?.extension?.find((e: any) => e.url === 'text')?.valueString ?? null
  const genderIdentity = genderIdExt?.valueCodeableConcept?.text ?? null

  const telecom: any[] = r['telecom'] ?? []
  const preferredLang = (r['communication'] as any[])?.find((c: any) => c.preferred)?.language?.coding?.[0]?.code ?? null

  return {
    ptnum:              fhirId,
    label:              0,
    scc:                null,
    first_name:         officialName?.given?.[0] ?? null,
    last_name:          officialName?.family ?? null,
    middle_name:        officialName?.given?.[1] ?? null,
    date_of_birth:      r['birthDate'] ?? null,
    age:                computeAge(r['birthDate'] ?? null),
    administrative_sex: r['gender'] ?? null,
    birth_sex:          birthSex,
    gender_identity:    genderIdentity,
    gender:             r['gender'] ?? null,
    preferred_language: preferredLang,
    race,
    ethnicity,
    tribal_affiliation: null,
    marital:            null,
    address_line:       addr?.line?.[0] ?? null,
    city:               addr?.city ?? null,
    state:              addr?.state ?? null,
    zip_code:           addr?.postalCode ?? null,
    phone:              telecom.find((t: any) => t.system === 'phone')?.value ?? null,
    email:              telecom.find((t: any) => t.system === 'email')?.value ?? null,
    // Vitals/labs populated separately from fhir_observation
    systolic_bp: null, diastolic_bp: null, heart_rate: null, bmi: null,
    total_cholesterol: null, ldl: null, hdl: null, triglycerides: null,
    hba1c: null, glucose: null, creatinine: null, egfr: null,
    hemoglobin: null, wbc: null, platelets: null,
    respiratory_rate: null, temperature_c: null, oxygen_saturation: null,
    height_cm: null, weight_kg: null, pain_score: null,
    problems: [], medications: [], allergies: [], immunizations: [],
    procedures: [], care_team: [], encounters: [], clinical_notes: [],
    goals: [], imaging_results: [], insurance: null,
    functional_status: null, mental_cognitive_status: null,
    disability_status: null, pregnancy_status: null,
    sdoh_education_level: null, sdoh_financial_strain: null,
    sdoh_housing_status: null, sdoh_transportation_insecurity: null,
    sdoh_veteran_status: null, sdoh_social_isolation: null,
    tobacco_status: null, assessment_plan: null,
    provenance_author: null, provenance_organization: null, provenance_timestamp: null,
  } as Patient
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
