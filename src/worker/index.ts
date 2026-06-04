import { Hono } from "hono";

interface Env {
  OPENAI_API_KEY: string;
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
    const body = await c.req.json<{ transcript: string; patientContext: string }>();
    const system = `You are a clinical documentation specialist generating SOAP notes from visit transcripts. Document ONLY what is stated in the transcript. Never fabricate findings. Use hedged diagnostic language.

FORMAT:
**SUBJECTIVE** — chief complaint and HPI in patient's words
**OBJECTIVE** — vitals/exam findings mentioned in the visit only
**ASSESSMENT** — clinical impression with hedged language
**PLAN** — numbered treatments, referrals, follow-up discussed

---
⚠ AI-GENERATED DRAFT — Requires physician review before filing.`;

    const text = await callOpenAI(getKey(c), [
      { role: "system", content: system },
      { role: "user", content: `PATIENT RECORD:\n${body.patientContext}\n\nTRANSCRIPT:\n${body.transcript}` },
    ], 1000);
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

export default app;
