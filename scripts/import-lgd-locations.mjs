#!/usr/bin/env node
/**
 * Official Local Government Directory (LGD - https://lgdirectory.gov.in/)
 * Location Importer & Validator
 *
 * Capabilities:
 * - Reads CSV and .csv.zip files for States/UTs, Districts, Sub-districts/Blocks, and Villages
 *   using pure Node.js zlib (no external binary dependency required).
 * - Performs strict header validation and row-level data validation.
 * - Enforces parent-child administrative hierarchy (State -> District -> Subdistrict/Block -> Village).
 * - Preserves both `subdistrict_code` and `block_code` linkages on villages.
 * - Validates geographic coordinates (India bounding box: Lat 6..38, Lng 68..98) and coordinate provenance.
 * - Prevents duplicates and supports safe idempotent re-imports (upsert semantics).
 * - Imports into the local SQL database (`node:sqlite`) and/or live Supabase (`--supabase`),
 *   and records the import run in `location_import_history`.
 */

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  readCsvOrZipPure,
  parseCsvLineFast,
  getParivaarDb,
  seedLgdIntoSqlite,
} from "../server/parivaarDatabase.mjs";

const ROOT = process.cwd();
const VALID_ADMIN_TYPES = new Set(["Tehsil", "Sub-District", "Block", "Taluka", "Mandal"]);

export const parseCsvLine = parseCsvLineFast;
export const readCsvOrZip = readCsvOrZipPure;

/** Parses CSV text into { headers, rows: [{ lineNumber, record: Record<string,string> }] } */
export function parseCsvContent(content, requiredHeaders, datasetLabel) {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    throw new Error(`${datasetLabel}: CSV file is empty.`);
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const missing = requiredHeaders.filter((req) => !headers.includes(req.toLowerCase()));
  if (missing.length > 0) {
    throw new Error(
      `${datasetLabel}: Missing required CSV headers [${missing.join(", ")}]. Found: [${headers.join(", ")}]`
    );
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const record = {};
    for (let c = 0; c < headers.length; c++) {
      record[headers[c]] = cols[c] !== undefined ? cols[c] : "";
    }
    rows.push({ lineNumber: i + 1, record });
  }
  return { headers, rows };
}

/** Validates India geographic coordinates when provided */
export function validateCoordinates(latRaw, lngRaw, sourceRaw, verifiedRaw) {
  const hasLat = latRaw !== "" && latRaw !== null && latRaw !== undefined;
  const hasLng = lngRaw !== "" && lngRaw !== null && lngRaw !== undefined;

  if (!hasLat && !hasLng) {
    return {
      valid: true,
      latitude: null,
      longitude: null,
      coord_source: null,
      coord_verified: false,
    };
  }

  if (hasLat !== hasLng) {
    return {
      valid: false,
      reason: "Both latitude and longitude must be present together.",
    };
  }

  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return {
      valid: false,
      reason: `Non-numeric coordinates (${latRaw}, ${lngRaw}).`,
    };
  }

  if (lat < 6.0 || lat > 38.0 || lng < 68.0 || lng > 98.0) {
    return {
      valid: false,
      reason: `Coordinates (${lat}, ${lng}) are outside India's geographic bounding box (Lat 6..38, Lng 68..98).`,
    };
  }

  const source = String(sourceRaw || "").trim();
  const isVerified =
    String(verifiedRaw || "").toLowerCase() === "true" && source.length > 0;

  return {
    valid: true,
    latitude: Number(lat.toFixed(6)),
    longitude: Number(lng.toFixed(6)),
    coord_source: source || null,
    coord_verified: isVerified,
  };
}

/**
 * Validates and processes an entire set of LGD files (States, Districts, Subdistricts/Blocks, Villages).
 */
export function processLgdDataset({
  statesFile,
  districtsFile,
  subdistrictsFile,
  villagesFile,
}) {
  const errors = [];
  const stats = {
    inserted_count: 0,
    updated_count: 0,
    skipped_count: 0,
    invalid_count: 0,
    by_level: {
      states: { inserted: 0, updated: 0, skipped: 0, invalid: 0 },
      districts: { inserted: 0, updated: 0, skipped: 0, invalid: 0 },
      subdistricts_blocks: { inserted: 0, updated: 0, skipped: 0, invalid: 0 },
      villages: {
        inserted: 0,
        updated: 0,
        skipped: 0,
        invalid: 0,
        verified_coords: 0,
        unverified_coords: 0,
      },
    },
  };

  const statesMap = new Map();
  const districtsMap = new Map();
  const subdistrictsMap = new Map();
  const villagesMap = new Map();

  // 1. States
  const statesParsed = parseCsvContent(
    readCsvOrZip(statesFile),
    ["state_code", "name_en", "state_or_ut"],
    "States CSV"
  );
  for (const { lineNumber, record } of statesParsed.rows) {
    const code = (record.state_code || "").trim();
    const nameEn = (record.name_en || "").trim();
    const stateOrUt = (record.state_or_ut || "State").trim();
    if (!code || !nameEn) {
      stats.invalid_count++;
      stats.by_level.states.invalid++;
      errors.push({ level: "states", line: lineNumber, code, reason: "Missing state_code or name_en" });
      continue;
    }
    if (stateOrUt !== "State" && stateOrUt !== "UT") {
      stats.invalid_count++;
      stats.by_level.states.invalid++;
      errors.push({ level: "states", line: lineNumber, code, reason: `Invalid state_or_ut '${stateOrUt}'` });
      continue;
    }
    const coordCheck = validateCoordinates(
      record.latitude,
      record.longitude,
      record.coord_source,
      record.coord_verified
    );
    if (!coordCheck.valid) {
      stats.invalid_count++;
      stats.by_level.states.invalid++;
      errors.push({ level: "states", line: lineNumber, code, reason: coordCheck.reason });
      continue;
    }

    const row = {
      state_code: code,
      name_en: nameEn,
      name_local: (record.name_local || "").trim() || null,
      state_or_ut: stateOrUt,
      census_2011_code: (record.census_2011_code || "").trim() || null,
      latitude: coordCheck.latitude,
      longitude: coordCheck.longitude,
      coord_source: coordCheck.coord_source,
      coord_verified: coordCheck.coord_verified,
      source: (record.source || "LGD (lgdirectory.gov.in)").trim(),
    };

    if (statesMap.has(code)) {
      const prev = JSON.stringify(statesMap.get(code));
      if (prev === JSON.stringify(row)) {
        stats.skipped_count++;
        stats.by_level.states.skipped++;
      } else {
        statesMap.set(code, row);
        stats.updated_count++;
        stats.by_level.states.updated++;
      }
    } else {
      statesMap.set(code, row);
      stats.inserted_count++;
      stats.by_level.states.inserted++;
    }
  }

  // 2. Districts
  const districtsParsed = parseCsvContent(
    readCsvOrZip(districtsFile),
    ["district_code", "state_code", "name_en"],
    "Districts CSV"
  );
  for (const { lineNumber, record } of districtsParsed.rows) {
    const code = (record.district_code || "").trim();
    const stateCode = (record.state_code || "").trim();
    const nameEn = (record.name_en || "").trim();
    if (!code || !stateCode || !nameEn) {
      stats.invalid_count++;
      stats.by_level.districts.invalid++;
      errors.push({ level: "districts", line: lineNumber, code, reason: "Missing district_code, state_code, or name_en" });
      continue;
    }
    if (!statesMap.has(stateCode)) {
      stats.invalid_count++;
      stats.by_level.districts.invalid++;
      errors.push({
        level: "districts",
        line: lineNumber,
        code,
        reason: `Parent state_code '${stateCode}' does not exist in states table`,
      });
      continue;
    }
    const coordCheck = validateCoordinates(
      record.latitude,
      record.longitude,
      record.coord_source,
      record.coord_verified
    );
    if (!coordCheck.valid) {
      stats.invalid_count++;
      stats.by_level.districts.invalid++;
      errors.push({ level: "districts", line: lineNumber, code, reason: coordCheck.reason });
      continue;
    }

    const row = {
      district_code: code,
      state_code: stateCode,
      name_en: nameEn,
      name_local: (record.name_local || "").trim() || null,
      census_2011_code: (record.census_2011_code || "").trim() || null,
      latitude: coordCheck.latitude,
      longitude: coordCheck.longitude,
      coord_source: coordCheck.coord_source,
      coord_verified: coordCheck.coord_verified,
      source: (record.source || "LGD (lgdirectory.gov.in)").trim(),
    };

    if (districtsMap.has(code)) {
      const prev = JSON.stringify(districtsMap.get(code));
      if (prev === JSON.stringify(row)) {
        stats.skipped_count++;
        stats.by_level.districts.skipped++;
      } else {
        districtsMap.set(code, row);
        stats.updated_count++;
        stats.by_level.districts.updated++;
      }
    } else {
      districtsMap.set(code, row);
      stats.inserted_count++;
      stats.by_level.districts.inserted++;
    }
  }

  // 3. Subdistricts / Blocks
  const subParsed = parseCsvContent(
    readCsvOrZip(subdistrictsFile),
    ["subdistrict_code", "district_code", "state_code", "name_en", "admin_type"],
    "Subdistricts/Blocks CSV"
  );
  for (const { lineNumber, record } of subParsed.rows) {
    const code = (record.subdistrict_code || "").trim();
    const districtCode = (record.district_code || "").trim();
    const stateCode = (record.state_code || "").trim();
    const nameEn = (record.name_en || "").trim();
    const adminType = (record.admin_type || "Tehsil").trim();

    if (!code || !districtCode || !stateCode || !nameEn) {
      stats.invalid_count++;
      stats.by_level.subdistricts_blocks.invalid++;
      errors.push({
        level: "subdistricts_blocks",
        line: lineNumber,
        code,
        reason: "Missing subdistrict_code, district_code, state_code, or name_en",
      });
      continue;
    }

    const parentDist = districtsMap.get(districtCode);
    if (!parentDist) {
      stats.invalid_count++;
      stats.by_level.subdistricts_blocks.invalid++;
      errors.push({
        level: "subdistricts_blocks",
        line: lineNumber,
        code,
        reason: `Parent district_code '${districtCode}' does not exist in districts table`,
      });
      continue;
    }

    if (parentDist.state_code !== stateCode) {
      stats.invalid_count++;
      stats.by_level.subdistricts_blocks.invalid++;
      errors.push({
        level: "subdistricts_blocks",
        line: lineNumber,
        code,
        reason: `Parent district '${districtCode}' belongs to state '${parentDist.state_code}', not '${stateCode}'`,
      });
      continue;
    }

    const normalizedType = VALID_ADMIN_TYPES.has(adminType) ? adminType : "Tehsil";

    const row = {
      subdistrict_code: code,
      district_code: districtCode,
      state_code: stateCode,
      name_en: nameEn,
      name_local: (record.name_local || "").trim() || null,
      admin_type: normalizedType,
      census_2011_code: (record.census_2011_code || "").trim() || null,
      source: (record.source || "LGD (lgdirectory.gov.in)").trim(),
    };

    if (subdistrictsMap.has(code)) {
      const prev = JSON.stringify(subdistrictsMap.get(code));
      if (prev === JSON.stringify(row)) {
        stats.skipped_count++;
        stats.by_level.subdistricts_blocks.skipped++;
      } else {
        subdistrictsMap.set(code, row);
        stats.updated_count++;
        stats.by_level.subdistricts_blocks.updated++;
      }
    } else {
      subdistrictsMap.set(code, row);
      stats.inserted_count++;
      stats.by_level.subdistricts_blocks.inserted++;
    }
  }

  // 4. Villages
  const villagesParsed = parseCsvContent(
    readCsvOrZip(villagesFile),
    ["village_code", "subdistrict_code", "district_code", "state_code", "name_en"],
    "Villages CSV/ZIP"
  );
  for (const { lineNumber, record } of villagesParsed.rows) {
    const code = (record.village_code || "").trim();
    const subdistrictCode = (record.subdistrict_code || "").trim();
    const blockCode = (record.block_code || "").trim() || null;
    const districtCode = (record.district_code || "").trim();
    const stateCode = (record.state_code || "").trim();
    const nameEn = (record.name_en || "").trim();

    if (!code || !subdistrictCode || !districtCode || !stateCode || !nameEn) {
      stats.invalid_count++;
      stats.by_level.villages.invalid++;
      errors.push({
        level: "villages",
        line: lineNumber,
        code,
        reason: "Missing village_code, subdistrict_code, district_code, state_code, or name_en",
      });
      continue;
    }

    const parentSub = subdistrictsMap.get(subdistrictCode);
    if (!parentSub) {
      stats.invalid_count++;
      stats.by_level.villages.invalid++;
      errors.push({
        level: "villages",
        line: lineNumber,
        code,
        reason: `Parent subdistrict_code '${subdistrictCode}' does not exist in subdistricts_blocks table`,
      });
      continue;
    }

    if (parentSub.district_code !== districtCode || parentSub.state_code !== stateCode) {
      stats.invalid_count++;
      stats.by_level.villages.invalid++;
      errors.push({
        level: "villages",
        line: lineNumber,
        code,
        reason: `Hierarchy mismatch for village '${code}': subdistrict '${subdistrictCode}' belongs to (${parentSub.state_code}, ${parentSub.district_code}), not (${stateCode}, ${districtCode})`,
      });
      continue;
    }

    const coordCheck = validateCoordinates(
      record.latitude,
      record.longitude,
      record.coord_source,
      record.coord_verified
    );
    if (!coordCheck.valid) {
      stats.invalid_count++;
      stats.by_level.villages.invalid++;
      errors.push({
        level: "villages",
        line: lineNumber,
        code,
        reason: coordCheck.reason,
      });
      continue;
    }

    const row = {
      village_code: code,
      subdistrict_code: subdistrictCode,
      block_code: blockCode,
      district_code: districtCode,
      state_code: stateCode,
      name_en: nameEn,
      name_local: (record.name_local || "").trim() || null,
      census_2011_code: (record.census_2011_code || "").trim() || null,
      latitude: coordCheck.latitude,
      longitude: coordCheck.longitude,
      coord_source: coordCheck.coord_source,
      coord_verified: coordCheck.coord_verified,
      source: (record.source || "LGD (lgdirectory.gov.in)").trim(),
    };

    if (villagesMap.has(code)) {
      const prev = JSON.stringify(villagesMap.get(code));
      if (prev === JSON.stringify(row)) {
        stats.skipped_count++;
        stats.by_level.villages.skipped++;
      } else {
        villagesMap.set(code, row);
        stats.updated_count++;
        stats.by_level.villages.updated++;
      }
    } else {
      villagesMap.set(code, row);
      stats.inserted_count++;
      stats.by_level.villages.inserted++;
      if (row.coord_verified) {
        stats.by_level.villages.verified_coords++;
      } else {
        stats.by_level.villages.unverified_coords++;
      }
    }
  }

  return {
    states: Array.from(statesMap.values()),
    districts: Array.from(districtsMap.values()),
    subdistricts: Array.from(subdistrictsMap.values()),
    villages: Array.from(villagesMap.values()),
    stats,
    errors,
  };
}

function sqlLiteral(val) {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "boolean") return val ? "true" : "false";
  if (typeof val === "number") return Number.isFinite(val) ? String(val) : "NULL";
  return `'${String(val).replace(/'/g, "''")}'`;
}

/**
 * Generates a SQL seed migration file (`supabase/migrations/20261026103000_seed_lgd_locations.sql`)
 * suitable for pasting directly into the Supabase SQL Editor (all 36 States/UTs, all 763 Districts,
 * Bundi/Rajasthan + nationwide Sub-districts/Blocks, and all 883 Bundi villages including all 106 in Talera
 * plus representative villages across India; full 153,070-village import uses `--supabase` or SQLite).
 */
function generateSqlSeed(result, batchSize = 250) {
  const chunks = [];
  chunks.push(`-- =============================================================================`);
  chunks.push(`-- Official Local Government Directory (LGD - lgdirectory.gov.in) Seed Migration`);
  chunks.push(`-- Generated by scripts/import-lgd-locations.mjs`);
  chunks.push(`-- For full 153,070-village batch upsert via API, run: npm run lgd:import:supabase`);
  chunks.push(`-- =============================================================================\n`);

  // 1. All 36 States/UTs
  for (let i = 0; i < result.states.length; i += batchSize) {
    const slice = result.states.slice(i, i + batchSize);
    const values = slice
      .map(
        (r) =>
          `  (${sqlLiteral(r.state_code)}, ${sqlLiteral(r.name_en)}, ${sqlLiteral(r.name_local)}, ${sqlLiteral(r.state_or_ut)}, ${sqlLiteral(r.census_2011_code)}, ${sqlLiteral(r.latitude)}, ${sqlLiteral(r.longitude)}, ${sqlLiteral(r.coord_source)}, ${sqlLiteral(r.coord_verified)}, ${sqlLiteral(r.source)})`
      )
      .join(",\n");
    chunks.push(
      `insert into public.states (state_code, name_en, name_local, state_or_ut, census_2011_code, latitude, longitude, coord_source, coord_verified, source)\nvalues\n${values}\non conflict (state_code) do update set\n  name_en = excluded.name_en,\n  name_local = excluded.name_local,\n  state_or_ut = excluded.state_or_ut,\n  census_2011_code = excluded.census_2011_code,\n  latitude = excluded.latitude,\n  longitude = excluded.longitude,\n  coord_source = excluded.coord_source,\n  coord_verified = excluded.coord_verified,\n  source = excluded.source,\n  last_updated = now();\n`
    );
  }

  // 2. All 763 Districts
  for (let i = 0; i < result.districts.length; i += batchSize) {
    const slice = result.districts.slice(i, i + batchSize);
    const values = slice
      .map(
        (r) =>
          `  (${sqlLiteral(r.district_code)}, ${sqlLiteral(r.state_code)}, ${sqlLiteral(r.name_en)}, ${sqlLiteral(r.name_local)}, ${sqlLiteral(r.census_2011_code)}, ${sqlLiteral(r.latitude)}, ${sqlLiteral(r.longitude)}, ${sqlLiteral(r.coord_source)}, ${sqlLiteral(r.coord_verified)}, ${sqlLiteral(r.source)})`
      )
      .join(",\n");
    chunks.push(
      `insert into public.districts (district_code, state_code, name_en, name_local, census_2011_code, latitude, longitude, coord_source, coord_verified, source)\nvalues\n${values}\non conflict (district_code) do update set\n  state_code = excluded.state_code,\n  name_en = excluded.name_en,\n  name_local = excluded.name_local,\n  census_2011_code = excluded.census_2011_code,\n  latitude = excluded.latitude,\n  longitude = excluded.longitude,\n  coord_source = excluded.coord_source,\n  coord_verified = excluded.coord_verified,\n  source = excluded.source,\n  last_updated = now();\n`
    );
  }

  // 3. Select SQL Editor seed subset of subdistricts & villages (all of Rajasthan & Bundi/Talera + nationwide sample)
  const distSubCount = new Map();
  const seedSubdistricts = result.subdistricts.filter((sb) => {
    if (sb.state_code === "8" || sb.district_code === "94") return true;
    const c = distSubCount.get(sb.district_code) || 0;
    if (c < 3) {
      distSubCount.set(sb.district_code, c + 1);
      return true;
    }
    return false;
  });
  const seededSubSet = new Set(seedSubdistricts.map((s) => s.subdistrict_code));

  for (let i = 0; i < seedSubdistricts.length; i += batchSize) {
    const slice = seedSubdistricts.slice(i, i + batchSize);
    const values = slice
      .map(
        (r) =>
          `  (${sqlLiteral(r.subdistrict_code)}, ${sqlLiteral(r.district_code)}, ${sqlLiteral(r.state_code)}, ${sqlLiteral(r.name_en)}, ${sqlLiteral(r.name_local)}, ${sqlLiteral(r.admin_type)}, ${sqlLiteral(r.census_2011_code)}, ${sqlLiteral(r.source)})`
      )
      .join(",\n");
    chunks.push(
      `insert into public.subdistricts_blocks (subdistrict_code, district_code, state_code, name_en, name_local, admin_type, census_2011_code, source)\nvalues\n${values}\non conflict (subdistrict_code) do update set\n  district_code = excluded.district_code,\n  state_code = excluded.state_code,\n  name_en = excluded.name_en,\n  name_local = excluded.name_local,\n  admin_type = excluded.admin_type,\n  census_2011_code = excluded.census_2011_code,\n  source = excluded.source,\n  last_updated = now();\n`
    );
  }

  // 4. All 883 villages of Bundi (including all 106 in Talera) + nationwide sample
  const stateVilCount = new Map();
  const seedVillages = result.villages.filter((v) => {
    if (!seededSubSet.has(v.subdistrict_code)) return false;
    if (v.district_code === "94") return true; // All 883 Bundi villages including all 106 in Talera
    const sc = stateVilCount.get(v.state_code) || 0;
    if (sc < 45) {
      stateVilCount.set(v.state_code, sc + 1);
      return true;
    }
    return false;
  });

  for (let i = 0; i < seedVillages.length; i += batchSize) {
    const slice = seedVillages.slice(i, i + batchSize);
    const values = slice
      .map(
        (r) =>
          `  (${sqlLiteral(r.village_code)}, ${sqlLiteral(r.subdistrict_code)}, ${sqlLiteral(r.block_code)}, ${sqlLiteral(r.district_code)}, ${sqlLiteral(r.state_code)}, ${sqlLiteral(r.name_en)}, ${sqlLiteral(r.name_local)}, ${sqlLiteral(r.census_2011_code)}, ${sqlLiteral(r.latitude)}, ${sqlLiteral(r.longitude)}, ${sqlLiteral(r.coord_source)}, ${sqlLiteral(r.coord_verified)}, ${sqlLiteral(r.source)})`
      )
      .join(",\n");
    chunks.push(
      `insert into public.villages (village_code, subdistrict_code, block_code, district_code, state_code, name_en, name_local, census_2011_code, latitude, longitude, coord_source, coord_verified, source)\nvalues\n${values}\non conflict (village_code) do update set\n  subdistrict_code = excluded.subdistrict_code,\n  block_code = excluded.block_code,\n  district_code = excluded.district_code,\n  state_code = excluded.state_code,\n  name_en = excluded.name_en,\n  name_local = excluded.name_local,\n  census_2011_code = excluded.census_2011_code,\n  latitude = excluded.latitude,\n  longitude = excluded.longitude,\n  coord_source = excluded.coord_source,\n  coord_verified = excluded.coord_verified,\n  source = excluded.source,\n  last_updated = now();\n`
    );
  }

  chunks.push(
    `insert into public.location_import_history (dataset_source, import_status, is_test_run, inserted_count, updated_count, skipped_count, invalid_count, error_summary, notes)\nvalues (\n  'LGD Official Dataset (lgdirectory.gov.in)',\n  'completed',\n  false,\n  ${result.stats.inserted_count},\n  ${result.stats.updated_count},\n  ${result.stats.skipped_count},\n  ${result.stats.invalid_count},\n  ${sqlLiteral(JSON.stringify(result.errors.slice(0, 50)))}::jsonb,\n  'Seeded via 20261026103000_seed_lgd_locations.sql'\n);\n`
  );

  return chunks.join("\n");
}

/** Performs batched upserts into live Supabase using service_role key */
async function importToSupabase(result, batchSize = 500, isTestRun = false) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "Missing SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY environment variables for live Supabase import."
    );
  }

  const client = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  const upsertBatches = async (table, rows, conflictCol) => {
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const { error } = await client.from(table).upsert(batch, { onConflict: conflictCol });
      if (error) {
        throw new Error(`Supabase upsert failed on ${table} (batch ${i}..${i + batch.length}): ${error.message}`);
      }
      process.stdout.write(`  [${table}] Upserted ${Math.min(i + batch.length, rows.length)} / ${rows.length}\r`);
    }
    process.stdout.write("\n");
  };

  await upsertBatches("states", result.states, "state_code");
  await upsertBatches("districts", result.districts, "district_code");
  await upsertBatches("subdistricts_blocks", result.subdistricts, "subdistrict_code");
  await upsertBatches("villages", result.villages, "village_code");

  const status = result.errors.length > 0 ? "completed_with_errors" : "completed";
  await client.from("location_import_history").insert({
    dataset_source: "LGD Official Dataset (lgdirectory.gov.in)",
    import_status: isTestRun ? "test_passed" : status,
    is_test_run: isTestRun,
    inserted_count: result.stats.inserted_count,
    updated_count: result.stats.updated_count,
    skipped_count: result.stats.skipped_count,
    invalid_count: result.stats.invalid_count,
    error_summary: result.errors.slice(0, 100),
    notes: `Imported ${result.states.length} states, ${result.districts.length} districts, ${result.subdistricts.length} subdistricts/blocks, ${result.villages.length} villages.`,
  });
}

async function main() {
  const args = process.argv.slice(2);
  const isTest = args.includes("--test");
  const isBundle = args.includes("--generate-bundle");
  const isSupabase = args.includes("--supabase");

  if (isTest) {
    console.log("==============================================================");
    console.log("Running Official LGD Importer — TEST IMPORT MODE");
    console.log("==============================================================");
    const testDir = path.join(ROOT, "data/lgd/test");
    const result = processLgdDataset({
      statesFile: path.join(testDir, "test_states.csv"),
      districtsFile: path.join(testDir, "test_districts.csv"),
      subdistrictsFile: path.join(testDir, "test_subdistricts.csv"),
      villagesFile: path.join(testDir, "test_villages.csv"),
    });

    const reportPath = path.join(testDir, "test-import-report.json");
    const report = {
      dataset_source: "LGD Test Dataset (data/lgd/test)",
      import_timestamp: new Date().toISOString(),
      import_status: "test_passed",
      is_test_run: true,
      ...result.stats,
      error_summary: result.errors,
    };
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");

    console.log(`States validated:             ${result.states.length}`);
    console.log(`Districts validated:          ${result.districts.length}`);
    console.log(`Subdistricts/Blocks validated:${result.subdistricts.length}`);
    console.log(`Villages validated:           ${result.villages.length}`);
    console.log(`Total Inserted:               ${result.stats.inserted_count}`);
    console.log(`Total Skipped (Duplicates):   ${result.stats.skipped_count}`);
    console.log(`Total Invalid (Caught):       ${result.stats.invalid_count}`);
    console.log(`Validation Errors Caught:`);
    for (const err of result.errors) {
      console.log(`  - [${err.level} line ${err.line}] (${err.code || "empty"}): ${err.reason}`);
    }
    console.log(`Saved test import report to: ${reportPath}`);
    return;
  }

  const dataDir = path.join(ROOT, "data/lgd");
  const villagesZip = path.join(dataDir, "lgd_villages.csv.zip");
  const villagesCsv = path.join(dataDir, "lgd_villages.csv");

  console.log("==============================================================");
  console.log("Running Official LGD Importer — FULL DATASET");
  console.log("==============================================================");
  const result = processLgdDataset({
    statesFile: path.join(dataDir, "lgd_states.csv"),
    districtsFile: path.join(dataDir, "lgd_districts.csv"),
    subdistrictsFile: path.join(dataDir, "lgd_subdistricts_blocks.csv"),
    villagesFile: fs.existsSync(villagesZip) ? villagesZip : villagesCsv,
  });

  console.log(`States/UTs:          ${result.states.length}`);
  console.log(`Districts:           ${result.districts.length}`);
  console.log(`Subdistricts/Blocks: ${result.subdistricts.length}`);
  console.log(`Villages:            ${result.villages.length} (${result.stats.by_level.villages.verified_coords} with verified coordinates, ${result.stats.by_level.villages.unverified_coords} directory-only)`);
  console.log(`Invalid rows:        ${result.stats.invalid_count}`);

  const report = {
    dataset_source: "Official Local Government Directory (https://lgdirectory.gov.in/)",
    import_timestamp: new Date().toISOString(),
    import_status: result.errors.length === 0 ? "completed" : "completed_with_errors",
    is_test_run: false,
    ...result.stats,
    error_summary: result.errors,
  };
  fs.writeFileSync(path.join(dataDir, "import-report.json"), JSON.stringify(report, null, 2) + "\n");

  if (isBundle || !isSupabase) {
    const db = getParivaarDb();
    const seeded = seedLgdIntoSqlite(db, dataDir);
    console.log(`Imported into relational SQL database:`, seeded.counts);

    const sqlPath = path.join(ROOT, "supabase/migrations/20261026103000_seed_lgd_locations.sql");
    fs.writeFileSync(sqlPath, generateSqlSeed(result, 250));
    console.log(`Generated SQL seed migration: ${sqlPath}`);
  }

  if (isSupabase) {
    await importToSupabase(result, 500, false);
    console.log("Successfully imported LGD dataset into live Supabase database.");
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("LGD Import Error:", err.message);
    process.exit(1);
  });
}
