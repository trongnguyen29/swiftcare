// Sidebar — cohort-level info panel (no single-patient dummy data)
// The Synthea dataset is a population cohort, not a single patient EHR

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
}

const QUICK_ACTIONS = [
  "Export to CSV",
  "Run Cohort Filter",
  "Staging Workup",
  "Referral Queue",
  "Research Report",
]

export default function Sidebar({ open }: SidebarProps) {
  return (
    <aside className={`sidebar ${open ? "" : "collapsed"}`}>

      {/* Dataset info */}
      <div className="sidebar-section">
        <div className="sidebar-label">Dataset</div>
        {[
          ["Source",    "Synthea Synthetic"],
          ["Version",   "Lung Cancer Cohort"],
          ["Tables",    "5 raw + 5 converted"],
          ["Total Pts", "21,601"],
          ["Features",  "771 columns"],
          ["Codes",     "791 C-code mappings"],
        ].map(([k, v]) => (
          <div className="info-row" key={k}>
            <span className="info-key">{k}</span>
            <span className="info-val">{v}</span>
          </div>
        ))}
      </div>

      {/* Cohort breakdown */}
      <div className="sidebar-section">
        <div className="sidebar-label">Cohort Breakdown</div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>LC Positive</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--danger)" }}>25.8%</span>
          </div>
          <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: "25.8%", background: "var(--danger)", borderRadius: 3 }} />
          </div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Former Smokers</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--warn)" }}>43.1%</span>
          </div>
          <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: "43.1%", background: "var(--warn)", borderRadius: 3 }} />
          </div>
        </div>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Male</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--blue-600)" }}>57.5%</span>
          </div>
          <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: "57.5%", background: "var(--blue-600)", borderRadius: 3 }} />
          </div>
        </div>
      </div>

      {/* Key findings */}
      <div className="sidebar-section">
        <div className="sidebar-label" style={{ color: "var(--danger)" }}>⚠ Key Risk Findings</div>
        {[
          { label: "No LC under age 40",       color: "var(--ok)"       },
          { label: "Peak incidence: 60–70 yrs", color: "var(--warn)"     },
          { label: "Former smokers: 34.8% LC",  color: "var(--danger)"   },
          { label: "Never smokers: 18.8% LC",   color: "var(--ok)"       },
          { label: "High SCC (120+): 3,794 pts",color: "var(--danger)"   },
        ].map(f => (
          <div key={f.label} style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 11 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: f.color, flexShrink: 0 }} />
            <span style={{ color: "var(--text-body)" }}>{f.label}</span>
          </div>
        ))}
      </div>

      {/* Avg vitals */}
      <div className="sidebar-section">
        <div className="sidebar-label">Cohort Avg Vitals</div>
        {[
          ["Avg Age",      "59.5 yrs"  ],
          ["Avg BMI",      "28.9"      ],
          ["Avg Systolic", "124.3 mmHg"],
          ["Avg HR",       "81.0 bpm"  ],
          ["Avg HbA1c",    "5.8%"      ],
          ["Avg Chol.",    "185.5 mg/dL"],
        ].map(([k, v]) => (
          <div className="info-row" key={k}>
            <span className="info-key">{k}</span>
            <span className="info-val">{v}</span>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="sidebar-section">
        <div className="sidebar-label">Quick Actions</div>
        {QUICK_ACTIONS.map(item => (
          <div
            key={item}
            className="sidebar-nav-item"
            onMouseEnter={e => (e.currentTarget.style.color = "var(--blue-600)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            {item}
            <span className="nav-arrow">›</span>
          </div>
        ))}
      </div>

    </aside>
  )
}
