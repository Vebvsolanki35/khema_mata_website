-- =============================================================================
-- Safe Migration: Add `father_name` to `public.parivaar_registrations`
-- =============================================================================
-- Preserves all existing family records, family codes (`family_id`), village
-- codes, and relationships while adding support for `father_name`.
-- =============================================================================

alter table public.parivaar_registrations
  add column if not exists father_name text
    check (father_name is null or char_length(btrim(father_name)) between 2 and 120);

create index if not exists parivaar_reg_father_name_idx
  on public.parivaar_registrations (lower(father_name));
