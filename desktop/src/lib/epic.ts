// Desktop-side wrappers for the Cloudflare Worker Epic BFF.
// The Worker holds all secrets; this module only makes HTTPS calls and parses FHIR Bundles.

// Baked in by Vite at build time. For production: VITE_WORKER_URL=https://... npm run tauri build
const EPIC_API: string = import.meta.env.VITE_WORKER_URL ?? 'http://localhost:8787'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EpicPatient {
  fhirId: string
  fullName: string | null
  gender: string | null
  birthDate: string | null
  mrn: string | null
  lastUpdated: string | null
  source: 'epic'
}

export interface EpicCondition {
  id: string
  code: string | null
  display: string | null
  text: string | null
  status: string | null
  onset: string | null
}

export interface EpicMedication {
  id: string
  code: string | null
  display: string | null
  text: string | null
  status: string | null
  authoredOn: string | null
  dosageText: string | null
}

export interface EpicAllergy {
  id: string
  code: string | null
  display: string | null
  text: string | null
  criticality: string | null
  status: string | null
  reactions: string[]
}

export interface EpicObservation {
  id: string
  code: string | null
  display: string | null
  value: string | null
  unit: string | null
  effective: string | null
  status: string | null
}

export interface EpicImmunization {
  id: string
  vaccine: string | null
  display: string | null
  status: string | null
  occurrence: string | null
  primarySource: boolean | null
}

export interface EpicEncounter {
  id: string
  type: string | null
  status: string | null
  periodStart: string | null
  periodEnd: string | null
  class: string | null
}

export interface EpicSessionStatus {
  connected: boolean
  scope: string | null
  expiresAt: string | null
  patientFhirId: string | null
  launchKind: 'standalone' | 'ehr'
}

export interface EpicClaimResult {
  sessionId: string
  patientFhirId: string | null
  launchKind: 'standalone' | 'ehr'
  scope: string | null
}

// ─── Session storage ──────────────────────────────────────────────────────────

const SESSION_KEY = 'epic_session_id'

export function getStoredSessionId(): string | null {
  return localStorage.getItem(SESSION_KEY)
}

export function storeSessionId(id: string) {
  localStorage.setItem(SESSION_KEY, id)
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

// ─── Worker API wrappers ──────────────────────────────────────────────────────

/** Start OAuth flow: returns { sessionId, authorizeUrl } */
export async function epicStartSession(): Promise<{ sessionId: string; authorizeUrl: string }> {
  const res = await fetch(`${EPIC_API}/api/epic/session/start`, { method: 'POST' })
  if (!res.ok) throw new Error(`Session start failed: ${await res.text()}`)
  return res.json()
}

/** Poll session status (used as dev fallback when deep link doesn't fire). */
export async function epicGetStatus(sessionId: string): Promise<EpicSessionStatus> {
  const res = await fetch(`${EPIC_API}/api/epic/session/${sessionId}`)
  if (!res.ok) throw new Error(`Status check failed: ${await res.text()}`)
  return res.json()
}

/** Exchange a one-time claim code (from the deep link) for a sessionId. */
export async function epicClaimCode(code: string): Promise<EpicClaimResult> {
  const res = await fetch(`${EPIC_API}/api/epic/claim/${encodeURIComponent(code)}`, { method: 'POST' })
  if (!res.ok) throw new Error(`Claim failed: ${await res.text()}`)
  return res.json()
}

/** Fetch persisted Epic patients from the interop_patient_list view. Requires a connected sessionId. */
export async function epicListPatients(sessionId: string): Promise<EpicPatient[]> {
  const res = await fetch(`${EPIC_API}/api/epic/patients`, {
    headers: { 'X-Epic-Session': sessionId },
  })
  if (!res.ok) throw new Error(`Patient list failed: ${await res.text()}`)
  const rows = await res.json() as {
    patient_fhir_id: string
    full_name: string | null
    gender: string | null
    birth_date: string | null
    mrn: string | null
    last_updated: string | null
  }[]
  return rows.map(r => ({
    fhirId:      r.patient_fhir_id,
    fullName:    r.full_name,
    gender:      r.gender,
    birthDate:   r.birth_date,
    mrn:         r.mrn,
    lastUpdated: r.last_updated,
    source:      'epic',
  }))
}

/** Search Epic patients via FHIR Patient?family=...&given=... */
export async function epicSearchPatients(
  sessionId: string,
  params: { family?: string; given?: string; birthdate?: string; identifier?: string },
): Promise<EpicPatient[]> {
  const qs = new URLSearchParams()
  if (params.family)     qs.set('family',     params.family)
  if (params.given)      qs.set('given',      params.given)
  if (params.birthdate)  qs.set('birthdate',  params.birthdate)
  if (params.identifier) qs.set('identifier', params.identifier)

  const res = await fetch(`${EPIC_API}/api/epic/fhir/Patient?${qs}`, {
    headers: { 'X-Epic-Session': sessionId },
  })
  if (!res.ok) throw new Error(`Patient search failed: ${await res.text()}`)
  const bundle = await res.json() as { entry?: { resource: Record<string, unknown> }[] }
  return (bundle.entry ?? []).map(e => parsePatientResource(e.resource))
}

/** Fetch a single Epic patient by FHIR id */
export async function epicGetPatient(sessionId: string, fhirId: string): Promise<EpicPatient | null> {
  const res = await fetch(`${EPIC_API}/api/epic/fhir/Patient/${fhirId}`, {
    headers: { 'X-Epic-Session': sessionId },
  })
  if (!res.ok) return null
  return parsePatientResource(await res.json())
}

/** Fetch clinical resources for a patient. fetchErrors is non-empty if any resource type failed. */
export async function epicGetResources(sessionId: string, patientFhirId: string): Promise<{
  conditions:    EpicCondition[]
  medications:   EpicMedication[]
  allergies:     EpicAllergy[]
  observations:  EpicObservation[]
  immunizations: EpicImmunization[]
  encounters:    EpicEncounter[]
  fetchErrors:   string[]
}> {
  const pid = encodeURIComponent(patientFhirId)

  const HEADERS = { 'X-Epic-Session': sessionId }

  const [condRes, medRes, allergyRes, obsRes, immunRes, encRes] = await Promise.allSettled([
    fetch(`${EPIC_API}/api/epic/fhir/Condition?patient=${pid}&clinical-status=active,inactive,resolved&_count=100`, { headers: HEADERS }),
    fetch(`${EPIC_API}/api/epic/fhir/MedicationRequest?patient=${pid}&status=active,stopped,completed&_count=100`, { headers: HEADERS }),
    fetch(`${EPIC_API}/api/epic/fhir/AllergyIntolerance?patient=${pid}&_count=100`, { headers: HEADERS }),
    fetch(`${EPIC_API}/api/epic/fhir/Observation?patient=${pid}&category=vital-signs&_sort=-date&_count=50`, { headers: HEADERS }),
    fetch(`${EPIC_API}/api/epic/fhir/Immunization?patient=${pid}&status=completed&_count=100`, { headers: HEADERS }),
    fetch(`${EPIC_API}/api/epic/fhir/Encounter?patient=${pid}&_sort=-date&_count=20`, { headers: HEADERS }),
  ])

  const fetchErrors: string[] = []

  async function entries(r: PromiseSettledResult<Response>, label: string) {
    if (r.status === 'rejected') {
      fetchErrors.push(`${label}: network error — ${r.reason}`)
      return []
    }
    if (!r.value.ok) {
      const body = await r.value.text().catch(() => '')
      fetchErrors.push(`${label}: HTTP ${r.value.status} — ${body.slice(0, 200)}`)
      return []
    }
    const b = await r.value.json() as { entry?: { resource: Record<string, unknown> }[] }
    return (b.entry ?? []).map(e => e.resource)
  }

  const result = {
    conditions:    (await entries(condRes,    'Condition')).map(parseCondition),
    medications:   (await entries(medRes,     'MedicationRequest')).map(parseMedication),
    allergies:     (await entries(allergyRes, 'AllergyIntolerance')).map(parseAllergy),
    observations:  (await entries(obsRes,     'Observation')).map(parseObservation),
    immunizations: (await entries(immunRes,   'Immunization')).map(parseImmunization),
    encounters:    (await entries(encRes,     'Encounter')).map(parseEncounter),
    fetchErrors,
  }

  if (fetchErrors.length) {
    console.warn('[epicGetResources] Some resource fetches failed:', fetchErrors)
  }

  return result
}

// ─── FHIR parsers ─────────────────────────────────────────────────────────────

type R = Record<string, unknown>
const str = (v: unknown) => (typeof v === 'string' ? v : null)
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const obj = (v: unknown): R => (v && typeof v === 'object' && !Array.isArray(v) ? v as R : {})

function codingDisplay(cc: unknown): { code: string | null; display: string | null; text: string | null } {
  const o = obj(cc)
  const c = obj(arr(o.coding)[0])
  return { code: str(c.code), display: str(c.display), text: str(o.text) }
}

export function parsePatientResource(r: R): EpicPatient {
  const names = arr(r.name)
  const n = obj(names[0])
  const given = arr(n.given).map(g => String(g)).join(' ')
  const family = str(n.family)
  const fullName = str(n.text) ?? ([given, family].filter(Boolean).join(' ') || null)

  const mrn = arr(r.identifier)
    .map(obj)
    .find(i => str(obj(i.type).coding ? obj(arr(obj(i.type).coding)[0]).code : null) === 'MR'
           || str(i.system)?.includes('MR'))
  const mrnValue = mrn ? str(mrn.value) : null

  return {
    fhirId:      str(r.id) ?? '',
    fullName,
    gender:      str(r.gender),
    birthDate:   str(r.birthDate),
    mrn:         mrnValue,
    lastUpdated: str(obj(r.meta).lastUpdated),
    source:      'epic',
  }
}

function parseCondition(r: R): EpicCondition {
  const code = codingDisplay(r.code)
  const cs = codingDisplay(r.clinicalStatus)
  return {
    id:      str(r.id) ?? '',
    code:    code.code,
    display: code.display,
    text:    code.text,
    status:  cs.code,
    onset:   str((r as R).onsetDateTime) ?? str(r.recordedDate),
  }
}

function parseMedication(r: R): EpicMedication {
  const med = codingDisplay((r as R).medicationCodeableConcept)
  const dosage = obj(arr(r.dosageInstruction)[0])
  return {
    id:          str(r.id) ?? '',
    code:        med.code,
    display:     med.display,
    text:        med.text,
    status:      str(r.status),
    authoredOn:  str(r.authoredOn),
    dosageText:  str(dosage.text),
  }
}

function parseAllergy(r: R): EpicAllergy {
  const code = codingDisplay(r.code)
  const reactions = arr(r.reaction).flatMap(rx =>
    arr(obj(rx).manifestation).map(m => codingDisplay(m).display ?? codingDisplay(m).text ?? '')
  ).filter(Boolean)
  return {
    id:          str(r.id) ?? '',
    code:        code.code,
    display:     code.display,
    text:        code.text,
    criticality: str(r.criticality),
    status:      str(obj(r.clinicalStatus).coding ? str(obj(arr(obj(r.clinicalStatus).coding)[0]).code) : null),
    reactions,
  }
}

function parseObservation(r: R): EpicObservation {
  const code = codingDisplay(r.code)
  const vq = obj((r as R).valueQuantity)
  const vc = codingDisplay((r as R).valueCodeableConcept)
  const value = vq.value != null
    ? String(vq.value)
    : vc.display ?? str((r as R).valueString)
  return {
    id:        str(r.id) ?? '',
    code:      code.code,
    display:   code.display,
    value:     value,
    unit:      str(vq.unit),
    effective: str((r as R).effectiveDateTime),
    status:    str(r.status),
  }
}

function parseImmunization(r: R): EpicImmunization {
  const vaccine = codingDisplay(r.vaccineCode)
  return {
    id:            str(r.id) ?? '',
    vaccine:       vaccine.code,
    display:       vaccine.display ?? vaccine.text,
    status:        str(r.status),
    occurrence:    str((r as R).occurrenceDateTime) ?? str((r as R).occurrenceString),
    primarySource: typeof r.primarySource === 'boolean' ? r.primarySource : null,
  }
}

function parseEncounter(r: R): EpicEncounter {
  const type = codingDisplay(arr(r.type)[0])
  const cls = obj(r.class)
  const per = obj(r.period)
  return {
    id:          str(r.id) ?? '',
    type:        type.display ?? type.text,
    status:      str(r.status),
    periodStart: str(per.start),
    periodEnd:   str(per.end),
    class:       str(cls.display) ?? str(cls.code),
  }
}

// ─── Start login: open browser + poll session (dev fallback) ──────────────────

/** Full standalone-launch login flow.
 *  1. Calls session/start to get authorizeUrl + sessionId.
 *  2. Opens the URL in the system browser (caller must supply openUrl from plugin-opener).
 *  3. Stores sessionId; returns it so the deep-link handler can claim it.
 */
export async function epicStartLogin(openUrl: (url: string) => Promise<void>): Promise<string> {
  const { sessionId, authorizeUrl } = await epicStartSession()
  storeSessionId(sessionId)
  await openUrl(authorizeUrl)
  return sessionId
}

/** Dev-mode polling fallback: poll until connected or timeout.
 *  Use this if the swiftcare:// deep link doesn't fire (e.g. under `tauri dev`).
 */
export async function pollUntilConnected(
  sessionId: string,
  options = { intervalMs: 2000, maxAttempts: 90 },
): Promise<EpicSessionStatus> {
  for (let i = 0; i < options.maxAttempts; i++) {
    await new Promise(r => setTimeout(r, options.intervalMs))
    const status = await epicGetStatus(sessionId)
    if (status.connected) return status
  }
  throw new Error('Login timeout — browser window not completed')
}
