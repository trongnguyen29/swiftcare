import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import rawData from "../../data/synthea.json";

const cohort = rawData.cohort as {
  total: number; cancer_positive: number; cancer_negative: number;
  avg_age: number; avg_bmi: number; avg_scc: number;
  gender: Record<string, number>;
  race: Record<string, number>;
  tobacco: Record<string, number>;
  age_dist: {age: string; positive: number; negative: number}[];
  scc_dist: {range: string; count: number}[];
  tobacco_cancer: {status: string; positive: number; negative: number}[];
  bmi_dist: {category: string; positive: number; negative: number}[];
  vitals: Record<string, number>;
};

const COLORS = ["var(--blue-600)","var(--teal-500)","var(--warn)","var(--ok)","var(--danger)","#a78bfa"];
const PIE_COLORS = ["#3b82f6","#14b8a6","#f59e0b","#22c55e","#ef4444","#8b5cf6"];

const TooltipStyle = {
  contentStyle:{background:"var(--bg-white)",border:"1px solid var(--border)",borderRadius:10,fontSize:12,boxShadow:"var(--shadow)"}
};

const raceData = Object.entries(cohort.race).map(([k, v]) => ({ name: k.charAt(0).toUpperCase()+k.slice(1), value: v }));
const genderData = [
  { name: "Male",   value: cohort.gender.m },
  { name: "Female", value: cohort.gender.f },
];

export default function CohortTab() {
  const prevalence = ((cohort.cancer_positive / cohort.total) * 100).toFixed(1);
  const formerPct  = ((cohort.tobacco.former / cohort.total) * 100).toFixed(1);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:18}}>

      {/* Top stat cards */}
      <div className="stat-grid" style={{gridTemplateColumns:"repeat(5,1fr)"}}>
        {[
          { val: cohort.total.toLocaleString(),            lbl:"Total Patients",    sub:"Across 5 files",               color:"var(--blue-600)"  },
          { val: cohort.cancer_positive.toLocaleString(),  lbl:"LC Positive",       sub:`${prevalence}% prevalence`,    color:"var(--danger)"    },
          { val: cohort.cancer_negative.toLocaleString(),  lbl:"Control",           sub:"No lung cancer",               color:"var(--ok)"        },
          { val: `${cohort.avg_age}`,                      lbl:"Avg Age",           sub:"years",                        color:"var(--teal-500)"  },
          { val: `${cohort.avg_scc}`,                      lbl:"Avg SCC Score",     sub:"9–172 range",                  color:"var(--warn)"      },
        ].map(s => (
          <div className="stat-card" key={s.lbl}>
            <div className="stat-val" style={{color:s.color}}>{s.val}</div>
            <div className="stat-lbl">{s.lbl}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Vitals overview row */}
      <div className="card">
        <div className="card-header"><span className="card-title">Cohort Vitals Averages</span></div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:0}}>
          {[
            { label:"Avg Systolic",    val:`${cohort.vitals.avg_systolic}`, unit:"mmHg" },
            { label:"Avg Diastolic",   val:`${cohort.vitals.avg_diastolic}`, unit:"mmHg" },
            { label:"Avg Heart Rate",  val:`${cohort.vitals.avg_hr}`, unit:"bpm" },
            { label:"Avg BMI",         val:`${cohort.avg_bmi}`, unit:"" },
            { label:"Total Chol.",     val:`${cohort.vitals.avg_chol}`, unit:"mg/dL" },
            { label:"Avg LDL",         val:`${cohort.vitals.avg_ldl}`, unit:"mg/dL" },
            { label:"Avg HbA1c",       val:`${cohort.vitals.avg_hba1c}`, unit:"%" },
          ].map(v => (
            <div key={v.label} style={{padding:"16px 12px",borderRight:"1px solid var(--border)",textAlign:"center"}} className="vital-cell">
              <div className="vital-label">{v.label}</div>
              <div style={{fontSize:22,fontWeight:700,fontFamily:"var(--mono)",color:"var(--text-heading)"}}>{v.val}</div>
              <div className="vital-unit">{v.unit}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts row 1 */}
      <div className="chart-grid">

        {/* Age distribution */}
        <div className="card">
          <div className="card-header"><span className="card-title">Age Distribution by Diagnosis</span></div>
          <div className="chart-wrap">
            <div className="chart-legend">
              <div className="legend-item"><div className="legend-dot" style={{background:"var(--danger)"}} />LC Positive</div>
              <div className="legend-item"><div className="legend-dot" style={{background:"var(--blue-400)"}} />Control</div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={cohort.age_dist} margin={{top:5,right:10,left:-10,bottom:5}}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="age" tick={{fontSize:11,fill:"var(--text-faint)"}} axisLine={false} tickLine={false} />
                <YAxis tick={{fontSize:11,fill:"var(--text-faint)"}} axisLine={false} tickLine={false} />
                <Tooltip {...TooltipStyle} />
                <Bar dataKey="positive" name="LC Positive" fill="var(--danger)" radius={[3,3,0,0]} opacity={.85} />
                <Bar dataKey="negative" name="Control"     fill="var(--blue-400)" radius={[3,3,0,0]} opacity={.7} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tobacco vs cancer */}
        <div className="card">
          <div className="card-header"><span className="card-title">Tobacco Status vs Diagnosis</span></div>
          <div className="chart-wrap">
            <div className="chart-legend">
              <div className="legend-item"><div className="legend-dot" style={{background:"var(--danger)"}} />LC Positive</div>
              <div className="legend-item"><div className="legend-dot" style={{background:"var(--ok)"}} />Control</div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={cohort.tobacco_cancer} margin={{top:5,right:10,left:-10,bottom:5}}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="status" tick={{fontSize:11,fill:"var(--text-faint)"}} axisLine={false} tickLine={false} />
                <YAxis tick={{fontSize:11,fill:"var(--text-faint)"}} axisLine={false} tickLine={false} />
                <Tooltip {...TooltipStyle} />
                <Bar dataKey="positive" name="LC Positive" fill="var(--danger)" radius={[3,3,0,0]} />
                <Bar dataKey="negative" name="Control"     fill="var(--ok)"     radius={[3,3,0,0]} opacity={.7} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* SCC distribution */}
        <div className="card">
          <div className="card-header"><span className="card-title">SCC Score Distribution</span></div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={cohort.scc_dist} margin={{top:5,right:10,left:-10,bottom:5}}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="range" tick={{fontSize:9,fill:"var(--text-faint)"}} axisLine={false} tickLine={false} />
                <YAxis tick={{fontSize:11,fill:"var(--text-faint)"}} axisLine={false} tickLine={false} />
                <Tooltip {...TooltipStyle} />
                <Bar dataKey="count" name="Patients" fill="var(--blue-500)" radius={[3,3,0,0]} opacity={.8}>
                  {cohort.scc_dist.map((_, i) => (
                    <Cell key={i} fill={i < 5 ? "var(--ok)" : i < 8 ? "var(--warn)" : "var(--danger)"} opacity={.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* BMI vs diagnosis */}
        <div className="card">
          <div className="card-header"><span className="card-title">BMI Category vs Diagnosis</span></div>
          <div className="chart-wrap">
            <div className="chart-legend">
              <div className="legend-item"><div className="legend-dot" style={{background:"var(--danger)"}} />LC Positive</div>
              <div className="legend-item"><div className="legend-dot" style={{background:"var(--teal-500)"}} />Control</div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={cohort.bmi_dist} margin={{top:5,right:10,left:-10,bottom:5}}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="category" tick={{fontSize:10,fill:"var(--text-faint)"}} axisLine={false} tickLine={false} />
                <YAxis tick={{fontSize:11,fill:"var(--text-faint)"}} axisLine={false} tickLine={false} />
                <Tooltip {...TooltipStyle} />
                <Bar dataKey="positive" name="LC Positive" fill="var(--danger)"   radius={[3,3,0,0]} />
                <Bar dataKey="negative" name="Control"     fill="var(--teal-500)" radius={[3,3,0,0]} opacity={.7} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Charts row 2 — pie charts */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:18}}>

        {/* Gender */}
        <div className="card">
          <div className="card-header"><span className="card-title">Gender Distribution</span></div>
          <div className="chart-wrap" style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={genderData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({name,percent}) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                  {genderData.map((_,i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip {...TooltipStyle} formatter={(v:number) => v.toLocaleString()} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Race */}
        <div className="card">
          <div className="card-header"><span className="card-title">Race Distribution</span></div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={raceData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({name,percent}) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                  {raceData.map((_,i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip {...TooltipStyle} formatter={(v:number) => v.toLocaleString()} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* LC Positive vs Negative */}
        <div className="card">
          <div className="card-header"><span className="card-title">Diagnosis Breakdown</span></div>
          <div className="chart-wrap" style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={[
                    {name:"LC Positive", value: cohort.cancer_positive},
                    {name:"Control",     value: cohort.cancer_negative},
                  ]}
                  dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}
                  label={({name,percent}) => `${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={11}
                >
                  <Cell fill="var(--danger)" />
                  <Cell fill="var(--ok)" />
                </Pie>
                <Tooltip {...TooltipStyle} formatter={(v:number) => v.toLocaleString()} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{display:"flex",gap:16,marginTop:4}}>
              <div className="legend-item"><div className="legend-dot" style={{background:"var(--danger)"}} />LC Positive ({prevalence}%)</div>
              <div className="legend-item"><div className="legend-dot" style={{background:"var(--ok)"}} />Control</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
