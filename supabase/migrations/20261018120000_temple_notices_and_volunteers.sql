-- =============================================================================
-- Live Temple Notices + Seva / Volunteer Registration
-- -----------------------------------------------------------------------------
-- Run this in the Supabase SQL editor (or `supabase db push`).
--
-- The site talks to Supabase with the ANON key from the browser, so every
-- permission below is enforced by Postgres Row Level Security. Hiding admin
-- buttons in the UI is NOT a security control; these policies are.
--
-- Nothing here deletes or alters existing tables.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Authorised Trust administrators
-- ---------------------------------------------------------------------------
-- After running this, add your admin accounts, e.g.:
--   insert into public.trust_admins (user_id, email, note)
--   select id, email, 'Temple office' from auth.users where email = 'you@example.com';
create table if not exists public.trust_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text,
  note       text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- Helper used by every policy below. SECURITY DEFINER so it can read
-- trust_admins without exposing that table to clients.
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
grant execute on function public.is_trust_admin() to anon, authenticated;

-- Admins may see who else is an admin (not the public).
alter table public.trust_admins enable row level security;

drop policy if exists "trust_admins_select" on public.trust_admins;
create policy "trust_admins_select"
  on public.trust_admins for select
  to authenticated
  using (public.is_trust_admin());

-- Rows are managed directly in SQL / by a service-role key, not from the
-- browser, so no insert/update/delete policy is granted.

-- ---------------------------------------------------------------------------
-- 2. updated_at trigger (shared)
-- ---------------------------------------------------------------------------
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
-- 3. Notices
-- ---------------------------------------------------------------------------
create table if not exists public.notices (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  body          text not null,
  category      text not null default 'general'
                  check (category in ('general','darshan_timings','aarti_puja',
                                      'festival','closure','event',
                                      'visitor_instruction')),
  priority      text not null default 'normal'
                  check (priority in ('normal','important','urgent')),
  status        text not null default 'draft'
                  check (status in ('draft','published','archived')),
  is_published  boolean not null default false,
  published_at  timestamptz,              -- null = publish immediately
  event_start   date,
  event_end     date,
  expires_at    timestamptz,              -- null = never expires
  link_url      text,
  image_url     text,
  created_by    uuid references auth.users (id),
  updated_by    uuid references auth.users (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists notices_live_idx
  on public.notices (is_published, status, published_at);
create index if not exists notices_expires_idx
  on public.notices (expires_at);

-- Audit trail: one row per insert/update/delete.
create table if not exists public.notice_audit (
  id          bigserial primary key,
  notice_id   uuid references public.notices (id) on delete cascade,
  action      text not null,               -- INSERT / UPDATE / DELETE
  actor       uuid references auth.users (id),
  actor_email text,
  snapshot    jsonb,
  created_at  timestamptz not null default now()
);

create or replace function public.log_notice_change()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target uuid;
begin
  target := coalesce(new.id, old.id);
  insert into public.notice_audit (notice_id, action, actor, actor_email, snapshot)
  values (
    target,
    tg_op,
    auth.uid(),
    (select u.email from auth.users u where u.id = auth.uid()),
    to_jsonb(coalesce(new, old))
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists notices_audit_trg on public.notices;
create trigger notices_audit_trg
  after insert or update or delete on public.notices
  for each row execute function public.log_notice_change();

drop trigger if exists notices_touch_trg on public.notices;
create trigger notices_touch_trg
  before update on public.notices
  for each row execute function public.touch_updated_at();

-- RLS -----------------------------------------------------------------------
alter table public.notices enable row level security;

-- Public reads only notices that are published, within their schedule window
-- and not expired. Admins read everything, including drafts and archived.
drop policy if exists "notices_public_read" on public.notices;
create policy "notices_public_read"
  on public.notices for select
  using (
    (
      status = 'published'
      and is_published
      and (published_at is null or published_at <= now())
      and (expires_at   is null or expires_at   >  now())
    )
    or public.is_trust_admin()
  );

drop policy if exists "notices_admin_insert" on public.notices;
create policy "notices_admin_insert"
  on public.notices for insert
  to authenticated
  with check (public.is_trust_admin());

drop policy if exists "notices_admin_update" on public.notices;
create policy "notices_admin_update"
  on public.notices for update
  to authenticated
  using (public.is_trust_admin())
  with check (public.is_trust_admin());

drop policy if exists "notices_admin_delete" on public.notices;
create policy "notices_admin_delete"
  on public.notices for delete
  to authenticated
  using (public.is_trust_admin());

alter table public.notice_audit enable row level security;

drop policy if exists "notice_audit_admin_read" on public.notice_audit;
create policy "notice_audit_admin_read"
  on public.notice_audit for select
  to authenticated
  using (public.is_trust_admin());

-- ---------------------------------------------------------------------------
-- 4. Volunteer applications
-- ---------------------------------------------------------------------------
create table if not exists public.volunteer_applications (
  id                uuid primary key default gen_random_uuid(),
  full_name         text not null,
  contact_method    text not null check (contact_method in ('mobile','email')),
  mobile            text,
  email             text,
  activity          text not null check (activity in ('temple_seva','festival_event',
                                                       'construction','visitor_assistance',
                                                       'community_service','other')),
  availability_date date,
  availability_note text,
  city              text,
  message           text,
  status            text not null default 'pending'
                      check (status in ('pending','contacted','approved','declined')),
  admin_note        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- the chosen contact method must actually carry a value
  constraint volunteer_contact_present check (
    (contact_method = 'mobile' and nullif(btrim(coalesce(mobile, '')), '') is not null)
    or
    (contact_method = 'email'  and nullif(btrim(coalesce(email,  '')), '') is not null)
  )
);

create index if not exists volunteer_status_idx on public.volunteer_applications (status);
create index if not exists volunteer_activity_idx on public.volunteer_applications (activity);

drop trigger if exists volunteer_touch_trg on public.volunteer_applications;
create trigger volunteer_touch_trg
  before update on public.volunteer_applications
  for each row execute function public.touch_updated_at();

-- RLS -----------------------------------------------------------------------
alter table public.volunteer_applications enable row level security;

-- Anyone may submit an application. NO select policy for anon, so a public
-- visitor cannot read back any applicant's details — not even their own.
drop policy if exists "volunteer_public_insert" on public.volunteer_applications;
create policy "volunteer_public_insert"
  on public.volunteer_applications for insert
  to anon, authenticated
  with check (true);

drop policy if exists "volunteer_admin_read" on public.volunteer_applications;
create policy "volunteer_admin_read"
  on public.volunteer_applications for select
  to authenticated
  using (public.is_trust_admin());

drop policy if exists "volunteer_admin_update" on public.volunteer_applications;
create policy "volunteer_admin_update"
  on public.volunteer_applications for update
  to authenticated
  using (public.is_trust_admin())
  with check (public.is_trust_admin());

drop policy if exists "volunteer_admin_delete" on public.volunteer_applications;
create policy "volunteer_admin_delete"
  on public.volunteer_applications for delete
  to authenticated
  using (public.is_trust_admin());

-- =============================================================================
-- Verification queries (run these to confirm the policies behave)
-- =============================================================================
-- 1. As ANON, you should only see live notices and no volunteer rows:
--      select count(*) from public.notices;
--      select count(*) from public.volunteer_applications;  -- permission denied
--
-- 2. After adding yourself to trust_admins you should see everything,
--    including drafts, archived notices and all applications.
-- =============================================================================
