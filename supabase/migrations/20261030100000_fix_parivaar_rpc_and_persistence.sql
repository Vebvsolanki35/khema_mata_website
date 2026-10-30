-- =============================================================================
-- Safe Migration: Fix `submit_parivaar_registration` RPC, Family ID Generation,
-- `father_name` / `member_count` Persistence, and Public Directory RPCs
-- =============================================================================
-- Preserves all existing records, family codes (`family_id`), and village codes.
-- =============================================================================

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

-- Drop the old 10-argument signature before replacing with the extended backward-compatible signature
drop function if exists public.submit_parivaar_registration(
  text, text, text, text, text, text, text, text, boolean, boolean
);

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

revoke all on function public.submit_parivaar_registration(
  text, text, text, text, text, text, text, text, boolean, boolean, text, integer, text, text, text, text, text
) from public;
grant execute on function public.submit_parivaar_registration(
  text, text, text, text, text, text, text, text, boolean, boolean, text, integer, text, text, text, text, text
) to anon, authenticated;

-- Update Summary Statistics RPC to include `total_members`
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

revoke all on function public.get_parivaar_summary_stats() from public;
grant execute on function public.get_parivaar_summary_stats() to anon, authenticated;

-- Privacy-Safe Public Family Directory RPC (never exposes phone_number or current_address)
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
    coalesce(sum(r.member_count), 0)::integer
  into v_total, v_members
  from public.parivaar_registrations r
  left join public.villages v on v.village_code = r.village_code
  where r.status = 'approved'
    and (p_state_code is null or p_state_code = '' or r.state_code = p_state_code)
    and (p_district_code is null or p_district_code = '' or r.district_code = p_district_code)
    and (p_subdistrict_code is null or p_subdistrict_code = '' or r.subdistrict_code = p_subdistrict_code)
    and (p_village_code is null or p_village_code = '' or r.village_code = p_village_code)
    and (
      v_q is null
      or lower(coalesce(r.family_id, '')) like ('%' || v_q || '%')
      or (r.public_visibility <> 'private' and lower(r.full_name) like ('%' || v_q || '%'))
      or (r.public_visibility <> 'private' and lower(coalesce(r.father_name, '')) like ('%' || v_q || '%'))
      or lower(coalesce(r.thikana, '')) like ('%' || v_q || '%')
      or lower(coalesce(v.name_en, '')) like ('%' || v_q || '%')
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
      r.state_code,
      coalesce(s.name_en, r.state_code) as state_name,
      r.district_code,
      coalesce(d.name_en, r.district_code) as district_name,
      r.subdistrict_code,
      coalesce(sb.name_en, r.subdistrict_code) as subdistrict_name,
      coalesce(sb.admin_type, 'Tehsil') as admin_type,
      r.village_code,
      coalesce(v.name_en, r.thikana) as village_name,
      r.created_at
    from public.parivaar_registrations r
    left join public.states s on s.state_code = r.state_code
    left join public.districts d on d.district_code = r.district_code
    left join public.subdistricts_blocks sb on sb.subdistrict_code = r.subdistrict_code
    left join public.villages v on v.village_code = r.village_code
    where r.status = 'approved'
      and (p_state_code is null or p_state_code = '' or r.state_code = p_state_code)
      and (p_district_code is null or p_district_code = '' or r.district_code = p_district_code)
      and (p_subdistrict_code is null or p_subdistrict_code = '' or r.subdistrict_code = p_subdistrict_code)
      and (p_village_code is null or p_village_code = '' or r.village_code = p_village_code)
      and (
        v_q is null
        or lower(coalesce(r.family_id, '')) like ('%' || v_q || '%')
        or (r.public_visibility <> 'private' and lower(r.full_name) like ('%' || v_q || '%'))
        or (r.public_visibility <> 'private' and lower(coalesce(r.father_name, '')) like ('%' || v_q || '%'))
        or lower(coalesce(r.thikana, '')) like ('%' || v_q || '%')
        or lower(coalesce(v.name_en, '')) like ('%' || v_q || '%')
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

revoke all on function public.get_public_parivaar_families(text, text, text, text, text, integer, integer) from public;
grant execute on function public.get_public_parivaar_families(text, text, text, text, text, integer, integer) to anon, authenticated;
