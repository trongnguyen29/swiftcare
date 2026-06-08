// Epic SMART-on-FHIR BFF — handles both standalone launch and EHR launch.
// All secrets (EPIC_CLIENT_SECRET, SUPABASE_SERVICE_ROLE_KEY) stay here; never sent to the client.

import { mapFhirResource } from './fhir-map'

export interface EpicEnv {
  EPIC_CLIENT_ID: string
  EPIC_CLIENT_SECRET: string
  EPIC_FHIR_BASE: string          // e.g. https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/
  EPIC_AUTHORIZE_URL: string      // fallback if discovery fails
  EPIC_TOKEN_URL: string          // fallback if discovery fails
  EPIC_REDIRECT_URI: string       // this Worker's /api/epic/callback URL
  EPIC_LAUNCH_URL: string         // this Worker's /api/epic/launch URL (for Epic to call)
  APP_DEEPLINK: string            // swiftcare://epic/done
  SESSION_SIGNING_KEY: string     // HMAC key for state signing
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Epic-Session',
}

const CLAIM_TTL_SECONDS = 120   // one-time claim codes live 2 minutes
const SESSION_TTL_DAYS  = 1     // pending sessions expire after 1 day

// ─── SMART App Launch v2 scopes
// .r = read by id,  .s = search,  .rs = read+search
// All clinical resources need .rs because we query them with ?patient=<id> (a search).
// Epic accepts both SMART v1 (.read) and v2 (.rs) but v2 is the current standard.
const STANDALONE_SCOPES = [
  'openid', 'fhirUser', 'offline_access',
  'user/Patient.rs',
  'user/Condition.rs',
  'user/Observation.rs',
  'user/MedicationRequest.rs',
  'user/AllergyIntolerance.rs',
  'user/Immunization.rs',
  'user/Procedure.rs',
  'user/Encounter.rs',
  'user/DiagnosticReport.rs',
].join(' ')

const EHR_LAUNCH_SCOPES = [
  'openid', 'fhirUser', 'launch', 'launch/patient', 'offline_access',
  'patient/Patient.r',
  'patient/Condition.rs',   'patient/Observation.rs',
  'patient/MedicationRequest.rs', 'patient/AllergyIntolerance.rs',
  'patient/Immunization.rs', 'patient/Procedure.rs',
  'patient/Encounter.rs',   'patient/DiagnosticReport.rs',
].join(' ')

// Allowed FHIR base hosts for EHR launch (prevent open-redirect)
const ALLOWED_FHIR_HOSTS = [
  'fhir.epic.com',
  'open.epic.com',
]

// ─── helpers ──────────────────────────────────────────────────────────────────

function base64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function sha256(data: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data))
  return base64url(buf)
}

function randomBase64url(bytes = 32): string {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return base64url(arr.buffer)
}

async function hmacSign(key: string, data: string): Promise<string> {
  const k = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data))
  return base64url(sig)
}

async function hmacVerify(key: string, data: string, sig: string): Promise<boolean> {
  try {
    const expected = await hmacSign(key, data)
    return expected === sig
  } catch {
    return false
  }
}

/** Pack { payload, sig } into a URL-safe state string. */
async function buildState(key: string, payload: Record<string, string>): Promise<string> {
  const json = JSON.stringify(payload)
  const sig = await hmacSign(key, json)
  return btoa(JSON.stringify({ payload: json, sig })).replace(/=/g, '')
}

/** Unpack and verify state string. Returns payload or null. */
async function verifyState(key: string, state: string): Promise<Record<string, string> | null> {
  try {
    const padded = state + '='.repeat((4 - state.length % 4) % 4)
    const { payload, sig } = JSON.parse(atob(padded))
    const ok = await hmacVerify(key, payload, sig)
    if (!ok) return null
    return JSON.parse(payload)
  } catch {
    return null
  }
}

// ─── Supabase helpers (service_role REST) ─────────────────────────────────────

function sbHeaders(env: EpicEnv) {
  return {
    'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  }
}

async function sbInsert(env: EpicEnv, table: string, row: Record<string, unknown>) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: sbHeaders(env),
    body: JSON.stringify(row),
  })
  if (!res.ok) throw new Error(`Supabase insert ${table}: ${await res.text()}`)
  return res.json()
}


async function sbUpdate(env: EpicEnv, table: string, id: string, patch: Record<string, unknown>) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: sbHeaders(env),
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error(`Supabase patch ${table}: ${await res.text()}`)
}

async function sbSelect(env: EpicEnv, table: string, params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString()
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?${qs}`, {
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  })
  if (!res.ok) throw new Error(`Supabase select ${table}: ${await res.text()}`)
  return res.json() as Promise<Record<string, unknown>[]>
}

// ─── SMART discovery ──────────────────────────────────────────────────────────

interface SmartConfig {
  authorization_endpoint: string
  token_endpoint: string
}

const discoveryCache = new Map<string, SmartConfig>()

async function discoverSmartConfig(fhirBase: string): Promise<SmartConfig> {
  if (discoveryCache.has(fhirBase)) return discoveryCache.get(fhirBase)!
  const url = fhirBase.replace(/\/$/, '') + '/.well-known/smart-configuration'
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`SMART discovery failed: ${res.status}`)
  const cfg = await res.json() as SmartConfig
  discoveryCache.set(fhirBase, cfg)
  return cfg
}

// ─── Token refresh ────────────────────────────────────────────────────────────

async function refreshAccessToken(
  env: EpicEnv,
  tokenUrl: string,
  refreshToken: string,
): Promise<{ access_token: string; refresh_token?: string; expires_in?: number }> {
  const creds = btoa(`${env.EPIC_CLIENT_ID}:${env.EPIC_CLIENT_SECRET}`)
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${creds}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  })
  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`)
  return res.json()
}

/** Load session, refresh token if within 60s of expiry. Returns current access_token. */
async function getValidToken(env: EpicEnv, sessionId: string): Promise<string> {
  const rows = await sbSelect(env, 'epic_oauth_sessions', {
    id: `eq.${sessionId}`,
    select: 'access_token,refresh_token,expires_at,fhir_base,status',
  })
  if (!rows.length || rows[0].status !== 'connected') throw new Error('Session not connected')
  const row = rows[0]

  const expiresAt = row.expires_at ? new Date(row.expires_at as string).getTime() : 0
  const needsRefresh = expiresAt > 0 && Date.now() > expiresAt - 60_000

  if (!needsRefresh) return row.access_token as string

  const cfg = await discoverSmartConfig(row.fhir_base as string)
  const refreshed = await refreshAccessToken(env, cfg.token_endpoint, row.refresh_token as string)

  const newExpiry = refreshed.expires_in
    ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
    : undefined

  await sbUpdate(env, 'epic_oauth_sessions', sessionId, {
    access_token: refreshed.access_token,
    ...(refreshed.refresh_token ? { refresh_token: refreshed.refresh_token } : {}),
    ...(newExpiry ? { expires_at: newExpiry } : {}),
  })

  return refreshed.access_token
}

// ─── Route handlers ───────────────────────────────────────────────────────────

/** POST /api/epic/session/start — generate PKCE + state, return authorize URL */
export async function handleSessionStart(_req: Request, env: EpicEnv): Promise<Response> {
  console.log('[epic/session/start] ---')
  console.log('[epic/session/start] EPIC_CLIENT_ID  :', env.EPIC_CLIENT_ID || '(not set!)')
  console.log('[epic/session/start] EPIC_REDIRECT_URI:', env.EPIC_REDIRECT_URI || '(not set!)')
  console.log('[epic/session/start] EPIC_FHIR_BASE  :', env.EPIC_FHIR_BASE || '(not set!)')

  const sessionId   = crypto.randomUUID()
  const verifier    = randomBase64url(32)
  const challenge   = await sha256(verifier)

  // State carries only the sessionId — verifier stays server-side in the DB.
  // Embedding the verifier in state (which travels through the browser URL) would
  // defeat PKCE's purpose; an attacker who intercepts the state could extract it.
  const state = await buildState(env.SESSION_SIGNING_KEY, { sessionId })

  let cfg: SmartConfig
  try {
    console.log('[epic/session/start] Discovering SMART config from', env.EPIC_FHIR_BASE)
    cfg = await discoverSmartConfig(env.EPIC_FHIR_BASE)
    console.log('[epic/session/start] Discovery OK — authorize:', cfg.authorization_endpoint)
  } catch (e) {
    console.warn('[epic/session/start] Discovery failed, using fallback:', String(e))
    cfg = { authorization_endpoint: env.EPIC_AUTHORIZE_URL, token_endpoint: env.EPIC_TOKEN_URL }
  }

  const authorizeParams = new URLSearchParams({
    response_type:         'code',
    client_id:             env.EPIC_CLIENT_ID,
    redirect_uri:          env.EPIC_REDIRECT_URI,
    scope:                 STANDALONE_SCOPES,
    state,
    aud:                   env.EPIC_FHIR_BASE,
    code_challenge:        challenge,
    code_challenge_method: 'S256',
  })
  const authorizeUrl = `${cfg.authorization_endpoint}?${authorizeParams}`
  console.log('[epic/session/start] Scopes:', STANDALONE_SCOPES)
  console.log('[epic/session/start] Authorize endpoint:', cfg.authorization_endpoint)
  // Do not log the full URL — state is HMAC-signed but not encrypted

  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000).toISOString()
  await sbInsert(env, 'epic_oauth_sessions', {
    id: sessionId,
    launch_kind: 'standalone',
    status: 'pending',
    fhir_base: env.EPIC_FHIR_BASE,
    state,
    code_verifier: verifier,   // stored server-side; never sent to browser
    expires_at: expiresAt,
  })

  console.log('[epic/session/start] Session created:', sessionId)
  return Response.json({ sessionId, authorizeUrl }, { headers: CORS })
}

/** GET /api/epic/launch?iss=...&launch=... — EHR-launch entry point */
export async function handleEhrLaunch(req: Request, env: EpicEnv): Promise<Response> {
  const url = new URL(req.url)
  const iss    = url.searchParams.get('iss')
  const launch = url.searchParams.get('launch')

  if (!iss || !launch) {
    return new Response('Missing iss or launch parameter', { status: 400 })
  }

  // Validate iss host
  const issHost = new URL(iss).hostname
  if (!ALLOWED_FHIR_HOSTS.some(h => issHost === h || issHost.endsWith('.' + h))) {
    return new Response('Untrusted FHIR server', { status: 403 })
  }

  const sessionId = crypto.randomUUID()
  const verifier  = randomBase64url(32)
  const challenge = await sha256(verifier)
  const state     = await buildState(env.SESSION_SIGNING_KEY, { sessionId })  // verifier stays in DB only

  let cfg: SmartConfig
  try {
    cfg = await discoverSmartConfig(iss.replace(/\/$/, '') + '/')
  } catch {
    cfg = { authorization_endpoint: env.EPIC_AUTHORIZE_URL, token_endpoint: env.EPIC_TOKEN_URL }
  }

  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000).toISOString()
  await sbInsert(env, 'epic_oauth_sessions', {
    id: sessionId,
    launch_kind: 'ehr',
    status: 'pending',
    fhir_base: iss.endsWith('/') ? iss : iss + '/',
    state,
    code_verifier: verifier,
    expires_at: expiresAt,
  })

  const authorizeParams = new URLSearchParams({
    response_type:         'code',
    client_id:             env.EPIC_CLIENT_ID,
    redirect_uri:          env.EPIC_REDIRECT_URI,
    scope:                 EHR_LAUNCH_SCOPES,
    state,
    aud:                   iss,
    launch,
    code_challenge:        challenge,
    code_challenge_method: 'S256',
  })

  return Response.redirect(`${cfg.authorization_endpoint}?${authorizeParams}`, 302)
}

/** GET /api/epic/callback?code=...&state=... — token exchange, mint claim code */
export async function handleCallback(req: Request, env: EpicEnv): Promise<Response> {
  console.log('[epic/callback] --- incoming callback')
  const url   = new URL(req.url)
  const code  = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  console.log('[epic/callback] code present :', !!code)
  console.log('[epic/callback] state present:', !!state)
  if (error) {
    const desc = url.searchParams.get('error_description') ?? error
    console.error('[epic/callback] Epic returned error:', error, '|', desc)
    return landingPage('Authorization failed', `Epic returned error: ${desc}`, null, null)
  }
  if (!code || !state) {
    console.error('[epic/callback] Missing code or state')
    return landingPage('Authorization failed', 'Missing code or state parameter.', null, null)
  }

  const payload = await verifyState(env.SESSION_SIGNING_KEY, state)
  if (!payload) {
    console.error('[epic/callback] State verification failed — tampered or wrong SESSION_SIGNING_KEY')
    return landingPage('Authorization failed', 'Invalid or tampered state parameter.', null, null)
  }

  const { sessionId } = payload
  console.log('[epic/callback] State verified — sessionId:', sessionId)

  // Load verifier from DB — it was never sent through the browser
  const rows = await sbSelect(env, 'epic_oauth_sessions', {
    id: `eq.${sessionId}`,
    select: 'status,fhir_base,launch_kind,code_verifier',
  })
  if (!rows.length || rows[0].status !== 'pending') {
    console.error('[epic/callback] Session not found or not pending — rows:', rows.length, rows[0]?.status)
    return landingPage('Session expired', 'This login session has already been used or expired.', null, null)
  }

  const { fhir_base, launch_kind, code_verifier } = rows[0]
  if (!code_verifier) {
    console.error('[epic/callback] No code_verifier in session — this should never happen')
    return landingPage('Authorization failed', 'Session is missing PKCE verifier.', null, null)
  }
  const verifier = code_verifier as string
  console.log('[epic/callback] Session OK — launch_kind:', launch_kind, 'fhir_base:', fhir_base)

  let tokenUrl: string
  try {
    const cfg = await discoverSmartConfig(fhir_base as string)
    tokenUrl = cfg.token_endpoint
    console.log('[epic/callback] Token URL (discovered):', tokenUrl)
  } catch (e) {
    tokenUrl = env.EPIC_TOKEN_URL
    console.warn('[epic/callback] Discovery failed, using fallback token URL:', tokenUrl, String(e))
  }

  console.log('[epic/callback] Exchanging code for tokens...')
  const creds = btoa(`${env.EPIC_CLIENT_ID}:${env.EPIC_CLIENT_SECRET}`)
  const tokenRes = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${creds}`,
    },
    body: new URLSearchParams({
      grant_type:    'authorization_code',
      code,
      redirect_uri:  env.EPIC_REDIRECT_URI,
      code_verifier: verifier,
    }).toString(),
  })

  console.log('[epic/callback] Token endpoint status:', tokenRes.status)
  if (!tokenRes.ok) {
    const detail = await tokenRes.text()
    console.error('[epic/callback] Token exchange failed:', detail)
    await sbUpdate(env, 'epic_oauth_sessions', sessionId, { status: 'error', error: detail })
    return landingPage('Token exchange failed', detail, null, null)
  }

  const tokenData = await tokenRes.json() as {
    access_token: string
    refresh_token?: string
    expires_in?: number
    token_type: string
    scope: string
    patient?: string
  }

  console.log('[epic/callback] Token OK — scope:', tokenData.scope)
  console.log('[epic/callback] patient in token:', tokenData.patient ?? '(none — standalone)')
  console.log('[epic/callback] access_token present:', !!tokenData.access_token)
  console.log('[epic/callback] refresh_token present:', !!tokenData.refresh_token)

  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null

  await sbUpdate(env, 'epic_oauth_sessions', sessionId, {
    status:          'connected',
    access_token:    tokenData.access_token,
    refresh_token:   tokenData.refresh_token ?? null,
    token_type:      tokenData.token_type,
    scope:           tokenData.scope,
    patient_fhir_id: tokenData.patient ?? null,
    expires_at:      expiresAt,
    code_verifier:   null,
    state:           null,
  })
  console.log('[epic/callback] Session updated to connected')

  // For EHR launch: immediately fetch & persist the in-context patient
  if (launch_kind === 'ehr' && tokenData.patient) {
    console.log('[epic/callback] EHR launch — fetching patient:', tokenData.patient)
    try {
      const ptRes = await fetch(`${(fhir_base as string).replace(/\/$/, '')}/Patient/${tokenData.patient}`, {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Accept': 'application/fhir+json',
        },
      })
      console.log('[epic/callback] Patient fetch status:', ptRes.status)
      if (ptRes.ok) {
        const pt = await ptRes.json()
        const canonicalBase = (fhir_base as string).replace(/\/+$/, '')
        const namespacedPt = tokenData.patient ? `${canonicalBase}|${tokenData.patient}` : null
        await mapFhirResource(env, pt, namespacedPt, canonicalBase)
        const patientDbId = `${canonicalBase}|${tokenData.patient!}`
        await recordSessionPatient(env, sessionId, patientDbId)
        console.log('[epic/callback] Patient mapped to DB')
      }
    } catch (e) {
      console.error('[epic/callback] Patient prefetch failed (non-fatal):', String(e))
    }
  }

  // Mint one-time claim code
  const claimCode = randomBase64url(16)
  const claimExpiry = new Date(Date.now() + CLAIM_TTL_SECONDS * 1000).toISOString()
  await sbInsert(env, 'epic_claim_codes', {
    code:       claimCode,
    session_id: sessionId,
    used:       false,
    expires_at: claimExpiry,
  })

  const deepLink = `${env.APP_DEEPLINK}?code=${encodeURIComponent(claimCode)}`
  const patientId = tokenData.patient ?? null
  console.log('[epic/callback] Claim code minted, deep link:', deepLink)

  return landingPage('Connected to Epic', 'Authorization successful. Opening SwiftCare…', deepLink, patientId)
}

/** GET /api/epic/session/:id — status check (never returns tokens) */
export async function handleSessionStatus(sessionId: string, env: EpicEnv): Promise<Response> {
  const rows = await sbSelect(env, 'epic_oauth_sessions', {
    id:     `eq.${sessionId}`,
    select: 'status,scope,expires_at,patient_fhir_id,launch_kind',
  })
  if (!rows.length) return Response.json({ connected: false }, { headers: CORS })
  const r = rows[0]
  return Response.json({
    connected:       r.status === 'connected',
    scope:           r.scope ?? null,
    expiresAt:       r.expires_at ?? null,
    patientFhirId:   r.patient_fhir_id ?? null,
    launchKind:      r.launch_kind,
  }, { headers: CORS })
}

/** POST /api/epic/claim/:code — exchange one-time code for sessionId */
export async function handleClaim(code: string, env: EpicEnv): Promise<Response> {
  // Atomic check-and-consume: WHERE used=false AND expires_at > now() prevents TOCTOU
  // races where two simultaneous requests both pass a separate read-then-write check.
  const now = new Date().toISOString()
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/epic_claim_codes?code=eq.${encodeURIComponent(code)}&used=eq.false&expires_at=gt.${now}`,
    { method: 'PATCH', headers: { ...sbHeaders(env), 'Prefer': 'return=representation' }, body: JSON.stringify({ used: true }) },
  )
  if (!res.ok) return Response.json({ error: 'Failed to consume code' }, { status: 500, headers: CORS })

  const consumed = await res.json() as { code: string; session_id: string }[]
  if (!consumed.length) {
    // Row not found, already used, or expired — don't distinguish to prevent oracle attacks
    return Response.json({ error: 'Invalid, already used, or expired claim code' }, { status: 410, headers: CORS })
  }

  const sessionRows = await sbSelect(env, 'epic_oauth_sessions', {
    id:     `eq.${consumed[0].session_id}`,
    select: 'patient_fhir_id,launch_kind,scope',
  })
  const session = sessionRows[0] ?? {}

  return Response.json({
    sessionId:     consumed[0].session_id,
    patientFhirId: session.patient_fhir_id ?? null,
    launchKind:    session.launch_kind,
    scope:         session.scope ?? null,
  }, { headers: CORS })
}

/** GET /api/epic/patients — persisted Epic patient list; requires a valid connected session */
export async function handlePatientList(req: Request, env: EpicEnv): Promise<Response> {
  const sessionId = req.headers.get('X-Epic-Session')
  if (!sessionId) {
    return Response.json({ error: 'Missing X-Epic-Session header' }, { status: 401, headers: CORS })
  }
  const sessions = await sbSelect(env, 'epic_oauth_sessions', {
    id:     `eq.${sessionId}`,
    select: 'status',
  })
  if (!sessions.length || sessions[0].status !== 'connected') {
    return Response.json({ error: 'Session not connected' }, { status: 403, headers: CORS })
  }

  // Get only patients linked to this session (session_patient junction prevents cross-session PHI)
  const linked = await sbSelect(env, 'session_patient', {
    session_id: `eq.${sessionId}`,
    select:     'patient_db_id',
  })
  if (!linked.length) return Response.json([], { headers: CORS })

  // Filter the view by db_id (namespaced PK) — safe even if raw FHIR ids collide across servers
  const dbIds = linked.map(r => r.patient_db_id as string).join(',')
  const rows = await sbSelect(env, 'interop_patient_list', {
    db_id:  `in.(${dbIds})`,
    select: 'patient_fhir_id,gender,birth_date,full_name,mrn,last_updated',
    order:  'last_updated.desc',
    limit:  '200',
  })
  return Response.json(rows, { headers: CORS })
}

/** ALL /api/epic/fhir/* — authenticated FHIR proxy + persist resources */
export async function handleFhirProxy(req: Request, env: EpicEnv, fhirPath: string): Promise<Response> {
  const sessionId = req.headers.get('X-Epic-Session')
  if (!sessionId) return Response.json({ error: 'Missing X-Epic-Session header' }, { status: 401, headers: CORS })

  let accessToken: string
  try {
    accessToken = await getValidToken(env, sessionId)
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 401, headers: CORS })
  }

  const sessionRows = await sbSelect(env, 'epic_oauth_sessions', {
    id: `eq.${sessionId}`, select: 'fhir_base,patient_fhir_id',
  })
  // Canonical source: trim trailing slash once here; all downstream uses are consistent
  const fhirBase = (sessionRows[0]?.fhir_base as string ?? env.EPIC_FHIR_BASE).replace(/\/+$/, '')
  const patientFhirId = sessionRows[0]?.patient_fhir_id as string | null

  const upstreamUrl = `${fhirBase}/${fhirPath}`
  const upstreamReq = new Request(upstreamUrl, {
    method:  req.method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept':        'application/fhir+json',
    },
  })

  const upstreamRes = await fetch(upstreamReq)

  // Guard against non-JSON upstream responses (Epic can return HTML/text on errors)
  const contentType = upstreamRes.headers.get('content-type') ?? ''
  if (!contentType.includes('json')) {
    const text = await upstreamRes.text()
    return Response.json(
      { error: `FHIR server returned non-JSON (${upstreamRes.status})`, detail: text.slice(0, 500) },
      { status: upstreamRes.status, headers: CORS },
    )
  }

  let body: Record<string, unknown>
  try {
    body = await upstreamRes.json() as Record<string, unknown>
  } catch {
    return Response.json(
      { error: 'FHIR server returned unparseable JSON', status: upstreamRes.status },
      { status: 502, headers: CORS },
    )
  }

  if (upstreamRes.ok) {
    persistFhirResponse(env, body, patientFhirId, sessionId, fhirBase).catch(() => {})
  }

  return Response.json(body, { status: upstreamRes.status, headers: CORS })
}

async function persistFhirResponse(
  env: EpicEnv,
  body: Record<string, unknown>,
  patientFhirId: string | null,
  sessionId?: string,
  fhirServer?: string,
) {
  const resources: Record<string, unknown>[] = body.resourceType === 'Bundle'
    ? ((body.entry as { resource?: Record<string, unknown> }[] | undefined) ?? [])
        .map(e => e.resource).filter(Boolean) as Record<string, unknown>[]
    : body.resourceType ? [body] : []

  const src = (fhirServer ?? 'epic').replace(/\/+$/, '')
  // Namespace the default patient id so mappers' `nsRef(src, r.subject) ?? defaultPatientId`
  // always produces a namespaced value, not a mix of raw and namespaced ids.
  const namespacedDefault = patientFhirId ? `${src}|${patientFhirId}` : null
  for (const resource of resources) {
    await mapFhirResource(env, resource, namespacedDefault, src).catch(() => {})
    if (resource.resourceType === 'Patient' && sessionId) {
      const rawId = typeof resource.id === 'string' ? resource.id : null
      if (rawId) {
        // Store the namespaced DB id so session_patient joins patient(id) correctly
        await recordSessionPatient(env, sessionId, `${src}|${rawId}`).catch(() => {})
      }
    }
  }
}

async function recordSessionPatient(env: EpicEnv, sessionId: string, patientDbId: string) {
  await fetch(`${env.SUPABASE_URL}/rest/v1/session_patient?on_conflict=session_id,patient_db_id`, {
    method: 'POST',
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({ session_id: sessionId, patient_db_id: patientDbId }),
  })
}

// ─── Landing page HTML (auto-redirects to swiftcare://) ───────────────────────

function landingPage(
  title: string,
  message: string,
  deepLink: string | null,
  _patientId: string | null,
): Response {
  const redirectScript = deepLink
    ? `<script>
        setTimeout(function() { window.location.href = ${JSON.stringify(deepLink)}; }, 500);
      </script>`
    : ''

  const openButton = deepLink
    ? `<p><a href="${deepLink}" style="
        display:inline-block;padding:10px 20px;background:#0d9488;color:#fff;
        border-radius:6px;text-decoration:none;font-weight:600;margin-top:12px">
        Open SwiftCare
       </a></p>`
    : ''

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — SwiftCare</title>
  <style>
    body { font-family: -apple-system, sans-serif; display: flex; align-items: center;
           justify-content: center; min-height: 100vh; margin: 0; background: #f0fdf4; }
    .card { background: #fff; border-radius: 12px; padding: 40px 48px; text-align: center;
            box-shadow: 0 2px 16px rgba(0,0,0,.08); max-width: 420px; }
    h1 { color: #0d9488; font-size: 22px; margin: 0 0 12px; }
    p  { color: #374151; font-size: 15px; margin: 0 0 8px; }
  </style>
  ${redirectScript}
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
    ${openButton}
  </div>
</body>
</html>`

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
