import { problems } from "../../data/patient";

const severityColor: Record<string, string> = {
  moderate: "var(--warn)",
  mild: "var(--accent-cyan)",
  severe: "var(--danger)",
};

export default function ProblemsTab() {
  const active = problems.filter((p) => p.status === "active");
  const historical = problems.filter((p) => p.status === "historical");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Active Problems */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Active Problems</span>
          <span className="badge badge-warn">{active.length}</span>
        </div>
        {active.map((p) => (
          <div className="problem-row" key={p.icd}>
            <div
              className="problem-dot"
              style={{ background: p.severity ? severityColor[p.severity] : "var(--text-muted)" }}
            />
            <div className="problem-name">{p.name}</div>
            <span className="badge" style={{
              background: p.severity ? `${severityColor[p.severity]}20` : "var(--bg-elevated)",
              color: p.severity ? severityColor[p.severity] : "var(--text-muted)",
            }}>
              {p.severity}
            </span>
            <div className="problem-icd">{p.icd}</div>
            <div className="problem-onset">since {p.onset}</div>
          </div>
        ))}
      </div>

      {/* Historical Problems */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Surgical / Historical</span>
          <span className="badge badge-muted">{historical.length}</span>
        </div>
        {historical.map((p) => (
          <div className="problem-row" key={p.icd} style={{ opacity: 0.6 }}>
            <div className="problem-dot" style={{ background: "var(--text-muted)" }} />
            <div className="problem-name">{p.name}</div>
            <span className="badge badge-muted">resolved</span>
            <div className="problem-icd">{p.icd}</div>
            <div className="problem-onset">{p.onset}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
