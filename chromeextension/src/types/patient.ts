export interface Problem {
  display: string;
  icd10_code: string;
  snomed_code?: string;
  onset_date?: string;
  status: string;
  category: string;
}

export interface Medication {
  name: string;
  rxnorm_code?: string;
  dose: string;
  route: string;
  frequency: string;
  indication?: string;
  start_date: string;
  status: string;
}

export interface Allergy {
  substance: string;
  type: string;
  reaction: string;
  severity: string;
  onset_date?: string;
  status: string;
}

export interface Immunization {
  vaccine: string;
  cvx_code: string;
  date: string;
  status: string;
  lot_number?: string;
}

export interface CareTeamMember {
  name: string;
  role: string;
  npi?: string;
  phone?: string;
  organization?: string;
}

export interface Insurance {
  coverage_status: string;
  coverage_type: string;
  payer: string;
  payer_id?: string;
  member_id: string;
  subscriber_id?: string;
  group_id?: string;
  relationship_to_subscriber: string;
}

export interface Encounter {
  encounter_type: string;
  date: string;
  reason: string;
  facility?: string;
  performing_provider?: string;
  disposition?: string;
}

export interface ClinicalNote {
  note_type: string;
  date: string;
  author: string;
  text: string;
}

export interface Procedure {
  display: string;
  cpt_code?: string;
  snomed_code?: string;
  date: string;
  status: string;
  performer?: string;
}

export interface ImagingResult {
  study: string;
  date: string;
  finding: string;
}

export interface Patient {
  ptnum: string;
  label: number;
  scc?: number;
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  date_of_birth?: string;
  age?: number;
  administrative_sex?: string;
  birth_sex?: string;
  gender_identity?: string;
  preferred_language?: string;
  race?: string;
  ethnicity?: string;
  tribal_affiliation?: string;
  marital?: string;
  address_line?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  phone?: string;
  email?: string;
  systolic_bp?: number;
  diastolic_bp?: number;
  heart_rate?: number;
  respiratory_rate?: number;
  temperature_c?: number;
  oxygen_saturation?: number;
  height_cm?: number;
  weight_kg?: number;
  bmi?: number;
  pain_score?: number;
  total_cholesterol?: number;
  ldl?: number;
  hdl?: number;
  triglycerides?: number;
  hba1c?: number;
  glucose?: number;
  creatinine?: number;
  egfr?: number;
  hemoglobin?: number;
  wbc?: number;
  platelets?: number;
  problems?: Problem[];
  medications?: Medication[];
  allergies?: Allergy[];
  immunizations?: Immunization[];
  procedures?: Procedure[];
  care_team?: CareTeamMember[];
  insurance?: Insurance;
  encounters?: Encounter[];
  clinical_notes?: ClinicalNote[];
  functional_status?: string;
  mental_cognitive_status?: string;
  disability_status?: string;
  pregnancy_status?: string;
  sdoh_education_level?: string;
  sdoh_financial_strain?: string;
  sdoh_housing_status?: string;
  sdoh_transportation_insecurity?: boolean;
  sdoh_veteran_status?: boolean;
  sdoh_social_isolation?: string;
  tobacco_status?: string;
  assessment_plan?: string;
  goals?: string[];
  imaging_results?: ImagingResult[];
  provenance_author?: string;
  provenance_organization?: string;
  provenance_timestamp?: string;
  gender?: string;
}

export function displayName(p: Patient): string {
  const name = [p.first_name, p.last_name]
    .filter(Boolean)
    .join(" ")
    .replace(/\d/g, "")
    .trim();
  return name || p.ptnum;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
