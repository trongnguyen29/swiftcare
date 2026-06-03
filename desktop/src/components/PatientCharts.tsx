import type { Patient } from '../lib/supabase'

interface Props { patient: Patient }

/* ── Reference ranges ── */
const RANGES: Record<string, { lo: number; hi: number; unit: string; label: string }> = {
  systolic_bp:       { lo: 90,  hi: 180, unit: 'mmHg',  label: 'Systolic BP'    },
  diastolic_bp:      { lo: 60,  hi: 120, unit: 'mmHg',  label: 'Diastolic BP'   },
  heart_rate:        { lo: 40,  hi: 140, unit: 'bpm',   label: 'Heart Rate'     },
  bmi:               { lo: 15,  hi: 45,  unit: '',      label: 'BMI'            },
  total_cholesterol: { lo: 100, hi: 280, unit: 'mg/dL', label: 'Total Chol.'   },
  ldl:               { lo: 50,  hi: 200, unit: 'mg/dL', label: 'LDL'           },
  hdl:               { lo: 20,  hi: 100, unit: 'mg/dL', label: 'HDL'           },
  triglycerides:     { lo: 50,  hi: 400, unit: 'mg/dL', label: 'Triglycerides' },
  hba1c:             { lo: 4,   hi: 11,  unit: '%',     label: 'HbA1c'         },
  glucose:           { lo: 60,  hi: 300, unit: 'mg/dL', label: 'Glucose'       },
}

/* Normal / target zones within the range */
const NORMAL: Record<string, { lo: number; hi: number }> = {
  systolic_bp:       { lo: 90,  hi: 130 },
  diastolic_bp:      { lo: 60,  hi: 90  },
  heart_rate:        { lo: 60,  hi: 100 },
  bmi:               { lo: 18.5,hi: 25  },
  total_cholesterol: { lo: 100, hi: 200 },
  ldl:               { lo: 50,  hi: 130 },
  hdl:               { lo: 40,  hi: 100 },
  triglycerides:     { lo: 50,  hi: 150 },
  hba1c:             { lo: 4,   hi: 5.7 },
  glucose:           { lo: 70,  hi: 100 },
}

function statusColor(key: string, val: number | string) {
  if (typeof val === 'string') {
    const s = val.toLowerCase().trim()
    return (s === 'normal') ? 'var(--ok)' : 'var(--danger)'
  }
  const n = NORMAL[key]
  if (!n) return 'var(--text-muted)'
  if (val > n.hi || val < n.lo) return 'var(--danger)'
  return 'var(--ok)'
}

/* Single horizontal gauge bar */
function GaugeBar({ field, value }: { field: string; value: number | string | null }) {
  if (value == null) return null
  const r = RANGES[field]
  const n = NORMAL[field]
  if (!r) return null

  const color = statusColor(field, value)

  // String values: show a solid colored bar at 50% width, no text inside track
  if (typeof value === 'string') {
    return (
      <div className="gauge-row">
        <div className="gauge-label">{r.label}</div>
        <div className="gauge-track">
          <div className="gauge-fill" style={{ width: '50%', background: color }} />
        </div>
        <div className="gauge-val" style={{ color, textTransform: 'capitalize' }}>{value}</div>
      </div>
    )
  }

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
interface BarDatum { label: string; value: number | string | null; unit: string; normalHi: number; key: string }

function MiniBarChart({ data, title }: { data: BarDatum[]; title: string }) {
  const valid = data.filter(d => d.value != null && typeof d.value === 'number')
  if (valid.length === 0) return null

  const maxVal = Math.max(...valid.map(d => d.value as number)) * 1.2

  return (
    <div className="chart-card card">
      <div className="card-header"><span className="card-title">{title}</span></div>
      <div className="mini-bar-chart">
        {data.map(d => {
          if (d.value == null) return null
          const color = statusColor(d.key, d.value)
          if (typeof d.value === 'string') {
            return (
              <div key={d.label} className="mini-bar-col">
                <div className="mini-bar-wrap">
                  <div className="mini-bar-fill" style={{ height: '50%', background: color }} />
                </div>
                <div className="mini-bar-label">{d.label}</div>
                <div className="mini-bar-val" style={{ color, textTransform: 'capitalize' }}>{d.value}</div>
              </div>
            )
          }
          const pct   = Math.min(100, (d.value / maxVal) * 100)
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
function RiskRing({ score, label, color }: { score: number; label: string; color: string }) {
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

export default function PatientCharts({ patient: p }: Props) {
  /* Compute a simple 0-100 risk score per category */
  function cvScore() {
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
  function metabolicScore() {
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
  function overallScore() {
    return Math.round((cvScore() + metabolicScore()) / 2)
  }

  const cv   = cvScore()
  const meta = metabolicScore()
  const ov   = overallScore()

  function ringColor(s: number) {
    if (s >= 60) return 'var(--danger)'
    if (s >= 30) return 'var(--warn)'
    return 'var(--ok)'
  }

  const lipidData: BarDatum[] = [
    { label: 'T.Chol', value: p.total_cholesterol, unit: 'mg/dL', normalHi: 200, key: 'total_cholesterol' },
    { label: 'LDL',    value: p.ldl,               unit: 'mg/dL', normalHi: 130, key: 'ldl'               },
    { label: 'HDL',    value: p.hdl,               unit: 'mg/dL', normalHi: 60,  key: 'hdl'               },
    { label: 'Trig.',  value: p.triglycerides,      unit: 'mg/dL', normalHi: 150, key: 'triglycerides'     },
  ]

  return (
    <div className="charts-wrap">

      {/* Risk Rings Row */}
      <div className="card risk-rings-card">
        <div className="card-header"><span className="card-title">Risk Overview</span></div>
        <div className="risk-rings-row">
          <RiskRing score={ov}   label="Overall"    color={ringColor(ov)}   />
          <div className="risk-ring-divider" />
          <RiskRing score={cv}   label="Cardiovasc." color={ringColor(cv)}   />
          <div className="risk-ring-divider" />
          <RiskRing score={meta} label="Metabolic"  color={ringColor(meta)} />
          <div className="risk-rings-legend">
            <div className="rings-legend-item"><span style={{ color: 'var(--ok)' }}>●</span> Low (0–29)</div>
            <div className="rings-legend-item"><span style={{ color: 'var(--warn)' }}>●</span> Moderate (30–59)</div>
            <div className="rings-legend-item"><span style={{ color: 'var(--danger)' }}>●</span> High (60+)</div>
            <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-faint)' }}>
              Scores derived from current vitals &amp; labs
            </div>
          </div>
        </div>
      </div>

      {/* Two column: gauges + bar chart */}
      <div className="charts-two-col">

        {/* Vitals Gauges */}
        <div className="card chart-card">
          <div className="card-header">
            <span className="card-title">Vitals vs. Reference</span>
            <span className="gauge-legend">
              <span className="gauge-legend-normal" /> Normal range
            </span>
          </div>
          <div className="gauges-body">
            {(['systolic_bp','diastolic_bp','heart_rate','bmi'] as const).map(f =>
              <GaugeBar key={f} field={f} value={p[f]} />
            )}
          </div>
        </div>

        {/* Lipid Panel Bar Chart */}
        <MiniBarChart data={lipidData} title="Lipid Panel" />
      </div>

      {/* Labs gauges */}
      <div className="card chart-card">
        <div className="card-header">
          <span className="card-title">Metabolic Labs vs. Reference</span>
          <span className="gauge-legend">
            <span className="gauge-legend-normal" /> Normal range
          </span>
        </div>
        <div className="gauges-body gauges-body--grid">
          {(['hba1c','glucose','total_cholesterol','ldl','hdl','triglycerides'] as const).map(f =>
            <GaugeBar key={f} field={f} value={p[f]} />
          )}
        </div>
      </div>

    </div>
  )
}
