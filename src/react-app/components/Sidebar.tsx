import { patient } from "../data/patient";

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
}

export default function Sidebar({ open }: SidebarProps) {
  return (
    <aside className={`sidebar ${open ? "" : "collapsed"}`}>
      {/* Demographics */}
      <div className="sidebar-section">
        <div className="sidebar-label">Demographics</div>
        {[
          ["Room", patient.room],
          ["Blood Type", patient.bloodType],
          ["Height", patient.height],
          ["Weight", patient.weight],
          ["BMI", patient.bmi.toFixed(1)],
          ["Admitted", patient.admittedOn],
        ].map(([k, v]) => (
          <div className="info-row" key={k}>
            <span className="info-key">{k}</span>
            <span className="info-val">{v}</span>
          </div>
        ))}
      </div>

      {/* Primary Dx */}
      <div className="sidebar-section">
        <div className="sidebar-label">Primary Diagnosis</div>
        <div style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 500, lineHeight: 1.5 }}>
          {patient.primaryDx}
        </div>
      </div>

      {/* Attending */}
      <div className="sidebar-section">
        <div className="sidebar-label">Care Team</div>
        <div className="info-row">
          <span className="info-key">Attending</span>
          <span className="info-val">{patient.attending}</span>
        </div>
        <div className="info-row">
          <span className="info-key">Insurance</span>
          <span className="info-val">{patient.insurance}</span>
        </div>
        <div className="info-row">
          <span className="info-key">Emergency</span>
          <span className="info-val" style={{ fontSize: 11 }}>{patient.emergencyContact}</span>
        </div>
      </div>

      {/* Allergies */}
      <div className="sidebar-section">
        <div className="sidebar-label" style={{ color: "var(--danger)" }}>
          ⚠ Allergies ({patient.allergies.length})
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {patient.allergies.map((a) => (
            <div key={a.substance} className={`allergy-chip ${a.severity}`} title={a.reaction}>
              <span>{a.severity === "severe" ? "⚠" : a.severity === "moderate" ? "●" : "○"}</span>
              {a.substance}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8 }}>
          {patient.allergies.map((a) => (
            <div key={a.substance} style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 3 }}>
              <span style={{ color: "var(--text-secondary)" }}>{a.substance}</span> → {a.reaction}
            </div>
          ))}
        </div>
      </div>

      {/* Quick links */}
      <div className="sidebar-section">
        <div className="sidebar-label">Quick Actions</div>
        {["View Orders", "Imaging", "Referrals", "Care Plan", "Discharge Summary"].map((item) => (
          <div
            key={item}
            style={{
              padding: "8px 0",
              fontSize: 12,
              color: "var(--text-secondary)",
              cursor: "pointer",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-blue)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
          >
            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>→</span>
            {item}
          </div>
        ))}
      </div>
    </aside>
  );
}
