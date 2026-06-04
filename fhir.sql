-- =============================================================================
-- SwiftCare FHIR US Core Relational Schema (Supabase / Postgres)
-- Run this file FIRST, then swiftcare.sql.
-- Design: one table per US Core resource, typed Must-Support scalars +
--   child tables for repeating MS elements, verbatim `resource jsonb` always stored.
-- Conventions:
--   • CodeableConcept → <field>_code, _system, _display, _text (primary coding)
--   • Reference(T)    → <field>_<type>_id text (logical id; no cross-resource FK)
--   • Repeating MS    → child table <resource>_<element> with <resource>_id FK
--   • RLS enabled on every table; no anon policies → Worker service_role only
-- Safe to re-run (CREATE TABLE IF NOT EXISTS / CREATE OR REPLACE).
-- =============================================================================

create extension if not exists pgcrypto;

-- ─── PATIENT ─────────────────────────────────────────────────────────────────
create table if not exists patient (
  id                          text primary key,
  resource                    jsonb not null,
  source                      text not null default 'epic',
  active                      boolean,
  gender                      text,
  birth_date                  date,
  deceased_boolean            boolean,
  deceased_datetime           timestamptz,
  marital_status_code         text,
  marital_status_system       text,
  marital_status_display      text,
  race_omb_code               text,
  race_omb_display            text,
  race_text                   text,
  ethnicity_omb_code          text,
  ethnicity_omb_display       text,
  ethnicity_text              text,
  birthsex                    text,
  gender_identity_code        text,
  gender_identity_display     text,
  managing_organization_id    text,
  last_updated                timestamptz,
  ingested_at                 timestamptz not null default now()
);
create index if not exists idx_patient_birth   on patient(birth_date);
create index if not exists idx_patient_res_gin on patient using gin (resource);

create table if not exists patient_identifier (
  id            bigint generated always as identity primary key,
  patient_id    text not null references patient(id) on delete cascade,
  use           text,
  system        text,
  value         text,
  type_code     text,
  type_system   text,
  type_display  text
);
create index if not exists idx_patient_identifier_pid on patient_identifier(patient_id);

create table if not exists patient_name (
  id         bigint generated always as identity primary key,
  patient_id text not null references patient(id) on delete cascade,
  use        text,
  text       text,
  family     text,
  given      text[],
  prefix     text[],
  suffix     text[]
);
create index if not exists idx_patient_name_pid on patient_name(patient_id);

create table if not exists patient_telecom (
  id         bigint generated always as identity primary key,
  patient_id text not null references patient(id) on delete cascade,
  system     text,
  value      text,
  use        text,
  rank       int
);
create index if not exists idx_patient_telecom_pid on patient_telecom(patient_id);

create table if not exists patient_address (
  id           bigint generated always as identity primary key,
  patient_id   text not null references patient(id) on delete cascade,
  use          text,
  type         text,
  text         text,
  line         text[],
  city         text,
  district     text,
  state        text,
  postal_code  text,
  country      text,
  period_start date,
  period_end   date
);
create index if not exists idx_patient_address_pid on patient_address(patient_id);

create table if not exists patient_communication (
  id               bigint generated always as identity primary key,
  patient_id       text not null references patient(id) on delete cascade,
  language_code    text,
  language_system  text,
  language_display text,
  preferred        boolean
);
create index if not exists idx_patient_communication_pid on patient_communication(patient_id);

-- ─── PRACTITIONER ────────────────────────────────────────────────────────────
create table if not exists practitioner (
  id           text primary key,
  resource     jsonb not null,
  source       text not null default 'epic',
  active       boolean,
  gender       text,
  birth_date   date,
  last_updated timestamptz,
  ingested_at  timestamptz not null default now()
);
create index if not exists idx_practitioner_res_gin on practitioner using gin (resource);

create table if not exists practitioner_identifier (
  id              bigint generated always as identity primary key,
  practitioner_id text not null references practitioner(id) on delete cascade,
  use             text,
  system          text,
  value           text,
  type_code       text,
  type_display    text
);
create index if not exists idx_pract_identifier_pid on practitioner_identifier(practitioner_id);

create table if not exists practitioner_name (
  id              bigint generated always as identity primary key,
  practitioner_id text not null references practitioner(id) on delete cascade,
  use             text,
  text            text,
  family          text,
  given           text[],
  prefix          text[],
  suffix          text[]
);
create index if not exists idx_pract_name_pid on practitioner_name(practitioner_id);

create table if not exists practitioner_telecom (
  id              bigint generated always as identity primary key,
  practitioner_id text not null references practitioner(id) on delete cascade,
  system          text,
  value           text,
  use             text
);
create index if not exists idx_pract_telecom_pid on practitioner_telecom(practitioner_id);

create table if not exists practitioner_address (
  id              bigint generated always as identity primary key,
  practitioner_id text not null references practitioner(id) on delete cascade,
  use             text,
  type            text,
  text            text,
  line            text[],
  city            text,
  state           text,
  postal_code     text,
  country         text
);
create index if not exists idx_pract_address_pid on practitioner_address(practitioner_id);

create table if not exists practitioner_qualification (
  id              bigint generated always as identity primary key,
  practitioner_id text not null references practitioner(id) on delete cascade,
  code_code       text,
  code_system     text,
  code_display    text,
  code_text       text,
  period_start    date,
  period_end      date,
  issuer_org_id   text
);
create index if not exists idx_pract_qual_pid on practitioner_qualification(practitioner_id);

-- ─── PRACTITIONERROLE ────────────────────────────────────────────────────────
create table if not exists practitionerrole (
  id              text primary key,
  resource        jsonb not null,
  source          text not null default 'epic',
  active          boolean,
  practitioner_id text,
  organization_id text,
  period_start    timestamptz,
  period_end      timestamptz,
  last_updated    timestamptz,
  ingested_at     timestamptz not null default now()
);
create index if not exists idx_pract_role_pract on practitionerrole(practitioner_id);
create index if not exists idx_pract_role_org   on practitionerrole(organization_id);

create table if not exists practitionerrole_code (
  id                  bigint generated always as identity primary key,
  practitionerrole_id text not null references practitionerrole(id) on delete cascade,
  code                text,
  system              text,
  display             text
);

create table if not exists practitionerrole_specialty (
  id                  bigint generated always as identity primary key,
  practitionerrole_id text not null references practitionerrole(id) on delete cascade,
  code                text,
  system              text,
  display             text
);

create table if not exists practitionerrole_location (
  id                  bigint generated always as identity primary key,
  practitionerrole_id text not null references practitionerrole(id) on delete cascade,
  location_id         text
);

create table if not exists practitionerrole_telecom (
  id                  bigint generated always as identity primary key,
  practitionerrole_id text not null references practitionerrole(id) on delete cascade,
  system              text,
  value               text,
  use                 text
);

-- ─── ORGANIZATION ────────────────────────────────────────────────────────────
create table if not exists organization (
  id           text primary key,
  resource     jsonb not null,
  source       text not null default 'epic',
  active       boolean,
  name         text,
  part_of_id   text,
  last_updated timestamptz,
  ingested_at  timestamptz not null default now()
);
create index if not exists idx_org_res_gin on organization using gin (resource);

create table if not exists organization_identifier (
  id              bigint generated always as identity primary key,
  organization_id text not null references organization(id) on delete cascade,
  use             text,
  system          text,
  value           text,
  type_code       text,
  type_display    text
);

create table if not exists organization_type (
  id              bigint generated always as identity primary key,
  organization_id text not null references organization(id) on delete cascade,
  code            text,
  system          text,
  display         text
);

create table if not exists organization_telecom (
  id              bigint generated always as identity primary key,
  organization_id text not null references organization(id) on delete cascade,
  system          text,
  value           text,
  use             text
);

create table if not exists organization_address (
  id              bigint generated always as identity primary key,
  organization_id text not null references organization(id) on delete cascade,
  use             text,
  type            text,
  text            text,
  line            text[],
  city            text,
  state           text,
  postal_code     text,
  country         text
);

-- ─── LOCATION ─────────────────────────────────────────────────────────────────
create table if not exists location (
  id                       text primary key,
  resource                 jsonb not null,
  source                   text not null default 'epic',
  status                   text,
  name                     text,
  mode                     text,
  managing_organization_id text,
  last_updated             timestamptz,
  ingested_at              timestamptz not null default now()
);
create index if not exists idx_location_org on location(managing_organization_id);

create table if not exists location_type (
  id          bigint generated always as identity primary key,
  location_id text not null references location(id) on delete cascade,
  code        text,
  system      text,
  display     text
);

create table if not exists location_telecom (
  id          bigint generated always as identity primary key,
  location_id text not null references location(id) on delete cascade,
  system      text,
  value       text,
  use         text
);

create table if not exists location_address (
  id          bigint generated always as identity primary key,
  location_id text not null references location(id) on delete cascade,
  use         text,
  type        text,
  text        text,
  line        text[],
  city        text,
  state       text,
  postal_code text,
  country     text
);

-- ─── RELATEDPERSON ────────────────────────────────────────────────────────────
create table if not exists relatedperson (
  id           text primary key,
  resource     jsonb not null,
  source       text not null default 'epic',
  active       boolean,
  patient_id   text,
  gender       text,
  birth_date   date,
  last_updated timestamptz,
  ingested_at  timestamptz not null default now()
);
create index if not exists idx_relatedperson_patient on relatedperson(patient_id);

create table if not exists relatedperson_relationship (
  id               bigint generated always as identity primary key,
  relatedperson_id text not null references relatedperson(id) on delete cascade,
  code             text,
  system           text,
  display          text
);

create table if not exists relatedperson_name (
  id               bigint generated always as identity primary key,
  relatedperson_id text not null references relatedperson(id) on delete cascade,
  use              text,
  text             text,
  family           text,
  given            text[]
);

create table if not exists relatedperson_telecom (
  id               bigint generated always as identity primary key,
  relatedperson_id text not null references relatedperson(id) on delete cascade,
  system           text,
  value            text,
  use              text
);

create table if not exists relatedperson_address (
  id               bigint generated always as identity primary key,
  relatedperson_id text not null references relatedperson(id) on delete cascade,
  use              text,
  line             text[],
  city             text,
  state            text,
  postal_code      text,
  country          text
);

-- ─── ENCOUNTER ────────────────────────────────────────────────────────────────
create table if not exists encounter (
  id                                text primary key,
  resource                          jsonb not null,
  source                            text not null default 'epic',
  status                            text,
  class_code                        text,
  class_system                      text,
  class_display                     text,
  subject_patient_id                text,
  period_start                      timestamptz,
  period_end                        timestamptz,
  service_provider_org_id           text,
  hospitalization_admit_code        text,
  hospitalization_admit_display     text,
  hospitalization_discharge_code    text,
  hospitalization_discharge_display text,
  last_updated                      timestamptz,
  ingested_at                       timestamptz not null default now()
);
create index if not exists idx_encounter_patient on encounter(subject_patient_id);
create index if not exists idx_encounter_period  on encounter(period_start);

create table if not exists encounter_type (
  id           bigint generated always as identity primary key,
  encounter_id text not null references encounter(id) on delete cascade,
  code         text,
  system       text,
  display      text,
  text         text
);

create table if not exists encounter_service_type (
  id           bigint generated always as identity primary key,
  encounter_id text not null references encounter(id) on delete cascade,
  code         text,
  system       text,
  display      text
);

create table if not exists encounter_participant (
  id                         bigint generated always as identity primary key,
  encounter_id               text not null references encounter(id) on delete cascade,
  type_code                  text,
  type_display               text,
  individual_practitioner_id text,
  period_start               timestamptz,
  period_end                 timestamptz
);

create table if not exists encounter_reason (
  id           bigint generated always as identity primary key,
  encounter_id text not null references encounter(id) on delete cascade,
  code         text,
  system       text,
  display      text,
  text         text
);

create table if not exists encounter_diagnosis (
  id           bigint generated always as identity primary key,
  encounter_id text not null references encounter(id) on delete cascade,
  condition_id text,
  use_code     text,
  use_display  text,
  rank         int
);

create table if not exists encounter_location (
  id           bigint generated always as identity primary key,
  encounter_id text not null references encounter(id) on delete cascade,
  location_id  text,
  status       text,
  period_start timestamptz,
  period_end   timestamptz
);

-- ─── CONDITION ────────────────────────────────────────────────────────────────
create table if not exists condition (
  id                         text primary key,
  resource                   jsonb not null,
  source                     text not null default 'epic',
  clinical_status_code       text,
  clinical_status_system     text,
  verification_status_code   text,
  verification_status_system text,
  subject_patient_id         text,
  encounter_id               text,
  code_code                  text,
  code_system                text,
  code_display               text,
  code_text                  text,
  onset_datetime             timestamptz,
  onset_age_value            numeric,
  onset_age_unit             text,
  onset_string               text,
  abatement_datetime         timestamptz,
  abatement_string           text,
  recorded_date              timestamptz,
  recorder_practitioner_id   text,
  asserter_practitioner_id   text,
  last_updated               timestamptz,
  ingested_at                timestamptz not null default now()
);
create index if not exists idx_condition_patient on condition(subject_patient_id);
create index if not exists idx_condition_code    on condition(code_code);
create index if not exists idx_condition_status  on condition(clinical_status_code);

create table if not exists condition_category (
  id           bigint generated always as identity primary key,
  condition_id text not null references condition(id) on delete cascade,
  code         text,
  system       text,
  display      text
);

create table if not exists condition_stage (
  id              bigint generated always as identity primary key,
  condition_id    text not null references condition(id) on delete cascade,
  summary_code    text,
  summary_display text,
  type_code       text,
  type_display    text
);

-- ─── OBSERVATION ──────────────────────────────────────────────────────────────
create table if not exists observation (
  id                         text primary key,
  resource                   jsonb not null,
  source                     text not null default 'epic',
  status                     text,
  subject_patient_id         text,
  encounter_id               text,
  effective_datetime         timestamptz,
  effective_period_start     timestamptz,
  effective_period_end       timestamptz,
  issued                     timestamptz,
  code_code                  text,
  code_system                text,
  code_display               text,
  code_text                  text,
  value_quantity_value       numeric,
  value_quantity_unit        text,
  value_quantity_system      text,
  value_quantity_code        text,
  value_codeable_code        text,
  value_codeable_system      text,
  value_codeable_display     text,
  value_codeable_text        text,
  value_string               text,
  value_boolean              boolean,
  value_datetime             timestamptz,
  data_absent_reason_code    text,
  data_absent_reason_display text,
  interpretation_code        text,
  interpretation_display     text,
  body_site_code             text,
  body_site_display          text,
  last_updated               timestamptz,
  ingested_at                timestamptz not null default now()
);
create index if not exists idx_obs_patient   on observation(subject_patient_id);
create index if not exists idx_obs_code      on observation(code_code);
create index if not exists idx_obs_effective on observation(effective_datetime);

create table if not exists observation_category (
  id             bigint generated always as identity primary key,
  observation_id text not null references observation(id) on delete cascade,
  code           text,
  system         text,
  display        text
);

create table if not exists observation_component (
  id                     bigint generated always as identity primary key,
  observation_id         text not null references observation(id) on delete cascade,
  code_code              text,
  code_system            text,
  code_display           text,
  code_text              text,
  value_quantity_value   numeric,
  value_quantity_unit    text,
  value_quantity_system  text,
  value_quantity_code    text,
  value_codeable_code    text,
  value_codeable_display text,
  value_string           text,
  data_absent_reason_code text
);

create table if not exists observation_reference_range (
  id             bigint generated always as identity primary key,
  observation_id text not null references observation(id) on delete cascade,
  low_value      numeric,
  low_unit       text,
  high_value     numeric,
  high_unit      text,
  type_code      text,
  type_display   text,
  text           text
);

-- ─── MEDICATION ───────────────────────────────────────────────────────────────
create table if not exists medication (
  id                  text primary key,
  resource            jsonb not null,
  source              text not null default 'epic',
  status              text,
  code_code           text,
  code_system         text,
  code_display        text,
  code_text           text,
  manufacturer_org_id text,
  form_code           text,
  form_display        text,
  last_updated        timestamptz,
  ingested_at         timestamptz not null default now()
);
create index if not exists idx_medication_code on medication(code_code);

create table if not exists medication_ingredient (
  id                         bigint generated always as identity primary key,
  medication_id              text not null references medication(id) on delete cascade,
  item_code                  text,
  item_system                text,
  item_display               text,
  item_reference_id          text,
  is_active                  boolean,
  strength_numerator_value   numeric,
  strength_numerator_unit    text,
  strength_denominator_value numeric,
  strength_denominator_unit  text
);

-- ─── MEDICATIONREQUEST ────────────────────────────────────────────────────────
create table if not exists medicationrequest (
  id                        text primary key,
  resource                  jsonb not null,
  source                    text not null default 'epic',
  status                    text,
  intent                    text,
  subject_patient_id        text,
  encounter_id              text,
  authored_on               timestamptz,
  requester_practitioner_id text,
  reported_boolean          boolean,
  reported_reference        text,
  medication_code           text,
  medication_system         text,
  medication_display        text,
  medication_text           text,
  medication_reference_id   text,
  do_not_perform            boolean,
  priority                  text,
  last_updated              timestamptz,
  ingested_at               timestamptz not null default now()
);
create index if not exists idx_medreq_patient on medicationrequest(subject_patient_id);
create index if not exists idx_medreq_code    on medicationrequest(medication_code);

create table if not exists medicationrequest_dosage (
  id                        bigint generated always as identity primary key,
  medicationrequest_id      text not null references medicationrequest(id) on delete cascade,
  sequence                  int,
  text                      text,
  timing_text               text,
  timing_code               text,
  as_needed_boolean         boolean,
  as_needed_code            text,
  site_code                 text,
  site_display              text,
  route_code                text,
  route_system              text,
  route_display             text,
  dose_value                numeric,
  dose_unit                 text,
  dose_low_value            numeric,
  dose_high_value           numeric,
  max_dose_per_period_value numeric,
  max_dose_per_period_unit  text
);

create table if not exists medicationrequest_reason (
  id                   bigint generated always as identity primary key,
  medicationrequest_id text not null references medicationrequest(id) on delete cascade,
  code                 text,
  system               text,
  display              text,
  condition_id         text
);

-- ─── MEDICATIONDISPENSE ───────────────────────────────────────────────────────
create table if not exists medicationdispense (
  id                      text primary key,
  resource                jsonb not null,
  source                  text not null default 'epic',
  status                  text,
  subject_patient_id      text,
  context_encounter_id    text,
  medication_code         text,
  medication_system       text,
  medication_display      text,
  medication_reference_id text,
  type_code               text,
  type_display            text,
  quantity_value          numeric,
  quantity_unit           text,
  days_supply_value       numeric,
  when_prepared           timestamptz,
  when_handed_over        timestamptz,
  last_updated            timestamptz,
  ingested_at             timestamptz not null default now()
);
create index if not exists idx_meddispense_patient on medicationdispense(subject_patient_id);

create table if not exists medicationdispense_performer (
  id                    bigint generated always as identity primary key,
  medicationdispense_id text not null references medicationdispense(id) on delete cascade,
  function_code         text,
  function_display      text,
  actor_practitioner_id text
);

create table if not exists medicationdispense_dosage (
  id                    bigint generated always as identity primary key,
  medicationdispense_id text not null references medicationdispense(id) on delete cascade,
  sequence              int,
  text                  text,
  dose_value            numeric,
  dose_unit             text,
  route_code            text,
  route_display         text
);

-- ─── ALLERGYINTOLERANCE ───────────────────────────────────────────────────────
create table if not exists allergyintolerance (
  id                         text primary key,
  resource                   jsonb not null,
  source                     text not null default 'epic',
  clinical_status_code       text,
  clinical_status_system     text,
  verification_status_code   text,
  verification_status_system text,
  type                       text,
  category                   text[],
  criticality                text,
  patient_id                 text,
  encounter_id               text,
  code_code                  text,
  code_system                text,
  code_display               text,
  code_text                  text,
  onset_datetime             timestamptz,
  recorded_date              timestamptz,
  recorder_practitioner_id   text,
  asserter_practitioner_id   text,
  last_updated               timestamptz,
  ingested_at                timestamptz not null default now()
);
create index if not exists idx_allergy_patient on allergyintolerance(patient_id);
create index if not exists idx_allergy_code    on allergyintolerance(code_code);

create table if not exists allergyintolerance_reaction (
  id                     bigint generated always as identity primary key,
  allergyintolerance_id  text not null references allergyintolerance(id) on delete cascade,
  substance_code         text,
  substance_system       text,
  substance_display      text,
  manifestation_code     text,
  manifestation_system   text,
  manifestation_display  text,
  manifestation_text     text,
  severity               text,
  onset                  timestamptz,
  description            text,
  exposure_route_code    text,
  exposure_route_display text
);

-- ─── IMMUNIZATION ─────────────────────────────────────────────────────────────
create table if not exists immunization (
  id                    text primary key,
  resource              jsonb not null,
  source                text not null default 'epic',
  status                text,
  status_reason_code    text,
  status_reason_display text,
  vaccine_code          text,
  vaccine_system        text,
  vaccine_display       text,
  vaccine_text          text,
  patient_id            text,
  encounter_id          text,
  occurrence_datetime   timestamptz,
  occurrence_string     text,
  recorded              timestamptz,
  primary_source        boolean,
  manufacturer_org_id   text,
  lot_number            text,
  expiration_date       date,
  site_code             text,
  site_display          text,
  route_code            text,
  route_display         text,
  dose_quantity_value   numeric,
  dose_quantity_unit    text,
  is_subpotent          boolean,
  last_updated          timestamptz,
  ingested_at           timestamptz not null default now()
);
create index if not exists idx_immunization_patient on immunization(patient_id);
create index if not exists idx_immunization_vaccine on immunization(vaccine_code);

create table if not exists immunization_performer (
  id                    bigint generated always as identity primary key,
  immunization_id       text not null references immunization(id) on delete cascade,
  function_code         text,
  function_display      text,
  actor_practitioner_id text,
  actor_org_id          text
);

create table if not exists immunization_reaction (
  id              bigint generated always as identity primary key,
  immunization_id text not null references immunization(id) on delete cascade,
  date            timestamptz,
  detail_obs_id   text,
  reported        boolean
);

-- ─── PROCEDURE ────────────────────────────────────────────────────────────────
create table if not exists procedure (
  id                       text primary key,
  resource                 jsonb not null,
  source                   text not null default 'epic',
  status                   text,
  subject_patient_id       text,
  encounter_id             text,
  code_code                text,
  code_system              text,
  code_display             text,
  code_text                text,
  performed_datetime       timestamptz,
  performed_period_start   timestamptz,
  performed_period_end     timestamptz,
  performed_string         text,
  recorder_practitioner_id text,
  asserter_practitioner_id text,
  report_diagnostic_id     text,
  outcome_code             text,
  outcome_display          text,
  last_updated             timestamptz,
  ingested_at              timestamptz not null default now()
);
create index if not exists idx_procedure_patient on procedure(subject_patient_id);
create index if not exists idx_procedure_code    on procedure(code_code);

create table if not exists procedure_category (
  id           bigint generated always as identity primary key,
  procedure_id text not null references procedure(id) on delete cascade,
  code         text,
  system       text,
  display      text
);

create table if not exists procedure_reason_code (
  id           bigint generated always as identity primary key,
  procedure_id text not null references procedure(id) on delete cascade,
  code         text,
  system       text,
  display      text
);

create table if not exists procedure_performer (
  id                    bigint generated always as identity primary key,
  procedure_id          text not null references procedure(id) on delete cascade,
  function_code         text,
  function_display      text,
  actor_practitioner_id text,
  actor_org_id          text,
  on_behalf_of_org_id   text
);

-- ─── DIAGNOSTICREPORT ─────────────────────────────────────────────────────────
create table if not exists diagnosticreport (
  id                     text primary key,
  resource               jsonb not null,
  source                 text not null default 'epic',
  status                 text,
  subject_patient_id     text,
  encounter_id           text,
  effective_datetime     timestamptz,
  effective_period_start timestamptz,
  effective_period_end   timestamptz,
  issued                 timestamptz,
  code_code              text,
  code_system            text,
  code_display           text,
  code_text              text,
  conclusion             text,
  conclusion_code        text,
  conclusion_system      text,
  conclusion_display     text,
  last_updated           timestamptz,
  ingested_at            timestamptz not null default now()
);
create index if not exists idx_diagreport_patient on diagnosticreport(subject_patient_id);
create index if not exists idx_diagreport_code    on diagnosticreport(code_code);

create table if not exists diagnosticreport_category (
  id                  bigint generated always as identity primary key,
  diagnosticreport_id text not null references diagnosticreport(id) on delete cascade,
  code                text,
  system              text,
  display             text
);

create table if not exists diagnosticreport_result (
  id                  bigint generated always as identity primary key,
  diagnosticreport_id text not null references diagnosticreport(id) on delete cascade,
  observation_id      text
);

create table if not exists diagnosticreport_performer (
  id                  bigint generated always as identity primary key,
  diagnosticreport_id text not null references diagnosticreport(id) on delete cascade,
  practitioner_id     text,
  organization_id     text
);

create table if not exists diagnosticreport_presented_form (
  id                  bigint generated always as identity primary key,
  diagnosticreport_id text not null references diagnosticreport(id) on delete cascade,
  content_type        text,
  url                 text,
  title               text,
  data                text
);

-- ─── DOCUMENTREFERENCE ────────────────────────────────────────────────────────
create table if not exists documentreference (
  id                 text primary key,
  resource           jsonb not null,
  source             text not null default 'epic',
  status             text,
  doc_status         text,
  type_code          text,
  type_system        text,
  type_display       text,
  type_text          text,
  subject_patient_id text,
  date               timestamptz,
  description        text,
  custodian_org_id   text,
  last_updated       timestamptz,
  ingested_at        timestamptz not null default now()
);
create index if not exists idx_docref_patient on documentreference(subject_patient_id);

create table if not exists documentreference_category (
  id                   bigint generated always as identity primary key,
  documentreference_id text not null references documentreference(id) on delete cascade,
  code                 text,
  system               text,
  display              text
);

create table if not exists documentreference_author (
  id                   bigint generated always as identity primary key,
  documentreference_id text not null references documentreference(id) on delete cascade,
  practitioner_id      text,
  organization_id      text
);

create table if not exists documentreference_content (
  id                   bigint generated always as identity primary key,
  documentreference_id text not null references documentreference(id) on delete cascade,
  content_type         text,
  url                  text,
  data                 text,
  format_code          text,
  format_system        text,
  format_display       text,
  title                text
);

create table if not exists documentreference_context (
  id                    bigint generated always as identity primary key,
  documentreference_id  text not null references documentreference(id) on delete cascade,
  encounter_id          text,
  period_start          timestamptz,
  period_end            timestamptz,
  event_code            text,
  event_display         text,
  facility_type_code    text,
  practice_setting_code text
);

-- ─── CAREPLAN ─────────────────────────────────────────────────────────────────
create table if not exists careplan (
  id                 text primary key,
  resource           jsonb not null,
  source             text not null default 'epic',
  status             text,
  intent             text,
  title              text,
  description        text,
  subject_patient_id text,
  encounter_id       text,
  period_start       timestamptz,
  period_end         timestamptz,
  created            timestamptz,
  custodian_id       text,
  last_updated       timestamptz,
  ingested_at        timestamptz not null default now()
);
create index if not exists idx_careplan_patient on careplan(subject_patient_id);

create table if not exists careplan_category (
  id          bigint generated always as identity primary key,
  careplan_id text not null references careplan(id) on delete cascade,
  code        text,
  system      text,
  display     text
);

create table if not exists careplan_addresses (
  id           bigint generated always as identity primary key,
  careplan_id  text not null references careplan(id) on delete cascade,
  condition_id text
);

create table if not exists careplan_activity (
  id                  bigint generated always as identity primary key,
  careplan_id         text not null references careplan(id) on delete cascade,
  detail_kind         text,
  detail_status       text,
  detail_code_code    text,
  detail_code_display text,
  detail_description  text
);

-- ─── CARETEAM ─────────────────────────────────────────────────────────────────
create table if not exists careteam (
  id                 text primary key,
  resource           jsonb not null,
  source             text not null default 'epic',
  status             text,
  name               text,
  subject_patient_id text,
  encounter_id       text,
  period_start       timestamptz,
  period_end         timestamptz,
  last_updated       timestamptz,
  ingested_at        timestamptz not null default now()
);
create index if not exists idx_careteam_patient on careteam(subject_patient_id);

create table if not exists careteam_participant (
  id                      bigint generated always as identity primary key,
  careteam_id             text not null references careteam(id) on delete cascade,
  role_code               text,
  role_system             text,
  role_display            text,
  member_practitioner_id  text,
  member_org_id           text,
  member_relatedperson_id text,
  on_behalf_of_org_id     text,
  period_start            timestamptz,
  period_end              timestamptz
);

-- ─── GOAL ─────────────────────────────────────────────────────────────────────
create table if not exists goal (
  id                   text primary key,
  resource             jsonb not null,
  source               text not null default 'epic',
  lifecycle_status     text,
  achievement_code     text,
  achievement_display  text,
  subject_patient_id   text,
  start_date           date,
  start_code           text,
  status_date          date,
  status_reason        text,
  description_code     text,
  description_system   text,
  description_display  text,
  description_text     text,
  expressed_by_id      text,
  last_updated         timestamptz,
  ingested_at          timestamptz not null default now()
);
create index if not exists idx_goal_patient on goal(subject_patient_id);

create table if not exists goal_target (
  id                    bigint generated always as identity primary key,
  goal_id               text not null references goal(id) on delete cascade,
  measure_code          text,
  measure_system        text,
  measure_display       text,
  detail_quantity_value numeric,
  detail_quantity_unit  text,
  detail_code           text,
  detail_display        text,
  detail_string         text,
  due_date              date,
  due_duration_value    numeric,
  due_duration_unit     text
);

create table if not exists goal_addresses (
  id           bigint generated always as identity primary key,
  goal_id      text not null references goal(id) on delete cascade,
  condition_id text
);

-- ─── COVERAGE ─────────────────────────────────────────────────────────────────
create table if not exists coverage (
  id                     text primary key,
  resource               jsonb not null,
  source                 text not null default 'epic',
  status                 text,
  subscriber_id          text,
  beneficiary_patient_id text,
  dependent              text,
  relationship_code      text,
  relationship_display   text,
  period_start           date,
  period_end             date,
  payor_org_id           text,
  order_int              int,
  last_updated           timestamptz,
  ingested_at            timestamptz not null default now()
);
create index if not exists idx_coverage_patient on coverage(beneficiary_patient_id);

create table if not exists coverage_class (
  id           bigint generated always as identity primary key,
  coverage_id  text not null references coverage(id) on delete cascade,
  type_code    text,
  type_system  text,
  type_display text,
  value        text,
  name         text
);

-- ─── DEVICE ───────────────────────────────────────────────────────────────────
create table if not exists device (
  id                  text primary key,
  resource            jsonb not null,
  source              text not null default 'epic',
  patient_id          text,
  status              text,
  distinct_identifier text,
  manufacturer        text,
  manufacture_date    timestamptz,
  expiration_date     timestamptz,
  lot_number          text,
  serial_number       text,
  type_code           text,
  type_system         text,
  type_display        text,
  owner_org_id        text,
  location_id         text,
  last_updated        timestamptz,
  ingested_at         timestamptz not null default now()
);
create index if not exists idx_device_patient on device(patient_id);

create table if not exists device_udi_carrier (
  id                bigint generated always as identity primary key,
  device_id         text not null references device(id) on delete cascade,
  device_identifier text,
  issuer            text,
  jurisdiction      text,
  carrier_hrf       text,
  carrier_aidc      text,
  entry_type        text
);

-- ─── SERVICEREQUEST ───────────────────────────────────────────────────────────
create table if not exists servicerequest (
  id                        text primary key,
  resource                  jsonb not null,
  source                    text not null default 'epic',
  status                    text,
  intent                    text,
  priority                  text,
  do_not_perform            boolean,
  subject_patient_id        text,
  encounter_id              text,
  code_code                 text,
  code_system               text,
  code_display              text,
  code_text                 text,
  occurrence_datetime       timestamptz,
  occurrence_period_start   timestamptz,
  occurrence_period_end     timestamptz,
  authored_on               timestamptz,
  requester_practitioner_id text,
  requester_org_id          text,
  last_updated              timestamptz,
  ingested_at               timestamptz not null default now()
);
create index if not exists idx_sreq_patient on servicerequest(subject_patient_id);

create table if not exists servicerequest_category (
  id                bigint generated always as identity primary key,
  servicerequest_id text not null references servicerequest(id) on delete cascade,
  code              text,
  system            text,
  display           text
);

create table if not exists servicerequest_reason_code (
  id                bigint generated always as identity primary key,
  servicerequest_id text not null references servicerequest(id) on delete cascade,
  code              text,
  system            text,
  display           text
);

-- ─── SPECIMEN ─────────────────────────────────────────────────────────────────
create table if not exists specimen (
  id                        text primary key,
  resource                  jsonb not null,
  source                    text not null default 'epic',
  status                    text,
  type_code                 text,
  type_system               text,
  type_display              text,
  subject_patient_id        text,
  received_time             timestamptz,
  collected_datetime        timestamptz,
  collected_period_start    timestamptz,
  collected_period_end      timestamptz,
  collector_practitioner_id text,
  accession_identifier      text,
  accession_system          text,
  last_updated              timestamptz,
  ingested_at               timestamptz not null default now()
);
create index if not exists idx_specimen_patient on specimen(subject_patient_id);

create table if not exists specimen_container (
  id                      bigint generated always as identity primary key,
  specimen_id             text not null references specimen(id) on delete cascade,
  type_code               text,
  type_display            text,
  capacity_value          numeric,
  capacity_unit           text,
  specimen_quantity_value numeric,
  specimen_quantity_unit  text,
  additive_code           text,
  additive_display        text
);

-- ─── PROVENANCE ───────────────────────────────────────────────────────────────
create table if not exists provenance (
  id                text primary key,
  resource          jsonb not null,
  source            text not null default 'epic',
  target_first      text,
  recorded          timestamptz,
  occurred_datetime timestamptz,
  policy            text,
  location_id       text,
  last_updated      timestamptz,
  ingested_at       timestamptz not null default now()
);

create table if not exists provenance_target (
  id            bigint generated always as identity primary key,
  provenance_id text not null references provenance(id) on delete cascade,
  reference     text
);

create table if not exists provenance_agent (
  id                   bigint generated always as identity primary key,
  provenance_id        text not null references provenance(id) on delete cascade,
  type_code            text,
  type_display         text,
  role_code            text,
  role_display         text,
  who_practitioner_id  text,
  who_org_id           text,
  who_relatedperson_id text,
  who_reference        text,
  on_behalf_of_org_id  text
);

create table if not exists provenance_entity (
  id             bigint generated always as identity primary key,
  provenance_id  text not null references provenance(id) on delete cascade,
  role           text,
  what_reference text
);

-- ─── QUESTIONNAIRERESPONSE ────────────────────────────────────────────────────
-- Items are deeply nested/variable; typed columns cover MS scalars; full detail in `resource`.
create table if not exists questionnaireresponse (
  id                     text primary key,
  resource               jsonb not null,
  source                 text not null default 'epic',
  questionnaire          text,
  status                 text,
  subject_patient_id     text,
  encounter_id           text,
  authored               timestamptz,
  author_practitioner_id text,
  author_patient_id      text,
  last_updated           timestamptz,
  ingested_at            timestamptz not null default now()
);
create index if not exists idx_qr_patient on questionnaireresponse(subject_patient_id);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────
-- No anon/authenticated policies → only service_role (Worker) may access these tables.
alter table patient                        enable row level security;
alter table patient_identifier             enable row level security;
alter table patient_name                   enable row level security;
alter table patient_telecom                enable row level security;
alter table patient_address                enable row level security;
alter table patient_communication          enable row level security;
alter table practitioner                   enable row level security;
alter table practitioner_identifier        enable row level security;
alter table practitioner_name              enable row level security;
alter table practitioner_telecom           enable row level security;
alter table practitioner_address           enable row level security;
alter table practitioner_qualification     enable row level security;
alter table practitionerrole               enable row level security;
alter table practitionerrole_code          enable row level security;
alter table practitionerrole_specialty     enable row level security;
alter table practitionerrole_location      enable row level security;
alter table practitionerrole_telecom       enable row level security;
alter table organization                   enable row level security;
alter table organization_identifier        enable row level security;
alter table organization_type              enable row level security;
alter table organization_telecom           enable row level security;
alter table organization_address           enable row level security;
alter table location                       enable row level security;
alter table location_type                  enable row level security;
alter table location_telecom               enable row level security;
alter table location_address               enable row level security;
alter table relatedperson                  enable row level security;
alter table relatedperson_relationship     enable row level security;
alter table relatedperson_name             enable row level security;
alter table relatedperson_telecom          enable row level security;
alter table relatedperson_address          enable row level security;
alter table encounter                      enable row level security;
alter table encounter_type                 enable row level security;
alter table encounter_service_type         enable row level security;
alter table encounter_participant          enable row level security;
alter table encounter_reason               enable row level security;
alter table encounter_diagnosis            enable row level security;
alter table encounter_location             enable row level security;
alter table condition                      enable row level security;
alter table condition_category             enable row level security;
alter table condition_stage                enable row level security;
alter table observation                    enable row level security;
alter table observation_category           enable row level security;
alter table observation_component          enable row level security;
alter table observation_reference_range    enable row level security;
alter table medication                     enable row level security;
alter table medication_ingredient          enable row level security;
alter table medicationrequest              enable row level security;
alter table medicationrequest_dosage       enable row level security;
alter table medicationrequest_reason       enable row level security;
alter table medicationdispense             enable row level security;
alter table medicationdispense_performer   enable row level security;
alter table medicationdispense_dosage      enable row level security;
alter table allergyintolerance             enable row level security;
alter table allergyintolerance_reaction    enable row level security;
alter table immunization                   enable row level security;
alter table immunization_performer         enable row level security;
alter table immunization_reaction          enable row level security;
alter table procedure                      enable row level security;
alter table procedure_category             enable row level security;
alter table procedure_reason_code          enable row level security;
alter table procedure_performer            enable row level security;
alter table diagnosticreport               enable row level security;
alter table diagnosticreport_category      enable row level security;
alter table diagnosticreport_result        enable row level security;
alter table diagnosticreport_performer     enable row level security;
alter table diagnosticreport_presented_form enable row level security;
alter table documentreference              enable row level security;
alter table documentreference_category     enable row level security;
alter table documentreference_author       enable row level security;
alter table documentreference_content      enable row level security;
alter table documentreference_context      enable row level security;
alter table careplan                       enable row level security;
alter table careplan_category              enable row level security;
alter table careplan_addresses             enable row level security;
alter table careplan_activity              enable row level security;
alter table careteam                       enable row level security;
alter table careteam_participant           enable row level security;
alter table goal                           enable row level security;
alter table goal_target                    enable row level security;
alter table goal_addresses                 enable row level security;
alter table coverage                       enable row level security;
alter table coverage_class                 enable row level security;
alter table device                         enable row level security;
alter table device_udi_carrier             enable row level security;
alter table servicerequest                 enable row level security;
alter table servicerequest_category        enable row level security;
alter table servicerequest_reason_code     enable row level security;
alter table specimen                       enable row level security;
alter table specimen_container             enable row level security;
alter table provenance                     enable row level security;
alter table provenance_target              enable row level security;
alter table provenance_agent               enable row level security;
alter table provenance_entity              enable row level security;
alter table questionnaireresponse          enable row level security;
