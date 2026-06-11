import type { Patient } from '../lib/supabase'
import { RANGES, NORMAL, vitalStatus, statusVar } from '../lib/clinicalRanges'

interface Props { patient: Patient }

/* Resolve a status color for a value via the shared 3-tier engine. */
function statusColor(key: string, val: number) {
  return statusVar(vitalStatus(key, val))
}

/* Single horizontal gauge bar */
function GaugeBar({ field, value }: { field: string; value: number | null }) {
  if (value == null) return null
  const r = RANGES[field]
  const n = NORMAL[field]
  if (!r) return null

  const color = statusColor(field, value)
  const span = r.hi - r.lo
  const pct  = Math.min(100, Math.max(0, ((value - r.lo) / span) * 100))
  const nLo  = ((n.lo - r.lo) / span) * 100
  const nHi  = ((n.hi - r.lo) / span) * 100

  return (
    <div className="gauge-row">
      <div className="gauge-label">{r.label}</div>
      <div className="gauge-track">
        {/* normal zone highlight */}
        <div
          className="gauge-normal-zone"
          style={{ left: `${nLo}%`, width: `${nHi - nLo}%` }}
        />
        {/* filled bar */}
        <div className="gauge-fill" style={{ width: `${pct}%`, background: color }} />
        {/* needle */}
        <div className="gauge-needle" style={{ left: `${pct}%`, background: color }} />
      </div>
      <div className="gauge-val" style={{ color }}>
        {value}{r.unit ? ` ${r.unit}` : ''}
      </div>
    </div>
  )
}

/* Mini bar chart for a group of values */
interface BarDatum { label: string; value: number | null; unit: string; normalHi: number; key: string }

function MiniBarChart({ data, title }: { data: BarDatum[]; title: string }) {
  const valid = data.filter(d => d.value != null)
  if (valid.length === 0) return null

  const maxVal = Math.max(...valid.map(d => d.value!)) * 1.2

  return (
    <div className="chart-card card">
      <div className="card-header"><span className="card-title">{title}</span></div>
      <div className="mini-bar-chart">
        {data.map(d => {
          if (d.value == null) return null
          const color  = statusColor(d.key, d.value)
          const pct    = Math.min(100, (d.value / maxVal) * 100)
          const refPct = Math.min(100, (d.normalHi / maxVal) * 100)
          return (
            <div key={d.label} className="mini-bar-col">
              <div className="mini-bar-wrap">
                {/* reference line */}
                <div className="mini-bar-ref-line" style={{ bottom: `${refPct}%` }} />
                <div
                  className="mini-bar-fill"
                  style={{ height: `${pct}%`, background: color }}
                />
              </div>
              <div className="mini-bar-label">{d.label}</div>
              <div className="mini-bar-val" style={{ color }}>{d.value}</div>
            </div>
          )
        })}
        <div className="mini-bar-ref-legend">
          <span className="ref-dot" /> Normal limit
        </div>
      </div>
    </div>
  )
}

/* Radial risk ring — pure SVG */
export function RiskRing({ score, label, color }: { score: number; label: string; color: string }) {
  const r = 28, cx = 36, cy = 36
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ

  return (
    <div className="risk-ring-wrap">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth="7" />
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke={color} strokeWidth="7"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
        <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
          fontSize="13" fontWeight="700" fill={color}>{score}</text>
      </svg>
      <div className="risk-ring-label">{label}</div>
    </div>
  )
}

/* ── Risk scoring (shared with Overview) ── */
export function cvScore(p: Patient) {
  let s = 0
  if (p.systolic_bp != null && p.systolic_bp >= 140) s += 30
  else if (p.systolic_bp != null && p.systolic_bp >= 130) s += 15
  if (p.total_cholesterol != null && p.total_cholesterol >= 240) s += 25
  else if (p.total_cholesterol != null && p.total_cholesterol >= 200) s += 12
  if (p.ldl != null && p.ldl >= 160) s += 25
  else if (p.ldl != null && p.ldl >= 130) s += 12
  if (p.tobacco_status === 'former') s += 20
  return Math.min(100, s)
}
export function metabolicScore(p: Patient) {
  let s = 0
  if (p.hba1c != null && p.hba1c >= 6.5) s += 35
  else if (p.hba1c != null && p.hba1c >= 5.7) s += 18
  if (p.glucose != null && p.glucose >= 126) s += 30
  else if (p.glucose != null && p.glucose >= 100) s += 15
  if (p.bmi != null && p.bmi >= 30) s += 25
  else if (p.bmi != null && p.bmi >= 25) s += 12
  if (p.triglycerides != null && p.triglycerides >= 200) s += 10
  return Math.min(100, s)
}
export function overallScore(p: Patient) {
  return Math.round((cvScore(p) + metabolicScore(p)) / 2)
}
export function ringColor(s: number) {
  if (s >= 60) return 'var(--danger)'
  if (s >= 30) return 'var(--warn)'
  return 'var(--ok)'
}

/** The three-ring risk row (without card chrome) — reused by Overview and Chart. */
export function RiskRings({ patient: p }: Props) {
  const cv = cvScore(p), meta = metabolicScore(p), ov = overallScore(p)
  return (
    <>
      <RiskRing score={ov}   label="Overall"     color={ringColor(ov)}   />
      <div className="risk-ring-divider" />
      <RiskRing score={cv}   label="Cardiovasc." color={ringColor(cv)}   />
      <div className="risk-ring-divider" />
      <RiskRing score={meta} label="Metabolic"   color={ringColor(meta)} />
    </>
  )
}

const VITAL_GAUGES = ['systolic_bp', 'diastolic_bp', 'heart_rate', 'bmi'] as const
const LAB_GAUGES   = ['hba1c', 'glucose', 'total_cholesterol', 'ldl', 'hdl', 'triglycerides'] as const

export default function PatientCharts({ patient: p }: Props) {
  const lipidData: BarDatum[] = [
    { label: 'T.Chol', value: p.total_cholesterol, unit: 'mg/dL', normalHi: 200, key: 'total_cholesterol' },
    { label: 'LDL',    value: p.ldl,               unit: 'mg/dL', normalHi: 130, key: 'ldl'               },
    { label: 'HDL',    value: p.hdl,               unit: 'mg/dL', normalHi: 60,  key: 'hdl'               },
    { label: 'Trig.',  value: p.triglycerides,      unit: 'mg/dL', normalHi: 150, key: 'triglycerides'     },
  ]

  const hasVitals = VITAL_GAUGES.some(f => p[f] != null)
  const hasLabs   = LAB_GAUGES.some(f => p[f] != null)
  const hasLipids = lipidData.some(d => d.value != null)

  return (
    <div className="charts-wrap">

      {/* Two column: gauges + bar chart */}
      <div className="charts-two-col">

        {/* Vitals Gauges */}
        <div className="card chart-card">
          <div className="card-header">
            <span className="card-title">Vitals vs. Reference</span>
            {hasVitals && <span className="gauge-legend"><span className="gauge-legend-normal" /> Normal range</span>}
          </div>
          <div className="gauges-body">
            {hasVitals
              ? VITAL_GAUGES.map(f => <GaugeBar key={f} field={f} value={p[f]} />)
              : <div className="card-empty-sm">No data for this patient</div>}
          </div>
        </div>

        {/* Lipid Panel Bar Chart */}
        {hasLipids ? <MiniBarChart data={lipidData} title="Lipid Panel" /> : (
          <div className="card chart-card">
            <div className="card-header"><span className="card-title">Lipid Panel</span></div>
            <div className="card-empty-sm">No data for this patient</div>
          </div>
        )}
      </div>

      {/* Labs gauges */}
      <div className="card chart-card">
        <div className="card-header">
          <span className="card-title">Metabolic Labs vs. Reference</span>
          {hasLabs && <span className="gauge-legend"><span className="gauge-legend-normal" /> Normal range</span>}
        </div>
        <div className={hasLabs ? 'gauges-body gauges-body--grid' : 'gauges-body'}>
          {hasLabs
            ? LAB_GAUGES.map(f => <GaugeBar key={f} field={f} value={p[f]} />)
            : <div className="card-empty-sm">No data for this patient</div>}
        </div>
      </div>

    </div>
  )
}
