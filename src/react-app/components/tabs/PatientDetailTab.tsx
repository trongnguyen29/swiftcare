import type { Patient } from "../../lib/supabase";

interface Props { patient: Patient; onBack: () => void; }

function vitalClass(val: number | null, type: string): string {
  if (val == null) return "";
  if (type === "sbp") return val >= 140 ? "elevated" : val >= 130 ? "elevated" : "good";
  if (type === "dbp") return val >= 90 ? "elevated" : "good";
  if (type === "hr")  return val > 100 ? "elevated" : val < 60 ? "elevated" : "good";
  if (type === "bmi") return val >= 30 ? "high" : val >= 25 ? "elevated" : "good";
  if (type === "chol") return val >= 200 ? "elevated" : "good";
  if (type === "ldl")  return val >= 130 ? "elevated" : "good";
  if (type === "hba1c") return val >= 6.5 ? "high" : val >= 5.7 ? "elevated" : "good";
  return "";
}

function pillClass(cls: string) {
  if (cls === "good") return "ok";
  if (cls === "elevated") return "warn";
  if (cls === "high") return "danger";
  return "ok";
}

function fmt(val: number | null, unit = ""): string {
  if (val == null) return "—";
  return `${val}${unit}`;
}

export default function PatientDetailTab({ patient: p, onBack }: Props) {
  const sccPct = p.scc ? Math.min(100, Math.round((p.scc / 172) * 100)) : 0;
  const isPositive = p.label === 1;

  return (
    <div>
      <button className="back-btn" onClick={onBack}>← Back to Registry</button>

      {/* Hero */}
      <div className="card" style={{marginBottom:16}}>
        <div className="detail-hero">
          <div style={{position:"relative",display:"flex",alignItems:"center",gap:20,flexWrap:"wrap"}}>
            <div style={{width:60,height:60,borderRadius:"50%",background:"rgba(255,255,255,.2)",border:"2px solid rgba(255,255,255,.4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:700,color:"#fff",flexShrink:0}}>
              {p.gender === "m" ? "♂" : "♀"}
            </div>
            <div>
              <div style={{fontSize:24,fontWeight:700,letterSpacing:"-.3px"}}>{p.ptnum}</div>
              <div style={{fontSize:13,color:"rgba(255,255,255,.8)",marginTop:3}}>
                {p.age ? `${p.age} years old` : "Age unknown"} · {p.gender === "m" ? "Male" : "Female"} · {p.race ?? "Unknown race"}
              </div>
              <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}}>
                <span style={{background:"rgba(255,255,255,.2)",color:"#fff",padding:"3px 10px",borderRadius:12,fontSize:11,fontWeight:600}}>
                  SCC: {p.scc ?? "N/A"}
                </span>
                <span style={{background:"rgba(255,255,255,.2)",color:"#fff",padding:"3px 10px",borderRadius:12,fontSize:11,fontWeight:600}}>
                  {p.tobacco_status === "former" ? "🚬 Former Smoker" : "✓ Never Smoked"}
                </span>
                <span style={{background:"rgba(255,255,255,.2)",color:"#fff",padding:"3px 10px",borderRadius:12,fontSize:11,fontWeight:600}}>
                  BMI: {p.bmi ?? "—"}
                </span>
              </div>
            </div>
            <div style={{marginLeft:"auto",display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
              <span style={{
                background: isPositive ? "rgba(220,38,38,.25)" : "rgba(22,163,74,.25)",
                border: `1px solid ${isPositive ? "rgba(220,38,38,.5)" : "rgba(22,163,74,.5)"}`,
                color: "#fff",
                padding: "6px 16px",
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: ".5px",
              }}>
                {isPositive ? "⚠ LC POSITIVE" : "✓ CONTROL"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="detail-grid">

        {/* Vitals */}
        <div className="card detail-2col">
          <div className="card-header"><span className="card-title">Vital Signs</span></div>
          <div className="vital-row">
            {[
              { label:"Systolic BP",  val:p.systolic_bp,   unit:"mmHg", type:"sbp"  },
              { label:"Diastolic BP", val:p.diastolic_bp,  unit:"mmHg", type:"dbp"  },
              { label:"Heart Rate",   val:p.heart_rate,    unit:"bpm",  type:"hr"   },
              { label:"Height",       val:p.height,        unit:"cm",   type:""     },
              { label:"Weight",       val:p.weight,        unit:"kg",   type:""     },
              { label:"BMI",          val:p.bmi,           unit:"",     type:"bmi"  },
            ].map(v => {
              const cls = vitalClass(v.val, v.type);
              const pc  = pillClass(cls);
              return (
                <div key={v.label} className="vital-cell">
                  <div className="vital-label">{v.label}</div>
                  <div className={`vital-value ${cls}`}>{fmt(v.val)}</div>
                  <div className="vital-unit">{v.unit}</div>
                  {cls && <div className={`vital-pill ${pc}`}>{cls === "good" ? "Normal" : cls === "elevated" ? "Elevated" : "High"}</div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* SCC Score */}
        <div className="card">
          <div className="card-header"><span className="card-title">SCC Score</span></div>
          <div className="scc-gauge">
            <div style={{fontSize:11,color:"var(--text-faint)",textTransform:"uppercase",letterSpacing:".7px",marginBottom:4}}>Lung Cancer Severity</div>
            <div className="scc-number">{p.scc ?? "—"}</div>
            <div style={{fontSize:11,color:"var(--text-muted)",marginTop:4}}>Range: 9 – 172 · Avg: 103.8</div>
            <div className="scc-bar-wrap">
              <div className="scc-bar-fill" style={{width:`${sccPct}%`}} />
            </div>
            <div style={{display:"flex",justifyContent:"space-between",width:"100%",fontSize:10,color:"var(--text-faint)",marginTop:4}}>
              <span>Low</span><span>Medium</span><span>High</span>
            </div>
            <div style={{marginTop:14}}>
              {isPositive
                ? <span className="badge badge-danger" style={{fontSize:12,padding:"5px 14px"}}>⚠ Lung Cancer Positive</span>
                : <span className="badge badge-ok" style={{fontSize:12,padding:"5px 14px"}}>✓ Control (No LC)</span>}
            </div>
          </div>
        </div>

        {/* Labs / Lipids */}
        <div className="card">
          <div className="card-header"><span className="card-title">Labs & Lipids</span></div>
          <div style={{padding:"8px 20px"}}>
            {[
              { k:"Total Cholesterol", v:p.total_cholesterol, unit:"mg/dL", ref:"<200",    type:"chol" },
              { k:"LDL",              v:p.ldl,               unit:"mg/dL", ref:"<130",    type:"ldl"  },
              { k:"HDL",              v:p.hdl,               unit:"mg/dL", ref:">40",     type:""     },
              { k:"Triglycerides",    v:p.triglycerides,     unit:"mg/dL", ref:"<150",    type:""     },
              { k:"HbA1c",            v:p.hba1c,             unit:"%",     ref:"<5.7",    type:"hba1c"},
              { k:"Glucose",          v:p.glucose,           unit:"mg/dL", ref:"70–99",   type:""     },
            ].map(row => {
              const cls = vitalClass(row.v, row.type);
              return (
                <div key={row.k} className="info-field">
                  <span className="field-key">{row.k}</span>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontFamily:"var(--mono)",fontWeight:700,color:cls==="elevated"?"var(--warn)":cls==="high"?"var(--danger)":"var(--text-heading)",fontSize:13}}>
                      {row.v ?? "—"} {row.v ? row.unit : ""}
                    </span>
                    <span style={{fontSize:10,color:"var(--text-faint)"}}>ref {row.ref}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Demographics */}
        <div className="card">
          <div className="card-header"><span className="card-title">Demographics</span></div>
          <div style={{padding:"8px 20px"}}>
            {[
              { k:"Patient ID",   v:p.ptnum },
              { k:"Age",          v:p.age ? `${p.age} years` : "—" },
              { k:"Gender",       v:p.gender === "m" ? "Male" : p.gender === "f" ? "Female" : "—" },
              { k:"Race",         v:p.race   ?? "—" },
              { k:"Ethnicity",    v:p.ethnicity ?? "—" },
              { k:"Marital",      v:p.marital === "m" ? "Married" : p.marital === "s" ? "Single" : p.marital ?? "—" },
              { k:"State",        v:p.state  ?? "—" },
              { k:"Tobacco",      v:p.tobacco_status === "former" ? "Former Smoker" : "Never Smoked" },
              { k:"Pain Score",   v:p.pain_score != null ? `${p.pain_score} / 10` : "—" },
            ].map(row => (
              <div key={row.k} className="info-field">
                <span className="field-key">{row.k}</span>
                <span className="field-val" style={{textTransform:"capitalize"}}>{row.v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Risk summary */}
        <div className="card">
          <div className="card-header"><span className="card-title">Risk Summary</span></div>
          <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:10}}>
            {[
              { factor:"Tobacco History",   present: p.tobacco_status === "former",              msg: p.tobacco_status === "former" ? "Former smoker — elevated risk" : "Never smoked" },
              { factor:"Hypertension",       present: !!(p.systolic_bp && p.systolic_bp >= 140), msg: p.systolic_bp && p.systolic_bp >= 140 ? `SBP ${p.systolic_bp} mmHg` : "BP within normal range" },
              { factor:"Obesity (BMI ≥30)",  present: !!(p.bmi && p.bmi >= 30),                  msg: p.bmi ? `BMI ${p.bmi}` : "BMI unavailable" },
              { factor:"High Cholesterol",   present: !!(p.total_cholesterol && p.total_cholesterol >= 200), msg: p.total_cholesterol ? `Total chol ${p.total_cholesterol} mg/dL` : "—" },
              { factor:"Elevated HbA1c",     present: !!(p.hba1c && p.hba1c >= 5.7),             msg: p.hba1c ? `HbA1c ${p.hba1c}%` : "—" },
              { factor:"Age > 60",           present: !!(p.age && p.age > 60),                   msg: p.age ? `Age ${p.age}` : "—" },
            ].map(r => (
              <div key={r.factor} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"8px 0",borderBottom:"1px solid var(--border)"}}>
                <div style={{width:20,height:20,borderRadius:"50%",background:r.present?"var(--danger-bg)":"var(--ok-bg)",border:`1px solid ${r.present?"var(--danger-bdr)":"var(--ok-bdr)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,flexShrink:0,color:r.present?"var(--danger)":"var(--ok)"}}>
                  {r.present ? "!" : "✓"}
                </div>
                <div>
                  <div style={{fontSize:12,fontWeight:600,color:"var(--text-heading)"}}>{r.factor}</div>
                  <div style={{fontSize:11,color:"var(--text-muted)"}}>{r.msg}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
