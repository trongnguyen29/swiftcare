export type AppointmentType =
  | "In-Person"
  | "Telehealth"
  | "Phone"
  | "New Patient"
  | "Follow Up"
  | "Physical Exam";

export type AppointmentStatus =
  | "Scheduled"
  | "Confirmed"
  | "Canceled"
  | "Completed";

export interface Appointment {
  id: string;
  ptnum: string;
  patient_name: string;
  appointment_date: string; // ISO string from API
  duration_minutes: number;
  appointment_type: AppointmentType;
  status: AppointmentStatus;
  reason: string;
  doctor_name: string;
  phone_number: string;
  is_reminder_sent: boolean;
}

export function appointmentTypeIcon(type: AppointmentType): string {
  const map: Record<AppointmentType, string> = {
    "In-Person": "📍",
    Telehealth: "📹",
    Phone: "📞",
    "New Patient": "🆕",
    "Follow Up": "🔄",
    "Physical Exam": "🩺",
  };
  return map[type] ?? "📅";
}

export function appointmentTypeColor(type: AppointmentType): string {
  const map: Record<AppointmentType, string> = {
    "In-Person": "var(--color-text)",
    Telehealth: "var(--color-teal)",
    Phone: "#a855f7",
    "New Patient": "#3b82f6",
    "Follow Up": "var(--color-teal)",
    "Physical Exam": "#6366f1",
  };
  return map[type] ?? "var(--color-text)";
}

export function statusColor(status: AppointmentStatus): string {
  const map: Record<AppointmentStatus, string> = {
    Scheduled: "#f59e0b",
    Confirmed: "var(--color-teal)",
    Canceled: "#ef4444",
    Completed: "#22c55e",
  };
  return map[status] ?? "var(--color-text-muted)";
}
