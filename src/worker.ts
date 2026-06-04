interface Env {
  OPENAI_API_KEY: string
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

function buildInsightPrompt(s: StatsPayload): string {
  const prevalence = ((s.pos / s.total) * 100).toFixed(1)
  const former = s.tobaccoCancer.find(t => t.status === 'Former Smoker')
  const never  = s.tobaccoCancer.find(t => t.status === 'Never Smoked')
  const formerRate = former
    ? ((former.positive / (former.positive + former.negative)) * 100).toFixed(1)
    : '—'
  const neverRate = never
    ? ((never.positive / (never.positive + never.negative)) * 100).toFixed(1)
    : '—'
  const peakAge = s.ageDist.reduce(
    (best, b) => (b.positive > best.positive ? b : best),
    s.ageDist[0],
  )

  return `Analyze this synthetic lung cancer research cohort and provide exactly 5 clinical insights numbered 1–5. Each insight should be 1–3 sentences, evidence-based, and cite specific numbers where relevant.

COHORT DATA:
- Patients: ${s.total.toLocaleString()} total | ${s.pos.toLocaleString()} LC Positive (${prevalence}%) | ${s.neg.toLocaleString()} Control
- Avg age ${s.avgAge}y | Avg BMI ${s.avgBmi} | Avg SCC score ${s.avgScc} (range 9–172)
- Tobacco: Former smoker LC rate ${formerRate}% vs never-smoker rate ${neverRate}%
- Peak LC cases in age group: ${peakAge?.age ?? '60–70'} (${peakAge?.positive?.toLocaleString()} positive)

AVERAGE VITALS:
- Systolic BP ${s.vitals.avg_systolic} mmHg | Diastolic ${s.vitals.avg_diastolic} mmHg | HR ${s.vitals.avg_hr} bpm
- Total Cholesterol ${s.vitals.avg_chol} mg/dL | LDL ${s.vitals.avg_ldl} mg/dL | HbA1c ${s.vitals.avg_hba1c}%

Focus on: disease burden, tobacco risk stratification, cardiovascular profile, metabolic health, and one actionable population health recommendation.`
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
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
        'You are a clinical data scientist specializing in population health and oncology research. Provide numbered, concise, evidence-based insights. Always cite specific numbers from the data provided.',
        buildInsightPrompt(stats),
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
