// OverviewTab — cohort-level overview using real Supabase data
import { useState, useEffect } from 'react'
import { supabase, TABLES, normalizeRow, type Patient } from '../../lib/supabase'
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts'

const TT = {
  contentStyle: {
    background: 'var(--bg-white)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    fontSize: 12,
    boxShadow: 'var(--shadow)',
  },
}

export default function OverviewTab() {
  const [recent,   setRecent]   = useState<Patient[]>([])
  const [loading,  setLoading]  = useState(true)
  const [counts,   setCounts]   = useState({ pos: 0, neg: 0, total: 0 })

  useEffect(() => {
    async function load() {
      // Fetch latest 10 patients + label counts from first table
      const [recRes, posRes, negRes] = await Promise.all([
        supabase
          .from(TABLES[0])
          .select('ptnum,label,scc,"C-424144002","C-263495000","C-103579009","C-39156-5","C-8480-6","C-8462-4","C-8867-4","C-72166-2","C-2093-3","C-18262-6","C-2085-9","C-4548-4","C-29463-7","C-8302-2","C-2571-8","C-2345-7","C-186034007","C-125680007","C-398070004","C-72514-3"')
          .order('scc', { ascending: false })
          .limit(10),
        supabase.from(TABLES[0]).select('ptnum', { count: 'exact', head: true }).eq('label', 1),
        supabase.from(TABLES[0]).select('ptnum', { count: 'exact', head: true }).eq('label', 0),
      ])

      if (recRes.data) setRecent(recRes.data.map(normalizeRow))
      setCounts({
        pos:   posRes.count ?? 0,
        neg:   negRes.count ?? 0,
        total: (posRes.count ?? 0) + (negRes.count ?? 0),
      })
      setLoading(false)
    }
    load()
  }, [])

  // SCC trend data — built from recent patients
  const sccTrend = recent.map(p => ({
    id:    p.ptnum,
    scc:   p.scc ?? 0,
    age:   p.age ?? 0,
    bmi:   p.bmi ?? 0,
  }))

  // Age distribution buckets from recent sample
  const ageBuckets = [
    { age: '<50',  count: recent.filter(p => p.age != null && p.age < 50).length  },
    { age: '50–60',count: recent.filter(p => p.age != null && p.age >= 50 && p.age < 60).length },
    { age: '60–70',count: recent.filter(p => p.age != null && p.age >= 60 && p.age < 70).length },
    { age: '70+',  count: recent.filter(p => p.age != null && p.age >= 70).length },
  ]

  const prevalence = counts.total > 0 ? ((counts.pos / counts.total) * 100).toFixed(1) : '—'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Top KPI cards */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        {[
          { val: '21,601',      lbl: 'Total Patients',    sub: 'Across 5 tables',        color: 'var(--blue-600)' },
          { val: '5,566',       lbl: 'LC Positive',       sub: `25.8% prevalence`,       color: 'var(--danger)'   },
          { val: '16,035',      lbl: 'Control Patients',  sub: 'No lung cancer',         color: 'var(--ok)'       },
          { val: `${prevalence}%`, lbl: 'LC Prevalence',  sub: `${counts.total.toLocaleString()} in table 1`, color: 'var(--warn)' },
        ].map(s => (
          <div className="stat-card" key={s.lbl}>
            <div className="stat-val" style={{ color: s.color }}>{s.val}</div>
            <div className="stat-lbl">{s.lbl}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Cohort vitals averages */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Cohort Averages</span>
          <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>Full dataset · 21,601 patients</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
          {[
            ['Avg Age',       '59.5',  'yrs'   ],
            ['Avg BMI',       '28.9',  ''      ],
            ['Avg Systolic',  '124.3', 'mmHg'  ],
            ['Avg Diastolic', '82.6',  'mmHg'  ],
            ['Avg HR',        '81.0',  'bpm'   ],
            ['Avg Chol.',     '185.5', 'mg/dL' ],
            ['Avg HbA1c',     '5.8',   '%'     ],
          ].map(([label, val, unit]) => (
            <div key={label as string} style={{ padding: '18px 12px', borderRight: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text-heading)' }}>{val}</div>
              <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 2 }}>{unit}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18 }}>

        {/* SCC scores of top 10 highest-risk patients */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Top 10 Highest SCC Scores (Table 1)</span>
            <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>Live from Supabase</span>
          </div>
          <div className="chart-wrap">
            {loading ? (
              <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', fontSize: 13 }}>Loading…</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={sccTrend} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="id" tick={{ fontSize: 9, fill: 'var(--text-faint)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-faint)' }} axisLine={false} tickLine={false} />
                  <Tooltip {...TT} />
                  <Bar dataKey="scc" name="SCC Score" fill="var(--blue-500)" radius={[4, 4, 0, 0]} opacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Age distribution */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Age Buckets (Top 10)</span>
          </div>
          <div className="chart-wrap">
            {loading ? (
              <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', fontSize: 13 }}>Loading…</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={ageBuckets} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="age" tick={{ fontSize: 11, fill: 'var(--text-faint)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-faint)' }} axisLine={false} tickLine={false} />
                  <Tooltip {...TT} />
                  <Bar dataKey="count" name="Patients" fill="var(--teal-500)" radius={[4, 4, 0, 0]} opacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Key findings panel */}
      <div className="card">
        <div className="card-header"><span className="card-title">Key Dataset Findings</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 0 }}>
          {[
            {
              icon: '🚬',
              title: 'Tobacco is the #1 Risk Factor',
              body: 'Former smokers: 34.8% LC rate vs 18.8% for never-smokers. No current smokers in cohort.',
              color: 'var(--danger)',
              bg: 'var(--danger-bg)',
            },
            {
              icon: '📅',
              title: 'Age 60–70 Peak Incidence',
              body: '1,910 LC positive patients in the 60–70 bracket. Zero cases under age 40.',
              color: 'var(--warn)',
              bg: 'var(--warn-bg)',
            },
            {
              icon: '📊',
              title: 'SCC Score Distribution',
              body: 'Low (0–80): 3,676 pts · Medium (80–120): 14,131 pts · High (120+): 3,794 pts',
              color: 'var(--blue-600)',
              bg: 'var(--blue-50)',
            },
          ].map(f => (
            <div key={f.title} style={{ padding: '20px 22px', borderRight: '1px solid var(--border)' }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{f.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: f.color, marginBottom: 6 }}>{f.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>{f.body}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent high-risk patients */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Highest Risk Patients (Top 10 by SCC)</span>
          <span className="badge badge-blue">Live · Table 1</span>
        </div>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-faint)' }}>Querying Supabase…</div>
        ) : (
          <table className="ehr-table">
            <thead>
              <tr><th>Patient ID</th><th>SCC</th><th>Age</th><th>Gender</th><th>Tobacco</th><th>BMI</th><th>Cholesterol</th><th>Diagnosis</th></tr>
            </thead>
            <tbody>
              {recent.map(p => (
                <tr key={p.ptnum}>
                  <td><span style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--blue-600)' }}>{p.ptnum}</span></td>
                  <td><span className={`badge ${p.scc && p.scc >= 130 ? 'badge-danger' : p.scc && p.scc >= 100 ? 'badge-warn' : 'badge-ok'}`}>{p.scc ?? '—'}</span></td>
                  <td>{p.age ?? '—'}</td>
                  <td>{p.gender === 'm' ? 'Male' : p.gender === 'f' ? 'Female' : '—'}</td>
                  <td><span className={`badge ${p.tobacco_status === 'former' ? 'badge-warn' : 'badge-ok'}`}>{p.tobacco_status === 'former' ? 'Former' : 'Never'}</span></td>
                  <td><span style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{p.bmi ?? '—'}</span></td>
                  <td><span style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{p.total_cholesterol ?? '—'}</span></td>
                  <td>{p.label === 1 ? <span className="badge badge-danger">LC Positive</span> : <span className="badge badge-ok">Control</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
