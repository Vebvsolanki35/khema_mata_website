import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const ROOT = process.cwd();

/**
 * Pure-Node ZIP/CSV reader (no external `unzip` binary required; works in local Node and Vercel Serverless).
 */
export function readCsvOrZipPure(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Dataset file not found: ${filePath}`);
  }
  if (!filePath.endsWith(".zip")) {
    return fs.readFileSync(filePath, "utf8");
  }

  const buf = fs.readFileSync(filePath);
  if (buf.length < 30 || buf.readUInt32LE(0) !== 0x04034b50) {
    throw new Error(`Invalid ZIP archive header: ${filePath}`);
  }

  // Locate End of Central Directory (EOCD: 0x06054b50)
  let eocdOffset = buf.length - 22;
  const minOffset = Math.max(0, buf.length - 65557);
  while (eocdOffset >= minOffset && buf.readUInt32LE(eocdOffset) !== 0x06054b50) {
    eocdOffset--;
  }
  if (eocdOffset < minOffset) {
    throw new Error(`Could not locate ZIP central directory in ${filePath}`);
  }

  const totalEntries = buf.readUInt16LE(eocdOffset + 10);
  let cdPtr = buf.readUInt32LE(eocdOffset + 16);

  for (let i = 0; i < totalEntries; i++) {
    if (buf.readUInt32LE(cdPtr) !== 0x02014b50) break;
    const compressionMethod = buf.readUInt16LE(cdPtr + 10);
    const compressedSize = buf.readUInt32LE(cdPtr + 20);
    const fileNameLen = buf.readUInt16LE(cdPtr + 28);
    const extraLen = buf.readUInt16LE(cdPtr + 30);
    const commentLen = buf.readUInt16LE(cdPtr + 32);
    const localHeaderOffset = buf.readUInt32LE(cdPtr + 42);
    const entryName = buf.subarray(cdPtr + 46, cdPtr + 46 + fileNameLen).toString("utf8");

    cdPtr += 46 + fileNameLen + extraLen + commentLen;

    if (entryName.endsWith(".csv") && !entryName.startsWith("__MACOSX")) {
      const localNameLen = buf.readUInt16LE(localHeaderOffset + 26);
      const localExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
      const slice = buf.subarray(dataStart, dataStart + compressedSize);
      if (compressionMethod === 0) {
        return slice.toString("utf8");
      }
      if (compressionMethod === 8) {
        return zlib.inflateRawSync(slice).toString("utf8");
      }
      throw new Error(`Unsupported ZIP compression method ${compressionMethod} in ${filePath}`);
    }
  }

  throw new Error(`No .csv entry found inside ZIP archive: ${filePath}`);
}

/** RFC-4180 CSV line parser */
export function parseCsvLineFast(line) {
  if (!line.includes('"')) {
    return line.split(",").map((s) => s.trim());
  }
  const cols = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      cols.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  cols.push(cur.trim());
  return cols;
}

/**
 * Resolves writable SQLite database path (.cache/parivaar.sqlite locally, /tmp/parivaar.sqlite on read-only serverless).
 */
export function resolveSqliteDbPath(customPath = null) {
  if (customPath) return customPath;
  if (process.env.PARIVAAR_SQLITE_PATH) return process.env.PARIVAAR_SQLITE_PATH;

  const localCacheDir = path.join(ROOT, ".cache");
  try {
    fs.mkdirSync(localCacheDir, { recursive: true });
    fs.accessSync(localCacheDir, fs.constants.W_OK);
    return path.join(localCacheDir, "parivaar.sqlite");
  } catch {
    return path.join("/tmp", "parivaar.sqlite");
  }
}

export function initParivaarSchema(db) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS states (
      state_code       TEXT PRIMARY KEY,
      name_en          TEXT NOT NULL,
      name_local       TEXT,
      state_or_ut      TEXT NOT NULL DEFAULT 'State' CHECK (state_or_ut IN ('State', 'UT')),
      census_2011_code TEXT,
      latitude         REAL CHECK (latitude IS NULL OR (latitude >= 6.0 AND latitude <= 38.0)),
      longitude        REAL CHECK (longitude IS NULL OR (longitude >= 68.0 AND longitude <= 98.0)),
      coord_source     TEXT,
      coord_verified   INTEGER NOT NULL DEFAULT 0,
      source           TEXT NOT NULL DEFAULT 'LGD (lgdirectory.gov.in)',
      last_updated     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS states_name_en_idx ON states (name_en COLLATE NOCASE);

    CREATE TABLE IF NOT EXISTS districts (
      district_code    TEXT PRIMARY KEY,
      state_code       TEXT NOT NULL REFERENCES states (state_code) ON DELETE RESTRICT,
      name_en          TEXT NOT NULL,
      name_local       TEXT,
      census_2011_code TEXT,
      latitude         REAL CHECK (latitude IS NULL OR (latitude >= 6.0 AND latitude <= 38.0)),
      longitude        REAL CHECK (longitude IS NULL OR (longitude >= 68.0 AND longitude <= 98.0)),
      coord_source     TEXT,
      coord_verified   INTEGER NOT NULL DEFAULT 0,
      source           TEXT NOT NULL DEFAULT 'LGD (lgdirectory.gov.in)',
      last_updated     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS districts_state_code_idx ON districts (state_code);
    CREATE INDEX IF NOT EXISTS districts_name_en_idx ON districts (name_en COLLATE NOCASE);

    CREATE TABLE IF NOT EXISTS subdistricts_blocks (
      subdistrict_code TEXT PRIMARY KEY,
      district_code    TEXT NOT NULL REFERENCES districts (district_code) ON DELETE RESTRICT,
      state_code       TEXT NOT NULL REFERENCES states (state_code) ON DELETE RESTRICT,
      name_en          TEXT NOT NULL,
      name_local       TEXT,
      admin_type       TEXT NOT NULL DEFAULT 'Tehsil'
                         CHECK (admin_type IN ('Tehsil', 'Sub-District', 'Block', 'Taluka', 'Mandal')),
      census_2011_code TEXT,
      source           TEXT NOT NULL DEFAULT 'LGD (lgdirectory.gov.in)',
      last_updated     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS subdistricts_district_code_idx ON subdistricts_blocks (district_code);
    CREATE INDEX IF NOT EXISTS subdistricts_state_code_idx ON subdistricts_blocks (state_code);
    CREATE INDEX IF NOT EXISTS subdistricts_name_en_idx ON subdistricts_blocks (name_en COLLATE NOCASE);

    CREATE TABLE IF NOT EXISTS villages (
      village_code     TEXT PRIMARY KEY,
      subdistrict_code TEXT NOT NULL REFERENCES subdistricts_blocks (subdistrict_code) ON DELETE RESTRICT,
      block_code       TEXT,
      district_code    TEXT NOT NULL REFERENCES districts (district_code) ON DELETE RESTRICT,
      state_code       TEXT NOT NULL REFERENCES states (state_code) ON DELETE RESTRICT,
      name_en          TEXT NOT NULL,
      name_local       TEXT,
      census_2011_code TEXT,
      latitude         REAL CHECK (latitude IS NULL OR (latitude >= 6.0 AND latitude <= 38.0)),
      longitude        REAL CHECK (longitude IS NULL OR (longitude >= 68.0 AND longitude <= 98.0)),
      coord_source     TEXT,
      coord_verified   INTEGER NOT NULL DEFAULT 0,
      source           TEXT NOT NULL DEFAULT 'LGD (lgdirectory.gov.in)',
      last_updated     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS villages_subdistrict_code_idx ON villages (subdistrict_code);
    CREATE INDEX IF NOT EXISTS villages_block_code_idx ON villages (block_code);
    CREATE INDEX IF NOT EXISTS villages_district_code_idx ON villages (district_code);
    CREATE INDEX IF NOT EXISTS villages_state_code_idx ON villages (state_code);
    CREATE INDEX IF NOT EXISTS villages_name_en_idx ON villages (name_en COLLATE NOCASE);

    CREATE TABLE IF NOT EXISTS location_import_history (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      dataset_source   TEXT NOT NULL,
      import_timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      import_status    TEXT NOT NULL CHECK (import_status IN ('running', 'completed', 'completed_with_errors', 'failed', 'test_passed')),
      is_test_run      INTEGER NOT NULL DEFAULT 0,
      inserted_count   INTEGER NOT NULL DEFAULT 0,
      updated_count    INTEGER NOT NULL DEFAULT 0,
      skipped_count    INTEGER NOT NULL DEFAULT 0,
      invalid_count    INTEGER NOT NULL DEFAULT 0,
      error_summary    TEXT NOT NULL DEFAULT '[]',
      notes            TEXT
    );

    CREATE TABLE IF NOT EXISTS parivaar_registrations (
      id                      TEXT PRIMARY KEY,
      family_id               TEXT UNIQUE,
      full_name               TEXT NOT NULL,
      father_name             TEXT,
      member_count            INTEGER NOT NULL DEFAULT 1 CHECK (member_count >= 1),
      state_code              TEXT NOT NULL REFERENCES states (state_code) ON DELETE RESTRICT,
      district_code           TEXT NOT NULL REFERENCES districts (district_code) ON DELETE RESTRICT,
      subdistrict_code        TEXT NOT NULL REFERENCES subdistricts_blocks (subdistrict_code) ON DELETE RESTRICT,
      village_code            TEXT REFERENCES villages (village_code) ON DELETE RESTRICT,
      thikana                 TEXT NOT NULL,
      thikana_same_as_village INTEGER NOT NULL DEFAULT 1 CHECK (thikana_same_as_village IN (0, 1)),
      current_address         TEXT NOT NULL,
      phone_number            TEXT NOT NULL,
      consent_given           INTEGER NOT NULL DEFAULT 1 CHECK (consent_given = 1),
      public_opt_in           INTEGER NOT NULL DEFAULT 1,
      public_visibility       TEXT NOT NULL DEFAULT 'default' CHECK (public_visibility IN ('default', 'public', 'private')),
      status                  TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
      admin_note              TEXT,
      created_at              TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at              TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS village_family_id_counters (
      village_code TEXT PRIMARY KEY,
      last_seq     INTEGER NOT NULL DEFAULT 0 CHECK (last_seq >= 0),
      updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS registration_audit_log (
      id              TEXT PRIMARY KEY,
      registration_id TEXT NOT NULL,
      family_id       TEXT NOT NULL,
      action          TEXT NOT NULL,
      changed_fields  TEXT NOT NULL DEFAULT '[]',
      previous_values TEXT NOT NULL DEFAULT '{}',
      new_values      TEXT NOT NULL DEFAULT '{}',
      admin_note      TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS reg_audit_reg_id_idx ON registration_audit_log (registration_id);
    CREATE INDEX IF NOT EXISTS reg_audit_family_id_idx ON registration_audit_log (family_id);
    CREATE INDEX IF NOT EXISTS parivaar_reg_status_idx ON parivaar_registrations (status);
    CREATE INDEX IF NOT EXISTS parivaar_reg_state_idx ON parivaar_registrations (state_code);
    CREATE INDEX IF NOT EXISTS parivaar_reg_district_idx ON parivaar_registrations (district_code);
    CREATE INDEX IF NOT EXISTS parivaar_reg_subdistrict_idx ON parivaar_registrations (subdistrict_code);
    CREATE INDEX IF NOT EXISTS parivaar_reg_village_idx ON parivaar_registrations (village_code);

    CREATE TABLE IF NOT EXISTS missing_location_reports (
      id               TEXT PRIMARY KEY,
      reporter_name    TEXT NOT NULL,
      reporter_phone   TEXT,
      state_code       TEXT,
      district_code    TEXT,
      subdistrict_code TEXT,
      missing_level    TEXT NOT NULL DEFAULT 'village'
                         CHECK (missing_level IN ('state', 'district', 'subdistrict_block', 'village')),
      proposed_name    TEXT NOT NULL,
      parent_context   TEXT,
      pincode          TEXT,
      notes            TEXT,
      status           TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'reviewed', 'imported', 'rejected')),
      created_at       TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Safe migrations for existing SQLite databases
  const regCols = db.prepare("PRAGMA table_info(parivaar_registrations)").all();
  if (!regCols.some((c) => c.name === "thikana_same_as_village")) {
    db.exec(
      "ALTER TABLE parivaar_registrations ADD COLUMN thikana_same_as_village INTEGER NOT NULL DEFAULT 1"
    );
  }
  if (!regCols.some((c) => c.name === "family_id")) {
    db.exec("ALTER TABLE parivaar_registrations ADD COLUMN family_id TEXT");
  }
  if (!regCols.some((c) => c.name === "member_count")) {
    db.exec(
      "ALTER TABLE parivaar_registrations ADD COLUMN member_count INTEGER NOT NULL DEFAULT 1"
    );
  }
  if (!regCols.some((c) => c.name === "public_visibility")) {
    db.exec(
      "ALTER TABLE parivaar_registrations ADD COLUMN public_visibility TEXT NOT NULL DEFAULT 'default'"
    );
  }
  if (!regCols.some((c) => c.name === "father_name")) {
    db.exec("ALTER TABLE parivaar_registrations ADD COLUMN father_name TEXT");
  }

  db.exec(`
    DROP INDEX IF EXISTS parivaar_registrations_dedup_idx;
    CREATE UNIQUE INDEX IF NOT EXISTS parivaar_reg_family_id_uidx
      ON parivaar_registrations (family_id) WHERE family_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS parivaar_reg_family_id_search_idx
      ON parivaar_registrations (lower(family_id));
    CREATE INDEX IF NOT EXISTS parivaar_reg_head_name_idx
      ON parivaar_registrations (lower(full_name));
    CREATE INDEX IF NOT EXISTS parivaar_reg_father_name_idx
      ON parivaar_registrations (lower(father_name));
  `);

  // Backfill any existing registrations that do not yet have a permanent family_id
  const missingFamilyIdRows = db
    .prepare(
      "SELECT id, village_code, district_code FROM parivaar_registrations WHERE family_id IS NULL ORDER BY created_at ASC"
    )
    .all();
  for (const r of missingFamilyIdRows) {
    const codePrefix = String(r.village_code || r.district_code || "00000").trim();
    const fid = allocateNextFamilyIdInternal(db, codePrefix);
    db.prepare("UPDATE parivaar_registrations SET family_id = ? WHERE id = ?").run(
      fid,
      r.id
    );
  }

  // Safe migration for existing SQLite databases to keep administrator display label overrides separate from original official LGD `name_en`
  const vilCols = db.prepare("PRAGMA table_info(villages)").all();
  if (!vilCols.some((c) => c.name === "display_name_override")) {
    db.exec(
      "ALTER TABLE villages ADD COLUMN display_name_override TEXT"
    );
  }
}

/**
 * Formats an official LGD village code and positive integer sequence into
 * `LGD_VILLAGE_CODE-SEQUENCE` with at least 3 digits (expanding beyond 999 automatically).
 * Examples:
 *   formatFamilyId("94494", 1)    -> "94494-001"
 *   formatFamilyId("94494", 10)   -> "94494-010"
 *   formatFamilyId("94494", 100)  -> "94494-100"
 *   formatFamilyId("94494", 1000) -> "94494-1000"
 */
export function formatFamilyId(villageCode, seq) {
  const cleanCode = String(villageCode || "").trim();
  const numSeq = Math.max(1, Math.floor(Number(seq) || 1));
  const paddedSeq = String(numSeq).padStart(3, "0");
  return `${cleanCode}-${paddedSeq}`;
}

/**
 * Allocates the next monotonic sequence number for `villageCode` inside an active
 * database write transaction. Never uses COUNT(*) and never reuses deleted IDs.
 */
function allocateNextFamilyIdInternal(db, villageCode) {
  const cleanCode = String(villageCode || "").trim();
  if (!cleanCode) {
    throw new Error("Official LGD village_code is required to generate a Family ID.");
  }

  // Check highest sequence already present in parivaar_registrations for this village
  const existingRows = db
    .prepare(
      "SELECT family_id FROM parivaar_registrations WHERE village_code = ? AND family_id IS NOT NULL"
    )
    .all(cleanCode);
  let maxExistingSeq = 0;
  const prefix = `${cleanCode}-`;
  for (const r of existingRows) {
    const fid = String(r.family_id || "");
    if (fid.startsWith(prefix)) {
      const tail = Number.parseInt(fid.slice(prefix.length), 10);
      if (Number.isFinite(tail) && tail > maxExistingSeq) {
        maxExistingSeq = tail;
      }
    }
  }

  const counterRow = db
    .prepare("SELECT last_seq FROM village_family_id_counters WHERE village_code = ?")
    .get(cleanCode);
  const currentSeq = Math.max(Number(counterRow?.last_seq || 0), maxExistingSeq);
  const nextSeq = currentSeq + 1;

  db.prepare(
    `INSERT INTO village_family_id_counters (village_code, last_seq, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(village_code) DO UPDATE SET
       last_seq = excluded.last_seq,
       updated_at = excluded.updated_at`
  ).run(cleanCode, nextSeq);

  return formatFamilyId(cleanCode, nextSeq);
}

let cachedDb = null;
let cachedDbPath = null;

/**
 * Seeds the SQLite database from `data/lgd/` if `states` or `villages` have not yet been imported.
 */
export function seedLgdIntoSqlite(db, lgdDir = path.join(ROOT, "data", "lgd")) {
  const statesFile = path.join(lgdDir, "lgd_states.csv");
  const districtsFile = path.join(lgdDir, "lgd_districts.csv");
  const subdistrictsFile = path.join(lgdDir, "lgd_subdistricts_blocks.csv");
  const villagesZipFile = path.join(lgdDir, "lgd_villages.csv.zip");
  const villagesCsvFile = path.join(lgdDir, "lgd_villages.csv");
  const villagesFile = fs.existsSync(villagesZipFile) ? villagesZipFile : villagesCsvFile;

  if (!fs.existsSync(statesFile) || !fs.existsSync(districtsFile) || !fs.existsSync(subdistrictsFile) || !fs.existsSync(villagesFile)) {
    return { imported: false, reason: "LGD dataset files missing" };
  }

  const now = new Date().toISOString();

  db.exec("BEGIN");
  try {
    // 1. States
    const stateLines = readCsvOrZipPure(statesFile).split(/\r?\n/).filter(Boolean);
    const upsertState = db.prepare(`
      INSERT INTO states (state_code, name_en, name_local, state_or_ut, census_2011_code, latitude, longitude, coord_source, coord_verified, source, last_updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(state_code) DO UPDATE SET
        name_en = excluded.name_en,
        name_local = excluded.name_local,
        state_or_ut = excluded.state_or_ut,
        census_2011_code = excluded.census_2011_code,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        coord_source = excluded.coord_source,
        coord_verified = excluded.coord_verified,
        source = excluded.source,
        last_updated = excluded.last_updated
    `);
    for (let i = 1; i < stateLines.length; i++) {
      const c = parseCsvLineFast(stateLines[i]);
      if (!c[0] || !c[1]) continue;
      upsertState.run(
        c[0],
        c[1],
        c[2] || null,
        c[3] || "State",
        c[4] || null,
        c[5] ? Number(c[5]) : null,
        c[6] ? Number(c[6]) : null,
        c[7] || null,
        String(c[8]).toLowerCase() === "true" ? 1 : 0,
        c[9] || "LGD (lgdirectory.gov.in)",
        now
      );
    }

    // 2. Districts
    const distLines = readCsvOrZipPure(districtsFile).split(/\r?\n/).filter(Boolean);
    const upsertDist = db.prepare(`
      INSERT INTO districts (district_code, state_code, name_en, name_local, census_2011_code, latitude, longitude, coord_source, coord_verified, source, last_updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(district_code) DO UPDATE SET
        state_code = excluded.state_code,
        name_en = excluded.name_en,
        name_local = excluded.name_local,
        census_2011_code = excluded.census_2011_code,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        coord_source = excluded.coord_source,
        coord_verified = excluded.coord_verified,
        source = excluded.source,
        last_updated = excluded.last_updated
    `);
    for (let i = 1; i < distLines.length; i++) {
      const c = parseCsvLineFast(distLines[i]);
      if (!c[0] || !c[1] || !c[2]) continue;
      upsertDist.run(
        c[0],
        c[1],
        c[2],
        c[3] || null,
        c[4] || null,
        c[5] ? Number(c[5]) : null,
        c[6] ? Number(c[6]) : null,
        c[7] || null,
        String(c[8]).toLowerCase() === "true" ? 1 : 0,
        c[9] || "LGD (lgdirectory.gov.in)",
        now
      );
    }

    // 3. Subdistricts / Blocks
    const subLines = readCsvOrZipPure(subdistrictsFile).split(/\r?\n/).filter(Boolean);
    const upsertSub = db.prepare(`
      INSERT INTO subdistricts_blocks (subdistrict_code, district_code, state_code, name_en, name_local, admin_type, census_2011_code, source, last_updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(subdistrict_code) DO UPDATE SET
        district_code = excluded.district_code,
        state_code = excluded.state_code,
        name_en = excluded.name_en,
        name_local = excluded.name_local,
        admin_type = excluded.admin_type,
        census_2011_code = excluded.census_2011_code,
        source = excluded.source,
        last_updated = excluded.last_updated
    `);
    for (let i = 1; i < subLines.length; i++) {
      const c = parseCsvLineFast(subLines[i]);
      if (!c[0] || !c[1] || !c[2] || !c[3]) continue;
      upsertSub.run(
        c[0],
        c[1],
        c[2],
        c[3],
        c[4] || null,
        c[5] || "Tehsil",
        c[6] || null,
        c[7] || "LGD (lgdirectory.gov.in)",
        now
      );
    }

    // 4. Villages (headers: village_code,subdistrict_code,block_code,district_code,state_code,name_en,name_local,census_2011_code,latitude,longitude,coord_source,coord_verified,source)
    const villageLines = readCsvOrZipPure(villagesFile).split(/\r?\n/).filter(Boolean);
    const headerCols = parseCsvLineFast(villageLines[0]).map((h) => h.toLowerCase());
    const hasBlockCol = headerCols.includes("block_code");

    const upsertVillage = db.prepare(`
      INSERT INTO villages (village_code, subdistrict_code, block_code, district_code, state_code, name_en, name_local, census_2011_code, latitude, longitude, coord_source, coord_verified, source, last_updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(village_code) DO UPDATE SET
        subdistrict_code = excluded.subdistrict_code,
        block_code = excluded.block_code,
        district_code = excluded.district_code,
        state_code = excluded.state_code,
        name_en = excluded.name_en,
        name_local = excluded.name_local,
        census_2011_code = excluded.census_2011_code,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        coord_source = excluded.coord_source,
        coord_verified = excluded.coord_verified,
        source = excluded.source,
        last_updated = excluded.last_updated
    `);

    for (let i = 1; i < villageLines.length; i++) {
      const c = parseCsvLineFast(villageLines[i]);
      if (hasBlockCol) {
        if (!c[0] || !c[1] || !c[3] || !c[4] || !c[5]) continue;
        upsertVillage.run(
          c[0],
          c[1],
          c[2] || null,
          c[3],
          c[4],
          c[5],
          c[6] || null,
          c[7] || null,
          c[8] ? Number(c[8]) : null,
          c[9] ? Number(c[9]) : null,
          c[10] || null,
          String(c[11]).toLowerCase() === "true" ? 1 : 0,
          c[12] || "LGD (lgdirectory.gov.in)",
          now
        );
      } else {
        if (!c[0] || !c[1] || !c[2] || !c[3] || !c[4]) continue;
        upsertVillage.run(
          c[0],
          c[1],
          null,
          c[2],
          c[3],
          c[4],
          c[5] || null,
          c[6] || null,
          c[7] ? Number(c[7]) : null,
          c[8] ? Number(c[8]) : null,
          c[9] || null,
          String(c[10]).toLowerCase() === "true" ? 1 : 0,
          c[11] || "LGD (lgdirectory.gov.in)",
          now
        );
      }
    }

    const totalStates = db.prepare("SELECT COUNT(*) AS cnt FROM states").get().cnt;
    const totalDistricts = db.prepare("SELECT COUNT(*) AS cnt FROM districts").get().cnt;
    const totalSubdistricts = db.prepare("SELECT COUNT(*) AS cnt FROM subdistricts_blocks").get().cnt;
    const totalVillages = db.prepare("SELECT COUNT(*) AS cnt FROM villages").get().cnt;

    const histCount = db.prepare("SELECT COUNT(*) AS cnt FROM location_import_history WHERE is_test_run = 0").get().cnt;
    if (histCount === 0) {
      db.prepare(`
        INSERT INTO location_import_history (dataset_source, import_timestamp, import_status, is_test_run, inserted_count, updated_count, skipped_count, invalid_count, error_summary, notes)
        VALUES (?, ?, 'completed', 0, ?, 0, 0, 0, '[]', ?)
      `).run(
        "Official Government of India LGD (lgdirectory.gov.in)",
        now,
        totalStates + totalDistricts + totalSubdistricts + totalVillages,
        `Imported ${totalStates} States/UTs, ${totalDistricts} Districts, ${totalSubdistricts} Sub-districts/Blocks, and ${totalVillages} Villages.`
      );
    }

    db.exec("COMMIT");
    return {
      imported: true,
      counts: {
        states: totalStates,
        districts: totalDistricts,
        subdistricts_blocks: totalSubdistricts,
        villages: totalVillages,
      },
    };
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export function getParivaarDb(customPath = null) {
  const dbPath = resolveSqliteDbPath(customPath);
  if (cachedDb && cachedDbPath === dbPath) {
    return cachedDb;
  }
  const db = new DatabaseSync(dbPath);
  initParivaarSchema(db);

  // Check if LGD locations need initial seeding or upgrade (e.g. if < 100,000 villages)
  const vCount = db.prepare("SELECT COUNT(*) AS cnt FROM villages").get().cnt;
  if (vCount < 100000 && !customPath) {
    seedLgdIntoSqlite(db);
  }

  cachedDb = db;
  cachedDbPath = dbPath;
  return db;
}

function normalizeBoolRow(row) {
  if (!row) return row;
  const out = { ...row };
  if ("coord_verified" in out) out.coord_verified = Boolean(out.coord_verified);
  if ("consent_given" in out) out.consent_given = Boolean(out.consent_given);
  if ("public_opt_in" in out) out.public_opt_in = Boolean(out.public_opt_in);
  if ("is_test_run" in out) out.is_test_run = Boolean(out.is_test_run);
  if ("thikana_same_as_village" in out)
    out.thikana_same_as_village = Boolean(out.thikana_same_as_village);
  return out;
}

const HINDI_DB_SEARCH_ALIASES = {
  राजस्थान: "rajasthan",
  गुजरात: "gujarat",
  "मध्य प्रदेश": "madhya pradesh",
  मध्यप्रदेश: "madhya pradesh",
  "उत्तर प्रदेश": "uttar pradesh",
  उत्तरप्रदेश: "uttar pradesh",
  महाराष्ट्र: "maharashtra",
  दिल्ली: "delhi",
  हरियाणा: "haryana",
  पंजाब: "punjab",
  बिहार: "bihar",
  झारखंड: "jharkhand",
  छत्तीसगढ़: "chhattisgarh",
  उत्तराखंड: "uttarakhand",
  बूंदी: "bundi",
  बून्दी: "bundi",
  कोटा: "kota",
  जयपुर: "jaipur",
  जोधपुर: "jodhpur",
  उदयपुर: "udaipur",
  अजमेर: "ajmer",
  भीलवाड़ा: "bhilwara",
  चित्तौड़गढ़: "chittorgarh",
  पाली: "pali",
  जालौर: "jalore",
  सिरोही: "sirohi",
  बाड़मेर: "barmer",
  जैसलमेर: "jaisalmer",
  बीकानेर: "bikaner",
  तलेरा: "talera",
  तालेड़ा: "talera",
  केशोरायपाटन: "keshoraipatan",
  नैनवां: "nainwa",
  हिण्डोली: "hindoli",
  हिंडोली: "hindoli",
  इन्द्रगढ़: "indragarh",
  इंद्रगढ़: "indragarh",
  छापावदा: "chhapawda",
  छापावड़ा: "chhapawda",
  देई: "dei",
};

function normalizePlaceToken(str) {
  let s = String(str || "").trim().toLowerCase();
  for (const [hi, en] of Object.entries(HINDI_DB_SEARCH_ALIASES)) {
    if (s === hi || s.includes(hi)) {
      s = en;
      break;
    }
  }
  return s
    .replace(/wada/g, "wda")
    .replace(/wara/g, "wra")
    .replace(/kheda/g, "khera")
    .replace(/gadh/g, "garh")
    .replace(/aa/g, "a")
    .replace(/ee/g, "i")
    .replace(/oo/g, "u");
}

/**
 * Query States/UTs from the SQL database.
 */
export function queryStates(db = getParivaarDb()) {
  const rows = db
    .prepare(
      `SELECT state_code, name_en, name_local, state_or_ut, census_2011_code,
              latitude, longitude, coord_source, coord_verified, source
       FROM states
       ORDER BY name_en ASC`
    )
    .all();
  return rows.map(normalizeBoolRow);
}

/**
 * Query Districts for a given State/UT (or all districts if stateCode omitted).
 */
export function queryDistricts(stateCode = null, db = getParivaarDb()) {
  const code = stateCode ? String(stateCode).trim() : null;
  const rows = code
    ? db
        .prepare(
          `SELECT district_code, state_code, name_en, name_local, census_2011_code,
                  latitude, longitude, coord_source, coord_verified, source
           FROM districts
           WHERE state_code = ?
           ORDER BY name_en ASC`
        )
        .all(code)
    : db
        .prepare(
          `SELECT district_code, state_code, name_en, name_local, census_2011_code,
                  latitude, longitude, coord_source, coord_verified, source
           FROM districts
           ORDER BY name_en ASC`
        )
        .all();
  return rows.map(normalizeBoolRow);
}

/**
 * Query Sub-districts / Tehsils / Talukas / Mandals / Blocks for a given District & State.
 */
export function querySubdistricts(stateCode = null, districtCode = null, db = getParivaarDb()) {
  const sCode = stateCode ? String(stateCode).trim() : null;
  const dCode = districtCode ? String(districtCode).trim() : null;

  const clauses = [];
  const params = [];
  if (sCode) {
    clauses.push("state_code = ?");
    params.push(sCode);
  }
  if (dCode) {
    clauses.push("district_code = ?");
    params.push(dCode);
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = db
    .prepare(
      `SELECT subdistrict_code, district_code, state_code, name_en, name_local,
              admin_type, census_2011_code, source
       FROM subdistricts_blocks
       ${whereSql}
       ORDER BY CASE WHEN admin_type != 'Block' THEN 0 ELSE 1 END, name_en ASC`
    )
    .all(...params);
  return rows.map(normalizeBoolRow);
}

/**
 * Query Villages for a selected Sub-district OR Block, District, and State.
 * Matches both `subdistrict_code` and `block_code` so whether a user selects a Tehsil (e.g. '6033' Talera)
 * or a Block (e.g. 'BLK-639' Talera Block), all official LGD villages for that parent unit are returned.
 */
export function queryVillages(
  { stateCode = null, districtCode = null, subdistrictCode = null, q = null, limit = 1000 } = {},
  db = getParivaarDb()
) {
  const sCode = stateCode ? String(stateCode).trim() : null;
  const dCode = districtCode ? String(districtCode).trim() : null;
  const subCode = subdistrictCode ? String(subdistrictCode).trim() : null;
  const query = q ? String(q).trim().toLowerCase() : null;
  const safeLimit = Math.min(Math.max(Number(limit) || 1000, 1), 2500);

  const clauses = [];
  const params = [];

  if (sCode) {
    clauses.push("state_code = ?");
    params.push(sCode);
  }
  if (dCode) {
    clauses.push("district_code = ?");
    params.push(dCode);
  }
  if (subCode) {
    const altBlk = subCode.startsWith("BLK-") ? subCode : `BLK-${subCode}`;
    clauses.push("(subdistrict_code = ? OR block_code = ? OR block_code = ?)");
    params.push(subCode, subCode, altBlk);
  }
  if (query && !subCode) {
    const likePattern = `%${query}%`;
    const normPattern = `%${normalizePlaceToken(query)}%`;
    clauses.push(
      "(lower(name_en) LIKE ? OR lower(name_en) LIKE ? OR lower(coalesce(name_local, '')) LIKE ? OR village_code LIKE ?)"
    );
    params.push(likePattern, normPattern, likePattern, likePattern);
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  let rows = db
    .prepare(
      `SELECT village_code, subdistrict_code, block_code, district_code, state_code,
              name_en, name_local, display_name_override, census_2011_code, latitude, longitude,
              coord_source, coord_verified, source
       FROM villages
       ${whereSql}
       ORDER BY name_en ASC
       LIMIT ?`
    )
    .all(...params, safeLimit);

  if (query && subCode) {
    const normQ = normalizePlaceToken(query);
    rows = rows.filter((r) => {
      const nameEn = String(r.name_en || "").toLowerCase();
      const nameLocal = String(r.name_local || "").toLowerCase();
      const code = String(r.village_code || "").toLowerCase();
      return (
        nameEn.includes(query) ||
        normalizePlaceToken(nameEn).includes(normQ) ||
        nameLocal.includes(query) ||
        code.includes(query)
      );
    });
  }

  return rows.map(normalizeBoolRow);
}

/**
 * Paginated directory query for `LocationDirectory.jsx` (States, Districts, Subdistricts/Blocks, Villages)
 * with live aggregate registration counts from `parivaar_registrations`.
 */
export function queryDirectory(
  {
    level = "states",
    stateCode = null,
    districtCode = null,
    subdistrictCode = null,
    q = null,
    page = 1,
    pageSize = 24,
  } = {},
  db = getParivaarDb()
) {
  const sCode = stateCode ? String(stateCode).trim() : null;
  const dCode = districtCode ? String(districtCode).trim() : null;
  const subCode = subdistrictCode ? String(subdistrictCode).trim() : null;
  const rawQuery = q ? String(q).trim().toLowerCase() : null;
  const query = rawQuery ? normalizePlaceToken(rawQuery) : null;
  const safePage = Math.max(Number(page) || 1, 1);
  const safePageSize = Math.min(Math.max(Number(pageSize) || 24, 1), 100);
  const offset = (safePage - 1) * safePageSize;

  if (level === "states") {
    const clauses = [];
    const params = [];
    if (sCode) {
      clauses.push("s.state_code = ?");
      params.push(sCode);
    }
    if (query) {
      const pat = `%${query}%`;
      clauses.push("(lower(s.name_en) LIKE ? OR lower(coalesce(s.name_local, '')) LIKE ? OR s.state_code LIKE ?)");
      params.push(pat, pat, pat);
    }
    const whereSql = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const total = db.prepare(`SELECT COUNT(*) AS cnt FROM states s ${whereSql}`).get(...params).cnt;
    const rows = db
      .prepare(
        `SELECT s.state_code, s.name_en, s.name_local, s.state_or_ut, s.census_2011_code,
                s.latitude, s.longitude, s.coord_source, s.coord_verified, s.source,
                COALESCE(rc.cnt, 0) AS registration_count,
                COALESCE(rc.members, 0) AS member_count
         FROM states s
         LEFT JOIN (
           SELECT state_code, COUNT(*) AS cnt, COALESCE(SUM(member_count), 0) AS members
           FROM parivaar_registrations
           WHERE status = 'approved'
           GROUP BY state_code
         ) rc ON rc.state_code = s.state_code
         ${whereSql}
         ORDER BY rc.cnt DESC, s.name_en ASC
         LIMIT ? OFFSET ?`
      )
      .all(...params, safePageSize, offset)
      .map(normalizeBoolRow);
    return { rows, total, page: safePage, page_size: safePageSize };
  }

  if (level === "districts") {
    const clauses = [];
    const params = [];
    if (sCode) {
      clauses.push("d.state_code = ?");
      params.push(sCode);
    }
    if (dCode) {
      clauses.push("d.district_code = ?");
      params.push(dCode);
    }
    if (query) {
      const pat = `%${query}%`;
      clauses.push("(lower(d.name_en) LIKE ? OR lower(coalesce(d.name_local, '')) LIKE ? OR d.district_code LIKE ?)");
      params.push(pat, pat, pat);
    }
    const whereSql = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const total = db.prepare(`SELECT COUNT(*) AS cnt FROM districts d ${whereSql}`).get(...params).cnt;
    const rows = db
      .prepare(
        `SELECT d.district_code, d.state_code, s.name_en AS state_name,
                d.name_en, d.name_local, d.census_2011_code,
                d.latitude, d.longitude, d.coord_source, d.coord_verified, d.source,
                COALESCE(rc.cnt, 0) AS registration_count,
                COALESCE(rc.members, 0) AS member_count
         FROM districts d
         JOIN states s ON s.state_code = d.state_code
         LEFT JOIN (
           SELECT district_code, COUNT(*) AS cnt, COALESCE(SUM(member_count), 0) AS members
           FROM parivaar_registrations
           WHERE status = 'approved'
           GROUP BY district_code
         ) rc ON rc.district_code = d.district_code
         ${whereSql}
         ORDER BY rc.cnt DESC, d.name_en ASC
         LIMIT ? OFFSET ?`
      )
      .all(...params, safePageSize, offset)
      .map(normalizeBoolRow);
    return { rows, total, page: safePage, page_size: safePageSize };
  }

  if (level === "subdistricts") {
    const clauses = [];
    const params = [];
    if (sCode) {
      clauses.push("sb.state_code = ?");
      params.push(sCode);
    }
    if (dCode) {
      clauses.push("sb.district_code = ?");
      params.push(dCode);
    }
    if (subCode) {
      clauses.push("sb.subdistrict_code = ?");
      params.push(subCode);
    }
    if (query) {
      const pat = `%${query}%`;
      clauses.push("(lower(sb.name_en) LIKE ? OR lower(coalesce(sb.name_local, '')) LIKE ? OR sb.subdistrict_code LIKE ?)");
      params.push(pat, pat, pat);
    }
    const whereSql = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const total = db.prepare(`SELECT COUNT(*) AS cnt FROM subdistricts_blocks sb ${whereSql}`).get(...params).cnt;
    const rows = db
      .prepare(
        `SELECT sb.subdistrict_code, sb.district_code, d.name_en AS district_name,
                sb.state_code, s.name_en AS state_name,
                sb.name_en, sb.name_local, sb.admin_type, sb.census_2011_code, sb.source,
                COALESCE(rc.cnt, 0) AS registration_count,
                COALESCE(rc.members, 0) AS member_count
         FROM subdistricts_blocks sb
         JOIN districts d ON d.district_code = sb.district_code
         JOIN states s ON s.state_code = sb.state_code
         LEFT JOIN (
           SELECT subdistrict_code, COUNT(*) AS cnt, COALESCE(SUM(member_count), 0) AS members
           FROM parivaar_registrations
           WHERE status = 'approved'
           GROUP BY subdistrict_code
         ) rc ON rc.subdistrict_code = sb.subdistrict_code
         ${whereSql}
         ORDER BY rc.cnt DESC, CASE WHEN sb.admin_type != 'Block' THEN 0 ELSE 1 END, sb.name_en ASC
         LIMIT ? OFFSET ?`
      )
      .all(...params, safePageSize, offset)
      .map(normalizeBoolRow);
    return { rows, total, page: safePage, page_size: safePageSize };
  }

  // Villages level
  const clauses = [];
  const params = [];
  if (sCode) {
    clauses.push("v.state_code = ?");
    params.push(sCode);
  }
  if (dCode) {
    clauses.push("v.district_code = ?");
    params.push(dCode);
  }
  if (subCode) {
    const altBlk = subCode.startsWith("BLK-") ? subCode : `BLK-${subCode}`;
    clauses.push("(v.subdistrict_code = ? OR v.block_code = ? OR v.block_code = ?)");
    params.push(subCode, subCode, altBlk);
  }
  if (query) {
    const pat = `%${query}%`;
    clauses.push("(lower(v.name_en) LIKE ? OR lower(coalesce(v.name_local, '')) LIKE ? OR lower(coalesce(v.display_name_override, '')) LIKE ? OR v.village_code LIKE ?)");
    params.push(pat, pat, pat, pat);
  }
  const whereSql = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const total = db.prepare(`SELECT COUNT(*) AS cnt FROM villages v ${whereSql}`).get(...params).cnt;
  const rows = db
    .prepare(
      `SELECT v.village_code, v.subdistrict_code, v.block_code, sb.name_en AS subdistrict_name,
              v.district_code, d.name_en AS district_name,
              v.state_code, s.name_en AS state_name,
              v.name_en, v.name_local, v.display_name_override, v.census_2011_code,
              v.latitude, v.longitude, v.coord_source, v.coord_verified, v.source,
              COALESCE(rc.cnt, 0) AS registration_count,
              COALESCE(rc.members, 0) AS member_count
       FROM villages v
       JOIN subdistricts_blocks sb ON sb.subdistrict_code = v.subdistrict_code
       JOIN districts d ON d.district_code = v.district_code
       JOIN states s ON s.state_code = v.state_code
       LEFT JOIN (
         SELECT village_code, COUNT(*) AS cnt, COALESCE(SUM(member_count), 0) AS members
         FROM parivaar_registrations
         WHERE status = 'approved' AND village_code IS NOT NULL
         GROUP BY village_code
       ) rc ON rc.village_code = v.village_code
       ${whereSql}
       ORDER BY rc.cnt DESC, v.name_en ASC
       LIMIT ? OFFSET ?`
    )
    .all(...params, safePageSize, offset)
    .map(normalizeBoolRow);
  return { rows, total, page: safePage, page_size: safePageSize };
}

/**
 * Live Summary Statistics from `parivaar_registrations` (0 when no registrations exist).
 * Avoids double-counting: counts each approved family record once in `total_registrations`
 * and each recorded `member_count` once in `total_members`.
 */
export function querySummaryStats(db = getParivaarDb()) {
  const row = db
    .prepare(
      `SELECT
         COUNT(*) AS total_registrations,
         COALESCE(SUM(member_count), 0) AS total_members,
         COUNT(DISTINCT state_code) AS states_represented,
         COUNT(DISTINCT district_code) AS districts_covered,
         COUNT(DISTINCT CASE WHEN village_code IS NOT NULL AND village_code != '' THEN village_code END) AS villages_represented
       FROM parivaar_registrations
       WHERE status = 'approved'`
    )
    .get();

  const lgdCounts = {
    states: db.prepare("SELECT COUNT(*) AS cnt FROM states").get().cnt,
    districts: db.prepare("SELECT COUNT(*) AS cnt FROM districts").get().cnt,
    subdistricts_blocks: db.prepare("SELECT COUNT(*) AS cnt FROM subdistricts_blocks").get().cnt,
    villages: db.prepare("SELECT COUNT(*) AS cnt FROM villages").get().cnt,
  };

  return {
    total_registrations: Number(row?.total_registrations || 0),
    total_members: Number(row?.total_members || 0),
    states_represented: Number(row?.states_represented || 0),
    districts_covered: Number(row?.districts_covered || 0),
    villages_represented: Number(row?.villages_represented || 0),
    lgd_totals: lgdCounts,
  };
}

/**
 * Live Map & Directory Aggregates from `parivaar_registrations` (Zero PII).
 */
export function queryMapAggregates({ stateCode = null, districtCode = null } = {}, db = getParivaarDb()) {
  const sCode = stateCode ? String(stateCode).trim() : null;
  const dCode = districtCode ? String(districtCode).trim() : null;

  const filterClauses = ["r.status = 'approved'"];
  const params = [];
  if (sCode) {
    filterClauses.push("r.state_code = ?");
    params.push(sCode);
  }
  if (dCode) {
    filterClauses.push("r.district_code = ?");
    params.push(dCode);
  }
  const whereSql = `WHERE ${filterClauses.join(" AND ")}`;

  const states = db
    .prepare(
      `SELECT s.state_code, s.name_en, s.name_local, s.state_or_ut,
              s.latitude, s.longitude, s.coord_source, s.coord_verified,
              COUNT(r.id) AS registration_count,
              COALESCE(SUM(r.member_count), 0) AS member_count
       FROM parivaar_registrations r
       JOIN states s ON s.state_code = r.state_code
       ${whereSql}
       GROUP BY s.state_code
       ORDER BY registration_count DESC, s.name_en ASC`
    )
    .all(...params)
    .map(normalizeBoolRow);

  const districts = db
    .prepare(
      `SELECT d.district_code, d.state_code, s.name_en AS state_name,
              d.name_en, d.name_local, d.latitude, d.longitude, d.coord_source, d.coord_verified,
              COUNT(r.id) AS registration_count,
              COALESCE(SUM(r.member_count), 0) AS member_count
       FROM parivaar_registrations r
       JOIN districts d ON d.district_code = r.district_code
       JOIN states s ON s.state_code = d.state_code
       ${whereSql}
       GROUP BY d.district_code
       ORDER BY registration_count DESC, d.name_en ASC`
    )
    .all(...params)
    .map(normalizeBoolRow);

  const subdistricts = db
    .prepare(
      `SELECT sb.subdistrict_code, sb.district_code, sb.state_code,
              sb.name_en, sb.admin_type,
              COUNT(r.id) AS registration_count,
              COALESCE(SUM(r.member_count), 0) AS member_count
       FROM parivaar_registrations r
       JOIN subdistricts_blocks sb ON sb.subdistrict_code = r.subdistrict_code
       ${whereSql}
       GROUP BY sb.subdistrict_code
       ORDER BY registration_count DESC, sb.name_en ASC`
    )
    .all(...params)
    .map(normalizeBoolRow);

  const villages = db
    .prepare(
      `SELECT v.village_code, v.subdistrict_code, v.block_code, sb.name_en AS subdistrict_name,
              v.district_code, d.name_en AS district_name,
              v.state_code, s.name_en AS state_name,
              v.name_en, v.name_local, v.latitude, v.longitude, v.coord_source, v.coord_verified,
              COUNT(r.id) AS registration_count,
              COALESCE(SUM(r.member_count), 0) AS member_count
       FROM parivaar_registrations r
       JOIN villages v ON v.village_code = r.village_code
       JOIN subdistricts_blocks sb ON sb.subdistrict_code = v.subdistrict_code
       JOIN districts d ON d.district_code = v.district_code
       JOIN states s ON s.state_code = v.state_code
       ${whereSql} AND r.village_code IS NOT NULL AND r.village_code != ''
       GROUP BY v.village_code
       ORDER BY registration_count DESC, v.name_en ASC`
    )
    .all(...params)
    .map(normalizeBoolRow);

  return { states, districts, subdistricts, villages };
}

/**
 * Configurable Public-Visibility Policy for the Public Family Directory.
 * - 'public_basic' (default): exposes Family ID, Family Head's Name, Member Count, and
 *   ancestral State/District/Tehsil/Village for records whose `public_visibility` is not 'private'.
 *   For records with `public_visibility = 'private'`, exposes ONLY Family ID and ancestral location
 *   with a privacy-safe indicator.
 * - 'id_only': exposes ONLY Family ID and ancestral location for all records.
 * Never exposes `phone_number` or `current_address` under any policy.
 */
export function getPublicVisibilityPolicy() {
  const raw = String(process.env.PARIVAAR_PUBLIC_VISIBILITY_POLICY || "public_basic")
    .trim()
    .toLowerCase();
  return raw === "id_only" ? "id_only" : "public_basic";
}

/**
 * Queries publicly listed Family records for `India -> State/UT -> District -> Tehsil/Block -> Village -> Family Listings`.
 * Strictly strips private fields (`phone_number`, `current_address`, and private `full_name`/`member_count`)
 * on the server before returning.
 */
export function queryPublicFamilies(
  {
    stateCode = null,
    districtCode = null,
    subdistrictCode = null,
    villageCode = null,
    q = null,
    page = 1,
    pageSize = 20,
    policyOverride = null,
  } = {},
  db = getParivaarDb()
) {
  const sCode = stateCode ? String(stateCode).trim() : null;
  const dCode = districtCode ? String(districtCode).trim() : null;
  const subCode = subdistrictCode ? String(subdistrictCode).trim() : null;
  const vCode = villageCode ? String(villageCode).trim() : null;
  const rawQ = q ? String(q).trim().toLowerCase() : null;
  const normQ = rawQ ? normalizePlaceToken(rawQ) : null;
  const safePage = Math.max(Number(page) || 1, 1);
  const safePageSize = Math.min(Math.max(Number(pageSize) || 20, 1), 100);
  const offset = (safePage - 1) * safePageSize;
  const policy = policyOverride || getPublicVisibilityPolicy();

  const clauses = ["r.status = 'approved'"];
  const params = [];

  if (sCode) {
    clauses.push("r.state_code = ?");
    params.push(sCode);
  }
  if (dCode) {
    clauses.push("r.district_code = ?");
    params.push(dCode);
  }
  if (subCode) {
    clauses.push("r.subdistrict_code = ?");
    params.push(subCode);
  }
  if (vCode) {
    clauses.push("r.village_code = ?");
    params.push(vCode);
  }

  if (rawQ) {
    const rawPat = `%${rawQ}%`;
    const normPat = `%${normQ}%`;
    // IMPORTANT: Never allow searching by `r.full_name` to match a private record!
    if (policy === "id_only") {
      clauses.push(
        "(lower(r.family_id) LIKE ? OR lower(coalesce(v.name_en, '')) LIKE ? OR lower(coalesce(v.name_en, '')) LIKE ? OR lower(d.name_en) LIKE ? OR lower(s.name_en) LIKE ?)"
      );
      params.push(rawPat, rawPat, normPat, normPat, normPat);
    } else {
      clauses.push(
        `(
          lower(r.family_id) LIKE ?
          OR (r.public_visibility != 'private' AND lower(r.full_name) LIKE ?)
          OR (r.public_visibility != 'private' AND lower(coalesce(r.father_name, '')) LIKE ?)
          OR lower(coalesce(v.name_en, '')) LIKE ?
          OR lower(coalesce(v.name_en, '')) LIKE ?
          OR lower(d.name_en) LIKE ?
          OR lower(s.name_en) LIKE ?
        )`
      );
      params.push(rawPat, rawPat, rawPat, rawPat, normPat, normPat, normPat);
    }
  }

  const whereSql = `WHERE ${clauses.join(" AND ")}`;

  const summaryRow = db
    .prepare(
      `SELECT
         COUNT(*) AS total_families,
         COALESCE(SUM(r.member_count), 0) AS total_members
       FROM parivaar_registrations r
       JOIN states s ON s.state_code = r.state_code
       JOIN districts d ON d.district_code = r.district_code
       JOIN subdistricts_blocks sb ON sb.subdistrict_code = r.subdistrict_code
       LEFT JOIN villages v ON v.village_code = r.village_code
       ${whereSql}`
    )
    .get(...params);

  const rawRows = db
    .prepare(
      `SELECT
         r.family_id,
         r.full_name,
         r.father_name,
         r.member_count,
         r.public_visibility,
         r.state_code, s.name_en AS state_name,
         r.district_code, d.name_en AS district_name,
         r.subdistrict_code, sb.name_en AS subdistrict_name, sb.admin_type,
         r.village_code, COALESCE(v.display_name_override, v.name_en, r.thikana) AS village_name,
         v.name_en AS official_village_name,
         r.created_at
       FROM parivaar_registrations r
       JOIN states s ON s.state_code = r.state_code
       JOIN districts d ON d.district_code = r.district_code
       JOIN subdistricts_blocks sb ON sb.subdistrict_code = r.subdistrict_code
       LEFT JOIN villages v ON v.village_code = r.village_code
       ${whereSql}
       ORDER BY r.family_id ASC, r.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, safePageSize, offset);

  const families = rawRows.map((row) => {
    const isPrivate =
      policy === "id_only" || String(row.public_visibility) === "private";
    const publicName = isPrivate ? null : row.full_name;
    const rawFather = String(row.father_name || "").trim();
    const publicFatherName =
      isPrivate || !rawFather ? null : rawFather;
    return {
      family_id: row.family_id,
      is_public: !isPrivate,
      is_private: isPrivate,
      family_head_name: publicName,
      head_name: publicName,
      father_name: publicFatherName,
      member_count: isPrivate ? null : Number(row.member_count || 1),
      privacy_notice: isPrivate
        ? "गोपनीय पंजीकरण — विवरण सार्वजनिक रूप से सूचीबद्ध नहीं है (Private Record — Family details are not publicly listed)"
        : null,
      state_code: row.state_code,
      state_name: row.state_name,
      district_code: row.district_code,
      district_name: row.district_name,
      subdistrict_code: row.subdistrict_code,
      subdistrict_name: row.subdistrict_name,
      admin_type: row.admin_type || "Tehsil",
      village_code: row.village_code,
      village_name: row.village_name,
      official_village_name: row.official_village_name || row.village_name,
      created_at: row.created_at,
    };
  });

  return {
    families,
    total: Number(summaryRow?.total_families || 0),
    total_members: Number(summaryRow?.total_members || 0),
    page: safePage,
    page_size: safePageSize,
    visibility_policy: policy,
  };
}

/**
 * Validated Server-Side Registration Submission into `parivaar_registrations`
 * with transaction-safe `LGD_VILLAGE_CODE-SEQUENCE` Family ID generation.
 */
export function insertParivaarRegistration(payload, db = getParivaarDb()) {
  const fullName = String(
    payload?.full_name ?? payload?.head_name ?? ""
  ).trim();
  const hasFatherField =
    payload?.father_name !== undefined ||
    payload?.fatherName !== undefined ||
    payload?.require_father_name === true;
  const fatherName = String(
    payload?.father_name ?? payload?.fatherName ?? ""
  ).trim();
  const stateCode = String(payload?.state_code || "").trim();
  const districtCode = String(payload?.district_code || "").trim();
  const subdistrictCode = String(payload?.subdistrict_code || "").trim();
  const villageCode = String(payload?.village_code || "").trim() || null;
  const rawThikana = String(payload?.thikana || "").trim();
  const sameAsVillage =
    payload?.thikana_same_as_village === true ||
    payload?.thikanaSameAsVillage === true;
  const requireVillage = payload?.require_village === true;
  const currentAddress = String(payload?.current_address || "").trim();
  let phone = String(payload?.phone_number || "").replace(/\D/g, "");

  // Member count validation (defaults to 1 when omitted by legacy callers; rejects <=0 or non-integers when supplied)
  const hasExplicitMemberCount =
    payload?.member_count !== undefined &&
    payload?.member_count !== null &&
    String(payload?.member_count).trim() !== "";
  const parsedMembers = hasExplicitMemberCount
    ? Number(payload.member_count)
    : 1;

  // Consent: streamlined form does not have a consent checkbox (defaults to true);
  // only reject if `consent_given: false` was explicitly passed.
  const consentGiven =
    payload?.consent_given === undefined ? true : Boolean(payload.consent_given);

  const publicVisibility = ["default", "public", "private"].includes(
    String(payload?.public_visibility || "")
  )
    ? String(payload.public_visibility)
    : "default";

  if (phone.length === 12 && phone.startsWith("91")) phone = phone.slice(2);
  else if (phone.length === 11 && phone.startsWith("0")) phone = phone.slice(1);

  if (fullName.length < 2 || fullName.length > 120 || /[<>]/.test(fullName)) {
    return {
      ok: false,
      code: "INVALID_NAME",
      message:
        "कृपया परिवार के मुखिया का वैध नाम दर्ज करें (Please enter a valid family head's name, 2–120 characters).",
    };
  }
  if (
    hasFatherField &&
    (fatherName.length < 2 ||
      fatherName.length > 120 ||
      /[<>]/.test(fatherName))
  ) {
    return {
      ok: false,
      code: "INVALID_FATHER_NAME",
      message:
        "कृपया पिता का वैध नाम दर्ज करें — 2 से 120 अक्षर (Please enter a valid Father's Name, 2–120 characters).",
    };
  }
  if (
    !Number.isInteger(parsedMembers) ||
    parsedMembers < 1 ||
    parsedMembers > 250
  ) {
    return {
      ok: false,
      code: "INVALID_MEMBER_COUNT",
      message:
        "कृपया परिवार के सदस्यों की वैध संख्या दर्ज करें — कम से कम 1 (Please enter a valid positive integer for number of family members).",
    };
  }
  if (!stateCode || !districtCode || !subdistrictCode) {
    return {
      ok: false,
      code: "MISSING_LOCATION",
      message:
        "कृपया राज्य, जिला और तहसील/ब्लॉक चुनें (State, District, and Tehsil/Block are required).",
    };
  }
  if (requireVillage && !villageCode) {
    return {
      ok: false,
      code: "MISSING_VILLAGE",
      message:
        "कृपया आधिकारिक सूची से अपना पैतृक गाँव चुनें (Please select your ancestral Village from the official LGD list).",
    };
  }
  if (sameAsVillage && !villageCode) {
    return {
      ok: false,
      code: "VILLAGE_REQUIRED_FOR_SAME_THIKANA",
      message:
        "Please select an official Village when 'Thikana is the same as Village' is checked, or uncheck the option to enter Thikana manually.",
    };
  }
  if (
    !villageCode &&
    !sameAsVillage &&
    (rawThikana.length < 1 ||
      rawThikana.length > 150 ||
      /[<>]/.test(rawThikana))
  ) {
    return {
      ok: false,
      code: "INVALID_THIKANA",
      message: "Please select an official ancestral Village or enter your Thikana name.",
    };
  }
  if (
    rawThikana &&
    (rawThikana.length > 150 || /[<>]/.test(rawThikana))
  ) {
    return {
      ok: false,
      code: "INVALID_THIKANA",
      message: "Invalid village/thikana name.",
    };
  }
  if (
    currentAddress.length < 3 ||
    currentAddress.length > 500 ||
    /[<>]/.test(currentAddress)
  ) {
    return {
      ok: false,
      code: "INVALID_ADDRESS",
      message:
        "कृपया अपना वर्तमान पता दर्ज करें (Please enter your current residential address).",
    };
  }
  if (!/^[6-9][0-9]{9}$/.test(phone) || /^(\d)\1{9}$/.test(phone)) {
    return {
      ok: false,
      code: "INVALID_PHONE",
      message:
        "कृपया वैध 10 अंकों का भारतीय मोबाइल नंबर दर्ज करें (Please enter a valid 10-digit Indian mobile number).",
    };
  }
  if (!consentGiven) {
    return {
      ok: false,
      code: "CONSENT_REQUIRED",
      message: "Consent is required to submit your registration.",
    };
  }

  // Verify official parent-child LGD hierarchy in SQL database
  const stateRow = db
    .prepare("SELECT state_code, name_en FROM states WHERE state_code = ?")
    .get(stateCode);
  if (!stateRow) {
    return {
      ok: false,
      code: "INVALID_HIERARCHY",
      message: "Selected State/UT does not exist in official LGD records.",
    };
  }

  const distRow = db
    .prepare(
      "SELECT district_code, name_en FROM districts WHERE district_code = ? AND state_code = ?"
    )
    .get(districtCode, stateCode);
  if (!distRow) {
    return {
      ok: false,
      code: "INVALID_HIERARCHY",
      message: "Selected District does not belong to the selected State/UT.",
    };
  }

  const subRow = db
    .prepare(
      "SELECT subdistrict_code, name_en, admin_type FROM subdistricts_blocks WHERE subdistrict_code = ? AND district_code = ? AND state_code = ?"
    )
    .get(subdistrictCode, districtCode, stateCode);
  if (!subRow) {
    return {
      ok: false,
      code: "INVALID_HIERARCHY",
      message: "Selected Tehsil/Block does not belong to the selected District.",
    };
  }

  let officialVillageRow = null;
  if (villageCode) {
    const altBlk = subdistrictCode.startsWith("BLK-")
      ? subdistrictCode
      : `BLK-${subdistrictCode}`;
    officialVillageRow = db
      .prepare(
        `SELECT village_code, name_en FROM villages
         WHERE village_code = ?
           AND district_code = ?
           AND state_code = ?
           AND (subdistrict_code = ? OR block_code = ? OR block_code = ?)`
      )
      .get(
        villageCode,
        districtCode,
        stateCode,
        subdistrictCode,
        subdistrictCode,
        altBlk
      );
    if (!officialVillageRow) {
      return {
        ok: false,
        code: "INVALID_HIERARCHY",
        message:
          "Selected Village does not belong to the selected Tehsil/Block.",
      };
    }
  }

  // Determine the village/thikana association
  let finalThikana = rawThikana;
  if (sameAsVillage && officialVillageRow) {
    const officialName = String(officialVillageRow.name_en || "").trim();
    if (
      rawThikana &&
      rawThikana.toLowerCase() !== officialName.toLowerCase()
    ) {
      return {
        ok: false,
        code: "THIKANA_VILLAGE_MISMATCH",
        message:
          "When 'Thikana is the same as Village' is checked, Thikana must match the selected official Village name.",
      };
    }
    finalThikana = officialName;
  } else if (!finalThikana && officialVillageRow) {
    finalThikana = String(officialVillageRow.name_en || "").trim();
  }

  // Anti-abuse rate limiting (max 15 submissions per phone in 1 hour)
  const recentCnt = db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM parivaar_registrations
       WHERE phone_number = ? AND datetime(created_at) > datetime('now', '-1 hour')`
    )
    .get(phone).cnt;
  if (recentCnt >= 15) {
    return {
      ok: false,
      code: "RATE_LIMITED",
      message:
        "Too many registrations submitted recently from this number. Please try again later.",
    };
  }

  // Execute duplicate check + sequence allocation + registration insert inside an atomic IMMEDIATE transaction
  db.exec("BEGIN IMMEDIATE");
  try {
    const dup = db
      .prepare(
        `SELECT id, family_id, father_name, member_count, village_code, thikana, thikana_same_as_village, current_address, created_at
         FROM parivaar_registrations
         WHERE phone_number = ? AND lower(trim(full_name)) = lower(?) AND district_code = ?`
      )
      .get(phone, fullName, districtCode);

    if (dup) {
      const sameVilCode =
        String(dup.village_code || "") === String(villageCode || "");
      const sameThikanaText =
        String(dup.thikana || "").trim().toLowerCase() ===
        String(finalThikana || "").trim().toLowerCase();
      const sameCheckbox =
        Boolean(dup.thikana_same_as_village) === sameAsVillage;
      const sameFatherText =
        !fatherName ||
        String(dup.father_name || "").trim().toLowerCase() ===
          fatherName.toLowerCase();

      if (sameVilCode && sameThikanaText && sameCheckbox && sameFatherText) {
        db.exec("ROLLBACK");
        return {
          ok: false,
          code: "DUPLICATE_REGISTRATION",
          existing_family_id: dup.family_id,
          message:
            "इस नाम, मोबाइल नंबर और गाँव/जिले के साथ पंजीकरण पहले ही दर्ज किया जा चुका है (A registration with this name, phone number, and location has already been recorded).",
        };
      }

      // Update existing household record while strictly preserving its permanent `family_id`
      const updatedAt = new Date().toISOString();
      const preservedFamilyId =
        dup.family_id ||
        allocateNextFamilyIdInternal(db, villageCode || districtCode);
      const nextFatherName = fatherName || dup.father_name || null;

      db.prepare(
        `UPDATE parivaar_registrations
         SET father_name = ?,
             member_count = ?,
             state_code = ?,
             district_code = ?,
             subdistrict_code = ?,
             village_code = ?,
             thikana = ?,
             thikana_same_as_village = ?,
             current_address = ?,
             updated_at = ?
         WHERE id = ?`
      ).run(
        nextFatherName,
        parsedMembers,
        stateCode,
        districtCode,
        subdistrictCode,
        villageCode,
        finalThikana,
        sameAsVillage ? 1 : 0,
        currentAddress,
        updatedAt,
        dup.id
      );

      db.prepare(
        `INSERT INTO registration_audit_log (
           id, registration_id, family_id, action, changed_fields, previous_values, new_values, created_at
         ) VALUES (?, ?, ?, 'updated_existing', ?, ?, ?, ?)`
      ).run(
        crypto.randomUUID(),
        dup.id,
        preservedFamilyId,
        JSON.stringify(["father_name", "village_code", "thikana", "current_address"]),
        JSON.stringify({
          father_name: dup.father_name,
          village_code: dup.village_code,
          thikana: dup.thikana,
          current_address: dup.current_address,
        }),
        JSON.stringify({
          father_name: nextFatherName,
          village_code: villageCode,
          thikana: finalThikana,
          current_address: currentAddress,
        }),
        updatedAt
      );

      db.exec("COMMIT");

      const savedRegistration = {
        id: dup.id,
        family_id: preservedFamilyId,
        full_name: fullName,
        head_name: fullName,
        father_name: nextFatherName,
        member_count: parsedMembers,
        state_code: stateCode,
        state_name: stateRow.name_en,
        district_code: districtCode,
        district_name: distRow.name_en,
        subdistrict_code: subdistrictCode,
        subdistrict_name: subRow.name_en,
        admin_type: subRow.admin_type || "Tehsil",
        village_code: villageCode,
        village_name: officialVillageRow ? officialVillageRow.name_en : finalThikana,
        thikana: finalThikana,
        thikana_same_as_village: sameAsVillage,
        current_address: currentAddress,
        phone_number: phone,
        created_at: dup.created_at,
      };

      return {
        ok: true,
        id: dup.id,
        family_id: preservedFamilyId,
        father_name: nextFatherName,
        updated: true,
        village_code: villageCode,
        thikana: finalThikana,
        thikana_same_as_village: sameAsVillage,
        created_at: dup.created_at,
        registration: savedRegistration,
      };
    }

    // Allocate permanent unique `LGD_VILLAGE_CODE-SEQUENCE` Family ID
    const idPrefix = villageCode || districtCode;
    const familyId = allocateNextFamilyIdInternal(db, idPrefix);
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const storedFatherName = fatherName || null;

    db.prepare(
      `INSERT INTO parivaar_registrations (
         id, family_id, full_name, father_name, member_count,
         state_code, district_code, subdistrict_code, village_code,
         thikana, thikana_same_as_village, current_address, phone_number,
         consent_given, public_opt_in, public_visibility, status, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, 'approved', ?, ?)`
    ).run(
      id,
      familyId,
      fullName,
      storedFatherName,
      parsedMembers,
      stateCode,
      districtCode,
      subdistrictCode,
      villageCode,
      finalThikana,
      sameAsVillage ? 1 : 0,
      currentAddress,
      phone,
      publicVisibility,
      createdAt,
      createdAt
    );

    db.prepare(
      `INSERT INTO registration_audit_log (
         id, registration_id, family_id, action, changed_fields, previous_values, new_values, created_at
       ) VALUES (?, ?, ?, 'created', '[]', '{}', ?, ?)`
    ).run(
      crypto.randomUUID(),
      id,
      familyId,
      JSON.stringify({
        family_id: familyId,
        full_name: fullName,
        father_name: storedFatherName,
        member_count: parsedMembers,
        village_code: villageCode,
        state_code: stateCode,
        district_code: districtCode,
        subdistrict_code: subdistrictCode,
      }),
      createdAt
    );

    db.exec("COMMIT");

    const savedRegistration = {
      id,
      family_id: familyId,
      full_name: fullName,
      head_name: fullName,
      father_name: storedFatherName,
      member_count: parsedMembers,
      state_code: stateCode,
      state_name: stateRow.name_en,
      district_code: districtCode,
      district_name: distRow.name_en,
      subdistrict_code: subdistrictCode,
      subdistrict_name: subRow.name_en,
      admin_type: subRow.admin_type || "Tehsil",
      village_code: villageCode,
      village_name: officialVillageRow ? officialVillageRow.name_en : finalThikana,
      thikana: finalThikana,
      thikana_same_as_village: sameAsVillage,
      current_address: currentAddress,
      phone_number: phone,
      public_visibility: publicVisibility,
      status: "approved",
      created_at: createdAt,
    };

    return {
      ok: true,
      id,
      family_id: familyId,
      father_name: storedFatherName,
      member_count: parsedMembers,
      village_code: villageCode,
      thikana: finalThikana,
      thikana_same_as_village: sameAsVillage,
      created_at: createdAt,
      registration: savedRegistration,
    };
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // ignore rollback error
    }
    throw err;
  }
}

/**
 * Validated Missing Location Report Submission into `missing_location_reports`.
 */
export function insertMissingLocationReport(payload, db = getParivaarDb()) {
  const reporterName = String(payload?.reporter_name || "").trim();
  const proposedName = String(payload?.proposed_name || "").trim();
  let phone = String(payload?.reporter_phone || "").replace(/\D/g, "");
  if (phone.length === 12 && phone.startsWith("91")) phone = phone.slice(2);
  else if (phone.length === 11 && phone.startsWith("0")) phone = phone.slice(1);
  if (!/^[6-9][0-9]{9}$/.test(phone)) phone = null;

  const pincodeRaw = String(payload?.pincode || "").trim();
  const pincode = /^[1-9][0-9]{5}$/.test(pincodeRaw) ? pincodeRaw : null;

  if (reporterName.length < 2 || proposedName.length < 2) {
    return { ok: false, code: "INVALID_INPUT", message: "Please provide your name and the missing location name." };
  }

  const validLevels = new Set(["state", "district", "subdistrict_block", "village"]);
  const level = validLevels.has(payload?.missing_level) ? payload.missing_level : "village";
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  db.prepare(
    `INSERT INTO missing_location_reports (
       id, reporter_name, reporter_phone, state_code, district_code, subdistrict_code,
       missing_level, proposed_name, parent_context, pincode, notes, status, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
  ).run(
    id,
    reporterName,
    phone,
    String(payload?.state_code || "").trim() || null,
    String(payload?.district_code || "").trim() || null,
    String(payload?.subdistrict_code || "").trim() || null,
    level,
    proposedName,
    String(payload?.parent_context || "").trim() || null,
    pincode,
    String(payload?.notes || "").trim() || null,
    createdAt
  );

  return { ok: true, id, created_at: createdAt };
}

/**
 * LGD Data-Quality Report for administrator review.
 * Preserves original official LGD names and codes while surfacing:
 * - unusual punctuation / abbreviation records (e.g., parentheses, numeric prefixes)
 * - duplicate normalized names within the same subdistrict
 * - missing parent relationship checks
 * - verified vs directory-only coordinate coverage
 */
export function queryDataQualityReport(db = getParivaarDb()) {
  const totalStates = db.prepare("SELECT COUNT(*) AS cnt FROM states").get().cnt;
  const totalDistricts = db.prepare("SELECT COUNT(*) AS cnt FROM districts").get().cnt;
  const totalSubdistricts = db.prepare("SELECT COUNT(*) AS cnt FROM subdistricts_blocks").get().cnt;
  const totalVillages = db.prepare("SELECT COUNT(*) AS cnt FROM villages").get().cnt;

  const verifiedCoords = db
    .prepare(
      "SELECT COUNT(*) AS cnt FROM villages WHERE coord_verified = 1 AND latitude IS NOT NULL AND longitude IS NOT NULL"
    )
    .get().cnt;
  const unverifiedCoords = totalVillages - verifiedCoords;

  const orphanDistricts = db
    .prepare(
      "SELECT COUNT(*) AS cnt FROM districts d LEFT JOIN states s ON s.state_code = d.state_code WHERE s.state_code IS NULL"
    )
    .get().cnt;
  const orphanSubdistricts = db
    .prepare(
      "SELECT COUNT(*) AS cnt FROM subdistricts_blocks sb LEFT JOIN districts d ON d.district_code = sb.district_code WHERE d.district_code IS NULL"
    )
    .get().cnt;
  const orphanVillages = db
    .prepare(
      "SELECT COUNT(*) AS cnt FROM villages v LEFT JOIN subdistricts_blocks sb ON sb.subdistrict_code = v.subdistrict_code WHERE sb.subdistrict_code IS NULL"
    )
    .get().cnt;

  const punctuationRecords = db
    .prepare(
      `SELECT v.village_code, v.name_en, v.display_name_override,
              v.subdistrict_code, sb.name_en AS subdistrict_name,
              v.district_code, d.name_en AS district_name,
              v.state_code, s.name_en AS state_name,
              v.coord_verified
       FROM villages v
       JOIN subdistricts_blocks sb ON sb.subdistrict_code = v.subdistrict_code
       JOIN districts d ON d.district_code = v.district_code
       JOIN states s ON s.state_code = v.state_code
       WHERE v.name_en GLOB '*[()/@*#0-9]*'
       ORDER BY CASE WHEN v.state_code = '8' AND v.district_code = '94' THEN 0 ELSE 1 END,
                v.name_en ASC
       LIMIT 30`
    )
    .all()
    .map(normalizeBoolRow);

  const duplicateNameGroups = db
    .prepare(
      `SELECT v.subdistrict_code, sb.name_en AS subdistrict_name,
              d.name_en AS district_name,
              lower(replace(replace(replace(v.name_en, ' ', ''), '(', ''), ')', '')) AS normalized_name,
              COUNT(*) AS record_count,
              GROUP_CONCAT(v.village_code || ':' || v.name_en, ' | ') AS official_records
       FROM villages v
       JOIN subdistricts_blocks sb ON sb.subdistrict_code = v.subdistrict_code
       JOIN districts d ON d.district_code = v.district_code
       GROUP BY v.subdistrict_code, lower(replace(replace(replace(v.name_en, ' ', ''), '(', ''), ')', ''))
       HAVING COUNT(*) > 1
       ORDER BY CASE WHEN v.state_code = '8' AND v.district_code = '94' THEN 0 ELSE 1 END,
                record_count DESC
       LIMIT 25`
    )
    .all();

  return {
    total_states: totalStates,
    total_districts: totalDistricts,
    total_subdistricts: totalSubdistricts,
    total_villages: totalVillages,
    verified_coordinates_count: verifiedCoords,
    unverified_coordinates_count: unverifiedCoords,
    orphan_parent_records: orphanDistricts + orphanSubdistricts + orphanVillages,
    flagged_punctuation_records: punctuationRecords,
    duplicate_name_groups: duplicateNameGroups,
  };
}

function buildAdminFilterWhereClause(filters = {}) {
  const clauses = [];
  const params = [];

  const q = String(filters?.q || "").trim().toLowerCase();
  if (q) {
    const pat = `%${q}%`;
    clauses.push(
      "(lower(coalesce(r.family_id, '')) LIKE ? OR lower(r.full_name) LIKE ? OR lower(coalesce(r.father_name, '')) LIKE ? OR lower(coalesce(r.thikana, '')) LIKE ? OR r.phone_number LIKE ?)"
    );
    params.push(pat, pat, pat, pat, pat);
  }

  const stateCode = String(filters?.stateCode || filters?.state_code || "").trim();
  if (stateCode) {
    clauses.push("r.state_code = ?");
    params.push(stateCode);
  }

  const districtCode = String(
    filters?.districtCode || filters?.district_code || ""
  ).trim();
  if (districtCode) {
    clauses.push("r.district_code = ?");
    params.push(districtCode);
  }

  const subdistrictCode = String(
    filters?.subdistrictCode || filters?.subdistrict_code || ""
  ).trim();
  if (subdistrictCode) {
    clauses.push("r.subdistrict_code = ?");
    params.push(subdistrictCode);
  }

  const villageCode = String(
    filters?.villageCode || filters?.village_code || ""
  ).trim();
  if (villageCode) {
    clauses.push("r.village_code = ?");
    params.push(villageCode);
  }

  const status = String(filters?.status || "").trim();
  if (status && status !== "all") {
    clauses.push("r.status = ?");
    params.push(status);
  }

  const visibility = String(
    filters?.publicVisibility || filters?.public_visibility || ""
  ).trim();
  if (visibility && visibility !== "all") {
    clauses.push("r.public_visibility = ?");
    params.push(visibility);
  }

  const dateFrom = String(filters?.dateFrom || filters?.date_from || "").trim();
  if (dateFrom) {
    clauses.push("date(r.created_at) >= date(?)");
    params.push(dateFrom);
  }

  const dateTo = String(filters?.dateTo || filters?.date_to || "").trim();
  if (dateTo) {
    clauses.push("date(r.created_at) <= date(?)");
    params.push(dateTo);
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return { whereSql, params };
}

/**
 * Admin queries & mutations for `TabParivaar.jsx` (never called by public views).
 * Supports both `queryAdminParivaarData(db)` and `queryAdminParivaarData(filters, db)`.
 */
export function queryAdminParivaarData(filtersOrDb = {}, maybeDb = null) {
  const isFirstArgDb =
    filtersOrDb && typeof filtersOrDb.prepare === "function";
  const filters = isFirstArgDb ? {} : filtersOrDb || {};
  const db = isFirstArgDb ? filtersOrDb : maybeDb || getParivaarDb();

  const safePage = Math.max(Number(filters.page) || 1, 1);
  const safePageSize = Math.min(
    Math.max(Number(filters.pageSize || filters.page_size) || 250, 1),
    1000
  );
  const offset = (safePage - 1) * safePageSize;

  const { whereSql, params } = buildAdminFilterWhereClause(filters);

  const countRow = db
    .prepare(
      `SELECT COUNT(*) AS cnt, COALESCE(SUM(r.member_count), 0) AS total_members
       FROM parivaar_registrations r
       ${whereSql}`
    )
    .get(...params);

  const registrations = db
    .prepare(
      `SELECT r.id, r.family_id, r.full_name, r.father_name, r.member_count,
              r.state_code, s.name_en AS state_name,
              r.district_code, d.name_en AS district_name,
              r.subdistrict_code, sb.name_en AS subdistrict_name, sb.admin_type,
              r.village_code, COALESCE(v.name_en, r.thikana) AS village_name,
              r.thikana, r.thikana_same_as_village, r.current_address, r.phone_number,
              r.consent_given, r.public_visibility, r.status, r.admin_note,
              r.created_at, r.updated_at
       FROM parivaar_registrations r
       LEFT JOIN states s ON s.state_code = r.state_code
       LEFT JOIN districts d ON d.district_code = r.district_code
       LEFT JOIN subdistricts_blocks sb ON sb.subdistrict_code = r.subdistrict_code
       LEFT JOIN villages v ON v.village_code = r.village_code
       ${whereSql}
       ORDER BY r.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, safePageSize, offset)
    .map(normalizeBoolRow);

  const auditHistory = db
    .prepare(
      `SELECT id, registration_id, family_id, action, changed_fields,
              previous_values, new_values, admin_note, created_at
       FROM registration_audit_log
       ORDER BY created_at DESC
       LIMIT 150`
    )
    .all()
    .map((a) => ({
      ...a,
      changed_fields: JSON.parse(a.changed_fields || "[]"),
      previous_values: JSON.parse(a.previous_values || "{}"),
      new_values: JSON.parse(a.new_values || "{}"),
    }));

  const missingReports = db
    .prepare(
      `SELECT id, reporter_name, reporter_phone, state_code, district_code, subdistrict_code,
              missing_level, proposed_name, parent_context, pincode, notes, status, created_at
       FROM missing_location_reports
       ORDER BY created_at DESC
       LIMIT 200`
    )
    .all();

  const importHistory = db
    .prepare(
      `SELECT id, dataset_source, import_timestamp, import_status, is_test_run,
              inserted_count, updated_count, skipped_count, invalid_count, error_summary, notes
       FROM location_import_history
       ORDER BY import_timestamp DESC
       LIMIT 50`
    )
    .all()
    .map((r) => ({
      ...normalizeBoolRow(r),
      error_summary:
        typeof r.error_summary === "string"
          ? JSON.parse(r.error_summary || "[]")
          : r.error_summary,
    }));

  const dataQualityReport = queryDataQualityReport(db);

  return {
    registrations,
    total_registrations: Number(countRow?.cnt || 0),
    total_members: Number(countRow?.total_members || 0),
    totalMatchingRegistrations: Number(countRow?.cnt || 0),
    totalMatchingMembers: Number(countRow?.total_members || 0),
    page: safePage,
    pageSize: safePageSize,
    auditHistory,
    auditLogs: auditHistory,
    missingReports,
    importHistory,
    dataQualityReport,
  };
}

/**
 * Builds structured datasets for Admin `.xlsx` (5 sheets) and `.csv` exports
 * directly from actual database records matching the active filters.
 */
export function buildAdminExportData(
  filters = {},
  includePrivateOrDb = true,
  maybeDb = null
) {
  const isSecondArgDb =
    includePrivateOrDb && typeof includePrivateOrDb.prepare === "function";
  const includePrivate = isSecondArgDb ? true : Boolean(includePrivateOrDb);
  const db = isSecondArgDb ? includePrivateOrDb : maybeDb || getParivaarDb();

  const { whereSql, params } = buildAdminFilterWhereClause(filters);

  const rawRegistrations = db
    .prepare(
      `SELECT r.id, r.family_id, r.full_name, COALESCE(r.father_name, '') AS father_name, r.member_count,
              r.state_code, COALESCE(s.name_en, r.state_code) AS state_name,
              r.district_code, COALESCE(d.name_en, r.district_code) AS district_name,
              r.subdistrict_code, COALESCE(sb.name_en, r.subdistrict_code) AS subdistrict_name,
              COALESCE(sb.admin_type, 'Tehsil') AS admin_type,
              COALESCE(r.village_code, '') AS village_code,
              COALESCE(v.name_en, r.thikana, '') AS village_name,
              COALESCE(r.thikana, v.name_en, '') AS thikana,
              r.current_address, r.phone_number,
              r.public_visibility, r.status, COALESCE(r.admin_note, '') AS admin_note,
              r.created_at, r.updated_at
       FROM parivaar_registrations r
       LEFT JOIN states s ON s.state_code = r.state_code
       LEFT JOIN districts d ON d.district_code = r.district_code
       LEFT JOIN subdistricts_blocks sb ON sb.subdistrict_code = r.subdistrict_code
       LEFT JOIN villages v ON v.village_code = r.village_code
       ${whereSql}
       ORDER BY r.family_id ASC, r.created_at ASC`
    )
    .all(...params);

  const registrations = rawRegistrations.map((r) => ({
    ...r,
    family_head_name: r.full_name,
    father_name: r.father_name || "",
    phone_number: includePrivate ? r.phone_number : "[Private]",
    current_address: includePrivate ? r.current_address : "[Private]",
  }));

  const stateSummary = db
    .prepare(
      `SELECT r.state_code, COALESCE(s.name_en, r.state_code) AS state_name,
              COUNT(r.id) AS family_count,
              COALESCE(SUM(r.member_count), 0) AS member_count,
              COUNT(DISTINCT r.district_code) AS districts_count,
              COUNT(DISTINCT r.village_code) AS villages_count
       FROM parivaar_registrations r
       LEFT JOIN states s ON s.state_code = r.state_code
       ${whereSql}
       GROUP BY r.state_code
       ORDER BY family_count DESC, state_name ASC`
    )
    .all(...params);

  const districtSummary = db
    .prepare(
      `SELECT r.district_code, COALESCE(d.name_en, r.district_code) AS district_name,
              r.state_code, COALESCE(s.name_en, r.state_code) AS state_name,
              COUNT(r.id) AS family_count,
              COALESCE(SUM(r.member_count), 0) AS member_count,
              COUNT(DISTINCT r.village_code) AS villages_count
       FROM parivaar_registrations r
       LEFT JOIN districts d ON d.district_code = r.district_code
       LEFT JOIN states s ON s.state_code = r.state_code
       ${whereSql}
       GROUP BY r.district_code
       ORDER BY family_count DESC, district_name ASC`
    )
    .all(...params);

  const villageSummary = db
    .prepare(
      `SELECT COALESCE(r.village_code, '') AS village_code,
              COALESCE(v.name_en, r.thikana, '') AS village_name,
              COALESCE(sb.name_en, r.subdistrict_code) AS subdistrict_name,
              COALESCE(d.name_en, r.district_code) AS district_name,
              COALESCE(s.name_en, r.state_code) AS state_name,
              COUNT(r.id) AS family_count,
              COALESCE(SUM(r.member_count), 0) AS member_count
       FROM parivaar_registrations r
       LEFT JOIN villages v ON v.village_code = r.village_code
       LEFT JOIN subdistricts_blocks sb ON sb.subdistrict_code = r.subdistrict_code
       LEFT JOIN districts d ON d.district_code = r.district_code
       LEFT JOIN states s ON s.state_code = r.state_code
       ${whereSql}
       GROUP BY r.village_code, r.subdistrict_code, r.district_code, r.state_code
       ORDER BY family_count DESC, village_name ASC`
    )
    .all(...params);

  const thikanaSummary = db
    .prepare(
      `SELECT COALESCE(r.thikana, v.name_en, '') AS thikana_name,
              COALESCE(r.village_code, '') AS village_code,
              COALESCE(d.name_en, r.district_code) AS district_name,
              COALESCE(s.name_en, r.state_code) AS state_name,
              COUNT(r.id) AS family_count,
              COALESCE(SUM(r.member_count), 0) AS member_count
       FROM parivaar_registrations r
       LEFT JOIN villages v ON v.village_code = r.village_code
       LEFT JOIN districts d ON d.district_code = r.district_code
       LEFT JOIN states s ON s.state_code = r.state_code
       ${whereSql}
       GROUP BY lower(trim(coalesce(r.thikana, v.name_en, ''))), r.district_code
       ORDER BY family_count DESC, thikana_name ASC`
    )
    .all(...params);

  return {
    registrations,
    allRegistrations: registrations,
    stateSummary: stateSummary.map((s) => ({
      ...s,
      total_families: s.family_count,
      total_members: s.member_count,
    })),
    districtSummary: districtSummary.map((d) => ({
      ...d,
      total_families: d.family_count,
      total_members: d.member_count,
    })),
    villageSummary: villageSummary.map((v) => ({
      ...v,
      total_families: v.family_count,
      total_members: v.member_count,
    })),
    thikanaSummary: thikanaSummary.map((t) => ({
      ...t,
      total_families: t.family_count,
      total_members: t.member_count,
    })),
  };
}

export function updateAdminRecord(payload, db = getParivaarDb()) {
  const { entity, operation, id, status, display_name_override } = payload || {};
  if (!id) return { ok: false, message: "Missing record id" };

  if (entity === "registration") {
    if (operation === "delete") {
      // Note: deleting a registration never decrements village_family_id_counters,
      // so deleted Family IDs are never reused.
      db.prepare("DELETE FROM parivaar_registrations WHERE id = ?").run(String(id));
      return { ok: true };
    }
    if (operation === "status" && ["pending", "approved", "rejected"].includes(status)) {
      const existing = db
        .prepare("SELECT id, family_id, status FROM parivaar_registrations WHERE id = ?")
        .get(String(id));
      if (!existing) return { ok: false, message: "Registration not found" };

      const updatedAt = new Date().toISOString();
      db.prepare(
        "UPDATE parivaar_registrations SET status = ?, updated_at = ? WHERE id = ?"
      ).run(status, updatedAt, String(id));

      db.prepare(
        `INSERT INTO registration_audit_log (
           id, registration_id, family_id, action, changed_fields, previous_values, new_values, created_at
         ) VALUES (?, ?, ?, 'status_changed', '["status"]', ?, ?, ?)`
      ).run(
        crypto.randomUUID(),
        String(id),
        existing.family_id || "",
        JSON.stringify({ status: existing.status }),
        JSON.stringify({ status }),
        updatedAt
      );
      return { ok: true, family_id: existing.family_id };
    }

    if (operation === "edit") {
      const existing = db
        .prepare("SELECT * FROM parivaar_registrations WHERE id = ?")
        .get(String(id));
      if (!existing) return { ok: false, message: "Registration not found" };

      const nextName =
        payload.full_name !== undefined
          ? String(payload.full_name).trim()
          : existing.full_name;
      const rawNextFather =
        payload.father_name !== undefined
          ? String(payload.father_name || "").trim()
          : existing.father_name;
      if (
        rawNextFather &&
        (rawNextFather.length < 2 ||
          rawNextFather.length > 120 ||
          /[<>]/.test(rawNextFather))
      ) {
        return {
          ok: false,
          code: "INVALID_FATHER_NAME",
          message:
            "Please enter a valid Father's Name (2–120 characters).",
        };
      }
      const nextFatherName = rawNextFather || null;
      const nextMembers =
        payload.member_count !== undefined
          ? Math.max(1, Math.floor(Number(payload.member_count) || 1))
          : Number(existing.member_count || 1);
      const nextAddress =
        payload.current_address !== undefined
          ? String(payload.current_address).trim()
          : existing.current_address;
      let nextPhone =
        payload.phone_number !== undefined
          ? String(payload.phone_number).replace(/\D/g, "")
          : existing.phone_number;
      if (nextPhone.length === 12 && nextPhone.startsWith("91")) {
        nextPhone = nextPhone.slice(2);
      } else if (nextPhone.length === 11 && nextPhone.startsWith("0")) {
        nextPhone = nextPhone.slice(1);
      }

      const nextState =
        payload.state_code !== undefined
          ? String(payload.state_code).trim()
          : existing.state_code;
      const nextDistrict =
        payload.district_code !== undefined
          ? String(payload.district_code).trim()
          : existing.district_code;
      const nextSubdistrict =
        payload.subdistrict_code !== undefined
          ? String(payload.subdistrict_code).trim()
          : existing.subdistrict_code;
      const nextVillage =
        payload.village_code !== undefined
          ? String(payload.village_code).trim() || null
          : existing.village_code;

      let nextThikana =
        payload.thikana !== undefined
          ? String(payload.thikana).trim()
          : existing.thikana;
      if (nextVillage && nextVillage !== existing.village_code) {
        const vilRow = db
          .prepare("SELECT name_en FROM villages WHERE village_code = ?")
          .get(nextVillage);
        if (vilRow && !payload.thikana) {
          nextThikana = vilRow.name_en;
        }
      }

      const nextVisibility = ["default", "public", "private"].includes(
        String(payload.public_visibility || "")
      )
        ? String(payload.public_visibility)
        : existing.public_visibility || "default";
      const nextStatus = ["pending", "approved", "rejected"].includes(
        String(payload.status || "")
      )
        ? String(payload.status)
        : existing.status;
      const nextAdminNote =
        payload.admin_note !== undefined
          ? String(payload.admin_note).trim() || null
          : existing.admin_note;

      // Track changed fields for audit history; NEVER alter `id` or `family_id`
      const changedFields = [];
      const prevVals = {};
      const newVals = {};
      const compareMap = {
        full_name: [existing.full_name, nextName],
        father_name: [existing.father_name, nextFatherName],
        member_count: [Number(existing.member_count || 1), nextMembers],
        current_address: [existing.current_address, nextAddress],
        phone_number: [existing.phone_number, nextPhone],
        state_code: [existing.state_code, nextState],
        district_code: [existing.district_code, nextDistrict],
        subdistrict_code: [existing.subdistrict_code, nextSubdistrict],
        village_code: [existing.village_code, nextVillage],
        thikana: [existing.thikana, nextThikana],
        public_visibility: [existing.public_visibility, nextVisibility],
        status: [existing.status, nextStatus],
        admin_note: [existing.admin_note, nextAdminNote],
      };

      for (const [field, [oldV, newV]] of Object.entries(compareMap)) {
        if (String(oldV ?? "") !== String(newV ?? "")) {
          changedFields.push(field);
          prevVals[field] = oldV;
          newVals[field] = newV;
        }
      }

      const locationChanged =
        changedFields.includes("state_code") ||
        changedFields.includes("district_code") ||
        changedFields.includes("subdistrict_code") ||
        changedFields.includes("village_code");

      const updatedAt = new Date().toISOString();

      db.prepare(
        `UPDATE parivaar_registrations
         SET full_name = ?,
             father_name = ?,
             member_count = ?,
             state_code = ?,
             district_code = ?,
             subdistrict_code = ?,
             village_code = ?,
             thikana = ?,
             current_address = ?,
             phone_number = ?,
             public_visibility = ?,
             status = ?,
             admin_note = ?,
             updated_at = ?
         WHERE id = ?`
      ).run(
        nextName,
        nextFatherName,
        nextMembers,
        nextState,
        nextDistrict,
        nextSubdistrict,
        nextVillage,
        nextThikana,
        nextAddress,
        nextPhone,
        nextVisibility,
        nextStatus,
        nextAdminNote,
        updatedAt,
        String(id)
      );

      if (changedFields.length > 0) {
        db.prepare(
          `INSERT INTO registration_audit_log (
             id, registration_id, family_id, action, changed_fields, previous_values, new_values, admin_note, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          crypto.randomUUID(),
          String(id),
          existing.family_id || "",
          locationChanged ? "location_corrected" : "admin_updated",
          JSON.stringify(changedFields),
          JSON.stringify(prevVals),
          JSON.stringify(newVals),
          nextAdminNote,
          updatedAt
        );
      }

      return {
        ok: true,
        id: String(id),
        family_id: existing.family_id,
        changed_fields: changedFields,
      };
    }
  }

  if (entity === "missing_report") {
    if (operation === "status" && ["pending", "reviewed", "imported", "rejected"].includes(status)) {
      db.prepare("UPDATE missing_location_reports SET status = ? WHERE id = ?").run(status, String(id));
      return { ok: true };
    }
  }

  if (entity === "village_display_label") {
    const cleanOverride = String(display_name_override || "").trim() || null;
    db.prepare("UPDATE villages SET display_name_override = ? WHERE village_code = ?").run(
      cleanOverride,
      String(id)
    );
    return { ok: true, village_code: String(id), display_name_override: cleanOverride };
  }

  return { ok: false, message: "Invalid admin operation" };
}
