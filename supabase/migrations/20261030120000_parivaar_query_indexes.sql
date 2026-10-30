-- Parivaar query indexes
-- ---------------------------------------------------------------------------
-- Additive only: no column is added, no row is modified, nothing is dropped.
-- Every statement is idempotent, so running it twice is safe.
--
-- The indexes mirror the filters the API actually sends:
--   * the public directory / overview aggregate on status = 'approved' combined
--     with one geographic parent code (state, district, tehsil or village);
--   * the family listing is ordered by created_at for a given family id;
--   * village lookups filter by district + tehsil.
--
-- Apply with the normal Supabase migration workflow. The application works
-- without them (they only steer the query planner).

create index if not exists parivaar_reg_status_state_idx
  on public.parivaar_registrations (status, state_code);

create index if not exists parivaar_reg_status_district_idx
  on public.parivaar_registrations (status, district_code);

create index if not exists parivaar_reg_status_subdistrict_idx
  on public.parivaar_registrations (status, subdistrict_code);

create index if not exists parivaar_reg_status_village_idx
  on public.parivaar_registrations (status, village_code);

create index if not exists parivaar_reg_family_id_created_idx
  on public.parivaar_registrations (family_id, created_at desc);

-- The public directory never exposes private rows, so the approved-public
-- subset is a useful partial index for village level listings.
create index if not exists parivaar_reg_public_village_idx
  on public.parivaar_registrations (village_code, created_at desc)
  where status = 'approved';

-- Reference-data lookups used by the cascading State -> District -> Tehsil ->
-- Village selectors (idempotent: the tables may already carry these indexes).
create index if not exists villages_subdistrict_code_idx
  on public.villages (subdistrict_code);

create index if not exists villages_block_code_idx
  on public.villages (block_code);

-- Keep planner statistics fresh for the newly indexed columns.
analyze public.parivaar_registrations;
analyze public.villages;
