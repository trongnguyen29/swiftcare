import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://ujqrxhhshxgqqjkblorh.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqcXJ4aGhzaHhncXFqa2Jsb3JoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDU3NjAsImV4cCI6MjA5NTM4MTc2MH0.t4CgUYE5oPLhocC2YtRF-WW6tMWu2Cvd0mYB_A1jWhk'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// All 5 raw data tables
export const TABLES = [
  'synthea-pt30k-lc-data-sel.csv',
  'synthea-pt30k1-lc-data-sel.csv',
  'synthea-pt30k2-lc-data-sel.csv',
  'synthea-pt30k3-lc-data-sel.csv',
  'synthea-pt30k4-lc-data-sel.csv',
]

// C-code → friendly name map
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
  'C-8302-2':    'height',
  'C-29463-7':   'weight',
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

// The columns we SELECT — ptnum, label, scc + all key C-codes
export const SELECT_COLS = [
  'ptnum', 'label', 'scc',
  ...Object.keys(CODE_MAP)
].join(',')

// Normalize a raw Supabase row → friendly Patient object
export function normalizeRow(row: Record<string, unknown>): Patient {
  const p: Record<string, unknown> = {
    ptnum:  row['ptnum'],
    label:  Number(row['label']),
    scc:    row['scc'] != null ? Number(row['scc']) : null,
    _table: row['_table'],
  }
  for (const [code, name] of Object.entries(CODE_MAP)) {
    const v = row[code]
    p[name] = v != null ? (isNaN(Number(v)) ? v : Number(v)) : null
  }
  return p as unknown as Patient
}

export type Patient = {
  ptnum: string
  label: number
  scc: number | null
  _table?: string
  age: number | null
  gender: string | null
  race: string | null
  ethnicity: string | null
  marital: string | null
  state: string | null
  systolic_bp: number | null
  diastolic_bp: number | null
  heart_rate: number | null
  height: number | null
  weight: number | null
  bmi: number | null
  tobacco_status: string | null
  pain_score: number | null
  total_cholesterol: number | null
  ldl: number | null
  hdl: number | null
  triglycerides: number | null
  hba1c: number | null
  glucose: number | null
}
