#!/usr/bin/env node
/**
 * PostgreSQL verification for the Parivaar registration RPC.
 * ---------------------------------------------------------------------------
 * Runs the ACTUAL migration SQL against a real PostgreSQL engine (PGlite, the
 * official PostgreSQL build compiled to WebAssembly) in a throw-away in-memory
 * database. Nothing here touches the production database: every row is a
 * clearly-labelled test record and the database is discarded when the process
 * exits.
 *
 * What it proves:
 *   1. the repair migration can build the Parivaar schema from nothing;
 *   2. it is idempotent (running it twice changes nothing and never fails);
 *   3. it preserves registrations, Family IDs and the per-village counters when
 *      applied to a database that already has data;
 *   4. `submit_parivaar_registration` resolves with the full 17-argument call
 *      used by the API *and* with the 10-argument call that the failing
 *      production request sent (backward compatibility);
 *   5. Family ID allocation stays sequential, unique and never reuses a number;
 *   6. duplicate submissions are rejected by the database;
 *   7. the public read RPCs never expose phone numbers or addresses.
 *
 * Usage: npm run test:parivaar:sql
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATION = path.join(
  ROOT,
  "supabase/migrations/20261101090000_ensure_parivaar_rpc_available.sql"
);

let passed = 0;
const results = [];

async function check(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed += 1;
    results.push({ name, ok: true });
  } catch (err) {
    console.error(`  ✕ FAILED: ${name}`);
    console.error(`    ${err?.message || err}`);
    results.push({ name, ok: false, error: String(err?.message || err) });
    process.exitCode = 1;
  }
}

/** Minimal stand-ins for the parts of Supabase this migration touches. */
const SUPABASE_SHIM = `
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text
);
create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;
`;

/** The one official village the tests register into (real LGD codes). */
const REFERENCE_ROWS = `
insert into public.states (state_code, name_en, name_local, state_or_ut, census_2011_code, latitude, longitude, coord_source, coord_verified)
values ('8', 'Rajasthan', 'राजस्थान', 'State', '08', 26.9124, 75.7873, 'LGD', true)
on conflict (state_code) do nothing;

insert into public.districts (district_code, state_code, name_en, name_local, census_2011_code, latitude, longitude, coord_source, coord_verified)
values ('94', '8', 'Bundi', 'बूंदी', '121', 25.50619, 75.81537, 'LGD', true)
on conflict (district_code) do nothing;

insert into public.subdistricts_blocks (subdistrict_code, district_code, state_code, name_en, name_local, admin_type, census_2011_code)
values ('6033', '94', '8', 'Talera', 'तालेरा', 'Tehsil', '006033')
on conflict (subdistrict_code) do nothing;

insert into public.villages (village_code, subdistrict_code, block_code, district_code, state_code, name_en, name_local, census_2011_code, latitude, longitude, coord_source, coord_verified)
values ('94494', '6033', 'BLK-639', '94', '8', 'Chhapawda', 'छापावड़ा', '094494', 25.316558, 75.788279, 'LGD + Census 2011', true)
on conflict (village_code) do nothing;
`;

/** Full 17-argument call — exactly what server/parivaarRegistration.mjs sends. */
const ARGS_V2 = [
  "p_full_name", "p_state_code", "p_district_code", "p_subdistrict_code",
  "p_village_code", "p_thikana", "p_current_address", "p_phone_number",
  "p_consent_given", "p_thikana_same_as_village", "p_father_name",
  "p_member_count", "p_family_id", "p_state_name", "p_district_name",
  "p_subdistrict_name", "p_village_name",
];

/** The 10-argument shape named in the production error message. */
const ARGS_V1 = [
  "p_full_name", "p_state_code", "p_district_code", "p_subdistrict_code",
  "p_village_code", "p_thikana", "p_current_address", "p_phone_number",
  "p_consent_given", "p_thikana_same_as_village",
];

function buildCall(params, values) {
  const names = params.map((p, i) => `${p} => $${i + 1}`).join(", ");
  return {
    sql: `select public.submit_parivaar_registration(${names}) as result`,
    values,
  };
}

function registrationValues(overrides = {}) {
  const base = {
    p_full_name: "TEST_VERIFICATION_RPC_Family",
    p_state_code: "8",
    p_district_code: "94",
    p_subdistrict_code: "6033",
    p_village_code: "94494",
    p_thikana: "Chhapawda",
    p_current_address: "Test address, Bundi",
    p_phone_number: "9812345670",
    p_consent_given: true,
    p_thikana_same_as_village: true,
    p_father_name: "Test Father",
    p_member_count: 4,
    p_family_id: null,
    p_state_name: "Rajasthan",
    p_district_name: "Bundi",
    p_subdistrict_name: "Talera",
    p_village_name: "Chhapawda",
  };
  return { ...base, ...overrides };
}

async function main() {
  let PGlite;
  try {
    ({ PGlite } = await import("@electric-sql/pglite"));
  } catch {
    console.error(
      "✕ @electric-sql/pglite is not installed. Run `npm install` (it is a devDependency) to execute the PostgreSQL suite."
    );
    process.exitCode = 1;
    return;
  }

  const migrationSql = fs.readFileSync(MIGRATION, "utf8");

  console.log("==================================================================");
  console.log("Parivaar registration RPC — PostgreSQL verification (PGlite)");
  console.log("==================================================================");

  const db = await PGlite.create();
  await db.exec(SUPABASE_SHIM);

  await check("1. Repair migration builds the whole Parivaar schema from an empty database", async () => {
    await db.exec(migrationSql);
    const procs = await db.query(
      `select pg_get_function_identity_arguments(p.oid) as args
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'submit_parivaar_registration'`
    );
    assert.equal(procs.rows.length, 1, "exactly one submit_parivaar_registration overload");
    for (const arg of ["p_family_id", "p_father_name", "p_member_count", "p_village_code", "p_village_name"]) {
      assert.ok(procs.rows[0].args.includes(arg), `signature must include ${arg}`);
    }
    for (const table of [
      "parivaar_registrations",
      "village_family_id_counters",
      "registration_audit_log",
      "missing_location_reports",
      "states",
      "districts",
      "subdistricts_blocks",
      "villages",
    ]) {
      const found = await db.query(
        `select 1 from information_schema.tables
          where table_schema = 'public' and table_name = $1`,
        [table]
      );
      assert.equal(found.rows.length, 1, `missing table ${table}`);
    }
    await db.exec(REFERENCE_ROWS);
  });

  await check("2. Migration is idempotent (second run is a clean no-op)", async () => {
    await db.exec(migrationSql);
    await db.exec(migrationSql);
  });

  await check("3. Family IDs already published by the site are reserved", async () => {
    const counter = await db.query(
      "select last_seq from public.village_family_id_counters where village_code = '94494'"
    );
    assert.equal(
      counter.rows[0]?.last_seq,
      1,
      "the counter must reserve 94494-001 for the verified Chhapawda family"
    );
  });

  await check("4. RPC resolves with the full 17-argument call and allocates the next Family ID", async () => {
    const call = buildCall(ARGS_V2, ARGS_V2.map((key) => registrationValues()[key]));
    const { rows } = await db.query(call.sql, call.values);
    const result = rows[0].result;
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.family_id, "94494-002");
    assert.equal(result.father_name, "Test Father");
    assert.equal(result.member_count, 4);
    const saved = await db.query(
      "select family_id, full_name, father_name, member_count, status from parivaar_registrations where family_id = $1",
      ["94494-002"]
    );
    assert.equal(saved.rows.length, 1);
    assert.equal(saved.rows[0].status, "approved");
  });

  await check("5. RPC still resolves with the 10-argument call from the production error", async () => {
    const values = ARGS_V1.map((key) => registrationValues()[key]);
    values[0] = "TEST_VERIFICATION_Legacy_Shape";
    values[3] = "9812345671"; // p_phone_number
    const call = buildCall(ARGS_V1, values);
    const { rows } = await db.query(call.sql, call.values);
    assert.equal(rows[0].result.ok, true, JSON.stringify(rows[0].result));
    assert.equal(rows[0].result.family_id, "94494-003");
  });

  await check("6. Duplicate submission is rejected and allocates no new Family ID", async () => {
    const v = registrationValues();
    const call = buildCall(ARGS_V2, ARGS_V2.map((key) => v[key]));
    const { rows } = await db.query(call.sql, call.values);
    assert.equal(rows[0].result.ok, false);
    assert.equal(rows[0].result.code, "DUPLICATE_REGISTRATION");
    const count = await db.query("select count(*)::int as c from parivaar_registrations");
    assert.equal(count.rows[0].c, 2);
  });

  await check("7. Family IDs stay sequential, unique and zero-padded", async () => {
    for (let i = 0; i < 9; i += 1) {
      const v = registrationValues({
        p_full_name: `TEST_VERIFICATION_Sequence_${i}`,
        p_phone_number: `98123456${String(80 + i).padStart(2, "0")}`,
      });
      const call = buildCall(ARGS_V2, ARGS_V2.map((key) => v[key]));
      const { rows } = await db.query(call.sql, call.values);
      assert.equal(rows[0].result.ok, true, JSON.stringify(rows[0].result));
      assert.equal(rows[0].result.family_id, `94494-${String(4 + i).padStart(3, "0")}`);
    }
    const dupes = await db.query(
      "select family_id, count(*) c from parivaar_registrations group by family_id having count(*) > 1"
    );
    assert.equal(dupes.rows.length, 0, "no duplicate Family IDs");
  });

  await check("8. Public read RPCs work and never expose private fields", async () => {
    const families = await db.query(
      "select public.get_public_parivaar_families(null, null, null, null, null, 1, 50) as result"
    );
    const payload = families.rows[0].result;
    assert.equal(payload.ok, true);
    assert.ok(payload.total >= 10, `expected at least 10 families, got ${payload.total}`);
    const serialized = JSON.stringify(payload);
    assert.ok(!serialized.includes("9812345670"), "phone number leaked from public RPC");
    assert.ok(!serialized.includes("Test address, Bundi"), "address leaked from public RPC");
    for (const key of Object.keys(payload.families[0])) {
      assert.ok(!["phone_number", "current_address"].includes(key), `private column ${key} exposed`);
    }

    const stats = await db.query("select public.get_parivaar_summary_stats() as result");
    assert.equal(stats.rows[0].result.total_registrations, payload.total);
    assert.equal(
      stats.rows[0].result.total_members,
      payload.total_members,
      "summary and directory member totals must agree"
    );

    const mapAgg = await db.query("select public.get_parivaar_map_aggregates(null, null) as result");
    const aggregates = mapAgg.rows[0].result;
    for (const key of ["states", "districts", "subdistricts", "villages"]) {
      assert.ok(Array.isArray(aggregates[key]), `map aggregate ${key} missing`);
    }
    assert.equal(aggregates.villages.length, 1);
    assert.equal(aggregates.villages[0].village_code, "94494");
    assert.equal(aggregates.villages[0].registration_count, payload.total);
  });

  await check("9. Re-applying the migration to a populated database preserves every record and counter", async () => {
    const before = await db.query(
      "select count(*)::int as families, coalesce(sum(member_count),0)::int as members from parivaar_registrations"
    );
    const counterBefore = await db.query(
      "select last_seq from village_family_id_counters where village_code = '94494'"
    );

    await db.exec(migrationSql);

    const after = await db.query(
      "select count(*)::int as families, coalesce(sum(member_count),0)::int as members from parivaar_registrations"
    );
    assert.deepEqual(after.rows[0], before.rows[0], "record counts changed");

    const counterAfter = await db.query(
      "select last_seq from village_family_id_counters where village_code = '94494'"
    );
    assert.equal(counterAfter.rows[0].last_seq, counterBefore.rows[0].last_seq, "counter was reset");

    const next = await db.query(
      `select public.submit_parivaar_registration(
         p_full_name => $1, p_state_code => $2, p_district_code => $3,
         p_subdistrict_code => $4, p_village_code => $5, p_thikana => $6,
         p_current_address => $7, p_phone_number => $8, p_consent_given => true,
         p_thikana_same_as_village => true) as result`,
      ["TEST_VERIFICATION_After_Reapply", "8", "94", "6033", "94494", "Chhapawda", "Test address", "9812345700"]
    );
    assert.equal(
      next.rows[0].result.family_id,
      `94494-${String(4 + 9).padStart(3, "0")}`,
      "sequence must continue where it left off"
    );
  });

  await check("10. The content store exists and only exposes public settings to visitors", async () => {
    const table = await db.query(
      `select 1 from information_schema.tables
        where table_schema = 'public' and table_name = 'site_content'`
    );
    assert.equal(table.rows.length, 1, "site_content must exist for the Parivaar store");

    // A public setting and a private (encrypted) Parivaar record row.
    await db.exec(`
      insert into public.site_content (key, value) values ('upi_id_1', 'trust@upi')
        on conflict (key) do nothing;
      insert into public.site_content (key, value) values ('parivaar_reg_v1:test', '{"enc":"x"}')
        on conflict (key) do nothing;
    `);

    await db.exec("set role anon");
    let visible;
    try {
      visible = await db.query("select key from public.site_content order by key");
    } finally {
      await db.exec("reset role");
    }
    const keys = visible.rows.map((row) => row.key);
    assert.deepEqual(keys, ["upi_id_1"], "anon must only see public settings");
    assert.ok(!keys.includes("parivaar_reg_v1:test"), "encrypted Parivaar rows must stay private");

    // The service role (used by the store) bypasses RLS: insert/update/delete work.
    await db.exec(`
      insert into public.site_content (key, value) values ('parivaar_rev_v1', '{"rev":"t1"}')
        on conflict (key) do update set value = excluded.value;
      update public.site_content set value = '{"rev":"t2"}' where key = 'parivaar_rev_v1';
    `);
    const revision = await db.query(
      "select value from public.site_content where key = 'parivaar_rev_v1'"
    );
    assert.equal(revision.rows[0].value, '{"rev":"t2"}');

    const touched = await db.query(
      "select updated_at > created_check as changed from (select updated_at, now() - interval '1 second' as created_check from public.site_content where key = 'parivaar_rev_v1') t"
    );
    assert.equal(touched.rows[0].changed, true, "updated_at must be maintained");
  });

  await check("11. Personal data is protected by RLS on the registrations table", async () => {
    const rls = await db.query(
      `select relrowsecurity from pg_class where oid = 'public.parivaar_registrations'::regclass`
    );
    assert.equal(rls.rows[0].relrowsecurity, true);
  });

  await check("12. anon/authenticated receive EXECUTE on the registration RPC", async () => {
    for (const role of ["anon", "authenticated"]) {
      const grant = await db.query(
        `select has_function_privilege($1,
           'public.submit_parivaar_registration(text, text, text, text, text, text, text, text, boolean, boolean, text, integer, text, text, text, text, text)'::regprocedure,
           'EXECUTE') as allowed`,
        [role]
      );
      assert.equal(grant.rows[0].allowed, true, `${role} cannot execute the RPC`);
    }
  });

  // -------------------------------------------------------------------------
  // Scenario: a database that already contains a *stale, differently shaped*
  // function (the most likely production state). The repair must replace it
  // without any manual DROP and still allocate Family IDs correctly.
  // -------------------------------------------------------------------------
  const staleDb = await PGlite.create();
  await staleDb.exec(SUPABASE_SHIM);
  await staleDb.exec(`
    create table public.legacy_probe (id integer);
    create function public.submit_parivaar_registration(
      p_full_name text,
      p_state_code text,
      p_district_code text,
      p_subdistrict_code text,
      p_village_code text,
      p_thikana text,
      p_current_address text,
      p_phone_number text,
      p_mohalla text,          -- renamed / extra parameter from an old draft
      p_consent_given boolean default true
    ) returns jsonb language sql as $$ select jsonb_build_object('ok', true) $$;
  `);

  await check("13. A stale differently-shaped function is replaced, not duplicated", async () => {
    await staleDb.exec(migrationSql);
    const procs = await staleDb.query(
      `select count(*)::int as c, min(pg_get_function_identity_arguments(p.oid)) as args
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'submit_parivaar_registration'`
    );
    assert.equal(procs.rows[0].c, 1, "exactly one overload must remain");
    assert.ok(procs.rows[0].args.includes("p_village_name"), "canonical signature must win");

    await staleDb.exec(REFERENCE_ROWS);
    const v = registrationValues({ p_full_name: "TEST_VERIFICATION_After_Stale_Repair" });
    const call = buildCall(ARGS_V2, ARGS_V2.map((key) => v[key]));
    const { rows } = await staleDb.query(call.sql, call.values);
    assert.equal(rows[0].result.ok, true, JSON.stringify(rows[0].result));
    assert.equal(rows[0].result.family_id, "94494-002");

    // ...and the repair stays idempotent from that state too.
    await staleDb.exec(migrationSql);
    const again = await staleDb.query("select count(*)::int as c from parivaar_registrations");
    assert.equal(again.rows[0].c, 1);
  });

  await staleDb.close();
  await db.close();

  console.log("==================================================================");
  if (passed === results.length) {
    console.log(`All ${passed} PostgreSQL checks passed (throw-away in-memory database).`);
  } else {
    console.log(`${passed}/${results.length} PostgreSQL checks passed.`);
  }
  console.log("==================================================================");
}

main().catch((err) => {
  console.error("PostgreSQL verification crashed:", err);
  process.exitCode = 1;
});
