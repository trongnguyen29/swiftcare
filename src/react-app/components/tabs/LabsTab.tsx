// LabsTab — shows real lab/vitals distributions from Supabase
// Replaces dummy data import with live cohort lab statistics

import { useState, useEffect } from 'react'
import { supabase, TABLES, normalizeRow, type Patient } from '../../lib/supabase'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const TT = {
  contentStyle: {
    background: 'var(--bg-white)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    fontSize: 12,
    boxShadow: 'var(--shadow)',
  },
}

type LabStat = {
  name: string
  avg: number
  min: number
  max: number
  unit: string
  ref: string
  flagHigh: number  // % above normal
  flagLow: number   // % below normal
  normalLow: number
  normalHigh: number
}

function computeStat(
  patients: Patient[],
  key: keyof Patient,
  name: string,
  unit: string,
  ref: string,
  normalLow: number,
  normalHigh: number
): LabStat {
  const vals = patients.map(p => p[key] as number | null).filter(v => v != null) as number[]
  if (vals.length === 0) return { name, avg: 0, min: 0, max: 0, unit, ref, flagHigh: 0, flagLow: 0, normalLow, normalHigh }
  const avg = Math.round((vals.reduce((a,b) => a+b, 0) / vals.length) * 10) / 10
  return {
    name, unit, ref, normalLow, normalHigh,
    avg,
    min: Math.min(...vals),
    max: Math.max(...vals),
    flagHigh: Math.round((vals.filter(v => v > normalHigh).length / vals.length) * 100),
    flagLow:  Math.round((vals.filter(v => v < normalLow).length  / vals.length) * 100),
  }
}

// Bucket a list of values into histogram bins
function histogram(vals: number[], binSize: number, label: string) {
  if (vals.length === 0) return []
  const min = Math.floor(Math.min(...vals) / binSize) * binSize
  const max = Math.ceil(Math.max(...vals)  / binSize) * binSize
  const bins = []
  for (let lo = min; lo < max; lo += binSize) {
    bins.push({
      [label]: `${lo}–${lo+binSize}`,
      count: vals.filter(v => v >= lo && v < lo + binSize).length,
    })
  }
  return bins
}

export default function LabsTab() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [activePanel, setActivePanel] = useState<string>('cholesterol')

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const { data, error: err } = await supabase
          .from(TABLES[0])
          .select('ptnum,label,"C-2093-3","C-18262-6","C-2085-9","C-2571-8","C-4548-4","C-2345-7","C-8480-6","C-8462-4","C-8867-4","C-39156-5"')
          .limit(500)
        if (err) throw err
        setPatients((data || []).map(normalizeRow))
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const stats: LabStat[] = patients.length === 0 ? [] : [
    computeStat(patients, 'total_cholesterol', 'Total Cholesterol', 'mg/dL', '<200',      0,   200),
    computeStat(patients, 'ldl',               'LDL Cholesterol',   'mg/dL', '<130',      0,   130),
    computeStat(patients, 'hdl',               'HDL Cholesterol',   'mg/dL', '>40',       40,  999),
    computeStat(patients, 'triglycerides',     'Triglycerides',     'mg/dL', '<150',      0,   150),
    computeStat(patients, 'hba1c',             'HbA1c',             '%',     '<5.7',      0,   5.7),
    computeStat(patients, 'glucose',           'Glucose',           'mg/dL', '70–99',     70,  99 ),
    computeStat(patients, 'systolic_bp',       'Systolic BP',       'mmHg',  '<130',      0,   130),
    computeStat(patients, 'diastolic_bp',      'Diastolic BP',      'mmHg',  '<80',       0,   80 ),
    computeStat(patients, 'heart_rate',        'Heart Rate',        'bpm',   '60–100',    60,  100),
    computeStat(patients, 'bmi',               'BMI',               '',      '18.5–24.9', 18.5,25 ),
  ]

  const PANELS: Record<string, { keys: (keyof Patient)[]; label: string; binSize: number; unit: string }> = {
    cholesterol: { keys: ['total_cholesterol','ldl','hdl'], label: 'Cholesterol Distribution', binSize: 20,  unit: 'mg/dL' },
    glucose:     { keys: ['glucose'],                        label: 'Glucose Distribution',      binSize: 10,  unit: 'mg/dL' },
    bp:          { keys: ['systolic_bp'],                    label: 'Systolic BP Distribution',  binSize: 10,  unit: 'mmHg'  },
    bmi:         { keys: ['bmi'],                            label: 'BMI Distribution',           binSize: 2,   unit: ''      },
  }

  const currentPanel = PANELS[activePanel]
  const histData = patients.length > 0
    ? histogram(
        patients.map(p => p[currentPanel.keys[0]] as number | null).filter(v => v != null) as number[],
        currentPanel.binSize,
        currentPanel.label
      )
    : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {error && (
        <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-bdr)', borderRadius: 'var(--radius)', padding: '12px 16px', color: 'var(--danger)', fontSize: 13 }}>
          ⚠ {error}
        </div>
      )}

      {/* Summary stats table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Lab & Vitals Summary — 500 Patient Sample</span>
          {loading && <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>Loading from Supabase…</span>}
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-faint)' }}>Querying Supabase…</div>
        ) : (
          <table className="ehr-table">
            <thead>
              <tr>
                <th>Lab / Vital</th>
                <th>Avg</th>
                <th>Min</th>
                <th>Max</th>
                <th>Unit</th>
                <th>Reference</th>
                <th>% Abnormal High</th>
                <th>% Abnormal Low</th>
              </tr>
            </thead>
            <tbody>
              {stats.map(s => (
                <tr key={s.name}>
                  <td style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{s.name}</td>
                  <td>
                    <span style={{
                      fontFamily: 'var(--mono)', fontWeight: 700,
                      color: s.avg > s.normalHigh ? 'var(--danger)' : s.avg < s.normalLow ? 'var(--blue-600)' : 'var(--ok)',
                    }}>
                      {s.avg}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-muted)' }}>{s.min}</td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-muted)' }}>{s.max}</td>
                  <td style={{ color: 'var(--text-faint)', fontSize: 12 }}>{s.unit}</td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-faint)' }}>{s.ref}</td>
                  <td>
                    {s.flagHigh > 0 ? (
                      <span style={{ color: s.flagHigh > 20 ? 'var(--danger)' : 'var(--warn)', fontWeight: 600, fontSize: 12 }}>
                        {s.flagHigh}%
                      </span>
                    ) : <span style={{ color: 'var(--ok)', fontSize: 12 }}>0%</span>}
                  </td>
                  <td>
                    {s.flagLow > 0 ? (
                      <span style={{ color: 'var(--blue-600)', fontWeight: 600, fontSize: 12 }}>{s.flagLow}%</span>
                    ) : <span style={{ color: 'var(--ok)', fontSize: 12 }}>0%</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Distribution histogram */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Distribution Viewer</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {Object.entries(PANELS).map(([key, _panel]) => (
              <button
                key={key}
                onClick={() => setActivePanel(key)}
                style={{
                  padding: '4px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  background: activePanel === key ? 'var(--blue-600)' : 'var(--bg-white)',
                  color: activePanel === key ? '#fff' : 'var(--text-muted)',
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: 'var(--font)',
                }}
              >
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="chart-wrap">
          {loading ? (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)' }}>Loading…</div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                {currentPanel.label} · {patients.length} patients · {currentPanel.unit}
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={histData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey={currentPanel.label} tick={{ fontSize: 9, fill: 'var(--text-faint)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-faint)' }} axisLine={false} tickLine={false} />
                  <Tooltip {...TT} />
                  <Bar dataKey="count" name="Patients" radius={[3, 3, 0, 0]}>
                    {histData.map((_, i) => (
                      <Cell key={i} fill={`hsl(${210 + i * 8}, 70%, 55%)`} opacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
