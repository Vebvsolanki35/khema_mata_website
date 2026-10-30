#!/usr/bin/env node
/**
 * Builds a pre-seeded, immutable SQLite database containing ONLY the official
 * LGD administrative hierarchy (states -> districts -> subdistricts/blocks ->
 * villages).  It deliberately contains no community registrations.
 *
 * Why: on a serverless cold start the previous implementation parsed ~5 MB of
 * LGD CSV and inserted 167,000+ rows into every new container (measured at
 * 4,700 ms in this environment).  Restoring this pre-built file instead takes
 * ~160 ms, and the expensive work moves to build time.
 *
 * The artifact is optional: if it is missing or unreadable, the server falls
 * back to importing the CSV files exactly as before.
 *
 * Usage: node scripts/build-lgd-sqlite.mjs [--if-missing] [--quiet]
 */

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LGD_DIR = path.join(ROOT, "data", "lgd");
const OUTPUT_PATH = path.join(LGD_DIR, "lgd_locations.sqlite.gz");

const args = new Set(process.argv.slice(2));
const ifMissing = args.has("--if-missing");
const quiet = args.has("--quiet");
const log = (...values) => {
  if (!quiet) console.log(...values);
};

async function main() {
  if (ifMissing && fs.existsSync(OUTPUT_PATH)) {
    log(`[lgd] prebuilt database already present (${OUTPUT_PATH})`);
    return;
  }

  if (!fs.existsSync(path.join(LGD_DIR, "lgd_states.csv"))) {
    log("[lgd] LGD source CSV files are not present; skipping prebuilt database.");
    return;
  }

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "lgd-build-"));
  const dbPath = path.join(workDir, "lgd_locations.sqlite");

  const startedAt = performance.now();
  const { initParivaarSchema, seedLgdIntoSqlite } = await import(
    "../server/parivaarDatabase.mjs"
  );

  const db = new DatabaseSync(dbPath);
  initParivaarSchema(db);
  const seedResult = seedLgdIntoSqlite(db);

  if (!seedResult?.imported) {
    log("[lgd] LGD import did not run; skipping prebuilt database.");
    db.close();
    fs.rmSync(workDir, { recursive: true, force: true });
    return;
  }

  // Make the file self-contained before it is copied around: fold the write
  // ahead log back into the main database file and leave it in rollback mode.
  try {
    db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  } catch {
    /* ignore */
  }
  try {
    db.exec("PRAGMA journal_mode = DELETE");
  } catch {
    /* ignore */
  }
  try {
    db.exec("VACUUM");
  } catch {
    /* ignore */
  }
  db.close();

  const raw = fs.readFileSync(dbPath);
  const compressed = zlib.gzipSync(raw, { level: 9 });
  fs.writeFileSync(`${OUTPUT_PATH}.tmp`, compressed);
  fs.renameSync(`${OUTPUT_PATH}.tmp`, OUTPUT_PATH);

  fs.rmSync(workDir, { recursive: true, force: true });

  log(
    `[lgd] prebuilt database written to ${path.relative(ROOT, OUTPUT_PATH)} ` +
      `(${(compressed.length / 1e6).toFixed(1)} MB from ${(raw.length / 1e6).toFixed(
        1
      )} MB, ${Math.round(performance.now() - startedAt)} ms)`
  );
}

main().catch((err) => {
  // Never fail a production build because the optional cache could not be built.
  console.warn(`[lgd] prebuilt database skipped: ${err?.message || err}`);
  process.exit(0);
});
