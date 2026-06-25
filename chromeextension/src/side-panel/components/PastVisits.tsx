import { useState, useEffect } from "react";
import type { Patient } from "../../types/patient";
import type { Visit } from "../../types/visit";
import { fetchVisits } from "../../api/api";
import { formatVisitDate } from "../../types/visit";

interface Props { patient: Patient; }

export default function PastVisits({ patient }: Props) {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchVisits(patient.ptnum)
      .then((v) => setVisits(v.sort((a, b) => b.created_at.localeCompare(a.created_at))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [patient.ptnum]);

  if (loading) {
    return (
      <div className="loading-row">
        <div className="spinner" />
        Loading visits…
      </div>
    );
  }

  if (visits.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon">🕐</div>
        <div className="empty-state__title">No past visits</div>
        <div className="empty-state__sub">Use the Visit tab to record a new visit</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {visits.map((v) => (
        <div key={v.id} className="card">
          <div
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
            onClick={() => setExpanded(expanded === v.id ? null : v.id)}
          >
            <div>
              <div className="text-sm font-semibold">{formatVisitDate(v.created_at)}</div>
              <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "3px" }}>
                <span className={`badge badge--status-${v.status}`}>{v.status}</span>
                {v.template_name && (
                  <span className="text-xs text-muted">{v.template_name}</span>
                )}
              </div>
            </div>
            <span style={{ color: "var(--color-text-faint)", fontSize: "14px" }}>
              {expanded === v.id ? "▲" : "▼"}
            </span>
          </div>

          {expanded === v.id && (
            <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "10px" }}>
              {v.transcript && (
                <div>
                  <div className="text-xs text-muted font-bold" style={{ marginBottom: "5px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Transcript
                  </div>
                  <div
                    style={{
                      background: "var(--color-surface-3)",
                      borderRadius: "var(--radius-sm)",
                      padding: "10px",
                      fontSize: "12px",
                      color: "var(--color-text-muted)",
                      lineHeight: 1.6,
                      whiteSpace: "pre-wrap",
                      maxHeight: "120px",
                      overflowY: "auto",
                    }}
                  >
                    {v.transcript}
                  </div>
                </div>
              )}
              {v.note && (
                <div>
                  <div className="text-xs text-muted font-bold" style={{ marginBottom: "5px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Note
                  </div>
                  <div
                    style={{
                      background: "var(--color-surface-3)",
                      borderRadius: "var(--radius-sm)",
                      padding: "10px",
                      fontSize: "12px",
                      color: "var(--color-text)",
                      lineHeight: 1.6,
                      whiteSpace: "pre-wrap",
                      maxHeight: "200px",
                      overflowY: "auto",
                    }}
                  >
                    {v.note}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
