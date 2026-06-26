import { Hono } from "hono";

interface Env {
  OPENAI_API_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_PHONE_NUMBER?: string;
  EPIC_CLIENT_ID?: string;
  EPIC_CLIENT_SECRET?: string;
  EPIC_FHIR_BASE_URL?: string;   // e.g. https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4
  EPIC_TOKEN_URL?: string;       // e.g. https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token
}

const app = new Hono<{ Bindings: Env }>();

// ── Types ─────────────────────────────────────────────────────────────────────

interface StatsPayload {
  total: number;
  pos: number;
  neg: number;
  avgAge: number;
  avgBmi: number;
  avgScc: number;
  vitals: Record<string, number>;
  tobaccoCancer: { status: string; positive: number; negative: number }[];
  ageDist: { age: string; positive: number; negative: number }[];
}

interface Visit {
  id: string;
  patient_ptnum: string | null;
  transcript: string;
  note: string;
  template_name: string | null;
  language: string | null;
  audio_path: string | null;
  status: "processing" | "complete" | "failed";
  created_at: string;
  updated_at: string;
}

// ── OpenAI helper ─────────────────────────────────────────────────────────────

const MODEL = "gpt-4o-mini";

async function callOpenAI(
  apiKey: string,
  messages: { role: string; content: string }[],
  maxTokens = 900,
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, messages }),
  });
  const data = (await res.json()) as {
    choices?: { message: { content: string } }[];
    error?: { message: string };
  };
  if (!res.ok) throw new Error(data.error?.message ?? "OpenAI error");
  return data.choices?.[0]?.message?.content ?? "";
}

function getKey(c: { env: Env }): string {
  const key = c.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not configured on the Worker");
  return key;
}

// ── Supabase helpers ──────────────────────────────────────────────────────────

function sbHeaders(env: Env, extra: Record<string, string> = {}): Record<string, string> {
  return {
    "Content-Type": "application/json",
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    ...extra,
  };
}

async function sbGet<T>(env: Env, path: string): Promise<T> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    headers: sbHeaders(env),
  });
  if (!res.ok) throw new Error(`Supabase error: ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function sbPost<T>(env: Env, path: string, body: unknown, prefer = ""): Promise<T> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    method: "POST",
    headers: sbHeaders(env, prefer ? { Prefer: prefer } : {}),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase error: ${await res.text()}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}

async function sbDelete(env: Env, path: string): Promise<void> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    method: "DELETE",
    headers: sbHeaders(env),
  });
  if (!res.ok) throw new Error(`Supabase error: ${await res.text()}`);
}

async function sbPatch<T>(env: Env, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    method: "PATCH",
    headers: sbHeaders(env, { Prefer: "return=representation" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase error: ${await res.text()}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}

function formatPhoneNumber(phoneNumber: string): string | null {
  const trimmed = phoneNumber.trim();
  if (trimmed.startsWith("+")) {
    return /^\+[1-9]\d{7,14}$/.test(trimmed) ? trimmed : null;
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

async function sendTwilioSMS(
  accountSid: string,
  authToken: string,
  fromNumber: string,
  toNumber: string,
  message: string,
): Promise<{ success: boolean; messageSid?: string; error?: string }> {
  const sid = accountSid.trim();
  const token = authToken.trim();
  const auth = btoa(`${sid}:${token}`);
  const formData = new URLSearchParams({
    From: fromNumber,
    To: toNumber,
    Body: message,
  });

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    },
  );

  if (!response.ok) {
    return { success: false, error: await response.text() };
  }

  const data = await response.json() as { sid?: string };
  return { success: true, messageSid: data.sid };
}

// ── Cohort insight prompt ─────────────────────────────────────────────────────

const COHORT_SYSTEM = `You are a clinical epidemiologist and population health expert reviewing a synthetic lung cancer research cohort. Produce insights that are analytical, not merely descriptive. Every insight must lead with clinical significance — not a raw statistic. Include specific numbers with denominator context. Flag anything unexpected or counter-intuitive.`;

function buildInsightPrompt(s: StatsPayload): string {
  const prevalence = ((s.pos / s.total) * 100).toFixed(1);
  const former = s.tobaccoCancer.find((t) => t.status === "Former Smoker");
  const never = s.tobaccoCancer.find((t) => t.status === "Never Smoked");
  const formerTotal = former ? former.positive + former.negative : 0;
  const neverTotal = never ? never.positive + never.negative : 0;
  const formerRate = formerTotal > 0 ? ((former!.positive / formerTotal) * 100).toFixed(1) : "—";
  const neverRate = neverTotal > 0 ? ((never!.positive / neverTotal) * 100).toFixed(1) : "—";
  const peakAge = s.ageDist.reduce((b, c) => (c.positive > b.positive ? c : b), s.ageDist[0]);

  return `Analyze this lung cancer research cohort. Produce exactly 5 numbered insights (1–5), each 2–3 sentences.

Required topics:
1. Disease burden: ${prevalence}% prevalence (${s.pos.toLocaleString()} / ${s.total.toLocaleString()})
2. Tobacco risk: former smoker rate ${formerRate}% (n=${formerTotal.toLocaleString()}) vs never ${neverRate}% (n=${neverTotal.toLocaleString()})
3. Age distribution: ${peakAge?.age ?? "60–70"} peak (${peakAge?.positive?.toLocaleString()} cases) and screening implications
4. Comorbidity profile: BP ${s.vitals.avg_systolic}/${s.vitals.avg_diastolic} mmHg, cholesterol ${s.vitals.avg_chol} mg/dL, HbA1c ${s.vitals.avg_hba1c}%
5. One specific actionable population health recommendation`;
}

// ── Routes ────────────────────────────────────────────────────────────────────

// iOS — send a patient appointment reminder through Twilio.
app.post("/api/send-appointment-reminder", async (c) => {
  try {
    const { phoneNumber, patientName, appointmentTime, doctorName } = await c.req.json<{
      phoneNumber?: string;
      patientName?: string;
      appointmentTime?: string;
      doctorName?: string;
    }>();

    const toNumber = phoneNumber ? formatPhoneNumber(phoneNumber) : null;
    if (!toNumber || !patientName?.trim() || !appointmentTime?.trim() || !doctorName?.trim()) {
      return c.json({ error: "A valid phone number, patient name, appointment time, and doctor name are required." }, 400);
    }

    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = c.env;
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      return c.json({ error: "Twilio is not configured on the SwiftCare worker." }, 500);
    }

    const clean = (value: string, maxLength: number) => value.trim().replace(/\s+/g, " ").slice(0, maxLength);
    const message = `SwiftCare reminder: Hi ${clean(patientName, 80)}, you have an appointment with ${clean(doctorName, 80)} on ${clean(appointmentTime, 100)}. Reply STOP to opt out.`;
    const result = await sendTwilioSMS(
      TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN,
      TWILIO_PHONE_NUMBER,
      toNumber,
      message,
    );

    if (!result.success) {
      console.error("Twilio reminder failed:", result.error);
      return c.json({ error: "Twilio could not send the reminder." }, 502);
    }

    return c.json({ success: true, messageSid: result.messageSid });
  } catch (error) {
    console.error("Appointment reminder failed:", error);
    return c.json({ error: "The reminder could not be sent." }, 500);
  }
});

// Web — cohort insights
app.post("/api/cohort-insights", async (c) => {
  try {
    const stats = await c.req.json<StatsPayload>();
    const text = await callOpenAI(getKey(c), [
      { role: "system", content: COHORT_SYSTEM },
      { role: "user", content: buildInsightPrompt(stats) },
    ], 1000);
    return c.json({ insights: text });
  } catch (e: unknown) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// Web — dataset AI chat (AITab)
app.post("/api/chat", async (c) => {
  try {
    const body = await c.req.json<{
      system?: string;
      messages: { role: string; content: string }[];
      max_tokens?: number;
    }>();
    const msgs = [
      ...(body.system ? [{ role: "system", content: body.system }] : []),
      ...body.messages,
    ];
    const text = await callOpenAI(getKey(c), msgs, body.max_tokens ?? 1000);
    return c.json({ choices: [{ message: { content: text } }] });
  } catch (e: unknown) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// Desktop — per-patient AI chat
app.post("/api/patient-chat", async (c) => {
  try {
    const body = await c.req.json<{
      messages: { role: string; content: string }[];
      patientContext: string;
      maxTokens?: number;
    }>();
    const system = `You are a clinical decision support AI in SwiftCare EHR. You assist physicians with evidence-based clinical reasoning at the point of care.

PATIENT RECORD:
${body.patientContext}

RULES: Decision-support only. Cite patient-specific values. Use hedged language ("consider," "consistent with"). For LC+ patients, integrate oncology context. Lead with the most important point. If you spot a critical unasked issue, end with "⚠ Unsolicited Flag:".`;

    const text = await callOpenAI(getKey(c), [
      { role: "system", content: system },
      ...body.messages,
    ], body.maxTokens ?? 1000);
    return c.json({ reply: text });
  } catch (e: unknown) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// Desktop — SOAP note from transcript
app.post("/api/soap-note", async (c) => {
  try {
    const body = await c.req.json<{
      transcript: string;
      patientContext: string;
      templatePrompt?: string;
    }>();

    const defaultFormat = `Produce a SOAP note using EXACTLY the following sections and headings, in this order, each heading on its own line. Do not add, rename, merge, or remove any heading.

## Subjective
### Chief Complaint
### History of Present Illness
### Review of Systems
### Additional Notes

## Objective
### Vitals
### Physical Exam
### Lab Results
### Additional Notes

## Assessment

## Plan

Rules:
- Write the content for each subsection on the line(s) below its heading.
- VITALS: Under "### Vitals", output EXACTLY these six lines, in this order, each on its own line: "Heart Rate: <value>", "Blood Pressure: <value>", "SpO2: <value>", "Temperature: <value>", "Weight: <value>", "Height: <value>". Use "Not stated" for any not mentioned. NEVER include pain score or BMI. If the clinician states any OTHER vital, put it in the Objective "### Additional Notes" section instead.
- LAB RESULTS: list any lab values mentioned in the transcript, one per line; otherwise "Not discussed."
- "Additional Notes" captures relevant context (including any extra vitals) that doesn't fit the other subsections.
- "Assessment" and "Plan" are free-form: structure them however best fits the visit (e.g., problem-by-problem).
- Document ONLY what is stated in the transcript. Never fabricate findings. Use hedged diagnostic language.
- If a subsection has no information from the transcript, write "Not discussed." under it.`;

    const formatInstructions = body.templatePrompt?.trim()
      ? body.templatePrompt.trim()
      : defaultFormat;

    const system = `You are a clinical documentation specialist generating clinical notes from visit transcripts. Document ONLY what is stated in the transcript. Never fabricate findings. Use hedged diagnostic language.

${formatInstructions}

---
⚠ AI-GENERATED DRAFT — Requires physician review before filing.`;

    const text = await callOpenAI(getKey(c), [
      { role: "system", content: system },
      { role: "user", content: `PATIENT RECORD:\n${body.patientContext}\n\nTRANSCRIPT:\n${body.transcript}` },
    ], 1200);
    return c.json({ note: text });
  } catch (e: unknown) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// Desktop — patient overview summary
app.post("/api/patient-overview", async (c) => {
  try {
    const { patientContext } = await c.req.json<{ patientContext: string }>();
    const text = await callOpenAI(getKey(c), [
      { role: "system", content: "You are a clinical AI writing concise handoff briefs for physicians." },
      { role: "user", content: `Write exactly 3 sentences: (1) single most urgent concern, (2) key comorbidities with specific values, (3) one priority action. Direct, physician-level language, actual numbers, no hedging, no bullets, under 90 words.\n\n${patientContext}` },
    ], 300);
    return c.json({ overview: text });
  } catch (e: unknown) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// Desktop — cohort insights (passes pre-formatted prompt from Rust)
app.post("/api/cohort-insights-desktop", async (c) => {
  try {
    const { prompt } = await c.req.json<{ prompt: string }>();
    const text = await callOpenAI(getKey(c), [
      { role: "system", content: COHORT_SYSTEM },
      { role: "user", content: prompt },
    ], 1000);
    return c.json({ insights: text });
  } catch (e: unknown) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// Audio transcription (Whisper). Language is forwarded when provided.
app.post("/api/transcribe", async (c) => {
  try {
    const { audioB64, mimeType, patientId, language } = await c.req.json<{
      audioB64: string;
      mimeType?: string;
      patientId?: string;
      language?: string;
    }>();

    const bytes = Uint8Array.from(atob(audioB64), (ch) => ch.charCodeAt(0));
    const ext = mimeType?.includes("webm") ? "webm"
      : mimeType?.includes("mp4") || mimeType?.includes("m4a") ? "mp4"
      : mimeType?.includes("ogg") ? "ogg"
      : "wav";

    const form = new FormData();
    form.append("file", new File([bytes], `recording.${ext}`, { type: mimeType || "audio/webm" }));
    form.append("model", "whisper-1");
    form.append("prompt", `Clinical encounter for patient ${patientId ?? ""}. Medical terminology: diagnoses, medications, dosages, vital signs, lab values.`);
    if (language && language !== "auto") {
      form.append("language", language);
    }

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${getKey(c)}` },
      body: form,
    });
    const data = (await res.json()) as { text?: string; error?: { message: string } };
    if (!res.ok) throw new Error(data.error?.message ?? "Whisper error");
    return c.json({ text: data.text ?? "" });
  } catch (e: unknown) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// ── Appointments CRUD ─────────────────────────────────────────────────────────

// Create a new appointment via service-role key (bypasses RLS).
// Body: { patientId: string, resource: object }
// Returns the same shape as the Supabase fhir_appointment row ([FHIRAppointmentRow][]).
app.post("/api/appointments", async (c) => {
  try {
    const { patientId, resource } = await c.req.json<{
      patientId: string;
      resource: Record<string, unknown>;
    }>();
    const fhirId = resource.id as string;
    if (!fhirId) return c.json({ error: "resource.id is required" }, 400);
    const rows = await sbPost<unknown[]>(
      c.env,
      "fhir_appointment",
      { fhir_id: fhirId, patient_id: patientId, resource },
      "return=representation",
    );
    return c.json(rows);
  } catch (e: unknown) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// Update appointment status — fetches existing resource and merges in the new status
// so other FHIR fields are not overwritten.
app.patch("/api/appointments/:id/status", async (c) => {
  try {
    const fhirId = c.req.param("id");
    const { status } = await c.req.json<{ status: string }>();

    const rows = await sbGet<{ fhir_id: string; patient_id: string; resource: Record<string, unknown> }[]>(
      c.env,
      `fhir_appointment?fhir_id=eq.${encodeURIComponent(fhirId)}&select=fhir_id,patient_id,resource`,
    );
    if (!rows.length) return c.json({ error: "Appointment not found" }, 404);

    const updated = await sbPatch<unknown[]>(
      c.env,
      `fhir_appointment?fhir_id=eq.${encodeURIComponent(fhirId)}`,
      { resource: { ...rows[0].resource, status } },
    );
    return c.json(updated[0] ?? {});
  } catch (e: unknown) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// ── Visits CRUD ───────────────────────────────────────────────────────────────

// Create a new visit (or upsert by id if provided)
app.post("/api/visits", async (c) => {
  try {
    const body = await c.req.json<Partial<Visit>>();
    const [row] = await sbPost<Visit[]>(
      c.env,
      "visits",
      {
        ...(body.id ? { id: body.id } : {}),
        patient_ptnum: body.patient_ptnum ?? null,
        transcript: body.transcript ?? "",
        note: body.note ?? "",
        template_name: body.template_name ?? null,
        language: body.language ?? "en",
        audio_path: body.audio_path ?? null,
        status: body.status ?? "complete",
      },
      "return=representation",
    );
    return c.json(row);
  } catch (e: unknown) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// List visits: ?ptnum=X for patient, ?unassigned=true for unassigned
app.get("/api/visits", async (c) => {
  try {
    const ptnum = c.req.query("ptnum");
    const unassigned = c.req.query("unassigned");
    let qs = "visits?order=created_at.desc&limit=50";
    if (ptnum) {
      qs += `&patient_ptnum=eq.${encodeURIComponent(ptnum)}`;
    } else if (unassigned === "true") {
      qs += "&patient_ptnum=is.null";
    }
    const rows = await sbGet<Visit[]>(c.env, qs);
    return c.json(rows);
  } catch (e: unknown) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// Update a visit (link to patient, change status, etc.)
app.patch("/api/visits/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json<Partial<Visit>>();
    const rows = await sbPatch<Visit[]>(c.env, `visits?id=eq.${id}`, body);
    return c.json(rows[0] ?? {});
  } catch (e: unknown) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// Delete an appointment
app.delete("/api/appointments/:id", async (c) => {
  try {
    const fhirId = c.req.param("id");
    await sbDelete(c.env, `fhir_appointment?fhir_id=eq.${encodeURIComponent(fhirId)}`);
    return c.json({ success: true });
  } catch (e: unknown) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// Get all appointments
app.get("/api/appointments", async (c) => {
  try {
    const rows = await sbGet<unknown[]>(
      c.env,
      "fhir_appointment?select=fhir_id,patient_id,resource&order=resource->start.asc"
    );
    return c.json(rows);
  } catch (e: unknown) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// Delete a visit
app.delete("/api/visits/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await sbDelete(c.env, `visits?id=eq.${id}`);
    return c.json({ success: true });
  } catch (e: unknown) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// ── Visit audio (Supabase Storage) ───────────────────────────────────────────

// Upload audio for a visit — stores under visit-audio/{visitId}.{ext}
app.post("/api/visit-audio", async (c) => {
  try {
    const { audioB64, mimeType, visitId } = await c.req.json<{
      audioB64: string;
      mimeType: string;
      visitId: string;
    }>();

    const bytes = Uint8Array.from(atob(audioB64), (ch) => ch.charCodeAt(0));
    const ext = mimeType.includes("webm") ? "webm"
      : mimeType.includes("mp4") || mimeType.includes("m4a") ? "mp4"
      : mimeType.includes("ogg") ? "ogg"
      : "wav";
    const path = `${visitId}.${ext}`;

    const res = await fetch(
      `${c.env.SUPABASE_URL}/storage/v1/object/visit-audio/${path}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${c.env.SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": mimeType,
          "x-upsert": "true",
        },
        body: bytes,
      },
    );
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Storage upload failed: ${err}`);
    }
    return c.json({ path });
  } catch (e: unknown) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// Get a short-TTL signed URL for audio playback (?path=visitId.ext)
app.get("/api/visit-audio-url", async (c) => {
  try {
    const path = c.req.query("path");
    if (!path) return c.json({ error: "path required" }, 400);

    const res = await fetch(
      `${c.env.SUPABASE_URL}/storage/v1/object/sign/visit-audio/${path}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${c.env.SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ expiresIn: 3600 }),
      },
    );
    if (!res.ok) throw new Error(`Storage sign failed: ${await res.text()}`);
    const data = (await res.json()) as { signedURL?: string };
    const signedURL = data.signedURL
      ? `${c.env.SUPABASE_URL}/storage/v1${data.signedURL}`
      : null;
    return c.json({ url: signedURL });
  } catch (e: unknown) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// ── Push note to EHR (Epic FHIR R4 DocumentReference) ────────────────────────

app.post("/api/push-note-to-ehr", async (c) => {
  const { noteText, patientId, patientName, date, templateName } = await c.req.json<{
    noteText: string;
    patientId: string;
    patientName?: string;
    date?: string;
    templateName?: string;
  }>();

  const clientId     = c.env.EPIC_CLIENT_ID;
  const clientSecret = c.env.EPIC_CLIENT_SECRET;
  const fhirBase     = c.env.EPIC_FHIR_BASE_URL
    ?? "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4";
  const tokenUrl     = c.env.EPIC_TOKEN_URL
    ?? "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token";

  if (!clientId || !clientSecret) {
    return c.json({ error: "EHR credentials not configured. Set EPIC_CLIENT_ID and EPIC_CLIENT_SECRET as Worker secrets." }, 503);
  }

  try {
    // 1. Obtain access token (client credentials)
    const tokenRes = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:    "client_credentials",
        client_id:     clientId,
        client_secret: clientSecret,
        scope:         "system/DocumentReference.write",
      }),
    });
    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      return c.json({ error: `EHR auth failed: ${err}` }, 502);
    }
    const token = (await tokenRes.json() as { access_token: string }).access_token;

    // 2. Build FHIR R4 DocumentReference
    const noteB64 = btoa(unescape(encodeURIComponent(noteText)));
    const now = date ?? new Date().toISOString();
    const docRef = {
      resourceType: "DocumentReference",
      status: "current",
      docStatus: "final",
      type: {
        coding: [{
          system: "http://loinc.org",
          code: "34109-9",
          display: templateName ?? "Note",
        }],
        text: templateName ?? "Clinical Note",
      },
      subject: {
        identifier: {
          system: "urn:swiftcare:patient",
          value: patientId,
        },
        display: patientName ?? patientId,
      },
      date: now,
      content: [{
        attachment: {
          contentType: "text/plain;charset=utf-8",
          data: noteB64,
          title: templateName ?? "Clinical Note",
          creation: now,
        },
      }],
      context: {
        period: { start: now },
      },
    };

    // 3. POST to FHIR server
    const fhirRes = await fetch(`${fhirBase}/DocumentReference`, {
      method: "POST",
      headers: {
        "Content-Type": "application/fhir+json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(docRef),
    });
    const fhirBody = await fhirRes.text();
    if (!fhirRes.ok) {
      return c.json({ error: `FHIR write failed (${fhirRes.status}): ${fhirBody}` }, 502);
    }
    const created = JSON.parse(fhirBody) as { id?: string };
    return c.json({ success: true, resourceId: created.id ?? null });
  } catch (e: unknown) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

export default app;
