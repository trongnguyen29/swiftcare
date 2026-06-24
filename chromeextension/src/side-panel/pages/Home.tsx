import { useState, useEffect, useCallback } from "react";
import type { Patient } from "../../types/patient";
import type { Appointment } from "../../types/appointment";
import type { Visit } from "../../types/visit";
import { displayName, initials } from "../../types/patient";
import {
  queryPatients,
  getAllAppointments,
  fetchUnassignedVisits,
  assignVisit,
} from "../../api/api";
import { formatVisitDate } from "../../types/visit";
import VisitPage from "./VisitPage";

// ── Recent patients (chrome.storage.local) ──────────────────────────────────

interface RecentEntry {
  ptnum: string;
  name: string;
  label: number;
}

async function loadRecents(): Promise<RecentEntry[]> {
  try {
    const res = await chrome.storage.local.get("recents");
    return (res.recents as RecentEntry[]) ?? [];
  } catch {
    return [];
  }
}

async function saveRecent(p: Patient) {
  try {
    const recents = await loadRecents();
    const filtered = recents.filter((r) => r.ptnum !== p.ptnum);
    const updated = [
      { ptnum: p.ptnum, name: displayName(p), label: p.label },
      ...filtered,
    ].slice(0, 8);
    await chrome.storage.local.set({ recents: updated });
  } catch {
    /* ignore */
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

interface HomeProps {
  onOpenPatient: (p: Patient) => void;
  onShowSchedule: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function Home({ onOpenPatient, onShowSchedule }: HomeProps) {
  const [searchText, setSearchText] = useState("");
  const [allPatients, setAllPatients] = useState<Patient[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [unassigned, setUnassigned] = useState<Visit[]>([]);
  const [loadingUnassigned, setLoadingUnassigned] = useState(false);
  const [recents, setRecents] = useState<RecentEntry[]>([]);
  const [showQuickRecord, setShowQuickRecord] = useState(false);
  const [assigningVisit, setAssigningVisit] = useState<Visit | null>(null);
  const [assignQuery, setAssignQuery] = useState("");
  const [toast, setToast] = useState("");

  const now = new Date();
  const today = now;

  const todayAppts = appointments.filter(
    (a) => new Date(a.appointment_date).toDateString() === today.toDateString()
  );
  const upcomingCount = appointments.filter(
    (a) => new Date(a.appointment_date) >= new Date(today.toDateString())
  ).length;

  // Search
  const searchResults = searchText.trim()
    ? allPatients
        .filter((p) =>
          displayName(p).toLowerCase().includes(searchText.toLowerCase())
        )
        .slice(0, 6)
    : [];

  const greeting = (() => {
    const h = now.getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  // Load data
  const loadPatients = useCallback(async () => {
    if (allPatients.length > 0 || loadingPatients) return;
    setLoadingPatients(true);
    try {
      const pts = await queryPatients();
      setAllPatients(pts);
    } catch {
      /* ignore */
    } finally {
      setLoadingPatients(false);
    }
  }, [allPatients.length, loadingPatients]);

  const loadUnassigned = useCallback(async () => {
    setLoadingUnassigned(true);
    try {
      const visits = await fetchUnassignedVisits();
      setUnassigned(visits);
    } catch {
      /* ignore */
    } finally {
      setLoadingUnassigned(false);
    }
  }, []);

  useEffect(() => {
    loadRecents().then(setRecents);
    getAllAppointments()
      .then(setAppointments)
      .catch(() => {});
    loadUnassigned();
    loadPatients();
  }, [loadUnassigned, loadPatients]);

  function openPatient(p: Patient) {
    saveRecent(p);
    loadRecents().then(setRecents);
    onOpenPatient(p);
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2800);
  }

  // Assign visit
  const assignQueryResults = assignQuery.trim()
    ? allPatients
        .filter((p) =>
          displayName(p).toLowerCase().includes(assignQuery.toLowerCase())
        )
        .slice(0, 5)
    : [];

  async function handleAssign(visit: Visit, patient: Patient) {
    try {
      await assignVisit(visit.id, patient.ptnum);
      showToast(`✓ Assigned to ${displayName(patient)}`);
      setAssigningVisit(null);
      setAssignQuery("");
      loadUnassigned();
    } catch {
      showToast("Failed to assign visit");
    }
  }

  if (showQuickRecord) {
    return (
      <VisitPage
        patient={null}
        onBack={() => {
          setShowQuickRecord(false);
          loadUnassigned();
        }}
      />
    );
  }

  return (
    <>
      <div className="page">
        <div className="page-inner">
          {/* Greeting */}
          <div className="greeting">
            <div className="greeting__title">{greeting}</div>
            <div className="greeting__date">{dateStr}</div>
          </div>

          {/* Stat cards */}
          <div className="stat-cards">
            <button
              id="stat-today"
              className="stat-card stat-card--clickable"
              onClick={onShowSchedule}
            >
              <div className="stat-card__icon" style={{ color: "var(--color-teal)" }}>📅</div>
              <div className="stat-card__value" style={{ color: "var(--color-teal)" }}>
                {todayAppts.length}
              </div>
              <div className="stat-card__label">Today</div>
            </button>
            <div className="stat-card">
              <div className="stat-card__icon" style={{ color: "var(--color-amber)" }}>📥</div>
              <div className="stat-card__value" style={{ color: "var(--color-amber)" }}>
                {unassigned.length}
              </div>
              <div className="stat-card__label">Unassigned</div>
            </div>
            <button
              id="stat-upcoming"
              className="stat-card stat-card--clickable"
              onClick={onShowSchedule}
            >
              <div className="stat-card__icon" style={{ color: "var(--color-indigo)" }}>⏰</div>
              <div className="stat-card__value" style={{ color: "var(--color-indigo)" }}>
                {upcomingCount}
              </div>
              <div className="stat-card__label">Upcoming</div>
            </button>
          </div>

          {/* Quick Record hero */}
          <button
            id="quick-record-btn"
            className="quick-record-hero"
            onClick={() => setShowQuickRecord(true)}
          >
            <div className="quick-record-hero__icon">🎙️</div>
            <div>
              <div className="quick-record-hero__title">Quick Record</div>
              <div className="quick-record-hero__sub">
                Start a visit without picking a patient
              </div>
            </div>
            <div className="quick-record-hero__arrow">→</div>
          </button>

          {/* Patient search */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div className="search-bar">
              <span className="search-bar__icon">🔍</span>
              <input
                id="patient-search-input"
                type="text"
                placeholder="Search patients by name…"
                value={searchText}
                onChange={(e) => {
                  setSearchText(e.target.value);
                  if (e.target.value) loadPatients();
                }}
                autoComplete="off"
              />
              {searchText && (
                <button
                  className="search-bar__clear"
                  onClick={() => setSearchText("")}
                >
                  ✕
                </button>
              )}
            </div>
            {searchText && (
              <div className="search-results">
                {loadingPatients && allPatients.length === 0 ? (
                  <div className="loading-row">
                    <div className="spinner" />
                    Loading patients…
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="loading-row" style={{ color: "var(--color-text-muted)" }}>
                    No matches
                  </div>
                ) : (
                  searchResults.map((p) => (
                    <button
                      key={p.ptnum}
                      id={`search-result-${p.ptnum}`}
                      className="search-result-item"
                      onClick={() => {
                        setSearchText("");
                        openPatient(p);
                      }}
                    >
                      <div className="patient-avatar">{initials(displayName(p))}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="font-semibold truncate">{displayName(p)}</div>
                        <div className="text-xs text-muted">{p.ptnum}</div>
                      </div>
                      {p.label === 1 && <span className="badge badge--lc">LC+</span>}
                      <span style={{ color: "var(--color-text-faint)", fontSize: "12px" }}>›</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Recent patients */}
          {recents.length > 0 && (
            <div>
              <div className="section-header">
                <div className="section-title">Recent Patients</div>
              </div>
              <div className="patient-chips">
                {recents.map((r) => (
                  <button
                    key={r.ptnum}
                    id={`recent-${r.ptnum}`}
                    className="patient-chip"
                    onClick={async () => {
                      const found = allPatients.find((p) => p.ptnum === r.ptnum);
                      if (found) { openPatient(found); return; }
                      await loadPatients();
                      const pt = allPatients.find((p) => p.ptnum === r.ptnum);
                      if (pt) openPatient(pt);
                    }}
                  >
                    <div className="patient-chip__avatar">
                      {initials(r.name)}
                    </div>
                    <div className="patient-chip__name">{r.name}</div>
                    {r.label === 1 && (
                      <span className="badge badge--lc" style={{ marginTop: "4px" }}>LC+</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Unassigned visits */}
          {(loadingUnassigned || unassigned.length > 0) && (
            <div>
              <div className="section-header">
                <div className="section-title">Unassigned Visits</div>
              </div>
              {loadingUnassigned && unassigned.length === 0 ? (
                <div className="loading-row">
                  <div className="spinner" />
                  Loading…
                </div>
              ) : (
                unassigned.map((v) => (
                  <div key={v.id} className="unassigned-card" style={{ marginBottom: "8px" }}>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm text-muted">{formatVisitDate(v.created_at)}</div>
                        <span className={`badge badge--status-${v.status}`}>{v.status}</span>
                      </div>
                      <button
                        id={`assign-visit-${v.id}`}
                        className="btn btn--sm"
                        style={{ background: "var(--color-teal-subtle)", color: "var(--color-teal)" }}
                        onClick={() => setAssigningVisit(v)}
                      >
                        👤 Assign
                      </button>
                    </div>
                    {v.transcript && (
                      <div
                        className="text-xs text-muted"
                        style={{ marginTop: "6px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
                      >
                        {v.transcript}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Today's schedule */}
          {todayAppts.length > 0 && (
            <div>
              <div className="section-header">
                <div className="section-title">Today's Schedule</div>
                <button id="see-all-appts" className="section-link" onClick={onShowSchedule}>
                  See all ›
                </button>
              </div>
              {todayAppts.slice(0, 5).map((a) => {
                const d = new Date(a.appointment_date);
                const isPast = d < now;
                return (
                  <div key={a.id} className="appt-card" style={{ marginBottom: "8px", opacity: isPast ? 0.75 : 1 }}>
                    <div className="appt-card__header">
                      <div className={`appt-card__time ${isPast ? "appt-card__time--past" : ""}`}>
                        {d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      </div>
                      <div className="appt-card__accent" />
                      <div className="appt-card__info">
                        <div className="appt-card__patient">{a.patient_name}</div>
                        <div className="appt-card__reason">{a.reason}</div>
                      </div>
                      {isPast && <span>✓</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Assign visit modal */}
      {assigningVisit && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "flex-end",
            zIndex: 1000,
          }}
          onClick={() => setAssigningVisit(null)}
        >
          <div
            style={{
              width: "100%",
              background: "var(--color-surface)",
              borderRadius: "var(--radius-xl) var(--radius-xl) 0 0",
              padding: "20px 16px 32px",
              maxHeight: "70%",
              overflow: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-bold" style={{ fontSize: "15px", marginBottom: "12px" }}>
              Assign Visit to Patient
            </div>
            <div className="search-bar" style={{ marginBottom: "10px" }}>
              <span className="search-bar__icon">🔍</span>
              <input
                id="assign-search-input"
                autoFocus
                type="text"
                placeholder="Search patients…"
                value={assignQuery}
                onChange={(e) => {
                  setAssignQuery(e.target.value);
                  loadPatients();
                }}
              />
            </div>
            {assignQueryResults.map((p) => (
              <button
                key={p.ptnum}
                id={`assign-patient-${p.ptnum}`}
                className="search-result-item"
                onClick={() => handleAssign(assigningVisit, p)}
              >
                <div className="patient-avatar">{initials(displayName(p))}</div>
                <div>
                  <div className="font-semibold">{displayName(p)}</div>
                  <div className="text-xs text-muted">{p.ptnum}</div>
                </div>
              </button>
            ))}
            {assignQuery && assignQueryResults.length === 0 && (
              <div className="empty-state">
                <div className="empty-state__sub">No patients found</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
