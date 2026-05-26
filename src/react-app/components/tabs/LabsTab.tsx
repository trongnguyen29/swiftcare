import { labs } from "../../data/patient";

export default function LabsTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {labs.map((panel) => (
        <div className="card" key={panel.panel}>
          <div className="card-header">
            <span className="card-title">{panel.panel}</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{panel.date}</span>
          </div>
          <table className="ehr-table">
            <thead>
              <tr>
                <th>Test</th>
                <th>Result</th>
                <th>Unit</th>
                <th>Reference Range</th>
                <th>Flag</th>
              </tr>
            </thead>
            <tbody>
              {panel.results.map((r) => (
                <tr key={r.name}>
                  <td style={{ fontWeight: 500 }}>{r.name}</td>
                  <td>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontWeight: 700,
                        color: r.flag === "H"
                          ? "var(--danger)"
                          : r.flag === "L"
                          ? "var(--accent-cyan)"
                          : "var(--text-primary)",
                      }}
                    >
                      {r.value}
                    </span>
                  </td>
                  <td style={{ color: "var(--text-muted)", fontSize: 12 }}>{r.unit}</td>
                  <td style={{ color: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-mono)" }}>
                    {r.ref}
                  </td>
                  <td>
                    {r.flag && (
                      <span className={`flag-${r.flag}`}>{r.flag}</span>
                    )}
                    {!r.flag && (
                      <span style={{ color: "var(--ok)", fontSize: 11, fontWeight: 600 }}>✓</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
