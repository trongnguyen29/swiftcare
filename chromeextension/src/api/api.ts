import type { Patient } from "../types/patient";
import type { Appointment, AppointmentStatus } from "../types/appointment";
import type { Visit } from "../types/visit";

const SUPABASE_URL = "https://ujqrxhhshxgqqjkblorh.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqcXJ4aGhzaHhncXFqa2Jsb3JoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDU3NjAsImV4cCI6MjA5NTM4MTc2MH0.t4CgUYE5oPLhocC2YtRF-WW6tMWu2Cvd0mYB_A1jWhk";
const WORKER_URL = "https://swiftcare.tnn-040.workers.dev";

const PATIENT_COLS =
  "ptnum,label,scc,first_name,last_name,age,administrative_sex,race,ethnicity,state,systolic_bp,diastolic_bp,heart_rate,bmi,total_cholesterol,ldl,hdl,triglycerides,hba1c,glucose,creatinine,egfr,hemoglobin,wbc,platelets,problems";

function sbHeaders(): HeadersInit {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    Accept: "application/json",
  };
}

// ─── Patients ─────────────────────────────────────────────────────────────────

export async function queryPatients(
  query = "",
  filter: "all" | "positive" | "control" = "all"
): Promise<Patient[]> {
  const params = new URLSearchParams({
    select: PATIENT_COLS,
    order: "last_name.asc,first_name.asc",
    limit: "150",
  });
  const q = query.trim().replace(/[,()]/g, "");
  if (q) {
    params.set(
      "or",
      `(ptnum.ilike.*${q}*,first_name.ilike.*${q}*,last_name.ilike.*${q}*)`
    );
  }
  if (filter === "positive") params.set("label", "eq.1");
  if (filter === "control") params.set("label", "eq.0");

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/patient_summary?${params}`,
    { headers: sbHeaders() }
  );
  if (!res.ok) throw new Error("Failed to load patients");
  return res.json();
}

export async function getPatientSummary(
  ptnum: string
): Promise<{ ai_summary?: string; ai_summary_at?: string } | null> {
  const params = new URLSearchParams({
    select: "ai_summary,ai_summary_hash,ai_summary_at",
    ptnum: `eq.${ptnum}`,
    limit: "1",
  });
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/patient_ai_summary?${params}`,
    { headers: sbHeaders() }
  );
  if (!res.ok) return null;
  const rows: { ai_summary?: string; ai_summary_at?: string }[] =
    await res.json();
  return rows[0] ?? null;
}

// ─── Appointments ─────────────────────────────────────────────────────────────

export async function getAllAppointments(): Promise<Appointment[]> {
  const params = new URLSearchParams({ select: "*", order: "appointment_date.asc" });
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/appointments?${params}`,
    { headers: sbHeaders() }
  );
  if (!res.ok) throw new Error("Failed to load appointments");
  return res.json();
}

export async function getPatientAppointments(
  ptnum: string
): Promise<Appointment[]> {
  const params = new URLSearchParams({
    select: "*",
    ptnum: `eq.${ptnum}`,
    order: "appointment_date.asc",
  });
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/appointments?${params}`,
    { headers: sbHeaders() }
  );
  if (!res.ok) throw new Error("Failed to load appointments");
  return res.json();
}

export async function createAppointment(
  data: Omit<Appointment, "id">
): Promise<Appointment> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/appointments`, {
    method: "POST",
    headers: {
      ...sbHeaders(),
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create appointment");
  const rows: Appointment[] = await res.json();
  return rows[0];
}

export async function updateAppointmentStatus(
  id: string,
  status: AppointmentStatus
): Promise<void> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/appointments?id=eq.${id}`,
    {
      method: "PATCH",
      headers: { ...sbHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }
  );
  if (!res.ok) throw new Error("Failed to update appointment");
}

export async function sendAppointmentReminder(
  phoneNumber: string,
  patientName: string,
  appointmentTime: string,
  doctorName: string
): Promise<string | undefined> {
  const res = await fetch(`${WORKER_URL}/api/send-appointment-reminder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber, patientName, appointmentTime, doctorName }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error ?? "Could not send reminder");
  return data.messageSid;
}

// ─── Visits ───────────────────────────────────────────────────────────────────

export async function fetchVisits(ptnum: string): Promise<Visit[]> {
  const res = await fetch(`${WORKER_URL}/api/visits?ptnum=${ptnum}`, {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Failed to load visits");
  return res.json();
}

export async function fetchUnassignedVisits(): Promise<Visit[]> {
  const res = await fetch(`${WORKER_URL}/api/visits?unassigned=true`, {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Failed to load unassigned visits");
  return res.json();
}

export async function saveVisit(data: {
  id?: string;
  patient_ptnum?: string;
  transcript: string;
  note: string;
  template_name?: string;
  language?: string;
  status?: string;
}): Promise<Visit> {
  const res = await fetch(`${WORKER_URL}/api/visits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to save visit");
  return res.json();
}

export async function assignVisit(
  visitId: string,
  patientPtnum: string
): Promise<Visit> {
  const res = await fetch(`${WORKER_URL}/api/visits/${visitId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patient_ptnum: patientPtnum }),
  });
  if (!res.ok) throw new Error("Failed to assign visit");
  return res.json();
}

// ─── Transcription ────────────────────────────────────────────────────────────

export async function transcribeAudio(
  audioB64: string,
  mimeType: string,
  patientId: string,
  language = "en"
): Promise<string> {
  const res = await fetch(`${WORKER_URL}/api/transcribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audioB64, mimeType, patientId, language }),
  });
  if (!res.ok) throw new Error("Transcription failed");
  const data = await res.json();
  return data.text ?? data.transcript ?? "";
}

// ─── SOAP Note ────────────────────────────────────────────────────────────────

export async function summarizeTranscript(
  transcript: string,
  patientContext: string,
  templatePrompt?: string
): Promise<string> {
  const body: Record<string, string> = { transcript, patientContext };
  if (templatePrompt) body.templatePrompt = templatePrompt;
  const res = await fetch(`${WORKER_URL}/api/soap-note`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to generate SOAP note");
  const data = await res.json();
  return data.note ?? "";
}

export async function pushNoteToEHR(
  noteText: string,
  patientId: string,
  patientName?: string,
  templateName?: string
): Promise<string> {
  const body: Record<string, string> = {
    noteText,
    patientId,
    date: new Date().toISOString(),
  };
  if (patientName) body.patientName = patientName;
  if (templateName) body.templateName = templateName;
  const res = await fetch(`${WORKER_URL}/api/push-note-to-ehr`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to push note to EHR");
  const data = await res.json();
  return data.resourceId ? `Posted — ID: ${data.resourceId}` : "Posted to EHR";
}

// ─── AI Chat ──────────────────────────────────────────────────────────────────

export async function chatWithPatient(
  messages: { role: string; content: string }[],
  patientContext: string
): Promise<string> {
  const res = await fetch(`${WORKER_URL}/api/patient-chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, patientContext, maxTokens: 1000 }),
  });
  if (!res.ok) throw new Error("Chat failed");
  const data = await res.json();
  return data.reply ?? "";
}
