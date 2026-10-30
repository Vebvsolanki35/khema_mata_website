-- =============================================================================
-- Solanki Parivaar Community Directory & Official LGD Administrative Locations
-- -----------------------------------------------------------------------------
-- Run this in the Supabase SQL Editor (or `supabase db push`) AFTER:
--   1. 20261018120000_temple_notices_and_volunteers.sql
--   2. 20261019090000_broadcast_center.sql
--
-- Security & Privacy Architecture:
-- - Official administrative location tables (`states`, `districts`,
--   `subdistricts_blocks`, `villages`) are separate from community registrations
--   and publicly readable (`SELECT`) for location dropdowns, map, and directory.
-- - `parivaar_registrations` has NO public `SELECT` policy. Visitors can NEVER
--   read personal names, phone numbers, or current residential addresses.
-- - Public registration submissions go through the validated server-side RPC
--   `public.submit_parivaar_registration(...)` which enforces Indian phone
--   validation, required fields, parent-child administrative hierarchy,
--   anti-abuse rate limiting, and duplicate prevention.
-- - Public statistics, map markers, and directory counts are served exclusively
--   as aggregate counts via read-only RPCs (`get_parivaar_summary_stats`,
--   `get_parivaar_map_aggregates`, `get_parivaar_location_counts`).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Official Administrative Hierarchy Tables (Source: LGD lgdirectory.gov.in)
-- ---------------------------------------------------------------------------

create table if not exists public.states (
  state_code       text primary key,
  name_en          text not null,
  name_local       text,
  state_or_ut      text not null default 'State'
                     check (state_or_ut in ('State', 'UT')),
  census_2011_code text,
  latitude         double precision
                     check (latitude is null or (latitude >= 6.0 and latitude <= 38.0)),
  longitude        double precision
                     check (longitude is null or (longitude >= 68.0 and longitude <= 98.0)),
  coord_source     text,
  coord_verified   boolean not null default false,
  source           text not null default 'LGD (lgdirectory.gov.in)',
  last_updated     timestamptz not null default now()
);

create index if not exists states_name_en_idx on public.states (lower(name_en));

create table if not exists public.districts (
  district_code    text primary key,
  state_code       text not null references public.states (state_code) on delete restrict,
  name_en          text not null,
  name_local       text,
  census_2011_code text,
  latitude         double precision
                     check (latitude is null or (latitude >= 6.0 and latitude <= 38.0)),
  longitude        double precision
                     check (longitude is null or (longitude >= 68.0 and longitude <= 98.0)),
  coord_source     text,
  coord_verified   boolean not null default false,
  source           text not null default 'LGD (lgdirectory.gov.in)',
  last_updated     timestamptz not null default now()
);

create index if not exists districts_state_code_idx on public.districts (state_code);
create index if not exists districts_name_en_idx on public.districts (lower(name_en));

create table if not exists public.subdistricts_blocks (
  subdistrict_code text primary key,
  district_code    text not null references public.districts (district_code) on delete restrict,
  state_code       text not null references public.states (state_code) on delete restrict,
  name_en          text not null,
  name_local       text,
  admin_type       text not null default 'Tehsil'
                     check (admin_type in ('Tehsil', 'Sub-District', 'Block', 'Taluka', 'Mandal')),
  census_2011_code text,
  source           text not null default 'LGD (lgdirectory.gov.in)',
  last_updated     timestamptz not null default now()
);

create index if not exists subdistricts_district_code_idx on public.subdistricts_blocks (district_code);
create index if not exists subdistricts_state_code_idx on public.subdistricts_blocks (state_code);
create index if not exists subdistricts_name_en_idx on public.subdistricts_blocks (lower(name_en));

create table if not exists public.villages (
  village_code     text primary key,
  subdistrict_code text not null references public.subdistricts_blocks (subdistrict_code) on delete restrict,
  block_code       text,
  district_code    text not null references public.districts (district_code) on delete restrict,
  state_code       text not null references public.states (state_code) on delete restrict,
  name_en          text not null,
  name_local       text,
  display_name_override text,
  census_2011_code text,
  latitude         double precision
                     check (latitude is null or (latitude >= 6.0 and latitude <= 38.0)),
  longitude        double precision
                     check (longitude is null or (longitude >= 68.0 and longitude <= 98.0)),
  coord_source     text,
  coord_verified   boolean not null default false,
  source           text not null default 'LGD (lgdirectory.gov.in)',
  last_updated     timestamptz not null default now(),
  constraint villages_verified_coords_chk check (
    (not coord_verified)
    or (
      latitude is not null
      and longitude is not null
      and nullif(btrim(coalesce(coord_source, '')), '') is not null
    )
  )
);

create index if not exists villages_subdistrict_code_idx on public.villages (subdistrict_code);
create index if not exists villages_block_code_idx on public.villages (block_code) where block_code is not null;
create index if not exists villages_district_code_idx on public.villages (district_code);
create index if not exists villages_state_code_idx on public.villages (state_code);
create index if not exists villages_name_en_idx on public.villages (lower(name_en));
create index if not exists villages_coord_verified_idx on public.villages (coord_verified) where coord_verified = true;

-- ---------------------------------------------------------------------------
-- 2. Location Import History Table
-- ---------------------------------------------------------------------------

create table if not exists public.location_import_history (
  id               bigserial primary key,
  dataset_source   text not null,
  import_timestamp timestamptz not null default now(),
  import_status    text not null
                     check (import_status in ('running', 'completed', 'completed_with_errors', 'failed', 'test_passed')),
  is_test_run      boolean not null default false,
  inserted_count   integer not null default 0 check (inserted_count >= 0),
  updated_count    integer not null default 0 check (updated_count >= 0),
  skipped_count    integer not null default 0 check (skipped_count >= 0),
  invalid_count    integer not null default 0 check (invalid_count >= 0),
  error_summary    jsonb not null default '[]'::jsonb,
  notes            text
);

create index if not exists location_import_history_ts_idx
  on public.location_import_history (import_timestamp desc);

-- ---------------------------------------------------------------------------
-- 3. Community Registrations Table (`parivaar_registrations`)
-- ---------------------------------------------------------------------------

create table if not exists public.parivaar_registrations (
  id               uuid primary key default gen_random_uuid(),
  family_id        text unique,
  full_name        text not null
                     check (char_length(btrim(full_name)) between 2 and 120),
  father_name      text
                     check (father_name is null or char_length(btrim(father_name)) between 2 and 120),
  member_count     integer not null default 1
                     check (member_count >= 1 and member_count <= 250),
  state_code       text not null references public.states (state_code) on delete restrict,
  district_code    text not null references public.districts (district_code) on delete restrict,
  subdistrict_code text not null references public.subdistricts_blocks (subdistrict_code) on delete restrict,
  village_code            text references public.villages (village_code) on delete restrict,
  thikana                 text not null
                            check (char_length(btrim(thikana)) between 1 and 150),
  thikana_same_as_village boolean not null default true,
  current_address         text not null
                            check (char_length(btrim(current_address)) between 3 and 500),
  phone_number     text not null
                     check (phone_number ~ '^[6-9][0-9]{9}$'),
  consent_given    boolean not null default true
                     check (consent_given = true),
  public_opt_in    boolean not null default true,
  public_visibility text not null default 'default'
                     check (public_visibility in ('default', 'public', 'private')),
  status           text not null default 'approved'
                     check (status in ('pending', 'approved', 'rejected')),
  admin_note       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.village_family_id_counters (
  village_code text primary key references public.villages (village_code) on delete restrict,
  last_seq     integer not null default 0 check (last_seq >= 0),
  updated_at   timestamptz not null default now()
);

create table if not exists public.registration_audit_log (
  id              uuid primary key default gen_random_uuid(),
  registration_id uuid not null,
  family_id       text not null,
  action          text not null,
  changed_fields  jsonb not null default '[]'::jsonb,
  previous_values jsonb not null default '{}'::jsonb,
  new_values      jsonb not null default '{}'::jsonb,
  admin_note      text,
  created_at      timestamptz not null default now()
);

create index if not exists reg_audit_reg_id_idx on public.registration_audit_log (registration_id);
create index if not exists reg_audit_family_id_idx on public.registration_audit_log (family_id);
create index if not exists parivaar_reg_family_id_idx on public.parivaar_registrations (lower(family_id));
create index if not exists parivaar_reg_head_name_idx on public.parivaar_registrations (lower(full_name));

-- Prevent duplicate registrations for the same phone number + name + district
create unique index if not exists parivaar_registrations_dedup_idx
  on public.parivaar_registrations (phone_number, lower(btrim(full_name)), district_code);

create index if not exists parivaar_reg_status_idx on public.parivaar_registrations (status);
create index if not exists parivaar_reg_state_idx on public.parivaar_registrations (state_code) where status = 'approved';
create index if not exists parivaar_reg_district_idx on public.parivaar_registrations (district_code) where status = 'approved';
create index if not exists parivaar_reg_subdistrict_idx on public.parivaar_registrations (subdistrict_code) where status = 'approved';
create index if not exists parivaar_reg_village_idx on public.parivaar_registrations (village_code) where status = 'approved';
create index if not exists parivaar_reg_created_idx on public.parivaar_registrations (created_at desc);

drop trigger if exists parivaar_registrations_touch_trg on public.parivaar_registrations;
create trigger parivaar_registrations_touch_trg
  before update on public.parivaar_registrations
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Missing Location Reports (Controlled Reporting for Admin Review)
-- ---------------------------------------------------------------------------

create table if not exists public.missing_location_reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_name    text not null check (char_length(btrim(reporter_name)) between 2 and 120),
  reporter_phone   text check (reporter_phone is null or reporter_phone ~ '^[6-9][0-9]{9}$'),
  state_code       text references public.states (state_code) on delete set null,
  district_code    text references public.districts (district_code) on delete set null,
  subdistrict_code text references public.subdistricts_blocks (subdistrict_code) on delete set null,
  missing_level    text not null default 'village'
                     check (missing_level in ('state', 'district', 'subdistrict_block', 'village')),
  proposed_name    text not null check (char_length(btrim(proposed_name)) between 2 and 150),
  parent_context   text,
  pincode          text check (pincode is null or pincode ~ '^[1-9][0-9]{5}$'),
  notes            text,
  status           text not null default 'pending'
                     check (status in ('pending', 'reviewed', 'imported', 'rejected')),
  created_at       timestamptz not null default now()
);

create index if not exists missing_location_reports_status_idx
  on public.missing_location_reports (status, created_at desc);

-- ---------------------------------------------------------------------------
-- 5. Row Level Security (RLS) Policies
-- ---------------------------------------------------------------------------

alter table public.states enable row level security;
alter table public.districts enable row level security;
alter table public.subdistricts_blocks enable row level security;
alter table public.villages enable row level security;
alter table public.location_import_history enable row level security;
alter table public.parivaar_registrations enable row level security;
alter table public.missing_location_reports enable row level security;

-- Administrative location tables: publicly readable, admin-only write
drop policy if exists "states_public_read" on public.states;
create policy "states_public_read"
  on public.states for select
  to anon, authenticated
  using (true);

drop policy if exists "states_admin_write" on public.states;
create policy "states_admin_write"
  on public.states for all
  to authenticated
  using (public.is_trust_admin())
  with check (public.is_trust_admin());

drop policy if exists "districts_public_read" on public.districts;
create policy "districts_public_read"
  on public.districts for select
  to anon, authenticated
  using (true);

drop policy if exists "districts_admin_write" on public.districts;
create policy "districts_admin_write"
  on public.districts for all
  to authenticated
  using (public.is_trust_admin())
  with check (public.is_trust_admin());

drop policy if exists "subdistricts_public_read" on public.subdistricts_blocks;
create policy "subdistricts_public_read"
  on public.subdistricts_blocks for select
  to anon, authenticated
  using (true);

drop policy if exists "subdistricts_admin_write" on public.subdistricts_blocks;
create policy "subdistricts_admin_write"
  on public.subdistricts_blocks for all
  to authenticated
  using (public.is_trust_admin())
  with check (public.is_trust_admin());

drop policy if exists "villages_public_read" on public.villages;
create policy "villages_public_read"
  on public.villages for select
  to anon, authenticated
  using (true);

drop policy if exists "villages_admin_write" on public.villages;
create policy "villages_admin_write"
  on public.villages for all
  to authenticated
  using (public.is_trust_admin())
  with check (public.is_trust_admin());

-- Location import history: admin read/write only
drop policy if exists "import_history_admin_all" on public.location_import_history;
create policy "import_history_admin_all"
  on public.location_import_history for all
  to authenticated
  using (public.is_trust_admin())
  with check (public.is_trust_admin());

-- Parivaar registrations:
-- Strictly NO public SELECT policy. Personal details (name, phone, address)
-- can ONLY be read or modified by authorised Trust administrators.
drop policy if exists "parivaar_reg_admin_select" on public.parivaar_registrations;
create policy "parivaar_reg_admin_select"
  on public.parivaar_registrations for select
  to authenticated
  using (public.is_trust_admin());

drop policy if exists "parivaar_reg_admin_update" on public.parivaar_registrations;
create policy "parivaar_reg_admin_update"
  on public.parivaar_registrations for update
  to authenticated
  using (public.is_trust_admin())
  with check (public.is_trust_admin());

drop policy if exists "parivaar_reg_admin_delete" on public.parivaar_registrations;
create policy "parivaar_reg_admin_delete"
  on public.parivaar_registrations for delete
  to authenticated
  using (public.is_trust_admin());

-- Missing location reports: admin read/update, public insert via RPC
drop policy if exists "missing_loc_admin_all" on public.missing_location_reports;
create policy "missing_loc_admin_all"
  on public.missing_location_reports for all
  to authenticated
  using (public.is_trust_admin())
  with check (public.is_trust_admin());

-- ---------------------------------------------------------------------------
-- 6. Server-Side Validated Registration & Aggregate Query RPCs
-- ---------------------------------------------------------------------------

create or replace function public.submit_parivaar_registration(
  p_full_name               text,
  p_state_code              text,
  p_district_code           text,
  p_subdistrict_code        text,
  p_village_code            text default null,
  p_thikana                 text default '',
  p_current_address         text default '',
  p_phone_number            text default '',
  p_consent_given           boolean default false,
  p_thikana_same_as_village boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name         text := btrim(coalesce(p_full_name, ''));
  v_state        text := btrim(coalesce(p_state_code, ''));
  v_district     text := btrim(coalesce(p_district_code, ''));
  v_subdistrict  text := btrim(coalesce(p_subdistrict_code, ''));
  v_village      text := nullif(btrim(coalesce(p_village_code, '')), '');
  v_thikana      text := btrim(coalesce(p_thikana, ''));
  v_same_village boolean := coalesce(p_thikana_same_as_village, false);
  v_official_vil text := null;
  v_address      text := btrim(coalesce(p_current_address, ''));
  v_phone        text := regexp_replace(coalesce(p_phone_number, ''), '\D', '', 'g');
  v_recent_cnt   integer := 0;
  v_new_id       uuid;
  v_created_at   timestamptz;
begin
  -- Strip leading country code 91 or 0 if 11-12 digits provided
  if char_length(v_phone) = 12 and left(v_phone, 2) = '91' then
    v_phone := substring(v_phone from 3);
  elsif char_length(v_phone) = 11 and left(v_phone, 1) = '0' then
    v_phone := substring(v_phone from 2);
  end if;

  -- 1. Required & format validation
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_NAME', 'message', 'Please enter a valid full name (2–120 characters).');
  end if;

  if v_name ~ '[<>]' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_NAME', 'message', 'Name contains invalid characters.');
  end if;

  if v_state = '' or v_district = '' or v_subdistrict = '' then
    return jsonb_build_object('ok', false, 'code', 'MISSING_LOCATION', 'message', 'State, District, and Tehsil/Block are required.');
  end if;

  if v_same_village and v_village is null then
    return jsonb_build_object('ok', false, 'code', 'VILLAGE_REQUIRED_FOR_SAME_THIKANA', 'message', 'Please select an official Village when ''Thikana is the same as Village'' is checked, or uncheck the option to enter Thikana manually.');
  end if;

  if not v_same_village and (char_length(v_thikana) < 1 or char_length(v_thikana) > 150 or v_thikana ~ '[<>]') then
    return jsonb_build_object('ok', false, 'code', 'INVALID_THIKANA', 'message', 'Please enter your Thikana name.');
  end if;

  if char_length(v_address) < 3 or char_length(v_address) > 500 or v_address ~ '[<>]' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_ADDRESS', 'message', 'Please enter your current residential address.');
  end if;

  if v_phone !~ '^[6-9][0-9]{9}$' or v_phone ~ '^(\d)\1{9}$' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_PHONE', 'message', 'Please enter a valid 10-digit Indian mobile number.');
  end if;

  if coalesce(p_consent_given, false) is not true then
    return jsonb_build_object('ok', false, 'code', 'CONSENT_REQUIRED', 'message', 'Consent is required to submit your registration.');
  end if;

  -- 2. Verify parent-child hierarchy against official LGD tables
  if not exists (
    select 1 from public.districts d
    where d.district_code = v_district and d.state_code = v_state
  ) then
    return jsonb_build_object('ok', false, 'code', 'INVALID_HIERARCHY', 'message', 'Selected District does not belong to the selected State/UT.');
  end if;

  if not exists (
    select 1 from public.subdistricts_blocks sb
    where sb.subdistrict_code = v_subdistrict
      and sb.district_code = v_district
      and sb.state_code = v_state
  ) then
    return jsonb_build_object('ok', false, 'code', 'INVALID_HIERARCHY', 'message', 'Selected Tehsil/Block does not belong to the selected District.');
  end if;

  if v_village is not null then
    select btrim(v.name_en) into v_official_vil
    from public.villages v
    where v.village_code = v_village
      and (v.subdistrict_code = v_subdistrict or v.block_code = v_subdistrict or v.block_code = ('BLK-' || v_subdistrict))
      and v.district_code = v_district
      and v.state_code = v_state;

    if v_official_vil is null then
      return jsonb_build_object('ok', false, 'code', 'INVALID_HIERARCHY', 'message', 'Selected Village does not belong to the selected Tehsil/Block.');
    end if;
  end if;

  if v_same_village then
    if v_thikana <> '' and lower(v_thikana) <> lower(v_official_vil) then
      return jsonb_build_object('ok', false, 'code', 'THIKANA_VILLAGE_MISMATCH', 'message', 'When ''Thikana is the same as Village'' is checked, Thikana must match the selected official Village name.');
    end if;
    v_thikana := v_official_vil;
  end if;

  -- 3. Duplicate check
  if exists (
    select 1 from public.parivaar_registrations r
    where r.phone_number = v_phone
      and lower(btrim(r.full_name)) = lower(v_name)
      and r.district_code = v_district
  ) then
    return jsonb_build_object('ok', false, 'code', 'DUPLICATE_REGISTRATION', 'message', 'A registration with this name, phone number, and district has already been recorded.');
  end if;

  -- 4. Anti-abuse rate limiting (max 5 submissions per phone number in 1 hour)
  select count(*) into v_recent_cnt
  from public.parivaar_registrations r
  where r.phone_number = v_phone
    and r.created_at > (now() - interval '1 hour');

  if v_recent_cnt >= 5 then
    return jsonb_build_object('ok', false, 'code', 'RATE_LIMITED', 'message', 'Too many registrations submitted recently from this number. Please try again later.');
  end if;

  -- 5. Insert registration
  insert into public.parivaar_registrations (
    full_name,
    state_code,
    district_code,
    subdistrict_code,
    village_code,
    thikana,
    thikana_same_as_village,
    current_address,
    phone_number,
    consent_given,
    status
  )
  values (
    v_name,
    v_state,
    v_district,
    v_subdistrict,
    v_village,
    v_thikana,
    v_same_village,
    v_address,
    v_phone,
    true,
    'approved'
  )
  returning id, created_at into v_new_id, v_created_at;

  return jsonb_build_object(
    'ok', true,
    'id', v_new_id,
    'village_code', v_village,
    'thikana', v_thikana,
    'thikana_same_as_village', v_same_village,
    'created_at', v_created_at
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'DUPLICATE_REGISTRATION', 'message', 'A registration with this name, phone number, and district has already been recorded.');
end;
$$;

revoke all on function public.submit_parivaar_registration(text, text, text, text, text, text, text, text, boolean, boolean) from public;
grant execute on function public.submit_parivaar_registration(text, text, text, text, text, text, text, text, boolean, boolean) to anon, authenticated;

-- Controlled Missing Location Report submission RPC
create or replace function public.submit_missing_location_report(
  p_reporter_name    text,
  p_reporter_phone   text default null,
  p_state_code       text default null,
  p_district_code    text default null,
  p_subdistrict_code text default null,
  p_missing_level    text default 'village',
  p_proposed_name    text default '',
  p_parent_context   text default null,
  p_pincode          text default null,
  p_notes            text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name     text := btrim(coalesce(p_reporter_name, ''));
  v_proposed text := btrim(coalesce(p_proposed_name, ''));
  v_phone    text := nullif(regexp_replace(coalesce(p_reporter_phone, ''), '\D', '', 'g'), '');
  v_pin      text := nullif(btrim(coalesce(p_pincode, '')), '');
  v_level    text := coalesce(nullif(btrim(p_missing_level), ''), 'village');
  v_id       uuid;
begin
  if v_phone is not null and char_length(v_phone) = 12 and left(v_phone, 2) = '91' then
    v_phone := substring(v_phone from 3);
  end if;

  if char_length(v_name) < 2 or char_length(v_proposed) < 2 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Please provide your name and the missing location name.');
  end if;

  if v_level not in ('state', 'district', 'subdistrict_block', 'village') then
    v_level := 'village';
  end if;

  if v_phone is not null and v_phone !~ '^[6-9][0-9]{9}$' then
    v_phone := null;
  end if;

  if v_pin is not null and v_pin !~ '^[1-9][0-9]{5}$' then
    v_pin := null;
  end if;

  insert into public.missing_location_reports (
    reporter_name,
    reporter_phone,
    state_code,
    district_code,
    subdistrict_code,
    missing_level,
    proposed_name,
    parent_context,
    pincode,
    notes,
    status
  )
  values (
    v_name,
    v_phone,
    nullif(btrim(coalesce(p_state_code, '')), ''),
    nullif(btrim(coalesce(p_district_code, '')), ''),
    nullif(btrim(coalesce(p_subdistrict_code, '')), ''),
    v_level,
    v_proposed,
    nullif(btrim(coalesce(p_parent_context, '')), ''),
    v_pin,
    nullif(btrim(coalesce(p_notes, '')), ''),
    'pending'
  )
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

revoke all on function public.submit_missing_location_report(text, text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.submit_missing_location_report(text, text, text, text, text, text, text, text, text, text) to anon, authenticated;

-- Summary Statistics RPC (Public Aggregate Data Only)
create or replace function public.get_parivaar_summary_stats()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'total_registrations', count(*)::integer,
    'states_represented', count(distinct state_code)::integer,
    'districts_covered', count(distinct district_code)::integer,
    'villages_represented', count(distinct village_code) filter (where village_code is not null)::integer
  )
  from public.parivaar_registrations
  where status = 'approved';
$$;

revoke all on function public.get_parivaar_summary_stats() from public;
grant execute on function public.get_parivaar_summary_stats() to anon, authenticated;

-- Map & Directory Aggregate Counts RPC (Public Aggregate Data Only — Zero PII)
create or replace function public.get_parivaar_map_aggregates(
  p_state_code    text default null,
  p_district_code text default null
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with filtered_regs as (
    select
      state_code,
      district_code,
      subdistrict_code,
      village_code
    from public.parivaar_registrations
    where status = 'approved'
      and (p_state_code is null or p_state_code = '' or state_code = p_state_code)
      and (p_district_code is null or p_district_code = '' or district_code = p_district_code)
  ),
  state_agg as (
    select
      s.state_code,
      s.name_en,
      s.name_local,
      s.state_or_ut,
      s.latitude,
      s.longitude,
      s.coord_source,
      s.coord_verified,
      count(r.state_code)::integer as registration_count
    from filtered_regs r
    join public.states s on s.state_code = r.state_code
    group by s.state_code, s.name_en, s.name_local, s.state_or_ut, s.latitude, s.longitude, s.coord_source, s.coord_verified
  ),
  district_agg as (
    select
      d.district_code,
      d.state_code,
      s.name_en as state_name,
      d.name_en,
      d.name_local,
      d.latitude,
      d.longitude,
      d.coord_source,
      d.coord_verified,
      count(r.district_code)::integer as registration_count
    from filtered_regs r
    join public.districts d on d.district_code = r.district_code
    join public.states s on s.state_code = d.state_code
    group by d.district_code, d.state_code, s.name_en, d.name_en, d.name_local, d.latitude, d.longitude, d.coord_source, d.coord_verified
  ),
  subdistrict_agg as (
    select
      sb.subdistrict_code,
      sb.district_code,
      sb.state_code,
      sb.name_en,
      sb.admin_type,
      count(r.subdistrict_code)::integer as registration_count
    from filtered_regs r
    join public.subdistricts_blocks sb on sb.subdistrict_code = r.subdistrict_code
    group by sb.subdistrict_code, sb.district_code, sb.state_code, sb.name_en, sb.admin_type
  ),
  village_agg as (
    select
      v.village_code,
      v.subdistrict_code,
      sb.name_en as subdistrict_name,
      v.district_code,
      d.name_en as district_name,
      v.state_code,
      s.name_en as state_name,
      v.name_en,
      v.name_local,
      v.latitude,
      v.longitude,
      v.coord_source,
      v.coord_verified,
      count(r.village_code)::integer as registration_count
    from filtered_regs r
    join public.villages v on v.village_code = r.village_code
    join public.subdistricts_blocks sb on sb.subdistrict_code = v.subdistrict_code
    join public.districts d on d.district_code = v.district_code
    join public.states s on s.state_code = v.state_code
    where r.village_code is not null
    group by
      v.village_code, v.subdistrict_code, sb.name_en,
      v.district_code, d.name_en, v.state_code, s.name_en,
      v.name_en, v.name_local, v.latitude, v.longitude, v.coord_source, v.coord_verified
  )
  select jsonb_build_object(
    'states', coalesce((select jsonb_agg(row_to_json(state_agg)) from state_agg), '[]'::jsonb),
    'districts', coalesce((select jsonb_agg(row_to_json(district_agg)) from district_agg), '[]'::jsonb),
    'subdistricts', coalesce((select jsonb_agg(row_to_json(subdistrict_agg)) from subdistrict_agg), '[]'::jsonb),
    'villages', coalesce((select jsonb_agg(row_to_json(village_agg)) from village_agg), '[]'::jsonb)
  );
$$;

revoke all on function public.get_parivaar_map_aggregates(text, text) from public;
grant execute on function public.get_parivaar_map_aggregates(text, text) to anon, authenticated;
