import { useState, useEffect, useCallback } from "react";
import type { Patient } from "../../types/patient";
import { displayName, initials } from "../../types/patient";
import { queryPatients } from "../../api/api";
import PatientDetail from "./PatientDetail";

interface PatientsProps {
  selectedPatient: Patient | null;
  onSelectPatient: (p: Patient | null) => void;
  onOpenPatient: (p: Patient) => void;
}

export default function Patients({
  selectedPatient,
  onSelectPatient,
}: PatientsProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [filter, setFilter] = useState<"all" | "positive" | "control">("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const pts = await queryPatients(searchText, filter);
      setPatients(pts);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [searchText, filter]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  if (selectedPatient) {
    return (
      <PatientDetail patient={selectedPatient} onBack={() => onSelectPatient(null)} />
    );
  }

  const filtered = searchText
    ? patients.filter((p) =>
        displayName(p).toLowerCase().includes(searchText.toLowerCase()) ||
        p.ptnum.toLowerCase().includes(searchText.toLowerCase())
      )
    : patients;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div
        style={{
          padding: "12px 14px",
          background: "var(--color-surface)",
          borderBottom: "1px solid var(--color-border)",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          flexShrink: 0,
        }}
      >
        <div className="search-bar">
          <span className="search-bar__icon">🔍</span>
          <input
            id="patients-search-input"
            type="text"
            placeholder="Search by name or MRN…"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            autoComplete="off"
          />
          {searchText && (
            <button className="search-bar__clear" onClick={() => setSearchText("")}>
              ✕
            </button>
          )}
        </div>

        <div className="filter-pills">
          {(["all", "positive", "control"] as const).map((f) => (
            <button
              key={f}
              id={`filter-${f}`}
              className={`filter-pill ${filter === f ? "filter-pill--active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "All" : f === "positive" ? "LC+ Positive" : "Control"}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="page" style={{ background: "var(--color-surface)" }}>
        {loading ? (
          <div className="loading-row">
            <div className="spinner" />
            Loading patients…
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">👥</div>
            <div className="empty-state__title">No patients found</div>
            <div className="empty-state__sub">Try a different search or filter</div>
          </div>
        ) : (
          <div>
            <div
              style={{
                padding: "6px 14px",
                fontSize: "11px",
                color: "var(--color-text-muted)",
                borderBottom: "1px solid var(--color-border)",
              }}
            >
              {filtered.length} patient{filtered.length !== 1 ? "s" : ""}
            </div>
            {filtered.map((p) => (
              <button
                key={p.ptnum}
                id={`patient-item-${p.ptnum}`}
                className="patient-list-item"
                onClick={() => onSelectPatient(p)}
              >
                <div className="patient-avatar">{initials(displayName(p))}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="font-semibold truncate">{displayName(p)}</div>
                  <div className="text-xs text-muted">
                    {p.ptnum}
                    {p.age ? ` · ${Math.round(p.age)} y/o` : ""}
                    {p.administrative_sex ? ` · ${p.administrative_sex}` : ""}
                  </div>
                </div>
                {p.label === 1 && <span className="badge badge--lc">LC+</span>}
                <span style={{ color: "var(--color-text-faint)", fontSize: "12px" }}>›</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
