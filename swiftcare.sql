-- =============================================================================
-- SwiftCare App Schema (Supabase / Postgres)
-- Run AFTER fhir.sql — the interop_patient_list view depends on fhir.sql tables.
-- Contains: OAuth sessions, one-time claim codes, Synthea↔FHIR link,
--   fetch log, and the interop patient list view for the desktop Interop tab.
-- Safe to re-run (CREATE TABLE IF NOT EXISTS / CREATE OR REPLACE).
-- =============================================================================

create extension if not exists pgcrypto;

-- ─── OAUTH SESSIONS ───────────────────────────────────────────────────────────
-- Written/read exclusively by the Cloudflare Worker (service_role key).
-- Covers both standalone and EHR-launch flows.
create table if not exists epic_oauth_sessions (
  id              text primary key,           -- opaque sessionId returned to the client
  launch_kind     text not null default 'standalone'
                  check (launch_kind in ('standalone', 'ehr')),
  status          text not null default 'pending'
                  check (status in ('pending', 'connected', 'error')),
  fhir_base       text not null,              -- FHIR R4 base URL from discovery or iss
  state           text,                       -- HMAC-signed CSRF state (sessionId only; verifier stays here)
  code_verifier   text,                       -- PKCE verifier (server-side only; cleared after token exchange)
  access_token    text,
  refresh_token   text,
  token_type      text,
  scope           text,
  patient_fhir_id text,                        -- set on EHR launch (patient already in context)
  expires_at      timestamptz,
  error           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_epic_sessions_status on epic_oauth_sessions(status);
create index if not exists idx_epic_sessions_patient on epic_oauth_sessions(patient_fhir_id);

-- ─── ONE-TIME CLAIM CODES ─────────────────────────────────────────────────────
-- Short-lived codes carried in the swiftcare:// deep link.
-- The desktop exchanges the code for { sessionId, patientFhirId } and it is marked used.
create table if not exists epic_claim_codes (
  code        text primary key,
  session_id  text not null references epic_oauth_sessions(id) on delete cascade,
  used        boolean not null default false,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_epic_claim_session on epic_claim_codes(session_id);

-- ─── SYNTHEA ↔ FHIR LINK ──────────────────────────────────────────────────────
-- Optional: links a local Synthea ptnum to a FHIR Patient id retrieved from Epic.
-- Useful when the same individual exists in both the Synthea dataset and Epic.
create table if not exists synthea_epic_link (
  id              bigint generated always as identity primary key,
  ptnum           text not null,              -- Synthea patient number
  patient_fhir_id text not null,             -- soft ref to fhir.patient(id)
  linked_by       text,                       -- who created the link (session_id or 'manual')
  linked_at       timestamptz not null default now(),
  unique (ptnum, patient_fhir_id)
);
create index if not exists idx_synthea_link_ptnum  on synthea_epic_link(ptnum);
create index if not exists idx_synthea_link_fhirid on synthea_epic_link(patient_fhir_id);

-- ─── FETCH LOG ────────────────────────────────────────────────────────────────
-- Audit trail of FHIR requests made via the Worker proxy.
create table if not exists epic_fetch_log (
  id            bigint generated always as identity primary key,
  session_id    text references epic_oauth_sessions(id) on delete set null,
  resource_type text,
  query         text,
  http_status   int,
  count         int,
  error_detail  text,
  fetched_at    timestamptz not null default now()
);
create index if not exists idx_fetch_log_session on epic_fetch_log(session_id);

-- ─── SESSION → PATIENT LINK ───────────────────────────────────────────────────
-- Junction table that scopes patient access to the session that fetched them.
-- Prevents any connected session from reading PHI fetched by a different session/org.
-- Populated by the Worker whenever a Patient resource is persisted via the FHIR proxy.
--
-- Migration: earlier versions used patient_fhir_id (raw FHIR id).
-- The column is now patient_db_id (namespaced: "source|raw_fhir_id") so the
-- key stays correct even when two FHIR servers issue the same raw resource id.
-- This block handles both fresh installs and upgrades.
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'session_patient' and column_name = 'patient_fhir_id'
  ) then
    -- Old rows store raw FHIR IDs which can no longer match the namespaced patient.id.
    -- Clear them; the Worker repopulates correctly on the next patient fetch.
    delete from session_patient;
    alter table session_patient rename column patient_fhir_id to patient_db_id;
  end if;
end $$;

create table if not exists session_patient (
  session_id      text not null references epic_oauth_sessions(id) on delete cascade,
  patient_db_id   text not null,   -- "source|raw_fhir_id" — matches patient(id) exactly
  linked_at       timestamptz not null default now(),
  primary key (session_id, patient_db_id)
);
create index if not exists idx_session_patient_dbid on session_patient(patient_db_id);

-- ─── INTEROP PATIENT LIST VIEW ────────────────────────────────────────────────
-- Powers the desktop Interop tab's patient list from persisted Epic patients.
-- The source filter is removed: source now stores the FHIR server URL (not the
-- literal 'epic'), so filtering on source would break. All patients in this
-- schema are from Epic by construction.
-- Caller (Worker handlePatientList) joins this view against session_patient to
-- return only the patients that belong to the requesting session.
drop view if exists interop_patient_list;
create view interop_patient_list as
select
  -- db_id: the namespaced PK used for session_patient joins and WHERE filtering
  p.id                   as db_id,
  -- patient_fhir_id: raw Epic resource id for FHIR API calls from the desktop
  p.resource->>'id'      as patient_fhir_id,
  p.source,
  p.gender,
  p.birth_date,
  coalesce(
    n.text,
    trim(concat_ws(' ', array_to_string(n.given, ' '), n.family))
  )                      as full_name,
  (
    select pi.value
    from   patient_identifier pi
    where  pi.patient_id = p.id
      and  pi.type_code  = 'MR'
    limit  1
  )                      as mrn,
  p.last_updated,
  p.ingested_at
from patient p
left join lateral (
  select * from patient_name pn
  where  pn.patient_id = p.id
  order  by pn.id
  limit  1
) n on true;

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────
-- No anon/authenticated policies: only the Worker's service_role key may read/write.
alter table epic_oauth_sessions enable row level security;
alter table epic_claim_codes    enable row level security;
alter table synthea_epic_link   enable row level security;
alter table epic_fetch_log      enable row level security;
alter table session_patient     enable row level security;

-- ─── TRIGGERS ─────────────────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_epic_sessions_updated on epic_oauth_sessions;
create trigger trg_epic_sessions_updated
  before update on epic_oauth_sessions
  for each row execute function set_updated_at();
