import { useState, useMemo } from "react";
import type { Patient } from "../../App";
import rawData from "../../data/synthea.json";

const patients = rawData.patients as Patient[];

interface Props { onSelect: (p: Patient) => void; }

function sccLabel(scc: number | null) {
  if (scc == null) return { label: "N/A", cls: "badge-muted" };
  if (scc >= 130) return { label: `${scc} · High`, cls: "badge-danger" };
  if (scc >= 100) return { label: `${scc} · Med`, cls: "badge-warn" };
  return { label: `${scc} · Low`, cls: "badge-ok" };
}

function bpLabel(s: number | null) {
  if (s == null) return "—";
  if (s >= 140) return "↑";
  return "✓";
}

export default function PatientListTab({ onSelect }: Props) {
  const [query, setQuery]     = useState("");
  const [filterLabel, setFilterLabel] = useState("all");
  const [filterGender, setFilterGender] = useState("all");
  const [filterTobacco, setFilterTobacco] = useState("all");
  const [page, setPage] = useState(0);
  const PER_PAGE = 20;

  const filtered = useMemo(() => {
    return patients.filter(p => {
      if (query && !p.ptnum.toLowerCase().includes(query.toLowerCase())) return false;
      if (filterLabel !== "all" && String(p.label) !== filterLabel) return false;
      if (filterGender !== "all" && p.gender !== filterGender) return false;
      if (filterTobacco !== "all" && p.tobacco_status !== filterTobacco) return false;
      return true;
    });
  }, [query, filterLabel, filterGender, filterTobacco]);

  const paged = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);

  return (
    <div>
      {/* Summary stat cards */}
      <div className="stat-grid">
        {[
          { val: patients.length.toLocaleString(), lbl: "Patients (sample)", sub: "300 of 21,601 total", color: "var(--blue-600)" },
          { val: patients.filter(p=>p.label===1).length.toString(), lbl: "LC Positive", sub: `${Math.round(patients.filter(p=>p.label===1).length/patients.length*100)}% in sample`, color: "var(--danger)" },
          { val: patients.filter(p=>p.tobacco_status==="former").length.toString(), lbl: "Former Smokers", sub: "Key risk factor", color: "var(--warn)" },
          { val: Math.round(patients.reduce((s,p)=>s+(p.age||0),0)/patients.length).toString(), lbl: "Avg Age", sub: "years old", color: "var(--teal-500)" },
        ].map(s => (
          <div className="stat-card" key={s.lbl}>
            <div className="stat-val" style={{color:s.color}}>{s.val}</div>
            <div className="stat-lbl">{s.lbl}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Search + filters */}
      <div className="search-bar">
        <input className="search-input" placeholder="🔍  Search by patient ID (e.g. p15865)…" value={query} onChange={e=>{setQuery(e.target.value);setPage(0)}} />
        <select className="filter-select" value={filterLabel} onChange={e=>{setFilterLabel(e.target.value);setPage(0)}}>
          <option value="all">All Diagnoses</option>
          <option value="1">LC Positive</option>
          <option value="0">Control</option>
        </select>
        <select className="filter-select" value={filterGender} onChange={e=>{setFilterGender(e.target.value);setPage(0)}}>
          <option value="all">All Genders</option>
          <option value="m">Male</option>
          <option value="f">Female</option>
        </select>
        <select className="filter-select" value={filterTobacco} onChange={e=>{setFilterTobacco(e.target.value);setPage(0)}}>
          <option value="all">All Tobacco</option>
          <option value="former">Former Smoker</option>
          <option value="never">Never Smoked</option>
        </select>
        <span style={{fontSize:12,color:"var(--text-faint)",whiteSpace:"nowrap"}}>{filtered.length} results</span>
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Patient Registry</span>
          <span className="badge badge-blue">{filtered.length} patients</span>
        </div>
        <table className="ehr-table">
          <thead>
            <tr>
              <th>Patient ID</th>
              <th>Age</th>
              <th>Gender</th>
              <th>Race</th>
              <th>Tobacco</th>
              <th>SCC Score</th>
              <th>BP</th>
              <th>BMI</th>
              <th>Diagnosis</th>
            </tr>
          </thead>
          <tbody>
            {paged.map(p => {
              const scc = sccLabel(p.scc);
              return (
                <tr key={p.ptnum} onClick={() => onSelect(p)}>
                  <td><span style={{fontFamily:"var(--mono)",fontWeight:600,color:"var(--blue-600)"}}>{p.ptnum}</span></td>
                  <td>{p.age ?? "—"}</td>
                  <td>{p.gender === "m" ? "Male" : p.gender === "f" ? "Female" : "—"}</td>
                  <td style={{textTransform:"capitalize"}}>{p.race ?? "—"}</td>
                  <td>
                    <span className={`badge ${p.tobacco_status === "former" ? "badge-warn" : "badge-ok"}`}>
                      {p.tobacco_status === "former" ? "Former" : "Never"}
                    </span>
                  </td>
                  <td><span className={`badge ${scc.cls}`}>{scc.label}</span></td>
                  <td>
                    <span style={{fontFamily:"var(--mono)",fontSize:12}}>
                      {p.systolic_bp ?? "—"}/{p.diastolic_bp ?? "—"}
                    </span>
                    <span style={{marginLeft:4,fontSize:11,color:p.systolic_bp&&p.systolic_bp>=140?"var(--danger)":"var(--ok)"}}>
                      {bpLabel(p.systolic_bp)}
                    </span>
                  </td>
                  <td><span style={{fontFamily:"var(--mono)",fontSize:12}}>{p.bmi ?? "—"}</span></td>
                  <td>
                    {p.label === 1
                      ? <span className="badge badge-danger">LC Positive</span>
                      : <span className="badge badge-ok">Control</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Pagination */}
        <div style={{display:"flex",alignItems:"center",gap:8,padding:"12px 16px",borderTop:"1px solid var(--border)",background:"var(--bg-subtle)"}}>
          <button
            onClick={() => setPage(p => Math.max(0, p-1))}
            disabled={page === 0}
            style={{padding:"5px 12px",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",background:"var(--bg-white)",cursor:"pointer",fontSize:12,opacity:page===0?.4:1}}
          >← Prev</button>
          <span style={{fontSize:12,color:"var(--text-muted)"}}>Page {page+1} of {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages-1, p+1))}
            disabled={page >= totalPages-1}
            style={{padding:"5px 12px",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",background:"var(--bg-white)",cursor:"pointer",fontSize:12,opacity:page>=totalPages-1?.4:1}}
          >Next →</button>
          <span style={{fontSize:11,color:"var(--text-faint)",marginLeft:"auto"}}>Click any row to view full patient record</span>
        </div>
      </div>
    </div>
  );
}
