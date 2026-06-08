// FHIR resource → Supabase typed tables mapper.
// For each resource type: upsert the main row (typed scalars + verbatim `resource` jsonb)
// then delete+insert child rows (simpler than per-row upserts for arrays).
// Unknown resource types are skipped (they can be added later as needed).

import type { EpicEnv } from './epic'

type R = Record<string, unknown>

function str(v: unknown): string | null  { return typeof v === 'string' ? v : null }
function bool(v: unknown): boolean | null { return typeof v === 'boolean' ? v : null }
function num(v: unknown): number | null  { return typeof v === 'number' ? v : null }
function arr(v: unknown): unknown[]      { return Array.isArray(v) ? v : [] }

function asObj(v: unknown): R { return (v && typeof v === 'object' && !Array.isArray(v)) ? v as R : {} }

// First coding from a CodeableConcept
function coding(cc: unknown): { code: string|null; system: string|null; display: string|null; text: string|null } {
  const o = asObj(cc)
  const c = arr(o.coding)[0] as R | undefined
  return {
    code:    str(c?.code),
    system:  str(c?.system),
    display: str(c?.display),
    text:    str(o.text),
  }
}

// Namespace a FHIR resource id with its server origin so rows from different
// Epic orgs never share a primary key. The raw FHIR id is still stored in
// resource jsonb and exposed by the interop_patient_list view.
function fhirDbId(src: string, r: R): string | null {
  const raw = str(r.id)
  return raw ? `${src}|${raw}` : null
}

// Reference logical id (strip "ResourceType/" prefix)
// Returns a namespaced reference id: "source|rawFhirId", or null.
// Ensures cross-resource FK-style columns stay consistent with the namespaced PKs.
function nsRef(src: string, ref: unknown): string | null {
  const r = asObj(ref)
  const s = str(r.reference)
  if (!s) return null
  const raw = s.includes('/') ? s.split('/').pop()! : s
  return raw ? `${src}|${raw}` : null
}

// Parse FHIR dateTime → ISO string or null
function dt(v: unknown): string | null {
  if (!v) return null
  const s = String(v)
  try { return new Date(s).toISOString() } catch { return null }
}

function dateOnly(v: unknown): string | null {
  const s = str(v)
  return s ?? null
}

// ─── Supabase REST helpers ─────────────────────────────────────────────────────

function sbHeaders(env: EpicEnv) {
  return {
    'apikey':        env.SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type':  'application/json',
    'Prefer':        'resolution=merge-duplicates,return=minimal',
  }
}

async function upsert(env: EpicEnv, table: string, row: R, onConflict = 'id') {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: 'POST',
    headers: sbHeaders(env),
    body: JSON.stringify(row),
  })
  if (!res.ok) throw new Error(`upsert ${table}: ${await res.text()}`)
}

async function deleteChildren(env: EpicEnv, table: string, foreignKey: string, parentId: string) {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/${table}?${foreignKey}=eq.${encodeURIComponent(parentId)}`,
    { method: 'DELETE', headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } },
  )
  if (!res.ok && res.status !== 404) throw new Error(`delete ${table}: ${await res.text()}`)
}

async function insertMany(env: EpicEnv, table: string, rows: R[]) {
  if (!rows.length) return
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...sbHeaders(env), Prefer: 'return=minimal' },
    body: JSON.stringify(rows),
  })
  if (!res.ok) throw new Error(`insertMany ${table}: ${await res.text()}`)
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function mapFhirResource(
  env: EpicEnv,
  resource: R,
  defaultPatientId?: string | null,
  // fhirServer: the FHIR base URL, used as `source` so records from different Epic orgs
  // never silently overwrite each other. Production schemas should also add a
  // UNIQUE (source, id) constraint to all resource tables.
  fhirServer = 'epic',
): Promise<void> {
  const type = str(resource.resourceType)
  if (!type) return
  // Canonicalize: strip trailing slashes so the same server never creates two source values
  const s = fhirServer.replace(/\/+$/, '')

  switch (type) {
    case 'Patient':            return mapPatient(env, resource, s)
    case 'Practitioner':       return mapPractitioner(env, resource, s)
    case 'PractitionerRole':   return mapPractitionerRole(env, resource, s)
    case 'Organization':       return mapOrganization(env, resource, s)
    case 'Location':           return mapLocation(env, resource, s)
    case 'RelatedPerson':      return mapRelatedPerson(env, resource, s)
    case 'Encounter':          return mapEncounter(env, resource, s)
    case 'Condition':          return mapCondition(env, resource, s)
    case 'Observation':        return mapObservation(env, resource, s)
    case 'Medication':         return mapMedication(env, resource, s)
    case 'MedicationRequest':  return mapMedicationRequest(env, resource, s)
    case 'MedicationDispense': return mapMedicationDispense(env, resource, s)
    case 'AllergyIntolerance': return mapAllergyIntolerance(env, resource, s)
    case 'Immunization':       return mapImmunization(env, resource, s)
    case 'Procedure':          return mapProcedure(env, resource, s)
    case 'DiagnosticReport':   return mapDiagnosticReport(env, resource, s)
    case 'DocumentReference':  return mapDocumentReference(env, resource, s)
    case 'CarePlan':           return mapCarePlan(env, resource, s)
    case 'CareTeam':           return mapCareTeam(env, resource, s)
    case 'Goal':               return mapGoal(env, resource, s)
    case 'Coverage':           return mapCoverage(env, resource, s)
    case 'Device':             return mapDevice(env, resource, s)
    case 'ServiceRequest':     return mapServiceRequest(env, resource, s)
    case 'Specimen':           return mapSpecimen(env, resource, s)
    case 'Provenance':         return mapProvenance(env, resource, s)
    case 'QuestionnaireResponse': return mapQuestionnaireResponse(env, resource, s, defaultPatientId)
    default: break
  }
}

// ─── Patient ──────────────────────────────────────────────────────────────────

async function mapPatient(env: EpicEnv, r: R, src = 'epic') {
  const id = fhirDbId(src, r); if (!id) return
  const meta = asObj(r.meta)
  const marital = coding(r.maritalStatus)

  // US Core race / ethnicity extensions
  let raceOmbCode = null, raceOmbDisplay = null, raceText = null
  let ethOmbCode = null, ethOmbDisplay = null, ethText = null
  let birthsex = null, genderIdentityCode = null, genderIdentityDisplay = null

  for (const ext of arr(r.extension) as R[]) {
    const url = str(ext.url) ?? ''
    if (url.endsWith('us-core-race')) {
      for (const e2 of arr(ext.extension) as R[]) {
        if (str(e2.url) === 'ombCategory') {
          const vcc = asObj(e2.valueCoding); raceOmbCode = str(vcc.code); raceOmbDisplay = str(vcc.display)
        }
        if (str(e2.url) === 'text') { raceText = str(e2.valueString) }
      }
    }
    if (url.endsWith('us-core-ethnicity')) {
      for (const e2 of arr(ext.extension) as R[]) {
        if (str(e2.url) === 'ombCategory') {
          const vcc = asObj(e2.valueCoding); ethOmbCode = str(vcc.code); ethOmbDisplay = str(vcc.display)
        }
        if (str(e2.url) === 'text') { ethText = str(e2.valueString) }
      }
    }
    if (url.endsWith('us-core-birthsex')) { birthsex = str(ext.valueCode) }
    if (url.endsWith('individual-genderIdentity')) {
      const gi = coding(ext.valueCodeableConcept); genderIdentityCode = gi.code; genderIdentityDisplay = gi.display
    }
  }

  await upsert(env, 'patient', {
    id, resource: r, source: src,
    active: bool(r.active), gender: str(r.gender),
    birth_date: dateOnly(r.birthDate),
    deceased_boolean: bool((r as R).deceasedBoolean),
    deceased_datetime: dt((r as R).deceasedDateTime),
    marital_status_code: marital.code, marital_status_system: marital.system, marital_status_display: marital.display,
    race_omb_code: raceOmbCode, race_omb_display: raceOmbDisplay, race_text: raceText,
    ethnicity_omb_code: ethOmbCode, ethnicity_omb_display: ethOmbDisplay, ethnicity_text: ethText,
    birthsex, gender_identity_code: genderIdentityCode, gender_identity_display: genderIdentityDisplay,
    managing_organization_id: nsRef(src,r.managingOrganization),
    last_updated: dt(meta.lastUpdated),
  })

  await deleteChildren(env, 'patient_identifier',    'patient_id', id)
  await deleteChildren(env, 'patient_name',           'patient_id', id)
  await deleteChildren(env, 'patient_telecom',        'patient_id', id)
  await deleteChildren(env, 'patient_address',        'patient_id', id)
  await deleteChildren(env, 'patient_communication',  'patient_id', id)

  await insertMany(env, 'patient_identifier', arr(r.identifier).map((x) => {
    const i = asObj(x); const tc = coding(i.type)
    return { patient_id: id, use: str(i.use), system: str(i.system), value: str(i.value),
             type_code: tc.code, type_system: tc.system, type_display: tc.display }
  }))

  await insertMany(env, 'patient_name', arr(r.name).map((x) => {
    const n = asObj(x)
    return { patient_id: id, use: str(n.use), text: str(n.text), family: str(n.family),
             given: arr(n.given), prefix: arr(n.prefix), suffix: arr(n.suffix) }
  }))

  await insertMany(env, 'patient_telecom', arr(r.telecom).map((x) => {
    const t = asObj(x)
    return { patient_id: id, system: str(t.system), value: str(t.value), use: str(t.use), rank: num(t.rank) }
  }))

  await insertMany(env, 'patient_address', arr(r.address).map((x) => {
    const a = asObj(x); const p = asObj(a.period)
    return { patient_id: id, use: str(a.use), type: str(a.type), text: str(a.text),
             line: arr(a.line), city: str(a.city), district: str(a.district),
             state: str(a.state), postal_code: str(a.postalCode), country: str(a.country),
             period_start: dateOnly(p.start), period_end: dateOnly(p.end) }
  }))

  await insertMany(env, 'patient_communication', arr(r.communication).map((x) => {
    const c = asObj(x); const lang = coding(c.language)
    return { patient_id: id, language_code: lang.code, language_system: lang.system,
             language_display: lang.display, preferred: bool(c.preferred) }
  }))
}

// ─── Practitioner ─────────────────────────────────────────────────────────────

async function mapPractitioner(env: EpicEnv, r: R, src = 'epic') {
  const id = fhirDbId(src, r); if (!id) return
  const meta = asObj(r.meta)
  await upsert(env, 'practitioner', {
    id, resource: r, source: src,
    active: bool(r.active), gender: str(r.gender),
    birth_date: dateOnly(r.birthDate),
    last_updated: dt(meta.lastUpdated),
  })
  await deleteChildren(env, 'practitioner_identifier', 'practitioner_id', id)
  await deleteChildren(env, 'practitioner_name',        'practitioner_id', id)
  await deleteChildren(env, 'practitioner_telecom',     'practitioner_id', id)
  await deleteChildren(env, 'practitioner_address',     'practitioner_id', id)
  await deleteChildren(env, 'practitioner_qualification','practitioner_id', id)

  await insertMany(env, 'practitioner_identifier', arr(r.identifier).map((x) => {
    const i = asObj(x); const tc = coding(i.type)
    return { practitioner_id: id, use: str(i.use), system: str(i.system), value: str(i.value), type_code: tc.code, type_display: tc.display }
  }))
  await insertMany(env, 'practitioner_name', arr(r.name).map((x) => {
    const n = asObj(x)
    return { practitioner_id: id, use: str(n.use), text: str(n.text), family: str(n.family), given: arr(n.given), prefix: arr(n.prefix), suffix: arr(n.suffix) }
  }))
  await insertMany(env, 'practitioner_telecom', arr(r.telecom).map((x) => {
    const t = asObj(x)
    return { practitioner_id: id, system: str(t.system), value: str(t.value), use: str(t.use) }
  }))
  await insertMany(env, 'practitioner_address', arr(r.address).map((x) => {
    const a = asObj(x)
    return { practitioner_id: id, use: str(a.use), type: str(a.type), text: str(a.text), line: arr(a.line), city: str(a.city), state: str(a.state), postal_code: str(a.postalCode), country: str(a.country) }
  }))
  await insertMany(env, 'practitioner_qualification', arr(r.qualification).map((x) => {
    const q = asObj(x); const c = coding(q.code); const p = asObj(q.period)
    return { practitioner_id: id, code_code: c.code, code_system: c.system, code_display: c.display, code_text: c.text, period_start: dateOnly(p.start), period_end: dateOnly(p.end), issuer_org_id: nsRef(src,q.issuer) }
  }))
}

// ─── PractitionerRole ─────────────────────────────────────────────────────────

async function mapPractitionerRole(env: EpicEnv, r: R, src = 'epic') {
  const id = fhirDbId(src, r); if (!id) return
  const meta = asObj(r.meta); const per = asObj(r.period)
  await upsert(env, 'practitionerrole', {
    id, resource: r, source: src,
    active: bool(r.active),
    practitioner_id: nsRef(src,r.practitioner),
    organization_id: nsRef(src,r.organization),
    period_start: dt(per.start), period_end: dt(per.end),
    last_updated: dt(meta.lastUpdated),
  })
  await deleteChildren(env, 'practitionerrole_code',     'practitionerrole_id', id)
  await deleteChildren(env, 'practitionerrole_specialty','practitionerrole_id', id)
  await deleteChildren(env, 'practitionerrole_location', 'practitionerrole_id', id)
  await deleteChildren(env, 'practitionerrole_telecom',  'practitionerrole_id', id)
  await insertMany(env, 'practitionerrole_code',     arr(r.code).map((x)     => { const c = coding(x); return { practitionerrole_id: id, code: c.code, system: c.system, display: c.display } }))
  await insertMany(env, 'practitionerrole_specialty',arr(r.specialty).map((x)=> { const c = coding(x); return { practitionerrole_id: id, code: c.code, system: c.system, display: c.display } }))
  await insertMany(env, 'practitionerrole_location', arr(r.location).map((x) => ({ practitionerrole_id: id, location_id: nsRef(src,x) })))
  await insertMany(env, 'practitionerrole_telecom',  arr(r.telecom).map((x)  => { const t = asObj(x); return { practitionerrole_id: id, system: str(t.system), value: str(t.value), use: str(t.use) } }))
}

// ─── Organization ─────────────────────────────────────────────────────────────

async function mapOrganization(env: EpicEnv, r: R, src = 'epic') {
  const id = fhirDbId(src, r); if (!id) return
  const meta = asObj(r.meta)
  await upsert(env, 'organization', { id, resource: r, source: src, active: bool(r.active), name: str(r.name), part_of_id: nsRef(src,r.partOf), last_updated: dt(meta.lastUpdated) })
  await deleteChildren(env, 'organization_identifier', 'organization_id', id)
  await deleteChildren(env, 'organization_type',       'organization_id', id)
  await deleteChildren(env, 'organization_telecom',    'organization_id', id)
  await deleteChildren(env, 'organization_address',    'organization_id', id)
  await insertMany(env, 'organization_identifier', arr(r.identifier).map((x) => { const i = asObj(x); const tc = coding(i.type); return { organization_id: id, use: str(i.use), system: str(i.system), value: str(i.value), type_code: tc.code, type_display: tc.display } }))
  await insertMany(env, 'organization_type',       arr(r.type).map((x) => { const c = coding(x); return { organization_id: id, code: c.code, system: c.system, display: c.display } }))
  await insertMany(env, 'organization_telecom',    arr(r.telecom).map((x) => { const t = asObj(x); return { organization_id: id, system: str(t.system), value: str(t.value), use: str(t.use) } }))
  await insertMany(env, 'organization_address',    arr(r.address).map((x) => { const a = asObj(x); return { organization_id: id, use: str(a.use), type: str(a.type), text: str(a.text), line: arr(a.line), city: str(a.city), state: str(a.state), postal_code: str(a.postalCode), country: str(a.country) } }))
}

// ─── Location ─────────────────────────────────────────────────────────────────

async function mapLocation(env: EpicEnv, r: R, src = 'epic') {
  const id = fhirDbId(src, r); if (!id) return
  const meta = asObj(r.meta)
  await upsert(env, 'location', { id, resource: r, source: src, status: str(r.status), name: str(r.name), mode: str(r.mode), managing_organization_id: nsRef(src,r.managingOrganization), last_updated: dt(meta.lastUpdated) })
  await deleteChildren(env, 'location_type',    'location_id', id)
  await deleteChildren(env, 'location_telecom', 'location_id', id)
  await deleteChildren(env, 'location_address', 'location_id', id)
  await insertMany(env, 'location_type',    arr(r.type).map((x) => { const c = coding(x); return { location_id: id, code: c.code, system: c.system, display: c.display } }))
  await insertMany(env, 'location_telecom', arr(r.telecom).map((x) => { const t = asObj(x); return { location_id: id, system: str(t.system), value: str(t.value), use: str(t.use) } }))
  const a = asObj(r.address)
  if (a.city || a.line) {
    await insertMany(env, 'location_address', [{ location_id: id, use: str(a.use), type: str(a.type), text: str(a.text), line: arr(a.line), city: str(a.city), state: str(a.state), postal_code: str(a.postalCode), country: str(a.country) }])
  }
}

// ─── RelatedPerson ────────────────────────────────────────────────────────────

async function mapRelatedPerson(env: EpicEnv, r: R, src = 'epic') {
  const id = fhirDbId(src, r); if (!id) return
  const meta = asObj(r.meta)
  await upsert(env, 'relatedperson', { id, resource: r, source: src, active: bool(r.active), patient_id: nsRef(src,r.patient), gender: str(r.gender), birth_date: dateOnly(r.birthDate), last_updated: dt(meta.lastUpdated) })
  await deleteChildren(env, 'relatedperson_relationship', 'relatedperson_id', id)
  await deleteChildren(env, 'relatedperson_name',         'relatedperson_id', id)
  await deleteChildren(env, 'relatedperson_telecom',      'relatedperson_id', id)
  await deleteChildren(env, 'relatedperson_address',      'relatedperson_id', id)
  await insertMany(env, 'relatedperson_relationship', arr(r.relationship).map((x) => { const c = coding(x); return { relatedperson_id: id, code: c.code, system: c.system, display: c.display } }))
  await insertMany(env, 'relatedperson_name',         arr(r.name).map((x) => { const n = asObj(x); return { relatedperson_id: id, use: str(n.use), text: str(n.text), family: str(n.family), given: arr(n.given) } }))
  await insertMany(env, 'relatedperson_telecom',      arr(r.telecom).map((x) => { const t = asObj(x); return { relatedperson_id: id, system: str(t.system), value: str(t.value), use: str(t.use) } }))
  await insertMany(env, 'relatedperson_address',      arr(r.address).map((x) => { const a = asObj(x); return { relatedperson_id: id, use: str(a.use), line: arr(a.line), city: str(a.city), state: str(a.state), postal_code: str(a.postalCode), country: str(a.country) } }))
}

// ─── Encounter ────────────────────────────────────────────────────────────────

async function mapEncounter(env: EpicEnv, r: R, src = 'epic') {
  const id = fhirDbId(src, r); if (!id) return
  const meta = asObj(r.meta); const per = asObj(r.period); const cls = asObj(r.class)
  const hosp = asObj(r.hospitalization)
  const admitC = coding(hosp.admitSource); const dischargeC = coding(hosp.dischargeDisposition)
  await upsert(env, 'encounter', {
    id, resource: r, source: src,
    status: str(r.status),
    class_code: str(cls.code), class_system: str(cls.system), class_display: str(cls.display),
    subject_patient_id: nsRef(src,r.subject),
    period_start: dt(per.start), period_end: dt(per.end),
    service_provider_org_id: nsRef(src,r.serviceProvider),
    hospitalization_admit_code: admitC.code, hospitalization_admit_display: admitC.display,
    hospitalization_discharge_code: dischargeC.code, hospitalization_discharge_display: dischargeC.display,
    last_updated: dt(meta.lastUpdated),
  })
  await deleteChildren(env, 'encounter_type',        'encounter_id', id)
  await deleteChildren(env, 'encounter_service_type','encounter_id', id)
  await deleteChildren(env, 'encounter_participant',  'encounter_id', id)
  await deleteChildren(env, 'encounter_reason',       'encounter_id', id)
  await deleteChildren(env, 'encounter_diagnosis',    'encounter_id', id)
  await deleteChildren(env, 'encounter_location',     'encounter_id', id)
  await insertMany(env, 'encounter_type',        arr(r.type).map((x) => { const c = coding(x); return { encounter_id: id, code: c.code, system: c.system, display: c.display, text: c.text } }))
  await insertMany(env, 'encounter_service_type',arr((r as R).serviceType ? [(r as R).serviceType] : []).map((x) => { const c = coding(x); return { encounter_id: id, code: c.code, system: c.system, display: c.display } }))
  await insertMany(env, 'encounter_participant', arr(r.participant).map((x) => {
    const p = asObj(x); const tc = coding(arr(p.type)[0]); const pp = asObj(p.period)
    return { encounter_id: id, type_code: tc.code, type_display: tc.display, individual_practitioner_id: nsRef(src,p.individual), period_start: dt(pp.start), period_end: dt(pp.end) }
  }))
  await insertMany(env, 'encounter_reason',    arr(r.reasonCode).map((x) => { const c = coding(x); return { encounter_id: id, code: c.code, system: c.system, display: c.display, text: c.text } }))
  await insertMany(env, 'encounter_diagnosis', arr(r.diagnosis).map((x) => {
    const d = asObj(x); const uc = coding(d.use)
    return { encounter_id: id, condition_id: nsRef(src,d.condition), use_code: uc.code, use_display: uc.display, rank: num(d.rank) }
  }))
  await insertMany(env, 'encounter_location',  arr(r.location).map((x) => {
    const l = asObj(x); const lp = asObj(l.period)
    return { encounter_id: id, location_id: nsRef(src,l.location), status: str(l.status), period_start: dt(lp.start), period_end: dt(lp.end) }
  }))
}

// ─── Condition ────────────────────────────────────────────────────────────────

async function mapCondition(env: EpicEnv, r: R, src = 'epic') {
  const id = fhirDbId(src, r); if (!id) return
  const meta = asObj(r.meta)
  const cs = coding(r.clinicalStatus); const vs = coding(r.verificationStatus); const code = coding(r.code)
  await upsert(env, 'condition', {
    id, resource: r, source: src,
    clinical_status_code: cs.code, clinical_status_system: cs.system,
    verification_status_code: vs.code, verification_status_system: vs.system,
    subject_patient_id: nsRef(src,r.subject), encounter_id: nsRef(src,r.encounter),
    code_code: code.code, code_system: code.system, code_display: code.display, code_text: code.text,
    onset_datetime: dt((r as R).onsetDateTime),
    onset_age_value: num(asObj((r as R).onsetAge).value), onset_age_unit: str(asObj((r as R).onsetAge).unit),
    onset_string: str((r as R).onsetString),
    abatement_datetime: dt((r as R).abatementDateTime), abatement_string: str((r as R).abatementString),
    recorded_date: dt(r.recordedDate),
    recorder_practitioner_id: nsRef(src,r.recorder), asserter_practitioner_id: nsRef(src,r.asserter),
    last_updated: dt(meta.lastUpdated),
  })
  await deleteChildren(env, 'condition_category', 'condition_id', id)
  await deleteChildren(env, 'condition_stage',    'condition_id', id)
  await insertMany(env, 'condition_category', arr(r.category).map((x) => { const c = coding(x); return { condition_id: id, code: c.code, system: c.system, display: c.display } }))
  await insertMany(env, 'condition_stage',    arr(r.stage).map((x) => { const s = asObj(x); const sc = coding(s.summary); const tc = coding(s.type); return { condition_id: id, summary_code: sc.code, summary_display: sc.display, type_code: tc.code, type_display: tc.display } }))
}

// ─── Observation ──────────────────────────────────────────────────────────────

async function mapObservation(env: EpicEnv, r: R, src = 'epic') {
  const id = fhirDbId(src, r); if (!id) return
  const meta = asObj(r.meta); const code = coding(r.code)
  const vq = asObj((r as R).valueQuantity); const vc = coding((r as R).valueCodeableConcept)
  const dar = coding(r.dataAbsentReason); const interp = coding(arr(r.interpretation)[0])
  const per = asObj(r.effectivePeriod); const bs = coding(r.bodySite)
  await upsert(env, 'observation', {
    id, resource: r, source: src,
    status: str(r.status), subject_patient_id: nsRef(src,r.subject), encounter_id: nsRef(src,r.encounter),
    effective_datetime: dt((r as R).effectiveDateTime),
    effective_period_start: dt(per.start), effective_period_end: dt(per.end),
    issued: dt(r.issued),
    code_code: code.code, code_system: code.system, code_display: code.display, code_text: code.text,
    value_quantity_value: num(vq.value), value_quantity_unit: str(vq.unit), value_quantity_system: str(vq.system), value_quantity_code: str(vq.code),
    value_codeable_code: vc.code, value_codeable_system: vc.system, value_codeable_display: vc.display, value_codeable_text: vc.text,
    value_string: str((r as R).valueString), value_boolean: bool((r as R).valueBoolean), value_datetime: dt((r as R).valueDateTime),
    data_absent_reason_code: dar.code, data_absent_reason_display: dar.display,
    interpretation_code: interp.code, interpretation_display: interp.display,
    body_site_code: bs.code, body_site_display: bs.display,
    last_updated: dt(meta.lastUpdated),
  })
  await deleteChildren(env, 'observation_category',        'observation_id', id)
  await deleteChildren(env, 'observation_component',       'observation_id', id)
  await deleteChildren(env, 'observation_reference_range', 'observation_id', id)
  await insertMany(env, 'observation_category', arr(r.category).map((x) => { const c = coding(x); return { observation_id: id, code: c.code, system: c.system, display: c.display } }))
  await insertMany(env, 'observation_component', arr(r.component).map((x) => {
    const c = asObj(x); const cc = coding(c.code); const cvq = asObj((c as R).valueQuantity); const cvc = coding((c as R).valueCodeableConcept)
    return { observation_id: id, code_code: cc.code, code_system: cc.system, code_display: cc.display, code_text: cc.text, value_quantity_value: num(cvq.value), value_quantity_unit: str(cvq.unit), value_quantity_system: str(cvq.system), value_quantity_code: str(cvq.code), value_codeable_code: cvc.code, value_codeable_display: cvc.display, value_string: str((c as R).valueString), data_absent_reason_code: coding(c.dataAbsentReason).code }
  }))
  await insertMany(env, 'observation_reference_range', arr(r.referenceRange).map((x) => {
    const rr = asObj(x); const lo = asObj(rr.low); const hi = asObj(rr.high)
    return { observation_id: id, low_value: num(lo.value), low_unit: str(lo.unit), high_value: num(hi.value), high_unit: str(hi.unit), type_code: coding(rr.type).code, type_display: coding(rr.type).display, text: str(rr.text) }
  }))
}

// ─── Medication ───────────────────────────────────────────────────────────────

async function mapMedication(env: EpicEnv, r: R, src = 'epic') {
  const id = fhirDbId(src, r); if (!id) return
  const meta = asObj(r.meta); const code = coding(r.code); const form = coding(r.form)
  await upsert(env, 'medication', { id, resource: r, source: src, status: str(r.status), code_code: code.code, code_system: code.system, code_display: code.display, code_text: code.text, manufacturer_org_id: nsRef(src,r.manufacturer), form_code: form.code, form_display: form.display, last_updated: dt(meta.lastUpdated) })
  await deleteChildren(env, 'medication_ingredient', 'medication_id', id)
  await insertMany(env, 'medication_ingredient', arr(r.ingredient).map((x) => {
    const i = asObj(x); const ic = coding(i.itemCodeableConcept); const ratio = asObj(i.strength); const num_ = asObj(ratio.numerator); const den = asObj(ratio.denominator)
    return { medication_id: id, item_code: ic.code, item_system: ic.system, item_display: ic.display, item_reference_id: nsRef(src,i.itemReference), is_active: bool(i.isActive), strength_numerator_value: num(num_.value), strength_numerator_unit: str(num_.unit), strength_denominator_value: num(den.value), strength_denominator_unit: str(den.unit) }
  }))
}

// ─── MedicationRequest ────────────────────────────────────────────────────────

async function mapMedicationRequest(env: EpicEnv, r: R, src = 'epic') {
  const id = fhirDbId(src, r); if (!id) return
  const meta = asObj(r.meta)
  const medCC = coding((r as R).medicationCodeableConcept)
  await upsert(env, 'medicationrequest', {
    id, resource: r, source: src,
    status: str(r.status), intent: str(r.intent),
    subject_patient_id: nsRef(src,r.subject), encounter_id: nsRef(src,r.encounter),
    authored_on: dt(r.authoredOn), requester_practitioner_id: nsRef(src,r.requester),
    reported_boolean: bool((r as R).reportedBoolean), reported_reference: nsRef(src,(r as R).reportedReference),
    medication_code: medCC.code, medication_system: medCC.system, medication_display: medCC.display, medication_text: medCC.text,
    medication_reference_id: nsRef(src,(r as R).medicationReference),
    do_not_perform: bool(r.doNotPerform), priority: str(r.priority),
    last_updated: dt(meta.lastUpdated),
  })
  await deleteChildren(env, 'medicationrequest_dosage', 'medicationrequest_id', id)
  await deleteChildren(env, 'medicationrequest_reason', 'medicationrequest_id', id)
  await insertMany(env, 'medicationrequest_dosage', arr(r.dosageInstruction).map((x) => {
    const d = asObj(x); const timing = asObj(d.timing); const route = coding(d.route); const site = coding(d.site)
    const dar0 = asObj(arr(d.doseAndRate)[0]); const doseRange = asObj(dar0.doseRange); const doseQty = asObj(dar0.doseQuantity)
    return { medicationrequest_id: id, sequence: num(d.sequence), text: str(d.text), timing_text: str(timing.text), as_needed_boolean: bool(d.asNeededBoolean), route_code: route.code, route_system: route.system, route_display: route.display, site_code: site.code, site_display: site.display, dose_value: num(doseQty.value), dose_unit: str(doseQty.unit), dose_low_value: num(asObj(doseRange.low).value), dose_high_value: num(asObj(doseRange.high).value) }
  }))
  await insertMany(env, 'medicationrequest_reason', arr(r.reasonCode).map((x) => { const c = coding(x); return { medicationrequest_id: id, code: c.code, system: c.system, display: c.display } }))
}

// ─── MedicationDispense ───────────────────────────────────────────────────────

async function mapMedicationDispense(env: EpicEnv, r: R, src = 'epic') {
  const id = fhirDbId(src, r); if (!id) return
  const meta = asObj(r.meta); const medCC = coding((r as R).medicationCodeableConcept)
  const type = coding(r.type); const qty = asObj(r.quantity); const ds = asObj(r.daysSupply)
  await upsert(env, 'medicationdispense', { id, resource: r, source: src, status: str(r.status), subject_patient_id: nsRef(src,r.subject), context_encounter_id: nsRef(src,r.context), medication_code: medCC.code, medication_system: medCC.system, medication_display: medCC.display, medication_reference_id: nsRef(src,(r as R).medicationReference), type_code: type.code, type_display: type.display, quantity_value: num(qty.value), quantity_unit: str(qty.unit), days_supply_value: num(ds.value), when_prepared: dt(r.whenPrepared), when_handed_over: dt(r.whenHandedOver), last_updated: dt(meta.lastUpdated) })
}

// ─── AllergyIntolerance ───────────────────────────────────────────────────────

async function mapAllergyIntolerance(env: EpicEnv, r: R, src = 'epic') {
  const id = fhirDbId(src, r); if (!id) return
  const meta = asObj(r.meta)
  const cs = coding(r.clinicalStatus); const vs = coding(r.verificationStatus); const code = coding(r.code)
  await upsert(env, 'allergyintolerance', {
    id, resource: r, source: src,
    clinical_status_code: cs.code, clinical_status_system: cs.system,
    verification_status_code: vs.code, verification_status_system: vs.system,
    type: str(r.type), category: arr(r.category) as string[], criticality: str(r.criticality),
    patient_id: nsRef(src,r.patient), encounter_id: nsRef(src,r.encounter),
    code_code: code.code, code_system: code.system, code_display: code.display, code_text: code.text,
    onset_datetime: dt((r as R).onsetDateTime), recorded_date: dt(r.recordedDate),
    recorder_practitioner_id: nsRef(src,r.recorder), asserter_practitioner_id: nsRef(src,r.asserter),
    last_updated: dt(meta.lastUpdated),
  })
  await deleteChildren(env, 'allergyintolerance_reaction', 'allergyintolerance_id', id)
  await insertMany(env, 'allergyintolerance_reaction', arr(r.reaction).map((x) => {
    const rx = asObj(x); const sub = coding(rx.substance); const er = coding(rx.exposureRoute)
    const mani = coding(arr(rx.manifestation)[0])
    return { allergyintolerance_id: id, substance_code: sub.code, substance_system: sub.system, substance_display: sub.display, manifestation_code: mani.code, manifestation_system: mani.system, manifestation_display: mani.display, manifestation_text: mani.text, severity: str(rx.severity), onset: dt(rx.onset), description: str(rx.description), exposure_route_code: er.code, exposure_route_display: er.display }
  }))
}

// ─── Immunization ─────────────────────────────────────────────────────────────

async function mapImmunization(env: EpicEnv, r: R, src = 'epic') {
  const id = fhirDbId(src, r); if (!id) return
  const meta = asObj(r.meta); const vaccine = coding(r.vaccineCode)
  const sr = coding(r.statusReason); const site = coding(r.site); const route = coding(r.route); const dq = asObj(r.doseQuantity)
  await upsert(env, 'immunization', { id, resource: r, source: src, status: str(r.status), status_reason_code: sr.code, status_reason_display: sr.display, vaccine_code: vaccine.code, vaccine_system: vaccine.system, vaccine_display: vaccine.display, vaccine_text: vaccine.text, patient_id: nsRef(src,r.patient), encounter_id: nsRef(src,r.encounter), occurrence_datetime: dt((r as R).occurrenceDateTime), occurrence_string: str((r as R).occurrenceString), recorded: dt(r.recorded), primary_source: bool(r.primarySource), manufacturer_org_id: nsRef(src,r.manufacturer), lot_number: str(r.lotNumber), expiration_date: dateOnly(r.expirationDate), site_code: site.code, site_display: site.display, route_code: route.code, route_display: route.display, dose_quantity_value: num(dq.value), dose_quantity_unit: str(dq.unit), is_subpotent: bool(r.isSubpotent), last_updated: dt(meta.lastUpdated) })
  await deleteChildren(env, 'immunization_performer', 'immunization_id', id)
  await deleteChildren(env, 'immunization_reaction',  'immunization_id', id)
  await insertMany(env, 'immunization_performer', arr(r.performer).map((x) => { const p = asObj(x); const fc = coding(p.function); return { immunization_id: id, function_code: fc.code, function_display: fc.display, actor_practitioner_id: nsRef(src,p.actor) } }))
  await insertMany(env, 'immunization_reaction',  arr(r.reaction).map((x) => { const rx = asObj(x); return { immunization_id: id, date: dt(rx.date), detail_obs_id: nsRef(src,rx.detail), reported: bool(rx.reported) } }))
}

// ─── Procedure ────────────────────────────────────────────────────────────────

async function mapProcedure(env: EpicEnv, r: R, src = 'epic') {
  const id = fhirDbId(src, r); if (!id) return
  const meta = asObj(r.meta); const code = coding(r.code); const outcome = coding(r.outcome)
  const pp = asObj(r.performedPeriod)
  await upsert(env, 'procedure', { id, resource: r, source: src, status: str(r.status), subject_patient_id: nsRef(src,r.subject), encounter_id: nsRef(src,r.encounter), code_code: code.code, code_system: code.system, code_display: code.display, code_text: code.text, performed_datetime: dt((r as R).performedDateTime), performed_period_start: dt(pp.start), performed_period_end: dt(pp.end), performed_string: str((r as R).performedString), outcome_code: outcome.code, outcome_display: outcome.display, last_updated: dt(meta.lastUpdated) })
  await deleteChildren(env, 'procedure_category',    'procedure_id', id)
  await deleteChildren(env, 'procedure_reason_code', 'procedure_id', id)
  await deleteChildren(env, 'procedure_performer',   'procedure_id', id)
  await insertMany(env, 'procedure_category',    arr(r.category ? [r.category] : []).map((x) => { const c = coding(x); return { procedure_id: id, code: c.code, system: c.system, display: c.display } }))
  await insertMany(env, 'procedure_reason_code', arr(r.reasonCode).map((x) => { const c = coding(x); return { procedure_id: id, code: c.code, system: c.system, display: c.display } }))
  await insertMany(env, 'procedure_performer',   arr(r.performer).map((x) => { const p = asObj(x); const fc = coding(p.function); return { procedure_id: id, function_code: fc.code, function_display: fc.display, actor_practitioner_id: nsRef(src,p.actor), on_behalf_of_org_id: nsRef(src,p.onBehalfOf) } }))
}

// ─── DiagnosticReport ─────────────────────────────────────────────────────────

async function mapDiagnosticReport(env: EpicEnv, r: R, src = 'epic') {
  const id = fhirDbId(src, r); if (!id) return
  const meta = asObj(r.meta); const code = coding(r.code)
  const concl = coding(arr(r.conclusionCode)[0]); const ep = asObj(r.effectivePeriod)
  await upsert(env, 'diagnosticreport', { id, resource: r, source: src, status: str(r.status), subject_patient_id: nsRef(src,r.subject), encounter_id: nsRef(src,r.encounter), effective_datetime: dt((r as R).effectiveDateTime), effective_period_start: dt(ep.start), effective_period_end: dt(ep.end), issued: dt(r.issued), code_code: code.code, code_system: code.system, code_display: code.display, code_text: code.text, conclusion: str(r.conclusion), conclusion_code: concl.code, conclusion_system: concl.system, conclusion_display: concl.display, last_updated: dt(meta.lastUpdated) })
  await deleteChildren(env, 'diagnosticreport_category',       'diagnosticreport_id', id)
  await deleteChildren(env, 'diagnosticreport_result',         'diagnosticreport_id', id)
  await deleteChildren(env, 'diagnosticreport_performer',      'diagnosticreport_id', id)
  await deleteChildren(env, 'diagnosticreport_presented_form', 'diagnosticreport_id', id)
  await insertMany(env, 'diagnosticreport_category',  arr(r.category).map((x) => { const c = coding(x); return { diagnosticreport_id: id, code: c.code, system: c.system, display: c.display } }))
  await insertMany(env, 'diagnosticreport_result',    arr(r.result).map((x) => ({ diagnosticreport_id: id, observation_id: nsRef(src,x) })))
  await insertMany(env, 'diagnosticreport_performer', arr(r.performer).map((x) => ({ diagnosticreport_id: id, practitioner_id: nsRef(src,x) })))
  await insertMany(env, 'diagnosticreport_presented_form', arr(r.presentedForm).map((x) => { const a = asObj(x); return { diagnosticreport_id: id, content_type: str(a.contentType), url: str(a.url), title: str(a.title), data: str(a.data) } }))
}

// ─── DocumentReference ────────────────────────────────────────────────────────

async function mapDocumentReference(env: EpicEnv, r: R, src = 'epic') {
  const id = fhirDbId(src, r); if (!id) return
  const meta = asObj(r.meta); const type = coding(r.type)
  await upsert(env, 'documentreference', { id, resource: r, source: src, status: str(r.status), doc_status: str(r.docStatus), type_code: type.code, type_system: type.system, type_display: type.display, type_text: type.text, subject_patient_id: nsRef(src,r.subject), date: dt(r.date), description: str(r.description), custodian_org_id: nsRef(src,r.custodian), last_updated: dt(meta.lastUpdated) })
  await deleteChildren(env, 'documentreference_category', 'documentreference_id', id)
  await deleteChildren(env, 'documentreference_author',   'documentreference_id', id)
  await deleteChildren(env, 'documentreference_content',  'documentreference_id', id)
  await deleteChildren(env, 'documentreference_context',  'documentreference_id', id)
  await insertMany(env, 'documentreference_category', arr(r.category).map((x) => { const c = coding(x); return { documentreference_id: id, code: c.code, system: c.system, display: c.display } }))
  await insertMany(env, 'documentreference_author',   arr(r.author).map((x) => ({ documentreference_id: id, practitioner_id: nsRef(src,x) })))
  await insertMany(env, 'documentreference_content',  arr(r.content).map((x) => { const c = asObj(x); const att = asObj(c.attachment); const fmt = coding(c.format); return { documentreference_id: id, content_type: str(att.contentType), url: str(att.url), data: str(att.data), format_code: fmt.code, format_system: fmt.system, format_display: fmt.display, title: str(att.title) } }))
  const ctx = asObj(r.context); const ctxP = asObj(ctx.period)
  if (ctx.encounter || ctx.period) {
    await insertMany(env, 'documentreference_context', [{ documentreference_id: id, encounter_id: nsRef(src,arr(ctx.encounter)[0]), period_start: dt(ctxP.start), period_end: dt(ctxP.end), facility_type_code: coding(ctx.facilityType).code, practice_setting_code: coding(ctx.practiceSetting).code }])
  }
}

// ─── CarePlan ─────────────────────────────────────────────────────────────────

async function mapCarePlan(env: EpicEnv, r: R, src = 'epic') {
  const id = fhirDbId(src, r); if (!id) return
  const meta = asObj(r.meta); const per = asObj(r.period)
  await upsert(env, 'careplan', { id, resource: r, source: src, status: str(r.status), intent: str(r.intent), title: str(r.title), description: str(r.description), subject_patient_id: nsRef(src,r.subject), encounter_id: nsRef(src,r.encounter), period_start: dt(per.start), period_end: dt(per.end), created: dt(r.created), last_updated: dt(meta.lastUpdated) })
  await deleteChildren(env, 'careplan_category',  'careplan_id', id)
  await deleteChildren(env, 'careplan_addresses', 'careplan_id', id)
  await deleteChildren(env, 'careplan_activity',  'careplan_id', id)
  await insertMany(env, 'careplan_category',  arr(r.category).map((x) => { const c = coding(x); return { careplan_id: id, code: c.code, system: c.system, display: c.display } }))
  await insertMany(env, 'careplan_addresses', arr(r.addresses).map((x) => ({ careplan_id: id, condition_id: nsRef(src,x) })))
  await insertMany(env, 'careplan_activity',  arr(r.activity).map((x) => { const a = asObj(x); const d = asObj(a.detail); const dc = coding(d.code); return { careplan_id: id, detail_kind: str(d.kind), detail_status: str(d.status), detail_code_code: dc.code, detail_code_display: dc.display, detail_description: str(d.description) } }))
}

// ─── CareTeam ─────────────────────────────────────────────────────────────────

async function mapCareTeam(env: EpicEnv, r: R, src = 'epic') {
  const id = fhirDbId(src, r); if (!id) return
  const meta = asObj(r.meta); const per = asObj(r.period)
  await upsert(env, 'careteam', { id, resource: r, source: src, status: str(r.status), name: str(r.name), subject_patient_id: nsRef(src,r.subject), encounter_id: nsRef(src,r.encounter), period_start: dt(per.start), period_end: dt(per.end), last_updated: dt(meta.lastUpdated) })
  await deleteChildren(env, 'careteam_participant', 'careteam_id', id)
  await insertMany(env, 'careteam_participant', arr(r.participant).map((x) => {
    const p = asObj(x); const rc = coding(arr(p.role)[0]); const pp = asObj(p.period)
    return { careteam_id: id, role_code: rc.code, role_system: rc.system, role_display: rc.display, member_practitioner_id: nsRef(src,p.member), on_behalf_of_org_id: nsRef(src,p.onBehalfOf), period_start: dt(pp.start), period_end: dt(pp.end) }
  }))
}

// ─── Goal ─────────────────────────────────────────────────────────────────────

async function mapGoal(env: EpicEnv, r: R, src = 'epic') {
  const id = fhirDbId(src, r); if (!id) return
  const meta = asObj(r.meta); const ach = coding(r.achievementStatus); const desc = coding(r.description)
  const start = asObj(r.startCodeableConcept)
  await upsert(env, 'goal', { id, resource: r, source: src, lifecycle_status: str(r.lifecycleStatus), achievement_code: ach.code, achievement_display: ach.display, subject_patient_id: nsRef(src,r.subject), start_date: dateOnly((r as R).startDate), start_code: coding(start).code, status_date: dateOnly(r.statusDate), status_reason: str(r.statusReason), description_code: desc.code, description_system: desc.system, description_display: desc.display, description_text: desc.text, last_updated: dt(meta.lastUpdated) })
  await deleteChildren(env, 'goal_target',    'goal_id', id)
  await deleteChildren(env, 'goal_addresses', 'goal_id', id)
  await insertMany(env, 'goal_target',    arr(r.target).map((x) => { const t = asObj(x); const mc = coding(t.measure); const dq = asObj((t as R).detailQuantity); const dc = coding((t as R).detailCodeableConcept); return { goal_id: id, measure_code: mc.code, measure_system: mc.system, measure_display: mc.display, detail_quantity_value: num(dq.value), detail_quantity_unit: str(dq.unit), detail_code: dc.code, detail_display: dc.display, detail_string: str((t as R).detailString), due_date: dateOnly((t as R).dueDate) } }))
  await insertMany(env, 'goal_addresses', arr(r.addresses).map((x) => ({ goal_id: id, condition_id: nsRef(src,x) })))
}

// ─── Coverage ─────────────────────────────────────────────────────────────────

async function mapCoverage(env: EpicEnv, r: R, src = 'epic') {
  const id = fhirDbId(src, r); if (!id) return
  const meta = asObj(r.meta); const rel = coding(r.relationship); const per = asObj(r.period)
  await upsert(env, 'coverage', { id, resource: r, source: src, status: str(r.status), subscriber_id: str(r.subscriberId), beneficiary_patient_id: nsRef(src,r.beneficiary), dependent: str(r.dependent), relationship_code: rel.code, relationship_display: rel.display, period_start: dateOnly(per.start), period_end: dateOnly(per.end), payor_org_id: nsRef(src,arr(r.payor)[0]), order_int: num(r.order), last_updated: dt(meta.lastUpdated) })
  await deleteChildren(env, 'coverage_class', 'coverage_id', id)
  await insertMany(env, 'coverage_class', arr(r.class).map((x) => { const c = asObj(x); const tc = coding(c.type); return { coverage_id: id, type_code: tc.code, type_system: tc.system, type_display: tc.display, value: str(c.value), name: str(c.name) } }))
}

// ─── Device ───────────────────────────────────────────────────────────────────

async function mapDevice(env: EpicEnv, r: R, src = 'epic') {
  const id = fhirDbId(src, r); if (!id) return
  const meta = asObj(r.meta); const type = coding(r.type)
  await upsert(env, 'device', { id, resource: r, source: src, patient_id: nsRef(src,r.patient), status: str(r.status), distinct_identifier: str(r.distinctIdentifier), manufacturer: str(r.manufacturer), manufacture_date: dt(r.manufactureDate), expiration_date: dt(r.expirationDate), lot_number: str(r.lotNumber), serial_number: str(r.serialNumber), type_code: type.code, type_system: type.system, type_display: type.display, owner_org_id: nsRef(src,r.owner), location_id: nsRef(src,r.location), last_updated: dt(meta.lastUpdated) })
  await deleteChildren(env, 'device_udi_carrier', 'device_id', id)
  await insertMany(env, 'device_udi_carrier', arr(r.udiCarrier).map((x) => { const u = asObj(x); return { device_id: id, device_identifier: str(u.deviceIdentifier), issuer: str(u.issuer), jurisdiction: str(u.jurisdiction), carrier_hrf: str(u.carrierHRF), carrier_aidc: str(u.carrierAIDC), entry_type: str(u.entryType) } }))
}

// ─── ServiceRequest ───────────────────────────────────────────────────────────

async function mapServiceRequest(env: EpicEnv, r: R, src = 'epic') {
  const id = fhirDbId(src, r); if (!id) return
  const meta = asObj(r.meta); const code = coding(r.code); const op = asObj(r.occurrencePeriod)
  await upsert(env, 'servicerequest', { id, resource: r, source: src, status: str(r.status), intent: str(r.intent), priority: str(r.priority), do_not_perform: bool(r.doNotPerform), subject_patient_id: nsRef(src,r.subject), encounter_id: nsRef(src,r.encounter), code_code: code.code, code_system: code.system, code_display: code.display, code_text: code.text, occurrence_datetime: dt((r as R).occurrenceDateTime), occurrence_period_start: dt(op.start), occurrence_period_end: dt(op.end), authored_on: dt(r.authoredOn), requester_practitioner_id: nsRef(src,r.requester), last_updated: dt(meta.lastUpdated) })
  await deleteChildren(env, 'servicerequest_category',    'servicerequest_id', id)
  await deleteChildren(env, 'servicerequest_reason_code', 'servicerequest_id', id)
  await insertMany(env, 'servicerequest_category',    arr(r.category).map((x) => { const c = coding(x); return { servicerequest_id: id, code: c.code, system: c.system, display: c.display } }))
  await insertMany(env, 'servicerequest_reason_code', arr(r.reasonCode).map((x) => { const c = coding(x); return { servicerequest_id: id, code: c.code, system: c.system, display: c.display } }))
}

// ─── Specimen ─────────────────────────────────────────────────────────────────

async function mapSpecimen(env: EpicEnv, r: R, src = 'epic') {
  const id = fhirDbId(src, r); if (!id) return
  const meta = asObj(r.meta); const type = coding(r.type); const col = asObj(r.collection); const cp = asObj(col.collectedPeriod)
  await upsert(env, 'specimen', { id, resource: r, source: src, status: str(r.status), type_code: type.code, type_system: type.system, type_display: type.display, subject_patient_id: nsRef(src,r.subject), received_time: dt(r.receivedTime), collected_datetime: dt((col as R).collectedDateTime), collected_period_start: dt(cp.start), collected_period_end: dt(cp.end), collector_practitioner_id: nsRef(src,col.collector), last_updated: dt(meta.lastUpdated) })
  await deleteChildren(env, 'specimen_container', 'specimen_id', id)
  await insertMany(env, 'specimen_container', arr(r.container).map((x) => { const c = asObj(x); const ct = coding(c.type); const cap = asObj(c.capacity); const sq = asObj(c.specimenQuantity); const add = coding(c.additiveCodeableConcept); return { specimen_id: id, type_code: ct.code, type_display: ct.display, capacity_value: num(cap.value), capacity_unit: str(cap.unit), specimen_quantity_value: num(sq.value), specimen_quantity_unit: str(sq.unit), additive_code: add.code, additive_display: add.display } }))
}

// ─── Provenance ───────────────────────────────────────────────────────────────

async function mapProvenance(env: EpicEnv, r: R, src = 'epic') {
  const id = fhirDbId(src, r); if (!id) return
  const meta = asObj(r.meta)
  await upsert(env, 'provenance', { id, resource: r, source: src, target_first: str(asObj(arr(r.target)[0]).reference), recorded: dt(r.recorded), occurred_datetime: dt((r as R).occurredDateTime), last_updated: dt(meta.lastUpdated) })
  await deleteChildren(env, 'provenance_target', 'provenance_id', id)
  await deleteChildren(env, 'provenance_agent',  'provenance_id', id)
  await deleteChildren(env, 'provenance_entity', 'provenance_id', id)
  await insertMany(env, 'provenance_target', arr(r.target).map((x) => ({ provenance_id: id, reference: str(asObj(x).reference) })))
  await insertMany(env, 'provenance_agent',  arr(r.agent).map((x) => { const a = asObj(x); const tc = coding(arr(a.type)[0]); const rc = coding(arr(a.role)[0]); return { provenance_id: id, type_code: tc.code, type_display: tc.display, role_code: rc.code, role_display: rc.display, who_practitioner_id: nsRef(src,a.who), on_behalf_of_org_id: nsRef(src,a.onBehalfOf) } }))
  await insertMany(env, 'provenance_entity', arr(r.entity).map((x) => { const e = asObj(x); return { provenance_id: id, role: str(e.role), what_reference: str(asObj(e.what).reference) } }))
}

// ─── QuestionnaireResponse ────────────────────────────────────────────────────

async function mapQuestionnaireResponse(env: EpicEnv, r: R, src = 'epic', defaultPatientId?: string | null) {
  const id = fhirDbId(src, r); if (!id) return
  const meta = asObj(r.meta)
  await upsert(env, 'questionnaireresponse', {
    id, resource: r, source: src,
    questionnaire: str(r.questionnaire), status: str(r.status),
    subject_patient_id: nsRef(src,r.subject) ?? defaultPatientId,
    encounter_id: nsRef(src,r.encounter), authored: dt(r.authored),
    last_updated: dt(meta.lastUpdated),
  })
}
