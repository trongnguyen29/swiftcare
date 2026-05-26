import { patient } from "../data/patient";

export default function Header() {
  const initials = patient.name
    .split(" ")
    .filter((_, i) => i === 0 || i === 2)
    .map((n) => n[0])
    .join("");

  return (
    <header className="ehr-header">
      <div className="header-logo">
        <div className="logo-mark">Rx</div>
        <span>SwiftCare EHR</span>
      </div>

      <div className="header-divider" />

      <div className="header-patient-pill">
        <div className="patient-avatar">{initials}</div>
        <div>
          <div className="patient-pill-name">{patient.name}</div>
          <div className="patient-pill-id">{patient.mrn} · DOB {patient.dob} · {patient.age}y {patient.sex}</div>
        </div>
      </div>

      <span
        style={{
          background: "var(--danger-dim)",
          color: "var(--danger)",
          border: "1px solid rgba(239,68,68,0.25)",
          borderRadius: "6px",
          padding: "3px 10px",
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "0.5px",
        }}
      >
        ⚠ ALLERGIES ON FILE
      </span>

      <div className="header-spacer" />

      <div className="header-actions">
        <div className="dr-chip">
          <div className="dr-dot" />
          Dr. Okafor
        </div>
        <button className="header-btn">
          <span>📋</span> New Order
        </button>
        <button className="header-btn">
          <span>📝</span> Add Note
        </button>
        <button className="header-btn primary">
          <span>💊</span> Reconcile Meds
        </button>
      </div>
    </header>
  );
}
