-- =============================================================================
-- Repair migration: restore the Parivaar registration RPC
-- =============================================================================
-- Failure being fixed (production, 2026-11-01):
--
--   POST /rest/v1/rpc/submit_parivaar_registration
--   Could not find the function public.submit_parivaar_registration(
--     p_consent_given, p_current_address, p_district_code, p_full_name,
--     p_phone_number, p_state_code, p_subdistrict_code, p_thikana,
--     p_thikana_same_as_village, p_village_code) in the schema cache
--
-- This error code (PGRST202) is raised by PostgREST *before* PostgreSQL ever
-- runs the call: PostgREST resolves the function from its cached list of
-- functions in the exposed schema that its connection role may EXECUTE.  The
-- database therefore has no usable `submit_parivaar_registration` for the API:
-- it is missing, it has a signature the API cannot reach, its EXECUTE grant is
-- missing, or the schema cache is stale.  Every one of those is repaired here.
--
-- Guarantees:
--   * additive + idempotent: CREATE ... IF NOT EXISTS, ADD COLUMN IF NOT EXISTS,
--     CREATE OR REPLACE FUNCTION, DROP POLICY IF EXISTS before CREATE POLICY;
--   * no table is dropped, truncated or recreated and no row is deleted or
--     rewritten - existing registrations, Family IDs, counters and the LGD
--     location data are preserved exactly as they are;
--   * the only DROP is of *stale duplicate definitions of this one function*
--     (step 4), which holds no data and cannot be called by the API anyway;
--   * safe to run on a healthy database (no-op apart from the cache reload) and
--     safe to run several times.
--
-- See docs/PARIVAAR_RPC_REPAIR.md for the analysis and the recovery runbook.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Shared helpers referenced below
-- ---------------------------------------------------------------------------

create table if not exists public.trust_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text,
  note       text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.is_trust_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.trust_admins a
    where a.user_id = auth.uid()
      and a.is_active
  );
$$;

revoke all on function public.is_trust_admin() from public;

do $$
declare
  v_role text;
begin
  foreach v_role in array array['anon', 'authenticated']
  loop
    continue when not exists (select 1 from pg_roles where rolname = v_role);
    execute format('grant execute on function public.is_trust_admin() to %I', v_role);
  end loop;
end
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Reference and Parivaar tables (created only if a previous run never
--    created them; existing tables and rows are untouched)
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
-- 1b. Location import history
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
-- 1c. Community registrations (`parivaar_registrations`)
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
-- 1d. Missing-location reports (admin review)
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
-- 2. Columns added by later migrations (no-ops when already present)
-- ---------------------------------------------------------------------------

alter table public.parivaar_registrations
  add column if not exists family_id text unique;

alter table public.parivaar_registrations
  add column if not exists father_name text
    check (father_name is null or char_length(btrim(father_name)) between 2 and 120);

alter table public.parivaar_registrations
  add column if not exists member_count integer not null default 1
    check (member_count >= 1 and member_count <= 250);

alter table public.parivaar_registrations
  add column if not exists public_visibility text not null default 'default'
    check (public_visibility in ('default', 'public', 'private'));

create table if not exists public.village_family_id_counters (
  village_code text primary key,
  last_seq     integer not null default 0 check (last_seq >= 0),
  updated_at   timestamptz not null default now()
);

create index if not exists parivaar_reg_father_name_idx
  on public.parivaar_registrations (lower(father_name));


-- ---------------------------------------------------------------------------
-- 3. Remove stale duplicate definitions of the registration function.
--    Only overloads of `submit_parivaar_registration` whose argument list is not
--    the canonical one below are removed: they are unreachable from the API and
--    would otherwise make the named-argument call ambiguous (SQLSTATE 42725) or
--    block CREATE OR REPLACE ("cannot change name of input parameter").
--    No data is touched, and on a correct database this block does nothing.
-- ---------------------------------------------------------------------------

do $$
declare
  v_rec      record;
  v_canonical constant text :=
    'p_full_name text, p_state_code text, p_district_code text, p_subdistrict_code text, '
    'p_village_code text, p_thikana text, p_current_address text, p_phone_number text, '
    'p_consent_given boolean, p_thikana_same_as_village boolean, p_father_name text, '
    'p_member_count integer, p_family_id text, p_state_name text, p_district_name text, '
    'p_subdistrict_name text, p_village_name text';
begin
  for v_rec in
    select p.oid,
           pg_get_function_identity_arguments(p.oid) as args
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'submit_parivaar_registration'
       and pg_get_function_identity_arguments(p.oid) <> v_canonical
  loop
    raise notice 'dropping stale signature submit_parivaar_registration(%)', v_rec.args;
    execute format('drop function public.submit_parivaar_registration(%s)', v_rec.args);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- 4. Canonical security-definer RPCs
--    `submit_parivaar_registration` is 17 arguments with the last seven
--    defaulted, so BOTH the current 17-argument call and the older
--    10-argument call resolve to it.  Family IDs are allocated inside the
--    function from `village_family_id_counters` (atomic upsert), never by
--    COUNT(*) and never in the browser.
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
  p_consent_given           boolean default true,
  p_thikana_same_as_village boolean default true,
  p_father_name             text default null,
  p_member_count            integer default 1,
  p_family_id               text default null,
  p_state_name              text default null,
  p_district_name           text default null,
  p_subdistrict_name        text default null,
  p_village_name            text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name          text := btrim(coalesce(p_full_name, ''));
  v_father        text := nullif(btrim(coalesce(p_father_name, '')), '');
  v_members       integer := greatest(1, least(250, coalesce(p_member_count, 1)));
  v_state         text := btrim(coalesce(p_state_code, ''));
  v_district      text := btrim(coalesce(p_district_code, ''));
  v_subdistrict   text := btrim(coalesce(p_subdistrict_code, ''));
  v_village       text := nullif(btrim(coalesce(p_village_code, '')), '');
  v_thikana       text := btrim(coalesce(p_thikana, ''));
  v_same_village  boolean := coalesce(p_thikana_same_as_village, true);
  v_official_vil  text := null;
  v_address       text := btrim(coalesce(p_current_address, ''));
  v_phone         text := regexp_replace(coalesce(p_phone_number, ''), '\D', '', 'g');
  v_req_family_id text := nullif(btrim(coalesce(p_family_id, '')), '');
  v_family_id     text;
  v_seq           integer;
  v_prefix        text;
  v_existing_id   uuid;
  v_existing_fid  text;
  v_existing_ts   timestamptz;
  v_recent_cnt    integer := 0;
  v_new_id        uuid;
  v_created_at    timestamptz;
begin
  -- Strip leading country code 91 or 0 if 11-12 digits provided
  if char_length(v_phone) = 12 and left(v_phone, 2) = '91' then
    v_phone := substring(v_phone from 3);
  elsif char_length(v_phone) = 11 and left(v_phone, 1) = '0' then
    v_phone := substring(v_phone from 2);
  end if;

  -- 1. Required & format validation
  if char_length(v_name) < 2 or char_length(v_name) > 120 or v_name ~ '[<>]' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_NAME', 'message', 'Please enter a valid full name (2–120 characters).');
  end if;

  if v_father is not null and (char_length(v_father) < 2 or char_length(v_father) > 120 or v_father ~ '[<>]') then
    return jsonb_build_object('ok', false, 'code', 'INVALID_FATHER_NAME', 'message', 'Please enter a valid Father''s Name (2–120 characters).');
  end if;

  if v_state = '' or v_district = '' or v_subdistrict = '' then
    return jsonb_build_object('ok', false, 'code', 'MISSING_LOCATION', 'message', 'State, District, and Tehsil/Block are required.');
  end if;

  if v_same_village and v_village is null then
    return jsonb_build_object('ok', false, 'code', 'VILLAGE_REQUIRED_FOR_SAME_THIKANA', 'message', 'Please select an official ancestral Village.');
  end if;

  if char_length(v_address) < 3 or char_length(v_address) > 500 or v_address ~ '[<>]' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_ADDRESS', 'message', 'Please enter your current residential address.');
  end if;

  if v_phone !~ '^[6-9][0-9]{9}$' or v_phone ~ '^(\d)\1{9}$' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_PHONE', 'message', 'Please enter a valid 10-digit Indian mobile number.');
  end if;

  if coalesce(p_consent_given, true) is not true then
    return jsonb_build_object('ok', false, 'code', 'CONSENT_REQUIRED', 'message', 'Consent is required to submit your registration.');
  end if;

  -- 2. Ensure parent LGD location rows exist in PostgreSQL (auto-seeding verified LGD rows if needed)
  insert into public.states (state_code, name_en, state_or_ut)
  values (v_state, coalesce(nullif(btrim(p_state_name), ''), v_state), 'State')
  on conflict (state_code) do nothing;

  insert into public.districts (district_code, state_code, name_en)
  values (v_district, v_state, coalesce(nullif(btrim(p_district_name), ''), v_district))
  on conflict (district_code) do nothing;

  insert into public.subdistricts_blocks (subdistrict_code, district_code, state_code, name_en, admin_type)
  values (v_subdistrict, v_district, v_state, coalesce(nullif(btrim(p_subdistrict_name), ''), v_subdistrict), 'Tehsil')
  on conflict (subdistrict_code) do nothing;

  if v_village is not null then
    select btrim(v.name_en) into v_official_vil
    from public.villages v
    where v.village_code = v_village;

    if v_official_vil is null then
      v_official_vil := coalesce(nullif(btrim(p_village_name), ''), nullif(v_thikana, ''), v_village);
      insert into public.villages (village_code, subdistrict_code, district_code, state_code, name_en)
      values (v_village, v_subdistrict, v_district, v_state, v_official_vil)
      on conflict (village_code) do nothing;
    end if;
  end if;

  if v_thikana = '' then
    v_thikana := coalesce(v_official_vil, v_village, v_subdistrict);
  end if;

  -- 3. Idempotency & Duplicate Check
  select r.id, r.family_id, r.created_at
    into v_existing_id, v_existing_fid, v_existing_ts
  from public.parivaar_registrations r
  where r.phone_number = v_phone
    and lower(btrim(r.full_name)) = lower(v_name)
    and r.district_code = v_district
  limit 1;

  if v_existing_id is not null then
    -- If this is a sync call for the exact same family_id, update father_name/member_count idempotently
    if v_req_family_id is not null and (v_existing_fid is null or v_existing_fid = v_req_family_id) then
      update public.parivaar_registrations
      set father_name = coalesce(v_father, father_name),
          member_count = v_members,
          family_id = coalesce(family_id, v_req_family_id)
      where id = v_existing_id;

      return jsonb_build_object(
        'ok', true,
        'id', v_existing_id,
        'family_id', coalesce(v_existing_fid, v_req_family_id),
        'full_name', v_name,
        'father_name', v_father,
        'member_count', v_members,
        'village_code', v_village,
        'thikana', v_thikana,
        'thikana_same_as_village', v_same_village,
        'created_at', v_existing_ts
      );
    end if;

    return jsonb_build_object(
      'ok', false,
      'code', 'DUPLICATE_REGISTRATION',
      'message', 'A registration with this name, phone number, and district has already been recorded.'
    );
  end if;

  -- 4. Anti-abuse rate limiting (max 5 submissions per phone number in 1 hour)
  select count(*) into v_recent_cnt
  from public.parivaar_registrations r
  where r.phone_number = v_phone
    and r.created_at > (now() - interval '1 hour');

  if v_recent_cnt >= 5 then
    return jsonb_build_object('ok', false, 'code', 'RATE_LIMITED', 'message', 'Too many registrations submitted recently from this number. Please try again later.');
  end if;

  -- 5. Allocate or synchronize permanent Family ID (`LGD_VILLAGE_CODE-SEQUENCE`)
  v_prefix := coalesce(v_village, v_subdistrict, v_district);

  if v_req_family_id is not null and not exists (
    select 1 from public.parivaar_registrations where family_id = v_req_family_id
  ) then
    v_family_id := v_req_family_id;
    v_seq := coalesce(nullif(regexp_replace(split_part(v_req_family_id, '-', 2), '\D', '', 'g'), '')::integer, 1);
    insert into public.village_family_id_counters (village_code, last_seq, updated_at)
    values (v_prefix, v_seq, now())
    on conflict (village_code) do update
      set last_seq = greatest(public.village_family_id_counters.last_seq, excluded.last_seq),
          updated_at = now();
  else
    insert into public.village_family_id_counters (village_code, last_seq, updated_at)
    values (v_prefix, 1, now())
    on conflict (village_code) do update
      set last_seq = public.village_family_id_counters.last_seq + 1,
          updated_at = now()
    returning last_seq into v_seq;

    v_family_id := v_prefix || '-' || case
      when v_seq < 1000 then lpad(v_seq::text, 3, '0')
      else v_seq::text
    end;
  end if;

  -- 6. Insert registration with all fields
  insert into public.parivaar_registrations (
    family_id,
    full_name,
    father_name,
    member_count,
    state_code,
    district_code,
    subdistrict_code,
    village_code,
    thikana,
    thikana_same_as_village,
    current_address,
    phone_number,
    consent_given,
    public_visibility,
    status
  )
  values (
    v_family_id,
    v_name,
    v_father,
    v_members,
    v_state,
    v_district,
    v_subdistrict,
    v_village,
    v_thikana,
    v_same_village,
    v_address,
    v_phone,
    true,
    'default',
    'approved'
  )
  returning id, created_at into v_new_id, v_created_at;

  return jsonb_build_object(
    'ok', true,
    'id', v_new_id,
    'family_id', v_family_id,
    'full_name', v_name,
    'father_name', v_father,
    'member_count', v_members,
    'state_code', v_state,
    'district_code', v_district,
    'subdistrict_code', v_subdistrict,
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

create or replace function public.get_parivaar_summary_stats()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'total_registrations', count(*)::integer,
    'total_members', coalesce(sum(member_count), 0)::integer,
    'states_represented', count(distinct state_code)::integer,
    'districts_covered', count(distinct district_code)::integer,
    'villages_represented', count(distinct village_code) filter (where village_code is not null)::integer
  )
  from public.parivaar_registrations
  where status = 'approved';
$$;

create or replace function public.get_public_parivaar_families(
  p_state_code       text default null,
  p_district_code    text default null,
  p_subdistrict_code text default null,
  p_village_code     text default null,
  p_q                text default null,
  p_page             integer default 1,
  p_page_size        integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_page      integer := greatest(1, coalesce(p_page, 1));
  v_page_size integer := greatest(1, least(100, coalesce(p_page_size, 20)));
  v_offset    integer := (v_page - 1) * v_page_size;
  v_q         text := nullif(lower(btrim(coalesce(p_q, ''))), '');
  v_total     integer := 0;
  v_members   integer := 0;
  v_rows      jsonb := '[]'::jsonb;
begin
  select
    count(*)::integer,
    coalesce(sum(coalesce(r.member_count, 1)), 0)::integer
  into v_total, v_members
  from public.parivaar_registrations r
  left join public.villages v on v.village_code = r.village_code
  where r.status = 'approved'
    and (p_state_code is null or p_state_code = '' or r.state_code = p_state_code or v.state_code = p_state_code)
    and (p_district_code is null or p_district_code = '' or r.district_code = p_district_code or v.district_code = p_district_code)
    and (
      p_subdistrict_code is null
      or p_subdistrict_code = ''
      or r.subdistrict_code = p_subdistrict_code
      or v.subdistrict_code = p_subdistrict_code
      or v.block_code = p_subdistrict_code
    )
    and (p_village_code is null or p_village_code = '' or r.village_code = p_village_code or v.village_code = p_village_code)
    and (
      v_q is null
      or lower(coalesce(r.family_id, '')) like ('%' || v_q || '%')
      or (r.public_visibility <> 'private' and lower(r.full_name) like ('%' || v_q || '%'))
      or (r.public_visibility <> 'private' and lower(coalesce(r.father_name, '')) like ('%' || v_q || '%'))
      or lower(coalesce(r.thikana, '')) like ('%' || v_q || '%')
      or lower(coalesce(v.name_en, '')) like ('%' || v_q || '%')
      or lower(coalesce(r.village_code, '')) like ('%' || v_q || '%')
    );

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  into v_rows
  from (
    select
      r.family_id,
      (r.public_visibility <> 'private') as is_public,
      (r.public_visibility = 'private') as is_private,
      case when r.public_visibility = 'private' then null else r.full_name end as family_head_name,
      case when r.public_visibility = 'private' then null else r.full_name end as head_name,
      case when r.public_visibility = 'private' then null else nullif(btrim(coalesce(r.father_name, '')), '') end as father_name,
      case when r.public_visibility = 'private' then null else coalesce(r.member_count, 1) end as member_count,
      coalesce(v.state_code, r.state_code) as state_code,
      coalesce(s.name_en, r.state_code) as state_name,
      coalesce(v.district_code, r.district_code) as district_code,
      coalesce(d.name_en, r.district_code) as district_name,
      coalesce(v.subdistrict_code, r.subdistrict_code) as subdistrict_code,
      coalesce(sb.name_en, r.subdistrict_code) as subdistrict_name,
      coalesce(sb.admin_type, 'Tehsil') as admin_type,
      r.village_code,
      coalesce(v.name_en, r.thikana) as village_name,
      r.created_at
    from public.parivaar_registrations r
    left join public.villages v on v.village_code = r.village_code
    left join public.states s on s.state_code = coalesce(v.state_code, r.state_code)
    left join public.districts d on d.district_code = coalesce(v.district_code, r.district_code)
    left join public.subdistricts_blocks sb on sb.subdistrict_code = coalesce(v.subdistrict_code, r.subdistrict_code)
    where r.status = 'approved'
      and (p_state_code is null or p_state_code = '' or r.state_code = p_state_code or v.state_code = p_state_code)
      and (p_district_code is null or p_district_code = '' or r.district_code = p_district_code or v.district_code = p_district_code)
      and (
        p_subdistrict_code is null
        or p_subdistrict_code = ''
        or r.subdistrict_code = p_subdistrict_code
        or v.subdistrict_code = p_subdistrict_code
        or v.block_code = p_subdistrict_code
      )
      and (p_village_code is null or p_village_code = '' or r.village_code = p_village_code or v.village_code = p_village_code)
      and (
        v_q is null
        or lower(coalesce(r.family_id, '')) like ('%' || v_q || '%')
        or (r.public_visibility <> 'private' and lower(r.full_name) like ('%' || v_q || '%'))
        or (r.public_visibility <> 'private' and lower(coalesce(r.father_name, '')) like ('%' || v_q || '%'))
        or lower(coalesce(r.thikana, '')) like ('%' || v_q || '%')
        or lower(coalesce(v.name_en, '')) like ('%' || v_q || '%')
        or lower(coalesce(r.village_code, '')) like ('%' || v_q || '%')
      )
    order by r.family_id asc, r.created_at desc
    limit v_page_size offset v_offset
  ) t;

  return jsonb_build_object(
    'ok', true,
    'families', v_rows,
    'total', v_total,
    'total_members', v_members,
    'page', v_page,
    'page_size', v_page_size,
    'visibility_policy', 'public_basic'
  );
end;
$$;

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

-- ---------------------------------------------------------------------------
-- 5. Row Level Security policies (re-created idempotently; no data change)
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
-- 6. EXECUTE privileges for the API roles
--    PostgREST only lists a function its connection role can execute, so a
--    missing grant is indistinguishable from a missing function.  Roles are
--    only referenced when they exist, so this also runs on plain PostgreSQL.
-- ---------------------------------------------------------------------------

revoke all on function public.submit_parivaar_registration(
  text, text, text, text, text, text, text, text, boolean, boolean,
  text, integer, text, text, text, text, text
) from public;
revoke all on function public.submit_missing_location_report(
  text, text, text, text, text, text, text, text, text, text
) from public;
revoke all on function public.get_parivaar_summary_stats() from public;
revoke all on function public.get_public_parivaar_families(
  text, text, text, text, text, integer, integer
) from public;
revoke all on function public.get_parivaar_map_aggregates(text, text) from public;

do $$
declare
  v_role text;
begin
  foreach v_role in array array['anon', 'authenticated']
  loop
    continue when not exists (select 1 from pg_roles where rolname = v_role);

    execute format('grant usage on schema public to %I', v_role);
    execute format(
      'grant execute on function public.submit_parivaar_registration(%s) to %I',
      'text, text, text, text, text, text, text, text, boolean, boolean, text, integer, text, text, text, text, text',
      v_role);
    execute format(
      'grant execute on function public.submit_missing_location_report(%s) to %I',
      'text, text, text, text, text, text, text, text, text, text', v_role);
    execute format('grant execute on function public.get_parivaar_summary_stats() to %I', v_role);
    execute format(
      'grant execute on function public.get_public_parivaar_families(%s) to %I',
      'text, text, text, text, text, integer, integer', v_role);
    execute format(
      'grant execute on function public.get_parivaar_map_aggregates(%s) to %I',
      'text, text', v_role);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- 7. Tell PostgREST to rebuild its schema cache now.
--    Without this the cache keeps answering PGRST202 until the instance
--    restarts; this NOTIFY is the documented, zero-configuration reload.
-- ---------------------------------------------------------------------------

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- 8. Self-check.  Any failure raises an exception, which rolls the whole
--    migration back - a half-applied repair is worse than none.
-- ---------------------------------------------------------------------------

do $$
declare
  v_args   text;
  v_role   text;
  v_target regprocedure;
begin
  select pg_get_function_identity_arguments(p.oid)
    into v_args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'submit_parivaar_registration';

  if v_args is null then
    raise exception
      'submit_parivaar_registration was not created - registration cannot work';
  end if;

  if v_args not like '%p_family_id%'
     or v_args not like '%p_father_name%'
     or v_args not like '%p_member_count%'
     or v_args not like '%p_village_name%' then
    raise exception
      'submit_parivaar_registration has an unexpected signature: %', v_args;
  end if;

  v_target := 'public.submit_parivaar_registration(text, text, text, text, text, text, text, text, boolean, boolean, text, integer, text, text, text, text, text)'::regprocedure;

  foreach v_role in array array['anon', 'authenticated']
  loop
    continue when not exists (select 1 from pg_roles where rolname = v_role);
    if not has_function_privilege(v_role, v_target, 'EXECUTE') then
      raise exception 'role % cannot EXECUTE submit_parivaar_registration', v_role;
    end if;
  end loop;

  raise notice 'submit_parivaar_registration is available to the API (%)', v_args;
end
$$;
