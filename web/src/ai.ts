// All AI calls (OpenAI) are proxied through the Worker so the API key never
// leaves the server. The desktop frontend calls these endpoints via fetch.

export interface AiEnv {
  OPENAI_API_KEY: string
}

const MODEL = 'gpt-4o-mini'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

async function openaiChat(
  apiKey: string,
  messages: { role: string; content: string }[],
  maxTokens = 1000,
): Promise<Response> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, messages }),
  })
  const data = await res.json() as { choices?: { message: { content: string } }[]; error?: { message: string } }
  if (!res.ok) return Response.json({ error: data.error?.message ?? 'OpenAI error' }, { status: res.status, headers: CORS })
  return Response.json({ text: data.choices?.[0]?.message?.content ?? '' }, { headers: CORS })
}

// ── POST /api/ai/transcribe ───────────────────────────────────────────────────
// Body: { audio_b64: string, mime_type: string, patient_id: string }
// Returns: { text: string }
export async function handleTranscribe(req: Request, env: AiEnv): Promise<Response> {
  const { audio_b64, mime_type, patient_id } = await req.json() as {
    audio_b64: string; mime_type: string; patient_id: string
  }

  const ext = mime_type.includes('webm') ? 'webm'
    : mime_type.includes('mp4') || mime_type.includes('m4a') ? 'mp4'
    : mime_type.includes('ogg') ? 'ogg'
    : 'wav'

  const bytes = Uint8Array.from(atob(audio_b64), c => c.charCodeAt(0))

  const form = new FormData()
  form.append('file', new Blob([bytes], { type: mime_type }), `recording.${ext}`)
  form.append('model', 'whisper-1')
  form.append('prompt',
    `Clinical encounter for patient ${patient_id}. Medical terminology: diagnoses, medications, dosages, vital signs, lab values, anatomical terms. Expected vocabulary: lung cancer, SCC score, hypertension, HbA1c, systolic, diastolic, metformin, atorvastatin, lisinopril, COPD, spirometry, oncology, chemotherapy, CT scan, PET scan, biopsy, staging, remission.`,
  )

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.OPENAI_API_KEY}` },
    body: form,
  })
  if (!res.ok) return Response.json({ error: await res.text() }, { status: res.status, headers: CORS })
  const data = await res.json() as { text: string }
  return Response.json({ text: data.text }, { headers: CORS })
}

// ── POST /api/ai/soap ────────────────────────────────────────────────────────
// Body: { transcript: string, patient_context: string }
// Returns: { text: string }
export async function handleSoap(req: Request, env: AiEnv): Promise<Response> {
  const { transcript, patient_context } = await req.json() as {
    transcript: string; patient_context: string
  }

  const system = `You are a board-certified clinical documentation specialist generating SOAP progress notes from physician visit transcripts for an EHR system.

ABSOLUTE RULES:
- Document ONLY what is explicitly stated or clearly implied in the transcript
- OBJECTIVE section: include only vitals/exam findings mentioned in the visit — do not copy the entire patient record
- Never fabricate symptoms, diagnoses, medications, or examination findings
- If the transcript is unclear, too brief, or does not represent a clinical encounter, state this clearly before the note
- Use hedged diagnostic language: "consistent with," "suggestive of," "rule out" — never definitive diagnoses
- End every note with the required physician attestation line

OUTPUT FORMAT — use these exact bold headers with a blank line between sections:

**SUBJECTIVE**
Chief complaint in the patient's own words. HPI covering: onset, duration, severity, character, associated symptoms, aggravating/relieving factors, pertinent negatives mentioned in the visit.

**OBJECTIVE**
Vitals and physical examination findings discussed during the visit. Reference patient record data only if it was explicitly reviewed or mentioned.

**ASSESSMENT**
Clinical impression. Lead with the primary concern. Address oncology status explicitly for LC+ patients. Use hedged diagnostic language throughout.

**PLAN**
Numbered list of all treatments, medication changes, referrals, orders, patient education, and follow-up timing discussed.

---
⚠ AI-GENERATED DRAFT — Requires physician review, editing, and attestation before filing.`

  return openaiChat(env.OPENAI_API_KEY, [
    { role: 'system', content: system },
    { role: 'user', content: `PATIENT RECORD (use only what was discussed in the visit):\n${patient_context}\n\nVISIT TRANSCRIPT:\n${transcript}` },
  ], 1000)
}

// ── POST /api/ai/patient-chat ────────────────────────────────────────────────
// Body: { messages: {role,content}[], patient_context: string }
// Returns: { text: string }
export async function handlePatientChat(req: Request, env: AiEnv): Promise<Response> {
  const { messages, patient_context } = await req.json() as {
    messages: { role: string; content: string }[];
    patient_context: string
  }

  const system = `You are a clinical decision support AI embedded at the point of care in SwiftCare EHR. You assist physicians with evidence-based clinical reasoning during patient encounters.

PATIENT RECORD:
${patient_context}

CORE CAPABILITIES:
• Differential diagnosis support with likelihood ranking
• Drug interaction and contraindication checking against this patient's active medications
• Care gap identification based on age, diagnoses, risk factors, and guidelines
• Lab and vital sign interpretation in this patient's specific clinical context
• Evidence-based guideline retrieval (ACC/AHA, NCCN, ADA, USPSTF, and others)
• Treatment option comparison with patient-specific contraindications flagged

RESPONSE RULES:
1. Frame every response as decision support — the clinician makes the final call
2. Always cite this patient's specific values when relevant
3. Use hedged diagnostic language: "consider," "may suggest," "consistent with," "rule out"
4. For LC+ patients, integrate oncology context into every recommendation
5. Lead with the most important point — clinicians are time-constrained
6. Use bullet points for lists; prose for explanations
7. PROACTIVE SAFETY: If you identify a critical issue not asked about — dangerous drug interaction, critical lab value, urgent vital sign — append it at the end under: "⚠ Unsolicited Flag:"
8. If a question falls outside clinical scope, redirect to what the patient record can inform`

  return openaiChat(env.OPENAI_API_KEY, [
    { role: 'system', content: system },
    ...messages,
  ], 1000)
}

// ── POST /api/ai/cohort ───────────────────────────────────────────────────────
// Simpler stats format used by the desktop (no tobaccoCancer/ageDist breakdown).
// Body: { total, pos, neg, avgAge, avgBmi, avgScc, vitals: { avg_systolic, avg_diastolic, avg_chol, avg_hba1c } }
// Returns: { text: string }
export async function handleCohortInsightsSimple(req: Request, env: AiEnv): Promise<Response> {
  const s = await req.json() as {
    total: number; pos: number; neg: number
    avgAge: number; avgBmi: number; avgScc: number
    vitals: { avg_systolic: number; avg_diastolic: number; avg_chol: number; avg_hba1c: number }
  }

  const prevalence = s.total > 0 ? (s.pos / s.total * 100).toFixed(1) : '0.0'

  const system = `You are a clinical epidemiologist and population health expert reviewing a synthetic lung cancer research cohort. Your analysis is read by clinical researchers and hospital administrators who make screening and resource allocation decisions.

Produce insights that are analytical, not merely descriptive. Every insight must lead with clinical or public health significance — not a raw statistic. Distinguish what the data shows from what it implies clinically. Flag anything unexpected or counter-intuitive.`

  const user = `Analyze this lung cancer research cohort. Produce exactly 5 numbered insights (1–5), each 2–3 sentences.

Required topics — one insight each:
1. Disease burden: what a ${prevalence}% LC prevalence (${s.pos} positive / ${s.total} total) means for this population
2. Tobacco risk stratification and screening implications
3. Age distribution and screening eligibility thresholds given mean age ${s.avgAge.toFixed(1)} years
4. Cardiovascular/metabolic comorbidity profile: BP (${s.vitals.avg_systolic.toFixed(0)}/${s.vitals.avg_diastolic.toFixed(0)} mmHg), cholesterol (${s.vitals.avg_chol.toFixed(0)} mg/dL), HbA1c (${s.vitals.avg_hba1c.toFixed(1)}%), BMI (${s.avgBmi.toFixed(1)}) in an oncology population
5. One specific, evidence-grounded population health or screening protocol recommendation

COHORT SUMMARY:
- Total: ${s.total} patients | LC Positive: ${s.pos} (${prevalence}%) | Control: ${s.neg}
- Mean age ${s.avgAge.toFixed(1)}y | Mean BMI ${s.avgBmi.toFixed(1)} | Mean SCC score ${s.avgScc.toFixed(1)}
- Avg vitals: SBP ${s.vitals.avg_systolic.toFixed(0)} | DBP ${s.vitals.avg_diastolic.toFixed(0)} | Chol ${s.vitals.avg_chol.toFixed(0)} mg/dL | HbA1c ${s.vitals.avg_hba1c.toFixed(1)}%`

  return openaiChat(env.OPENAI_API_KEY, [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ], 1000)
}
