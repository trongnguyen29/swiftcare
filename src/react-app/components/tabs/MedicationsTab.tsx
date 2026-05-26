import { medications } from "../../data/patient";

export default function MedicationsTab() {
  const active = medications.filter((m) => m.status === "active");
  const prn = medications.filter((m) => m.status === "prn");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="card">
        <div className="card-header">
          <span className="card-title">Active Medications</span>
          <span className="badge badge-ok">{active.length} active</span>
        </div>
        <table className="ehr-table">
          <thead>
            <tr>
              <th>Medication</th>
              <th>Dose / Route</th>
              <th>Frequency</th>
              <th>Prescriber</th>
              <th>Last Given</th>
              <th>Next Due</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {active.map((med) => (
              <tr key={med.name}>
                <td>
                  <span style={{ fontWeight: 600 }}>{med.name}</span>
                </td>
                <td>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
                    {med.dose} {med.route}
                  </span>
                </td>
                <td style={{ color: "var(--text-secondary)" }}>{med.frequency}</td>
                <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{med.prescriber}</td>
                <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{med.lastGiven}</td>
                <td style={{ fontSize: 12, color: "var(--accent-cyan)" }}>{med.nextDue}</td>
                <td>
                  <span className="badge badge-ok">Active</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">PRN Medications</span>
          <span className="badge badge-muted">{prn.length}</span>
        </div>
        <table className="ehr-table">
          <thead>
            <tr>
              <th>Medication</th>
              <th>Dose / Route</th>
              <th>Indication</th>
              <th>Prescriber</th>
              <th>Last Given</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {prn.map((med) => (
              <tr key={med.name}>
                <td>
                  <span style={{ fontWeight: 600 }}>{med.name}</span>
                </td>
                <td>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
                    {med.dose} {med.route}
                  </span>
                </td>
                <td style={{ color: "var(--text-secondary)" }}>{med.frequency}</td>
                <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{med.prescriber}</td>
                <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{med.lastGiven}</td>
                <td>
                  <span className="badge badge-muted">PRN</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
