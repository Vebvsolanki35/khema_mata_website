-- =============================================================================
-- Broadcast Center (प्रसारण केंद्र)
-- -----------------------------------------------------------------------------
-- Extends the existing notices system. Nothing here drops or rewrites existing
-- tables, data or policies. Run AFTER 20261018120000_temple_notices_and_volunteers.sql.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Notices: per-announcement language
-- ---------------------------------------------------------------------------
-- The public site switches between hi/en/gu. Each announcement records the
-- language it was written in, so the right version is shown to each visitor.
alter table public.notices
  add column if not exists language text not null default 'hi';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'notices_language_check' and conrelid = 'public.notices'::regclass
  ) then
    alter table public.notices
      add constraint notices_language_check check (language in ('hi', 'en', 'gu'));
  end if;
end $$;

create index if not exists notices_language_idx on public.notices (language);

-- ---------------------------------------------------------------------------
-- 2. Notices: add Seva and Emergency categories
-- ---------------------------------------------------------------------------
-- The original check constraint is replaced with a superset. Every previously
-- valid value stays valid, so no existing row can be invalidated.
alter table public.notices drop constraint if exists notices_category_check;

alter table public.notices
  add constraint notices_category_check
  check (category in (
    'general',              -- General Notice
    'darshan_timings',      -- Darshan Timings
    'aarti_puja',           -- Aarti / Puja
    'festival',             -- Festival
    'closure',              -- Temple Closure
    'event',                -- Religious Event
    'visitor_instruction',  -- Visitor instruction
    'seva',                 -- Seva
    'emergency'             -- Emergency
  ));

-- ---------------------------------------------------------------------------
-- 3. Broadcast deliveries — channel status, one row per (notice, channel, target)
-- ---------------------------------------------------------------------------
-- Status vocabulary is deliberately conservative:
--   pending      queued, not yet attempted
--   link_opened  admin opened a WhatsApp share link. THIS IS NOT "sent" —
--                the message is only sent if the admin completes it in WhatsApp.
--   sent         the provider accepted the message
--   delivered    CONFIRMED by the provider API or its webhook
--   failed       the provider rejected it / transport error
--   skipped      channel not configured or admin chose not to use it
--
-- A row must never be written with 'sent' or 'delivered' unless a provider
-- actually confirmed it.
create table if not exists public.broadcast_deliveries (
  id                  uuid primary key default gen_random_uuid(),
  notice_id           uuid not null references public.notices (id) on delete cascade,
  channel             text not null check (channel in ('website', 'whatsapp_share', 'whatsapp_business')),
  recipient_ref       text not null default 'public',
  status              text not null default 'pending'
                        check (status in ('pending','link_opened','sent','delivered','failed','skipped')),
  attempts            integer not null default 0,
  provider_message_id text,
  last_error          text,
  created_by          uuid references auth.users (id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Retry safety: one row per (notice, channel, recipient). Re-running a failed
-- delivery updates the existing row and bumps `attempts` instead of inserting a
-- duplicate successful send.
create unique index if not exists broadcast_deliveries_unique
  on public.broadcast_deliveries (notice_id, channel, recipient_ref);

create index if not exists broadcast_deliveries_notice_idx
  on public.broadcast_deliveries (notice_id);

drop trigger if exists broadcast_deliveries_touch_trg on public.broadcast_deliveries;
create trigger broadcast_deliveries_touch_trg
  before update on public.broadcast_deliveries
  for each row execute function public.touch_updated_at();

alter table public.broadcast_deliveries enable row level security;

-- Admins only. Ordinary visitors have NO policy at all on this table, so they
-- cannot read delivery records or admin metadata.
drop policy if exists "broadcast_deliveries_admin_read" on public.broadcast_deliveries;
create policy "broadcast_deliveries_admin_read"
  on public.broadcast_deliveries for select
  to authenticated
  using (public.is_trust_admin());

drop policy if exists "broadcast_deliveries_admin_write" on public.broadcast_deliveries;
create policy "broadcast_deliveries_admin_write"
  on public.broadcast_deliveries for insert
  to authenticated
  with check (public.is_trust_admin());

drop policy if exists "broadcast_deliveries_admin_update" on public.broadcast_deliveries;
create policy "broadcast_deliveries_admin_update"
  on public.broadcast_deliveries for update
  to authenticated
  using (public.is_trust_admin())
  with check (public.is_trust_admin());

-- ---------------------------------------------------------------------------
-- 4. Optional image / poster storage
-- ---------------------------------------------------------------------------
-- Announcements may carry an image. Admins upload; the public can read.
insert into storage.buckets (id, name, public)
values ('notice-media', 'notice-media', true)
on conflict (id) do nothing;

drop policy if exists "notice_media_public_read" on storage.objects;
create policy "notice_media_public_read"
  on storage.objects for select
  using (bucket_id = 'notice-media');

drop policy if exists "notice_media_admin_insert" on storage.objects;
create policy "notice_media_admin_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'notice-media' and public.is_trust_admin());

drop policy if exists "notice_media_admin_delete" on storage.objects;
create policy "notice_media_admin_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'notice-media' and public.is_trust_admin());

-- =============================================================================
-- NOTE ON SCHEDULED PUBLISHING (how it stays reliable without a browser open)
-- =============================================================================
-- There is no background job, because none is needed: visibility is computed
-- SERVER-SIDE at read time. The public query filters on
--
--     status = 'published'
--     AND is_published
--     AND (published_at IS NULL OR published_at <= now())
--     AND (expires_at   IS NULL OR expires_at   >  now())
--
-- `now()` is evaluated by Postgres on every request, so a notice whose
-- published_at has just passed becomes visible on the next page load even if
-- no administrator has opened the dashboard since scheduling it. Likewise an
-- expired notice drops out immediately.
--
-- The admin "Schedule" action therefore sets status='published' and
-- is_published=true while leaving published_at in the future — the time gate
-- is the only thing holding it back, and it needs no process to release it.
--
-- If you later want the row's own fields to flip (e.g. for reporting), you can
-- enable pg_cron in the Supabase dashboard and schedule:
--   select cron.schedule('publish-due-notices', '* * * * *',
--     $$ update public.notices set is_published = true
--        where status = 'published' and published_at <= now()
--          and not is_published $$);
-- This is optional and changes only how the row looks in the admin list, not
-- what the public sees.
-- =============================================================================
