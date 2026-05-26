import { useState, useEffect } from 'react'
import { supabase, TABLES, type Patient, normalizeRow } from '../../lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts'

const TT = { contentStyle: { background: 'var(--bg-white)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12, boxShadow: 'var(--shadow)' } }
const PIE_COLORS = ['#3b82f6','#14b8a6','#f59e0b','#22c55e','#ef4444','#8b5cf6']

type Stats = {
  total: number; pos: number; neg: number
  avgAge: number; avgBmi: number; avgScc: number
  gender: { name: string; value: number }[]
  race:   { name: string; value: number }[]
  ageDist: { age: string; positive: number; negative: number }[]
  tobaccoCancer: { status: string; positive: number; negative: number }[]
  sccDist: { range: string; count: number }[]
  bmiDist: { category: string; positive: number; negative: number }[]
  vitals: Record<string, number>
}

function buildStats(rows: Patient[]): Stats {
  const total = rows.length
  const pos   = rows.filter(r => r.label === 1).length
  const neg   = total - pos

  const avg = (arr: (number | null)[]) => {
    const v = arr.filter(x => x != null) as number[]
    return v.length ? Math.round((v.reduce((a,b) => a+b,0) / v.length) * 10) / 10 : 0
  }

  const genderCount: Record<string, number> = {}
  const raceCount:   Record<string, number> = {}
  rows.forEach(r => {
    if (r.gender) genderCount[r.gender] = (genderCount[r.gender]||0)+1
    if (r.race)   raceCount[r.race]     = (raceCount[r.race]||0)+1
  })

  const ageBuckets = [['<40',0,40],['40–50',40,50],['50–60',50,60],['60–70',60,70],['70–80',70,80],['80+',80,200]]
  const ageDist = ageBuckets.map(([label,lo,hi]) => ({
    age: label as string,
    positive: rows.filter(r => r.label===1 && r.age!=null && r.age>=(lo as number) && r.age<(hi as number)).length,
    negative: rows.filter(r => r.label===0 && r.age!=null && r.age>=(lo as number) && r.age<(hi as number)).length,
  }))

  const tobaccoCancer = ['never','former'].map(s => ({
    status: s === 'former' ? 'Former Smoker' : 'Never Smoked',
    positive: rows.filter(r => r.label===1 && r.tobacco_status===s).length,
    negative: rows.filter(r => r.label===0 && r.tobacco_status===s).length,
  }))

  const sccDist = Array.from({length:12},(_,i)=>i*15).map(lo => ({
    range: `${lo}–${lo+15}`,
    count: rows.filter(r => r.scc!=null && r.scc>=lo && r.scc<lo+15).length,
  })).filter(b => b.count > 0)

  const bmiCats = [['Underweight',0,18.5],['Normal',18.5,25],['Overweight',25,30],['Obese',30,200]]
  const bmiDist = bmiCats.map(([cat,lo,hi]) => ({
    category: cat as string,
    positive: rows.filter(r => r.label===1 && r.bmi!=null && r.bmi>=(lo as number) && r.bmi<(hi as number)).length,
    negative: rows.filter(r => r.label===0 && r.bmi!=null && r.bmi>=(lo as number) && r.bmi<(hi as number)).length,
  }))

  return {
    total, pos, neg,
    avgAge: avg(rows.map(r=>r.age)),
    avgBmi: avg(rows.map(r=>r.bmi)),
    avgScc: avg(rows.map(r=>r.scc)),
    gender: Object.entries(genderCount).map(([k,v])=>({ name: k==='m'?'Male':'Female', value: v })),
    race:   Object.entries(raceCount).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([k,v])=>({ name: k.charAt(0).toUpperCase()+k.slice(1), value: v })),
    ageDist, tobaccoCancer, sccDist, bmiDist,
    vitals: {
      avg_systolic:  avg(rows.map(r=>r.systolic_bp)),
      avg_diastolic: avg(rows.map(r=>r.diastolic_bp)),
      avg_hr:        avg(rows.map(r=>r.heart_rate)),
      avg_chol:      avg(rows.map(r=>r.total_cholesterol)),
      avg_ldl:       avg(rows.map(r=>r.ldl)),
      avg_hdl:       avg(rows.map(r=>r.hdl)),
      avg_hba1c:     avg(rows.map(r=>r.hba1c)),
    },
  }
}

export default function CohortTab() {
  const [stats,    setStats]    = useState<Stats | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [progress, setProgress] = useState(0)
  const [error,    setError]    = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true); setError(null)
      try {
        const all: Patient[] = []
        for (let i = 0; i < TABLES.length; i++) {
          setProgress(i)
          // Fetch in batches of 1000
          let offset = 0
          while (true) {
            const { data, error: err } = await supabase
              .from(TABLES[i])
              .select('ptnum,label,scc,"C-424144002","C-263495000","C-103579009","C-39156-5","C-8480-6","C-8462-4","C-8867-4","C-72166-2","C-2093-3","C-18262-6","C-2085-9","C-4548-4"')
              .range(offset, offset + 999)
            if (err) throw err
            if (!data || data.length === 0) break
            all.push(...data.map(normalizeRow))
            if (data.length < 1000) break
            offset += 1000
          }
        }
        setStats(buildStats(all))
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load cohort data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 400, gap: 16 }}>
      <div style={{ fontSize: 32 }}>⟳</div>
      <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Loading cohort data from Supabase…</div>
      <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Table {progress + 1} of {TABLES.length}</div>
      <div style={{ width: 200, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${((progress + 1) / TABLES.length) * 100}%`, background: 'var(--blue-500)', borderRadius: 3, transition: 'width .3s' }} />
      </div>
    </div>
  )

  if (error) return (
    <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-bdr)', borderRadius: 'var(--radius-lg)', padding: 24, color: 'var(--danger)' }}>
      ⚠ {error}
    </div>
  )

  if (!stats) return null
  const prevalence = ((stats.pos / stats.total) * 100).toFixed(1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Top stats */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(5,1fr)' }}>
        {[
          { val: stats.total.toLocaleString(), lbl: 'Total Patients',  sub: '5 tables combined',       color: 'var(--blue-600)' },
          { val: stats.pos.toLocaleString(),   lbl: 'LC Positive',     sub: `${prevalence}% prevalence`, color: 'var(--danger)'   },
          { val: stats.neg.toLocaleString(),   lbl: 'Control',         sub: 'No lung cancer',           color: 'var(--ok)'       },
          { val: `${stats.avgAge}`,            lbl: 'Avg Age',         sub: 'years',                    color: 'var(--teal-500)' },
          { val: `${stats.avgScc}`,            lbl: 'Avg SCC Score',   sub: '9–172 range',              color: 'var(--warn)'     },
        ].map(s => (
          <div className="stat-card" key={s.lbl}>
            <div className="stat-val" style={{ color: s.color }}>{s.val}</div>
            <div className="stat-lbl">{s.lbl}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Vitals row */}
      <div className="card">
        <div className="card-header"><span className="card-title">Cohort Vitals Averages</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
          {[
            ['Avg Systolic',   `${stats.vitals.avg_systolic}`,  'mmHg' ],
            ['Avg Diastolic',  `${stats.vitals.avg_diastolic}`, 'mmHg' ],
            ['Avg Heart Rate', `${stats.vitals.avg_hr}`,        'bpm'  ],
            ['Avg BMI',        `${stats.avgBmi}`,               ''     ],
            ['Total Chol.',    `${stats.vitals.avg_chol}`,      'mg/dL'],
            ['Avg LDL',        `${stats.vitals.avg_ldl}`,       'mg/dL'],
            ['Avg HbA1c',      `${stats.vitals.avg_hba1c}`,     '%'    ],
          ].map(([label,val,unit]) => (
            <div key={label as string} style={{ padding: '16px 12px', borderRight: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text-heading)' }}>{val}</div>
              <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 2 }}>{unit}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts grid */}
      <div className="chart-grid">
        {/* Age dist */}
        <div className="card">
          <div className="card-header"><span className="card-title">Age Distribution by Diagnosis</span></div>
          <div className="chart-wrap">
            <div className="chart-legend">
              <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--danger)' }} />LC Positive</div>
              <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--blue-400)' }} />Control</div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.ageDist} margin={{ top:5,right:10,left:-10,bottom:5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="age" tick={{ fontSize:11, fill:'var(--text-faint)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:11, fill:'var(--text-faint)' }} axisLine={false} tickLine={false} />
                <Tooltip {...TT} />
                <Bar dataKey="positive" name="LC Positive" fill="var(--danger)"   radius={[3,3,0,0]} opacity={.85} />
                <Bar dataKey="negative" name="Control"     fill="var(--blue-400)" radius={[3,3,0,0]} opacity={.7}  />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tobacco vs cancer */}
        <div className="card">
          <div className="card-header"><span className="card-title">Tobacco Status vs Diagnosis</span></div>
          <div className="chart-wrap">
            <div className="chart-legend">
              <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--danger)' }} />LC Positive</div>
              <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--ok)' }} />Control</div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.tobaccoCancer} margin={{ top:5,right:10,left:-10,bottom:5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="status" tick={{ fontSize:11, fill:'var(--text-faint)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:11, fill:'var(--text-faint)' }} axisLine={false} tickLine={false} />
                <Tooltip {...TT} />
                <Bar dataKey="positive" name="LC Positive" fill="var(--danger)" radius={[3,3,0,0]} />
                <Bar dataKey="negative" name="Control"     fill="var(--ok)"     radius={[3,3,0,0]} opacity={.7} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* SCC dist */}
        <div className="card">
          <div className="card-header"><span className="card-title">SCC Score Distribution</span></div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.sccDist} margin={{ top:5,right:10,left:-10,bottom:5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="range" tick={{ fontSize:9, fill:'var(--text-faint)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:11, fill:'var(--text-faint)' }} axisLine={false} tickLine={false} />
                <Tooltip {...TT} />
                <Bar dataKey="count" name="Patients" radius={[3,3,0,0]} opacity={.85}>
                  {stats.sccDist.map((_, i) => (
                    <Cell key={i} fill={i < 5 ? 'var(--ok)' : i < 8 ? 'var(--warn)' : 'var(--danger)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* BMI dist */}
        <div className="card">
          <div className="card-header"><span className="card-title">BMI Category vs Diagnosis</span></div>
          <div className="chart-wrap">
            <div className="chart-legend">
              <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--danger)' }} />LC Positive</div>
              <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--teal-500)' }} />Control</div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.bmiDist} margin={{ top:5,right:10,left:-10,bottom:5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="category" tick={{ fontSize:10, fill:'var(--text-faint)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:11, fill:'var(--text-faint)' }} axisLine={false} tickLine={false} />
                <Tooltip {...TT} />
                <Bar dataKey="positive" name="LC Positive" fill="var(--danger)"   radius={[3,3,0,0]} />
                <Bar dataKey="negative" name="Control"     fill="var(--teal-500)" radius={[3,3,0,0]} opacity={.7} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Pie charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18 }}>
        {[
          { title: 'Gender', data: stats.gender },
          { title: 'Race',   data: stats.race   },
          { title: 'Diagnosis', data: [{ name: 'LC Positive', value: stats.pos }, { name: 'Control', value: stats.neg }] },
        ].map(chart => (
          <div className="card" key={chart.title}>
            <div className="card-header"><span className="card-title">{chart.title}</span></div>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={chart.data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65}
                    label={({ percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                    {chart.data.map((_, i) => (
                      <Cell key={i} fill={chart.title === 'Diagnosis' ? (i === 0 ? 'var(--danger)' : 'var(--ok)') : PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...TT} formatter={(v: number) => v.toLocaleString()} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 4 }}>
                {chart.data.map((d, i) => (
                  <div key={d.name} className="legend-item">
                    <div className="legend-dot" style={{ background: chart.title === 'Diagnosis' ? (i === 0 ? 'var(--danger)' : 'var(--ok)') : PIE_COLORS[i % PIE_COLORS.length] }} />
                    {d.name}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
