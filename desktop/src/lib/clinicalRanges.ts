// Shared clinical reference-range engine.
// Single source of truth for vital/lab ranges, status tiers, and reference text.
// Consumed by PatientSummary (Overview flags + values) and PatientCharts (gauges).

export type VitalStatus = 'normal' | 'borderline' | 'critical' | 'unknown'

/** Full plausible display span — used only for gauge geometry (bar width). */
export const RANGES: Record<string, { lo: number; hi: number; unit: string; label: string }> = {
  systolic_bp:       { lo: 90,  hi: 180, unit: 'mmHg',  label: 'Systolic BP'   },
  diastolic_bp:      { lo: 60,  hi: 120, unit: 'mmHg',  label: 'Diastolic BP'  },
  heart_rate:        { lo: 40,  hi: 140, unit: 'bpm',   label: 'Heart Rate'    },
  oxygen_saturation: { lo: 88,  hi: 100, unit: '%',     label: 'SpO₂'          },
  bmi:               { lo: 15,  hi: 45,  unit: '',      label: 'BMI'           },
  total_cholesterol: { lo: 100, hi: 280, unit: 'mg/dL', label: 'Total Chol.'   },
  ldl:               { lo: 50,  hi: 200, unit: 'mg/dL', label: 'LDL'           },
  hdl:               { lo: 20,  hi: 100, unit: 'mg/dL', label: 'HDL'           },
  triglycerides:     { lo: 50,  hi: 400, unit: 'mg/dL', label: 'Triglycerides' },
  hba1c:             { lo: 4,   hi: 11,  unit: '%',     label: 'HbA1c'         },
  glucose:           { lo: 60,  hi: 300, unit: 'mg/dL', label: 'Glucose'       },
  egfr:              { lo: 15,  hi: 120, unit: 'mL/min',label: 'eGFR'          },
}

/** Normal / target zone within the range. Inside → `normal`; inside RANGES but
 *  outside this → `borderline`. */
export const NORMAL: Record<string, { lo: number; hi: number }> = {
  systolic_bp:       { lo: 90,   hi: 130 },
  diastolic_bp:      { lo: 60,   hi: 90  },
  heart_rate:        { lo: 60,   hi: 100 },
  oxygen_saturation: { lo: 95,   hi: 100 },
  bmi:               { lo: 18.5, hi: 25  },
  total_cholesterol: { lo: 100,  hi: 200 },
  ldl:               { lo: 50,   hi: 130 },
  hdl:               { lo: 40,   hi: 100 },
  triglycerides:     { lo: 50,   hi: 150 },
  hba1c:             { lo: 4,    hi: 5.7 },
  glucose:           { lo: 70,   hi: 100 },
  egfr:              { lo: 60,   hi: 120 },
}

/** Severe cutoffs: a value beyond this band is `critical` (red). Between NORMAL
 *  and CRITICAL is `borderline` (amber). These are clinical, not display, limits. */
export const CRITICAL: Record<string, { lo: number; hi: number }> = {
  systolic_bp:       { lo: 80,  hi: 160 },
  diastolic_bp:      { lo: 50,  hi: 100 },
  heart_rate:        { lo: 50,  hi: 120 },
  oxygen_saturation: { lo: 92,  hi: 101 },
  bmi:               { lo: 16,  hi: 35  },
  total_cholesterol: { lo: 0,   hi: 240 },
  ldl:               { lo: 0,   hi: 160 },
  hdl:               { lo: 30,  hi: 999 },
  triglycerides:     { lo: 0,   hi: 200 },
  hba1c:             { lo: 0,   hi: 6.5 },
  glucose:           { lo: 70,  hi: 126 },
  egfr:              { lo: 30,  hi: 999 },
}

/** Human-readable target description for inline display (e.g. "ref <130"). */
const REF_TEXT: Record<string, string> = {
  systolic_bp:       'ref 90–130',
  diastolic_bp:      'ref 60–90',
  heart_rate:        'ref 60–100',
  oxygen_saturation: 'ref ≥95',
  bmi:               'ref 18.5–25',
  total_cholesterol: 'ref <200',
  ldl:               'ref <130',
  hdl:               'ref ≥40',
  triglycerides:     'ref <150',
  hba1c:             'ref <5.7',
  glucose:           'ref 70–100',
  egfr:              'ref ≥60',
}

/** Three-tier clinical status for a value. `unknown` when null or unranged. */
export function vitalStatus(key: string, val: number | null | undefined): VitalStatus {
  if (val == null) return 'unknown'
  const n = NORMAL[key]
  const c = CRITICAL[key]
  if (!n || !c) return 'unknown'
  if (val < c.lo || val > c.hi) return 'critical'
  if (val < n.lo || val > n.hi) return 'borderline'
  return 'normal'
}

/** CSS class for a value span, matching App.css `.val-*` rules. */
export function statusClass(status: VitalStatus): string {
  switch (status) {
    case 'critical':   return 'val-critical'
    case 'borderline': return 'val-borderline'
    case 'normal':     return 'val-normal'
    default:           return ''
  }
}

/** CSS var color for a status, for inline SVG/gauge use. */
export function statusVar(status: VitalStatus): string {
  switch (status) {
    case 'critical':   return 'var(--danger)'
    case 'borderline': return 'var(--warn)'
    case 'normal':     return 'var(--ok)'
    default:           return 'var(--text-muted)'
  }
}

/** Inline reference text for a field, or '' if none defined. */
export function formatRef(key: string): string {
  return REF_TEXT[key] ?? ''
}
