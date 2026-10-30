-- =============================================================================
-- Parivaar performance indexes (ADDITIVE ONLY)
-- =============================================================================
-- These indexes match the exact query shapes used by the live endpoints:
--   * every public aggregate / directory query filters `status = 'approved'`
--     and then one geographic parent code;
--   * the public family listing orders by `family_id` and filters by village;
--   * the admin screen filters by status + created_at.
--
-- Nothing here changes data, drops a column, or rewrites a table.  Every
-- statement is idempotent and safe to run on the existing production database.
-- =============================================================================

-- Rewrite the single-column partial indexes as composite indexes so the
-- planner can satisfy both predicates from one index.
create index if not exists parivaar_reg_status_village_idx
  on public.parivaar_registrations (status, village_code);

create index if not exists parivaar_reg_status_district_idx
  on public.parivaar_registrations (status, district_code);

create index if not exists parivaar_reg_status_subdistrict_idx
  on public.parivaar_registrations (status, subdistrict_code);

create index if not exists parivaar_reg_status_state_idx
  on public.parivaar_registrations (status, state_code);

-- Directory ordering (`order by r.family_id asc, r.created_at desc`).
create index if not exists parivaar_reg_family_created_idx
  on public.parivaar_registrations (family_id asc, created_at desc);

-- Map / village aggregation filtered by approval status.
create index if not exists parivaar_reg_approved_village_idx
  on public.parivaar_registrations (village_code, district_code, state_code)
  where status = 'approved';

-- Village lookups by hierarchy (state -> district -> subdistrict) already exist;
-- this one covers the `block_code` equivalence used by Talera Block filters.
create index if not exists villages_block_subdistrict_idx
  on public.villages (block_code, subdistrict_code)
  where block_code is not null;

-- Keep table statistics fresh so the planner picks the new indexes.
analyze public.parivaar_registrations;
analyze public.villages;
