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
  state           text,                       -- HMAC-signed CSRF state (carries PKCE verifier)
  code_verifier   text,                       -- PKCE verifier (transient, cleared after exchange)
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

-- ─── INTEROP PATIENT LIST VIEW ────────────────────────────────────────────────
-- Powers the desktop Interop tab's patient list from persisted Epic patients.
-- Depends on fhir.sql tables: patient, patient_name, patient_identifier.
create or replace view interop_patient_list as
select
  p.id            as patient_fhir_id,
  p.gender,
  p.birth_date,
  coalesce(
    n.text,
    trim(concat_ws(' ', array_to_string(n.given, ' '), n.family))
  )               as full_name,
  (
    select pi.value
    from   patient_identifier pi
    where  pi.patient_id = p.id
      and  pi.type_code  = 'MR'
    limit  1
  )               as mrn,
  p.last_updated,
  p.ingested_at
from patient p
left join lateral (
  select * from patient_name pn
  where  pn.patient_id = p.id
  order  by pn.id
  limit  1
) n on true
where p.source = 'epic';

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────
-- No anon/authenticated policies: only the Worker's service_role key may read/write.
alter table epic_oauth_sessions enable row level security;
alter table epic_claim_codes    enable row level security;
alter table synthea_epic_link   enable row level security;
alter table epic_fetch_log      enable row level security;

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
