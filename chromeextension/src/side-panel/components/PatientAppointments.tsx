import { useState, useEffect } from "react";
import type { Patient } from "../../types/patient";
import type { Appointment } from "../../types/appointment";
import {
  getPatientAppointments,
  updateAppointmentStatus,
  sendAppointmentReminder,
} from "../../api/api";
import { appointmentTypeIcon, statusColor } from "../../types/appointment";

interface Props { patient: Patient; }

export default function PatientAppointments({ patient }: Props) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2800);
  }

  useEffect(() => {
    setLoading(true);
    getPatientAppointments(patient.ptnum)
      .then(setAppointments)
      .catch(() => showToast("Failed to load appointments"))
      .finally(() => setLoading(false));
  }, [patient.ptnum]);

  const now = new Date();
  const upcoming = appointments.filter((a) => new Date(a.appointment_date) >= now);
  const past = appointments.filter((a) => new Date(a.appointment_date) < now);

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

  if (loading) {
    return (
      <div className="loading-row">
        <div className="spinner" />
        Loading appointments…
      </div>
    );
  }

  if (appointments.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon">📅</div>
        <div className="empty-state__title">No appointments</div>
        <div className="empty-state__sub">No appointments scheduled for this patient</div>
      </div>
    );
  }

  function renderAppt(a: Appointment, isPast: boolean) {
    const d = new Date(a.appointment_date);
    return (
      <div key={a.id} className="appt-card" style={{ marginBottom: "8px", opacity: isPast ? 0.8 : 1 }}>
        <div className="appt-card__header">
          <div className={`appt-card__time ${isPast ? "appt-card__time--past" : ""}`}>
            {d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </div>
          <div className="appt-card__accent" />
          <div className="appt-card__info">
            <div className="appt-card__patient">
              {d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </div>
            <div className="appt-card__reason">{a.reason}</div>
            <div className="appt-card__meta">
              <span>{appointmentTypeIcon(a.appointment_type)}</span>
              <span>{a.appointment_type}</span>
              <span>·</span>
              <span style={{ color: statusColor(a.status) }}>{a.status}</span>
              <span>·</span>
              <span>{a.duration_minutes}m</span>
            </div>
          </div>
        </div>

        {!isPast && (
          <div className="appt-card__actions">
            <select
              id={`pat-status-${a.id}`}
              value={a.status}
              onChange={(e) => handleStatusChange(a, e.target.value as Appointment["status"])}
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
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {a.phone_number && (
              <button
                id={`pat-remind-${a.id}`}
                className="btn btn--sm"
                style={{
                  background: a.is_reminder_sent ? "var(--color-green-subtle)" : "var(--color-surface-3)",
                  color: a.is_reminder_sent ? "var(--color-green)" : "var(--color-text-muted)",
                }}
                onClick={() => !a.is_reminder_sent && handleSendReminder(a)}
                disabled={a.is_reminder_sent}
              >
                {a.is_reminder_sent ? "✓ Sent" : "📱 Remind"}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {upcoming.length > 0 && (
          <div>
            <div className="day-label">Upcoming</div>
            {upcoming.map((a) => renderAppt(a, false))}
          </div>
        )}
        {past.length > 0 && (
          <div>
            <div className="day-label">Past</div>
            {past.map((a) => renderAppt(a, true))}
          </div>
        )}
      </div>
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
