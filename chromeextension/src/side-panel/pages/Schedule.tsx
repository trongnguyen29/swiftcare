import { useState, useEffect } from "react";
import type { Patient } from "../../types/patient";
import type { Appointment } from "../../types/appointment";
import { displayName } from "../../types/patient";
import { getAllAppointments, updateAppointmentStatus, sendAppointmentReminder } from "../../api/api";
import { appointmentTypeIcon, statusColor } from "../../types/appointment";

interface ScheduleProps {
  onOpenPatient: (p: Patient) => void;
}

type FilterType = "all" | "upcoming" | "past";

export default function Schedule({ onOpenPatient: _onOpenPatient }: ScheduleProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FilterType>("upcoming");
  const [toast, setToast] = useState("");
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2800);
  }

  useEffect(() => {
    setLoading(true);
    getAllAppointments()
      .then(setAppointments)
      .catch(() => showToast("Failed to load appointments"))
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();

  const filtered = appointments.filter((a) => {
    const d = new Date(a.appointment_date);
    if (filter === "upcoming") return d >= now;
    if (filter === "past") return d < now;
    return true;
  });

  // Group by date
  const grouped = filtered.reduce<Record<string, Appointment[]>>((acc, a) => {
    const dateKey = new Date(a.appointment_date).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(a);
    return acc;
  }, {});

  async function handleStatusChange(a: Appointment, status: Appointment["status"]) {
    try {
      await updateAppointmentStatus(a.id, status);
      setAppointments((prev) =>
        prev.map((x) => (x.id === a.id ? { ...x, status } : x))
      );
      showToast(`✓ Marked as ${status}`);
    } catch {
      showToast("Failed to update status");
    }
  }

  async function handleSendReminder(a: Appointment) {
    try {
      const d = new Date(a.appointment_date);
      const timeStr = d.toLocaleString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
      await sendAppointmentReminder(
        a.phone_number,
        a.patient_name,
        timeStr,
        a.doctor_name
      );
      setAppointments((prev) =>
        prev.map((x) => (x.id === a.id ? { ...x, is_reminder_sent: true } : x))
      );
      showToast("✓ Reminder sent");
    } catch (e) {
      showToast(`Failed: ${(e as Error).message}`);
    }
  }

  // Date picker days (surrounding 14 days)
  const days: Date[] = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i - 3);
    return d;
  });

  const selectedDateAppts = appointments.filter(
    (a) => new Date(a.appointment_date).toISOString().slice(0, 10) === selectedDate
  );

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        {/* Date strip */}
        <div
          style={{
            padding: "12px 14px 10px",
            background: "var(--color-surface)",
            borderBottom: "1px solid var(--color-border)",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "6px",
              overflowX: "auto",
              scrollbarWidth: "none",
              paddingBottom: "4px",
            }}
          >
            {days.map((d) => {
              const iso = d.toISOString().slice(0, 10);
              const hasAppts = appointments.some(
                (a) => new Date(a.appointment_date).toISOString().slice(0, 10) === iso
              );
              const isSelected = iso === selectedDate;
              const isToday = iso === new Date().toISOString().slice(0, 10);
              return (
                <button
                  key={iso}
                  id={`day-${iso}`}
                  onClick={() => setSelectedDate(iso)}
                  style={{
                    flexShrink: 0,
                    width: "44px",
                    padding: "6px 4px",
                    borderRadius: "var(--radius-md)",
                    cursor: "pointer",
                    background: isSelected ? "var(--color-teal)" : "var(--color-surface-2)",
                    color: isSelected ? "white" : isToday ? "var(--color-teal)" : "var(--color-text-muted)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "3px",
                    transition: "all 0.15s ease",
                    border: isSelected ? "none" : "1px solid var(--color-border)",
                  }}
                >
                  <div style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase" }}>
                    {d.toLocaleDateString("en-US", { weekday: "short" })}
                  </div>
                  <div style={{ fontSize: "16px", fontWeight: 800 }}>{d.getDate()}</div>
                  {hasAppts && (
                    <div
                      style={{
                        width: "4px",
                        height: "4px",
                        borderRadius: "50%",
                        background: isSelected ? "rgba(255,255,255,0.7)" : "var(--color-teal)",
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Filter pills */}
        <div
          style={{
            padding: "10px 14px",
            background: "var(--color-surface)",
            borderBottom: "1px solid var(--color-border)",
            flexShrink: 0,
          }}
        >
          <div className="filter-pills">
            {(["all", "upcoming", "past"] as const).map((f) => (
              <button
                key={f}
                id={`sched-filter-${f}`}
                className={`filter-pill ${filter === f ? "filter-pill--active" : ""}`}
                onClick={() => setFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
            <span
              style={{
                marginLeft: "auto",
                fontSize: "11px",
                color: "var(--color-text-muted)",
                alignSelf: "center",
              }}
            >
              {selectedDateAppts.length} today
            </span>
          </div>
        </div>

        {/* List */}
        <div className="page">
          {loading ? (
            <div className="loading-row">
              <div className="spinner" />
              Loading appointments…
            </div>
          ) : Object.keys(grouped).length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">📅</div>
              <div className="empty-state__title">No appointments</div>
              <div className="empty-state__sub">
                {filter === "upcoming" ? "Nothing scheduled yet" : "No past appointments"}
              </div>
            </div>
          ) : (
            <div className="page-inner">
              {Object.entries(grouped).map(([dateLabel, appts]) => (
                <div key={dateLabel}>
                  <div className="day-label">{dateLabel}</div>
                  {appts.map((a) => {
                    const d = new Date(a.appointment_date);
                    const isPast = d < now;
                    return (
                      <div
                        key={a.id}
                        className="appt-card"
                        style={{ marginBottom: "8px", opacity: isPast ? 0.8 : 1 }}
                      >
                        <div className="appt-card__header">
                          <div
                            className={`appt-card__time ${isPast ? "appt-card__time--past" : ""}`}
                          >
                            {d.toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </div>
                          <div className="appt-card__accent" />
                          <div className="appt-card__info">
                            <div className="appt-card__patient">{a.patient_name}</div>
                            <div className="appt-card__reason">{a.reason}</div>
                            <div className="appt-card__meta">
                              <span>{appointmentTypeIcon(a.appointment_type)}</span>
                              <span>{a.appointment_type}</span>
                              <span>·</span>
                              <span style={{ color: statusColor(a.status) }}>
                                {a.status}
                              </span>
                              <span>·</span>
                              <span>{a.duration_minutes}m</span>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="appt-card__actions">
                          <select
                            id={`status-select-${a.id}`}
                            value={a.status}
                            onChange={(e) =>
                              handleStatusChange(a, e.target.value as Appointment["status"])
                            }
                            style={{
                              flex: 1,
                              background: "var(--color-surface-3)",
                              border: "1px solid var(--color-border)",
                              borderRadius: "var(--radius-sm)",
                              color: "var(--color-text)",
                              padding: "5px 8px",
                              fontSize: "11px",
                              cursor: "pointer",
                            }}
                          >
                            {["Scheduled", "Confirmed", "Completed", "Canceled"].map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                          {a.phone_number && (
                            <button
                              id={`reminder-btn-${a.id}`}
                              className="btn btn--sm"
                              style={{
                                background: a.is_reminder_sent
                                  ? "var(--color-green-subtle)"
                                  : "var(--color-surface-3)",
                                color: a.is_reminder_sent
                                  ? "var(--color-green)"
                                  : "var(--color-text-muted)",
                              }}
                              onClick={() => !a.is_reminder_sent && handleSendReminder(a)}
                              disabled={a.is_reminder_sent}
                            >
                              {a.is_reminder_sent ? "✓ Sent" : "📱 Remind"}
                            </button>
                          )}
                        </div>

                        {a.doctor_name && (
                          <div className="text-xs text-muted">
                            {a.doctor_name}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
