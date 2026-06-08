import {
  handleSessionStart,
  handleEhrLaunch,
  handleCallback,
  handleSessionStatus,
  handleClaim,
  handlePatientList,
  handleFhirProxy,
  type EpicEnv,
} from './epic'
import {
  handleTranscribe,
  handleSoap,
  handlePatientChat,
  handleCohortInsightsSimple,
  type AiEnv,
} from './ai'

interface Env extends EpicEnv, AiEnv {
  ASSETS: { fetch(req: Request): Promise<Response> }
}

interface StatsPayload {
  total: number
  pos: number
  neg: number
  avgAge: number
  avgBmi: number
  avgScc: number
  vitals: Record<string, number>
  tobaccoCancer: { status: string; positive: number; negative: number }[]
  ageDist: { age: string; positive: number; negative: number }[]
}

const MODEL = 'gpt-4o-mini' // swap to hospital endpoint/model here


const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Epic-Session',
}

const COHORT_SYSTEM = `You are a clinical epidemiologist and population health expert reviewing a synthetic lung cancer research cohort. Your analysis is read by clinical researchers and hospital administrators who make screening and resource decisions.

Produce insights that are analytical, not merely descriptive. Every insight must:
- Lead with clinical or public health significance — not a raw statistic
- Include specific numbers with denominator context (e.g., "34.8% of 9,317 former smokers")
- Distinguish what the data shows from what it implies clinically
- Be actionable or hypothesis-generating where possible

Flag anything that is unexpected, counter-intuitive, or that contradicts conventional clinical assumptions.`

const COHORT_USER_PROMPT = (s: StatsPayload) => {
  const prevalence = ((s.pos / s.total) * 100).toFixed(1)
  const former = s.tobaccoCancer.find(t => t.status === 'Former Smoker')
  const never  = s.tobaccoCancer.find(t => t.status === 'Never Smoked')
  const formerTotal = former ? former.positive + former.negative : 0
  const neverTotal  = never  ? never.positive  + never.negative  : 0
  const formerRate  = formerTotal > 0 ? ((former!.positive / formerTotal) * 100).toFixed(1) : '—'
  const neverRate   = neverTotal  > 0 ? ((never!.positive  / neverTotal)  * 100).toFixed(1) : '—'
  const peakAge = s.ageDist.reduce((b, c) => c.positive > b.positive ? c : b, s.ageDist[0])

  return `Analyze this lung cancer research cohort. Produce exactly 5 numbered insights (1–5), each 2–3 sentences.

Required topics — one insight each:
1. Disease burden: what a ${prevalence}% LC prevalence means for this population and how it compares to real-world expectations
2. Tobacco risk stratification: former smoker LC rate (${formerRate}% of ${formerTotal.toLocaleString()}) vs never-smoker rate (${neverRate}% of ${neverTotal.toLocaleString()}) — quantify the differential and its screening implications
3. Age distribution: the age-${peakAge?.age ?? '60–70'} peak (${peakAge?.positive?.toLocaleString()} cases) and what this means for screening eligibility thresholds
4. Cardiovascular and metabolic comorbidity profile: interpret the BP (${s.vitals.avg_systolic}/${s.vitals.avg_diastolic} mmHg), cholesterol (${s.vitals.avg_chol} mg/dL), and HbA1c (${s.vitals.avg_hba1c}%) averages in the context of an oncology population
5. One specific, evidence-grounded population health or screening protocol recommendation derived from patterns in this data`
}

async function callOpenAI(
  apiKey: string,
  system: string,
  userContent: string,
  maxTokens = 900,
): Promise<{ ok: boolean; text: string; status: number }> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: userContent },
      ],
    }),
  })
  const data = await res.json() as {
    choices?: { message: { content: string } }[]
    error?: { message: string }
  }
  if (!res.ok) {
    return { ok: false, text: data.error?.message ?? 'OpenAI API error', status: res.status }
  }
  return { ok: true, text: data.choices?.[0]?.message?.content ?? '', status: 200 }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS })
    }

    // ── AI proxy (key stays in Worker) ──
    if (url.pathname === '/api/ai/transcribe' && request.method === 'POST') {
      return handleTranscribe(request, env)
    }
    if (url.pathname === '/api/ai/soap' && request.method === 'POST') {
      return handleSoap(request, env)
    }
    if (url.pathname === '/api/ai/patient-chat' && request.method === 'POST') {
      return handlePatientChat(request, env)
    }
    if (url.pathname === '/api/ai/cohort' && request.method === 'POST') {
      return handleCohortInsightsSimple(request, env)
    }

    // ── Epic SMART-on-FHIR BFF ──
    if (url.pathname === '/api/epic/session/start' && request.method === 'POST') {
      return handleSessionStart(request, env)
    }
    if (url.pathname === '/api/epic/launch' && request.method === 'GET') {
      return handleEhrLaunch(request, env)
    }
    if (url.pathname === '/api/epic/callback' && request.method === 'GET') {
      return handleCallback(request, env)
    }
    if (url.pathname.startsWith('/api/epic/session/') && request.method === 'GET') {
      const sessionId = url.pathname.replace('/api/epic/session/', '')
      return handleSessionStatus(sessionId, env)
    }
    if (url.pathname.startsWith('/api/epic/claim/') && request.method === 'POST') {
      const code = url.pathname.replace('/api/epic/claim/', '')
      return handleClaim(code, env)
    }
    if (url.pathname === '/api/epic/patients' && request.method === 'GET') {
      return handlePatientList(request, env)
    }
    if (url.pathname.startsWith('/api/epic/fhir/')) {
      const fhirPath = url.pathname.replace('/api/epic/fhir/', '') + url.search
      return handleFhirProxy(request, env, fhirPath)
    }

    if (!env.OPENAI_API_KEY && (url.pathname.startsWith('/api/'))) {
      return Response.json(
        { error: 'OPENAI_API_KEY not configured. Set it as a Cloudflare Worker secret.' },
        { status: 500, headers: CORS },
      )
    }

    // ── Cohort-level AI insights ──
    if (url.pathname === '/api/cohort-insights' && request.method === 'POST') {
      const stats = await request.json() as StatsPayload
      const result = await callOpenAI(
        env.OPENAI_API_KEY,
        COHORT_SYSTEM,
        COHORT_USER_PROMPT(stats),
        1000,
      )
      if (!result.ok) {
        return Response.json({ error: result.text }, { status: result.status, headers: CORS })
      }
      return Response.json({ insights: result.text }, { headers: CORS })
    }

    // ── Dataset AI chat proxy (used by AITab) ──
    if (url.pathname === '/api/chat' && request.method === 'POST') {
      const body = await request.json() as {
        system?: string
        messages: { role: string; content: string }[]
        max_tokens?: number
      }
      const msgs = [
        ...(body.system ? [{ role: 'system', content: body.system }] : []),
        ...body.messages,
      ]
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: body.max_tokens ?? 1000,
          messages: msgs,
        }),
      })
      const data = await res.json()
      return Response.json(data, { status: res.status, headers: CORS })
    }

    // ── Static assets (built React app) ──
    return env.ASSETS.fetch(request)
  },
}
