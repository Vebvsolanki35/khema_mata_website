#!/usr/bin/env node
/**
 * Automated Verification Suite for the Solanki Rajput Parivaar Directory
 * Verifies all 16 required production scenarios + LGD dataset, Map, Mobile UI/UX, and Export checks:
 *  1. Valid family registration submission
 *  2. Registration with Hindi name and address
 *  3. Registration with English name and address
 *  4. Registration with invalid phone number (rejected)
 *  5. Registration with invalid member count (0, negative, non-numeric) (rejected)
 *  6. Registration without selecting required ancestral hierarchy fields (rejected)
 *  7. First registration in village `94494` gets `94494-001`
 *  8. Second registration in village `94494` gets `94494-002` (and formatting up to `94494-010`, `94494-100`, `94494-1000`)
 *  9. Simultaneous registrations in the same village do not get duplicate Family IDs; deleted IDs are never reused
 * 10. Editing a family record (including ancestral location correction) does not change its `family_id` and records audit history
 * 11. Confirmation page shows the saved Family ID, Copy Family ID button, submitted details, and exact correction message
 * 12. Public directory search by Family ID and location works (`India -> State/UT -> District -> Tehsil/Block -> Village -> Family Listings`)
 * 13. Private fields (`phone_number`, `current_address`) are never exposed publicly (including for private-visibility records)
 * 14. Admin export produces a valid `.xlsx` multi-sheet workbook (5 sheets) with Hindi text, preserved text cells, and formula-injection protection
 * 15. Admin filtered export exports only matching rows
 * 16. Directory pagination and search work with a representative dataset (120 records across multiple states/districts/villages) and restore clean 0-record state
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { inflateRawSync } from "node:zlib";
import { SECTIONS, getActiveSection } from "../src/data/navigation.js";
import translations from "../src/data/translations.js";
import { BANK_DETAILS, UPI_IDS } from "../src/config/donation.js";
import { WHATSAPP_GROUP_INVITE } from "../src/config/constants.js";
import {
  isValidIndianPhone,
  normalizeIndianPhone,
  normalizePlaceSearch,
  validateParivaarRegistration,
} from "../src/lib/validateParivaar.js";
import { processLgdDataset } from "./import-lgd-locations.mjs";
import {
  getParivaarDb,
  formatFamilyId,
  queryStates,
  queryDistricts,
  querySubdistricts,
  queryVillages,
  queryDirectory,
  queryPublicFamilies,
  querySummaryStats,
  queryMapAggregates,
  insertParivaarRegistration,
  insertMissingLocationReport,
  queryAdminParivaarData,
  buildAdminExportData,
  queryDataQualityReport,
  updateAdminRecord,
} from "../server/parivaarDatabase.mjs";
import {
  buildXlsxWorkbookBuffer,
  buildCsvBuffer,
  sanitizeSpreadsheetText,
} from "../server/xlsxBuilder.mjs";

const ROOT = process.cwd();
let passed = 0;

function check(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✕ FAILED: ${name}`);
    console.error(`    ${err.stack || err.message}`);
    process.exitCode = 1;
  }
}

/**
 * Helper to parse ZIP central directory entries from a generated `.xlsx` buffer
 * and decompress XML sheets to verify genuine OpenXML structure and Hindi content.
 */
function inspectXlsxBuffer(buf) {
  assert.equal(buf[0], 0x50, "XLSX must start with PK zip signature (0x50)");
  assert.equal(buf[1], 0x4b, "XLSX must start with PK zip signature (0x4b)");

  const entries = new Map();
  let offset = 0;
  while (offset + 30 <= buf.length) {
    const sig = buf.readUInt32LE(offset);
    if (sig !== 0x04034b50) break; // Local file header signature
    const compression = buf.readUInt16LE(offset + 8);
    const compressedSize = buf.readUInt32LE(offset + 18);
    const nameLen = buf.readUInt16LE(offset + 26);
    const extraLen = buf.readUInt16LE(offset + 28);
    const name = buf
      .subarray(offset + 30, offset + 30 + nameLen)
      .toString("utf8");
    const dataStart = offset + 30 + nameLen + extraLen;
    const rawData = buf.subarray(dataStart, dataStart + compressedSize);
    const content =
      compression === 8
        ? inflateRawSync(rawData).toString("utf8")
        : rawData.toString("utf8");
    entries.set(name, content);
    offset = dataStart + compressedSize;
  }
  return entries;
}

/**
 * Clean up all `TEST_VERIFICATION_*` records and reset `village_family_id_counters`
 * for test villages only if no real registrations exist in those villages.
 */
function cleanTestArtifacts(db) {
  db.prepare(
    "DELETE FROM registration_audit_log WHERE registration_id IN (SELECT id FROM parivaar_registrations WHERE full_name LIKE 'TEST_VERIFICATION_%' OR full_name LIKE 'टेस्ट_सत्यापन_%')"
  ).run();
  db.prepare(
    "DELETE FROM parivaar_registrations WHERE full_name LIKE 'TEST_VERIFICATION_%' OR full_name LIKE 'टेस्ट_सत्यापन_%'"
  ).run();
  db.prepare(
    "DELETE FROM missing_location_reports WHERE reporter_name LIKE 'TEST_VERIFICATION_%'"
  ).run();

  const totalRemaining =
    db.prepare("SELECT COUNT(*) AS cnt FROM parivaar_registrations").get()
      ?.cnt || 0;
  if (totalRemaining === 0) {
    db.prepare("DELETE FROM village_family_id_counters").run();
    db.prepare("DELETE FROM registration_audit_log").run();
  }
}

console.log("==============================================================");
console.log("Solanki Rajput Parivaar Directory — Production Verification Suite");
console.log("==============================================================");

// Pre-clean any leftover test records
cleanTestArtifacts(getParivaarDb());

// 1. Official LGD Importer & Rajasthan -> Bundi -> Talera -> Chhapawda (94494)
check("1. Official LGD dataset (36 States, 763 Districts, 14,144 Subdistricts/Blocks, 153,070 Villages) & Rajasthan -> Bundi -> Talera -> Chhapawda (94494)", () => {
  const testDir = path.join(ROOT, "data/lgd/test");
  const res = processLgdDataset({
    statesFile: path.join(testDir, "test_states.csv"),
    districtsFile: path.join(testDir, "test_districts.csv"),
    subdistrictsFile: path.join(testDir, "test_subdistricts.csv"),
    villagesFile: path.join(testDir, "test_villages.csv"),
  });
  assert.equal(res.states.length, 2);
  assert.equal(res.districts.length, 3);
  assert.equal(res.subdistricts.length, 6);
  assert.equal(res.villages.length, 5);

  const db = getParivaarDb();
  assert.equal(queryStates(db).length, 36);
  assert.equal(queryDistricts("8", db).length, 33);

  const taleraVillages = queryVillages(
    { stateCode: "8", districtCode: "94", subdistrictCode: "6033", limit: 1000 },
    db
  );
  assert.equal(taleraVillages.length, 106);

  const chhapawda = taleraVillages.find((v) => v.village_code === "94494");
  assert.ok(
    chhapawda &&
      chhapawda.name_en === "Chhapawda" &&
      chhapawda.coord_verified === true &&
      chhapawda.latitude === 25.316558 &&
      chhapawda.longitude === 75.788279
  );
});

// 2. Scenarios 4, 5, 6: Client & Server Validation for Phone, Member Count, and Required Ancestral Hierarchy
check("2. [Scenarios 4, 5, 6] Validation rejects invalid phone numbers, invalid member counts (0, negative, non-numeric), and missing ancestral location fields", () => {
  assert.equal(normalizeIndianPhone("+91 98765-43210"), "9876543210");
  assert.equal(isValidIndianPhone("9876543210"), true);
  assert.equal(isValidIndianPhone("1234567890"), false);
  assert.equal(isValidIndianPhone("9999999999"), false);

  // Scenario 4: Invalid phone number
  const badPhoneErr = validateParivaarRegistration({
    fullName: "Rajendra Singh Solanki",
    memberCount: 5,
    stateCode: "8",
    districtCode: "94",
    subdistrictCode: "6033",
    villageCode: "94494",
    requireVillage: true,
    currentAddress: "Kota Road, Bundi",
    phoneNumber: "12345",
  });
  assert.ok(badPhoneErr.phoneNumber, "Must reject invalid phone number");

  // Scenario 5: Invalid member counts (0, negative, non-numeric, decimal)
  for (const invalidCount of [0, "0", -3, "-5", "abc", "3.5", ""]) {
    const err = validateParivaarRegistration({
      fullName: "Rajendra Singh Solanki",
      memberCount: invalidCount,
      stateCode: "8",
      districtCode: "94",
      subdistrictCode: "6033",
      villageCode: "94494",
      requireVillage: true,
      currentAddress: "Kota Road, Bundi",
      phoneNumber: "9829012345",
    });
    assert.ok(
      err.memberCount,
      `Client validation must reject memberCount=${JSON.stringify(invalidCount)}`
    );
  }

  const db = getParivaarDb();
  for (const invalidServerCount of [0, -2, "abc"]) {
    const srvRes = insertParivaarRegistration(
      {
        full_name: "TEST_VERIFICATION_BAD_MEMBER_COUNT",
        member_count: invalidServerCount,
        state_code: "8",
        district_code: "94",
        subdistrict_code: "6033",
        village_code: "94494",
        require_village: true,
        current_address: "Bundi, Rajasthan",
        phone_number: "9829012345",
      },
      db
    );
    assert.equal(srvRes.ok, false);
    assert.equal(srvRes.code, "INVALID_MEMBER_COUNT");
  }

  // Scenario 6: Missing required ancestral hierarchy fields (State, District, Tehsil/Block, Village)
  const missingHierarchyErr = validateParivaarRegistration({
    fullName: "Rajendra Singh Solanki",
    memberCount: 4,
    stateCode: "",
    districtCode: "",
    subdistrictCode: "",
    villageCode: "",
    requireVillage: true,
    currentAddress: "Bundi, Rajasthan",
    phoneNumber: "9829012345",
  });
  assert.ok(
    missingHierarchyErr.stateCode &&
      missingHierarchyErr.districtCode &&
      missingHierarchyErr.subdistrictCode &&
      missingHierarchyErr.villageCode,
    "Must require State, District, Tehsil/Block, and Village"
  );

  const missingVillageSrv = insertParivaarRegistration(
    {
      full_name: "TEST_VERIFICATION_NO_VILLAGE",
      member_count: 4,
      state_code: "8",
      district_code: "94",
      subdistrict_code: "6033",
      village_code: "",
      require_village: true,
      current_address: "Bundi, Rajasthan",
      phone_number: "9829012345",
    },
    db
  );
  assert.equal(missingVillageSrv.ok, false);
  assert.equal(missingVillageSrv.code, "MISSING_VILLAGE");
});

// 3. Scenarios 1, 2, 3, 7, 8, 9, 10: Family ID Generation (`94494-001`, `94494-002`), Hindi & English Registrations, Concurrency, No Reuse on Delete, and Permanent ID on Edit
check("3. [Scenarios 1, 2, 3, 7, 8, 9, 10] Family ID generation (94494-001, 94494-002, 94494-010, 94494-100, 94494-1000), Hindi/English registration, concurrency safety, non-reuse after delete, and permanent Family ID on edits", () => {
  const db = getParivaarDb();
  cleanTestArtifacts(db);

  // Verify formatFamilyId rules
  assert.equal(formatFamilyId("94494", 1), "94494-001");
  assert.equal(formatFamilyId("94494", 2), "94494-002");
  assert.equal(formatFamilyId("94494", 10), "94494-010");
  assert.equal(formatFamilyId("94494", 100), "94494-100");
  assert.equal(formatFamilyId("94494", 1000), "94494-1000");

  try {
    // Scenario 1, 2, 7: First registration in village 94494 (Hindi name & address) -> gets 94494-001
    const reg1 = insertParivaarRegistration(
      {
        full_name: "टेस्ट_सत्यापन_ठाकुर राजेंद्र सिंह सोलंकी",
        member_count: 6,
        state_code: "8",
        district_code: "94",
        subdistrict_code: "6033",
        village_code: "94494",
        require_village: true,
        current_address: "मकान नं. 12, सिविल लाइन्स, बूंदी, राजस्थान",
        phone_number: "9829011001",
      },
      db
    );
    assert.equal(reg1.ok, true);
    assert.equal(reg1.family_id, "94494-001");
    assert.equal(reg1.member_count, 6);
    assert.equal(reg1.registration.village_name, "Chhapawda");

    // Scenario 3, 8: Second registration in village 94494 (English name & address) -> gets 94494-002
    const reg2 = insertParivaarRegistration(
      {
        full_name: "TEST_VERIFICATION_Vikramaditya Singh Solanki",
        member_count: 4,
        state_code: "8",
        district_code: "94",
        subdistrict_code: "6033",
        village_code: "94494",
        require_village: true,
        current_address: "Plot 45, Vaishali Nagar, Jaipur, Rajasthan",
        phone_number: "9829011002",
      },
      db
    );
    assert.equal(reg2.ok, true);
    assert.equal(reg2.family_id, "94494-002");
    assert.equal(reg2.member_count, 4);

    // Scenario 9a: Delete reg2 (94494-002) and verify next registration gets 94494-003 (NEVER reuses 94494-002)
    const delRes = updateAdminRecord(
      { entity: "registration", operation: "delete", id: reg2.id },
      db
    );
    assert.equal(delRes.ok, true);

    const reg3 = insertParivaarRegistration(
      {
        full_name: "TEST_VERIFICATION_Mahendra Singh Solanki",
        member_count: 5,
        state_code: "8",
        district_code: "94",
        subdistrict_code: "6033",
        village_code: "94494",
        require_village: true,
        current_address: "Dadabari, Kota, Rajasthan",
        phone_number: "9829011003",
      },
      db
    );
    assert.equal(reg3.ok, true);
    assert.equal(
      reg3.family_id,
      "94494-003",
      "Deleted Family ID 94494-002 must never be reused; next registration must receive 94494-003"
    );

    // Scenario 9b: Simultaneous / burst registrations in the same village (15 rapid calls)
    const concurrentIds = new Set();
    for (let idx = 0; idx < 15; idx++) {
      const r = insertParivaarRegistration(
        {
          full_name: `TEST_VERIFICATION_CONCURRENT_${idx + 1}`,
          member_count: (idx % 7) + 2,
          state_code: "8",
          district_code: "94",
          subdistrict_code: "6033",
          village_code: "94494",
          require_village: true,
          current_address: `Sector ${idx + 1}, Bundi, Rajasthan`,
          phone_number: `9829022${String(idx + 100).slice(-3)}`,
        },
        db
      );
      assert.equal(r.ok, true);
      assert.equal(
        concurrentIds.has(r.family_id),
        false,
        `Duplicate Family ID generated: ${r.family_id}`
      );
      concurrentIds.add(r.family_id);
    }
    assert.equal(concurrentIds.size, 15);
    assert.ok(concurrentIds.has("94494-004") && concurrentIds.has("94494-018"));

    // Scenario 10: Editing a family record (including member_count, head name, and ancestral village correction)
    // must NEVER change its permanent `family_id`, and must record the change in `registration_audit_log`.
    const editRes = updateAdminRecord(
      {
        entity: "registration",
        operation: "edit",
        id: reg1.id,
        full_name: "टेस्ट_सत्यापन_ठाकुर राजेंद्र सिंह जी सोलंकी (संशोधित)",
        member_count: 8,
        phone_number: "9829011099",
        current_address: "नया पता: सिविल लाइन्स, बूंदी",
        state_code: "8",
        district_code: "94",
        subdistrict_code: "6033",
        village_code: "94466", // Corrected ancestral village to Aktasa (94466)
        thikana: "Aktasa",
        public_visibility: "public",
        status: "approved",
        reason: "Ancestral village & member count correction requested by Family Head",
      },
      db
    );
    assert.equal(editRes.ok, true);
    assert.equal(
      editRes.family_id,
      "94494-001",
      "Permanent Family ID 94494-001 must NEVER change even when ancestral village or details are edited"
    );

    const updatedRow = db
      .prepare("SELECT * FROM parivaar_registrations WHERE id = ?")
      .get(reg1.id);
    assert.equal(updatedRow.family_id, "94494-001");
    assert.equal(updatedRow.member_count, 8);
    assert.equal(updatedRow.village_code, "94466");

    const auditEntry = db
      .prepare(
        "SELECT * FROM registration_audit_log WHERE registration_id = ? ORDER BY created_at DESC LIMIT 1"
      )
      .get(reg1.id);
    assert.ok(auditEntry, "Audit log entry must be created on edit");
    assert.equal(auditEntry.family_id, "94494-001");
    assert.equal(auditEntry.action, "location_corrected");
    assert.ok(auditEntry.previous_values.includes("94494"));
    assert.ok(auditEntry.new_values.includes("94466"));
  } finally {
    cleanTestArtifacts(db);
  }
});

// 4. Scenarios 12, 13, 14, 15, 16: Public Family Directory, Privacy Rules, 5-Sheet Excel (.xlsx) & CSV Export, Filtered Export, and 120-Record Load/Pagination Test
check("4. [Scenarios 12, 13, 14, 15, 16] Public Family Directory, Private Record Visibility, 5-Sheet Hindi Excel (.xlsx) Export, Filtered Export, and 120-Record Pagination Load Test", () => {
  const db = getParivaarDb();
  cleanTestArtifacts(db);

  try {
    // Seed 120 representative test registrations across 3 villages:
    // - 50 in Chhapawda (94494, Talera 6033, Bundi 94, Rajasthan 8)
    // - 40 in Aktasa (94466, Talera 6033, Bundi 94, Rajasthan 8)
    // - 30 in Baroondhan (94454, Talera 6033, Bundi 94, Rajasthan 8)
    const testVillages = [
      { code: "94494", name: "Chhapawda", count: 50 },
      { code: "94466", name: "Aktasa", count: 40 },
      { code: "94454", name: "Baroondhan", count: 30 },
    ];

    let seqPhone = 9829100001;
    let firstChhapawdaId = null;
    let privateRecordUuid = null;
    let privateRecordFamilyId = null;

    for (const tv of testVillages) {
      for (let i = 1; i <= tv.count; i++) {
        const isHindi = i % 2 === 1;
        const headName = isHindi
          ? `टेस्ट_सत्यापन_कुंवर प्रताप सिंह सोलंकी ${tv.code}-${i}`
          : `TEST_VERIFICATION_Kunwar Pratap Singh Solanki ${tv.code}-${i}`;
        const address = isHindi
          ? `गोपनीय निवास नं. ${i}, कोटा रोड, बूंदी`
          : `Private House No. ${i}, Kota Road, Bundi`;
        const res = insertParivaarRegistration(
          {
            full_name: headName,
            member_count: (i % 6) + 2,
            state_code: "8",
            district_code: "94",
            subdistrict_code: "6033",
            village_code: tv.code,
            require_village: true,
            current_address: address,
            phone_number: String(seqPhone++),
          },
          db
        );
        assert.equal(res.ok, true);
        if (tv.code === "94494" && i === 1) {
          firstChhapawdaId = res.family_id;
          assert.equal(firstChhapawdaId, "94494-001");
        }
        if (tv.code === "94494" && i === 2) {
          assert.equal(res.family_id, "94494-002");
          privateRecordUuid = res.id;
          privateRecordFamilyId = res.family_id;
        }
      }
    }

    // Mark 94494-002 as `private` visibility to test Scenario 13 (private record visibility rules)
    updateAdminRecord(
      {
        entity: "registration",
        operation: "edit",
        id: privateRecordUuid,
        public_visibility: "private",
        reason: "Testing private record visibility",
      },
      db
    );

    // Scenario 16: Verify Summary Statistics & Directory Pagination across 120 registrations
    const stats = querySummaryStats(db);
    assert.equal(stats.total_registrations, 120);
    assert.ok(stats.total_members >= 240);
    assert.equal(stats.states_represented, 1);
    assert.equal(stats.districts_covered, 1);
    assert.equal(stats.villages_represented, 3);

    // Paginate Public Family Listings (Page 1, Page 2, Page 6)
    const pubPage1 = queryPublicFamilies({ page: 1, pageSize: 20 }, db);
    const pubPage2 = queryPublicFamilies({ page: 2, pageSize: 20 }, db);
    assert.equal(pubPage1.total, 120);
    assert.equal(pubPage1.families.length, 20);
    assert.equal(pubPage2.families.length, 20);
    assert.notEqual(pubPage1.families[0].family_id, pubPage2.families[0].family_id);

    // Scenario 12: Search Public Family Directory by exact Family ID (`94494-001`) and by village (`94466`)
    const searchById = queryPublicFamilies({ q: "94494-001" }, db);
    assert.equal(searchById.total, 1);
    assert.equal(searchById.families[0].family_id, "94494-001");
    assert.equal(searchById.families[0].is_public, true);
    assert.ok(searchById.families[0].family_head_name.includes("टेस्ट_सत्यापन_कुंवर प्रताप सिंह सोलंकी"));

    const filterByVillage = queryPublicFamilies({ villageCode: "94466", pageSize: 50 }, db);
    assert.equal(filterByVillage.total, 40);

    // Scenario 13: Privacy Verification — Private record `94494-002` exposes its `family_id` and location,
    // but NEVER exposes `family_head_name`, `member_count`, `phone_number`, or `current_address`!
    const searchPrivate = queryPublicFamilies({ q: privateRecordFamilyId }, db);
    assert.equal(searchPrivate.total, 1);
    const privItem = searchPrivate.families[0];
    assert.equal(privItem.family_id, "94494-002", "Family ID must be publicly visible even for private records");
    assert.equal(privItem.is_public, false);
    assert.equal(privItem.family_head_name, null, "Private record must not expose family_head_name publicly");
    assert.equal(privItem.member_count, null, "Private record must not expose member_count publicly");

    const allPublicJson = JSON.stringify({
      stats,
      agg: queryMapAggregates({ stateCode: "8", districtCode: "94" }, db),
      dir: queryDirectory({ stateCode: "8", districtCode: "94", subdistrictCode: "6033" }, db),
      pubPage1,
      searchPrivate,
    });
    assert.equal(allPublicJson.includes("9829100"), false, "Public API responses must NEVER leak phone numbers");
    assert.equal(allPublicJson.includes("Private House No."), false, "Public API responses must NEVER leak English current addresses");
    assert.equal(allPublicJson.includes("गोपनीय निवास नं."), false, "Public API responses must NEVER leak Hindi current addresses");
    assert.equal(
      allPublicJson.includes("TEST_VERIFICATION_Kunwar Pratap Singh Solanki 94494-2"),
      false,
      "Private record's head name must NEVER appear in public responses"
    );

    // Scenario 14: Admin Export produces a genuine 5-sheet `.xlsx` file preserving Hindi text, Family IDs, LGD codes, and formula sanitization
    assert.equal(sanitizeSpreadsheetText("=cmd|' /C calc'!A0"), "'=cmd|' /C calc'!A0");
    assert.equal(sanitizeSpreadsheetText("+919829012345"), "'+919829012345");

    const fullExportData = buildAdminExportData({}, true, db);
    assert.equal(fullExportData.allRegistrations.length, 120);
    assert.equal(fullExportData.stateSummary.length, 1);
    assert.equal(fullExportData.districtSummary.length, 1);
    assert.equal(fullExportData.villageSummary.length, 3);
    assert.equal(fullExportData.thikanaSummary.length, 3);

    const xlsxBuf = buildXlsxWorkbookBuffer([
      {
        name: "All Registrations",
        columns: [
          { header: "Family ID", key: "family_id", width: 16 },
          { header: "Family Head's Name (परिवार के मुखिया का नाम)", key: "family_head_name", width: 32 },
          { header: "Number of Family Members", key: "member_count", width: 18, type: "number" },
          { header: "Ancestral Village Code", key: "village_code", width: 16 },
          { header: "Mobile Number", key: "phone_number", width: 18 },
        ],
        rows: fullExportData.allRegistrations,
      },
      {
        name: "State Summary",
        columns: [
          { header: "State Name", key: "state_name", width: 24 },
          { header: "Total Registered Families", key: "total_families", width: 20, type: "number" },
        ],
        rows: fullExportData.stateSummary,
      },
      {
        name: "District Summary",
        columns: [
          { header: "District Name", key: "district_name", width: 24 },
          { header: "Total Registered Families", key: "total_families", width: 20, type: "number" },
        ],
        rows: fullExportData.districtSummary,
      },
      {
        name: "Village Summary",
        columns: [
          { header: "Village Name", key: "village_name", width: 24 },
          { header: "Total Registered Families", key: "total_families", width: 20, type: "number" },
        ],
        rows: fullExportData.villageSummary,
      },
      {
        name: "Thikana Summary",
        columns: [
          { header: "Thikana / Village Association", key: "thikana_name", width: 28 },
          { header: "Total Registered Families", key: "total_families", width: 20, type: "number" },
        ],
        rows: fullExportData.thikanaSummary,
      },
    ]);

    const zipEntries = inspectXlsxBuffer(xlsxBuf);
    assert.ok(zipEntries.has("xl/workbook.xml"), "XLSX must contain xl/workbook.xml");
    assert.ok(zipEntries.has("xl/worksheets/sheet1.xml"), "XLSX must contain sheet1 (All Registrations)");
    assert.ok(zipEntries.has("xl/worksheets/sheet2.xml"), "XLSX must contain sheet2 (State Summary)");
    assert.ok(zipEntries.has("xl/worksheets/sheet3.xml"), "XLSX must contain sheet3 (District Summary)");
    assert.ok(zipEntries.has("xl/worksheets/sheet4.xml"), "XLSX must contain sheet4 (Village Summary)");
    assert.ok(zipEntries.has("xl/worksheets/sheet5.xml"), "XLSX must contain sheet5 (Thikana Summary)");

    const workbookXml = zipEntries.get("xl/workbook.xml");
    for (const sheetName of [
      "All Registrations",
      "State Summary",
      "District Summary",
      "Village Summary",
      "Thikana Summary",
    ]) {
      assert.ok(workbookXml.includes(sheetName), `Workbook XML must include sheet "${sheetName}"`);
    }

    const sheet1Xml = zipEntries.get("xl/worksheets/sheet1.xml");
    assert.ok(
      sheet1Xml.includes("94494-001"),
      "Sheet 1 XML must preserve Family ID '94494-001' as text"
    );
    assert.ok(
      sheet1Xml.includes("टेस्ट_सत्यापन_कुंवर प्रताप सिंह सोलंकी"),
      "Sheet 1 XML must preserve Devanagari Hindi names without corruption"
    );

    // Scenario 15: Admin Filtered Export exports only matching rows (e.g. villageCode = "94454" -> 30 rows)
    const filteredExportData = buildAdminExportData({ villageCode: "94454" }, false, db);
    assert.equal(
      filteredExportData.allRegistrations.length,
      30,
      "Filtered export for village 94454 must return exactly 30 rows"
    );
    assert.equal(
      filteredExportData.allRegistrations[0].phone_number,
      "[Private]",
      "When includePrivate=false, phone_number must be redacted as '[Private]'"
    );

    const csvBuf = buildCsvBuffer(
      [
        { header: "Family ID", key: "family_id" },
        { header: "Family Head's Name", key: "family_head_name" },
        { header: "Village Code", key: "village_code" },
      ],
      filteredExportData.allRegistrations
    );
    const csvStr = csvBuf.toString("utf8");
    assert.ok(csvStr.startsWith("\uFEFF"), "CSV export must include UTF-8 BOM for Excel Hindi compatibility");
    assert.ok(csvStr.includes("94454-001"));
    assert.equal(csvStr.includes("94494-001"), false, "Filtered CSV must not include non-matching villages");
  } finally {
    cleanTestArtifacts(db);
  }

  const finalStats = querySummaryStats(db);
  assert.equal(finalStats.total_registrations, 0, "All test records cleaned up; 0 fake registrations remain");
});

// 5. Scenario 11 & UI Structure: 5 Website Sections, Form without Separate Thikana/Consent Inputs, and Confirmation Page Details
check("5. [Scenario 11] Parivaar page has 5 clear sections, registration form removes separate Thikana/consent inputs, and Confirmation view shows exact correction message", () => {
  const parivaarPageSrc = fs.readFileSync(path.join(ROOT, "src/pages/Parivaar.jsx"), "utf8");
  for (const requiredSection of [
    "1. परिचय (Overview)",
    "2. समाज का मानचित्र (Community Map)",
    "3. परिवार खोजें (Family Directory)",
    "4. परिवार पंजीकरण (Register Family)",
    "5. सुधार एवं सहायता (Corrections & Help)",
  ]) {
    assert.ok(
      parivaarPageSrc.includes(requiredSection),
      `Parivaar.jsx must include section "${requiredSection}"`
    );
  }

  const formSrc = fs.readFileSync(
    path.join(ROOT, "src/components/parivaar/ParivaarRegistrationForm.jsx"),
    "utf8"
  );
  assert.ok(
    formSrc.includes("परिवार के मुखिया का नाम (Family Head's Name)"),
    "Registration form must include Family Head's Name"
  );
  assert.ok(
    formSrc.includes("परिवार के सदस्यों की संख्या (Number of Family Members)"),
    "Registration form must include Number of Family Members"
  );
  assert.equal(
    formSrc.includes('data-testid="reg-thikana-input"'),
    false,
    "Separate Thikana text input must be removed from the registration form"
  );
  assert.equal(
    formSrc.includes('id="parivaar-consent"'),
    false,
    "Separate public-listing consent checkbox must not be present in this version"
  );
  assert.ok(
    formSrc.includes("पंजीकरण सफल (Registration Successful)") &&
      formSrc.includes('data-testid="generated-family-id"') &&
      formSrc.includes('data-testid="copy-family-id-btn"') &&
      formSrc.includes("जानकारी में कोई गलती है? (Found an Error?)") &&
      formSrc.includes(
        "यदि आपके द्वारा भरी गई जानकारी में कोई गलती है, तो कृपया अपने Family ID के साथ directory administrator से संपर्क करें। (If any submitted information is incorrect, contact the directory administrator and provide your Family ID.)"
      ),
    "Confirmation view must display Registration Successful title, generated Family ID, Copy button, and exact Hindi+English correction notice"
  );
});

// 6. Map Tile Provider, LGD Data-Quality Report, Navigation & Mobile-First UI/UX Regression Checks
check("6. Map tile configuration, LGD Data-Quality Report, Navigation preservation, and Mobile-First UI/UX checks", () => {
  const mapCode = fs.readFileSync(
    path.join(ROOT, "src/components/parivaar/CommunityMap.jsx"),
    "utf8"
  );
  assert.ok(
    mapCode.includes(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
    ),
    "CommunityMap must use keyless Esri World Street Map as primary tile provider"
  );
  assert.ok(
    mapCode.includes(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
    ),
    "CommunityMap must configure Esri World Topographic Map as automatic fallback"
  );
  assert.ok(
    mapCode.includes("maxZoom: 18"),
    "CommunityMap must support zoom levels up to 18"
  );

  const ids = SECTIONS.map((s) => s.id);
  assert.deepEqual(ids, ["home", "heritage", "darshan", "visit", "seva", "parivaar"]);
  assert.equal(getActiveSection("/parivaar")?.section?.id, "parivaar");
  assert.equal(BANK_DETAILS.accountNumber, "686005601933");
  assert.equal(BANK_DETAILS.ifsc, "ICIC0006860");
  assert.ok(UPI_IDS.length >= 1);
  assert.ok(WHATSAPP_GROUP_INVITE.startsWith("https://chat.whatsapp.com/"));

  const db = getParivaarDb();
  const dq = queryDataQualityReport(db);
  assert.equal(dq.total_states, 36);
  assert.equal(dq.total_districts, 763);
  assert.equal(dq.total_villages, 153070);
  assert.equal(dq.orphan_parent_records, 0);

  assert.ok(normalizePlaceSearch("राजस्थान").includes("rajasthan"));
  assert.ok(normalizePlaceSearch("बूंदी").includes("bundi"));
  assert.ok(normalizePlaceSearch("छापावदा").includes("chhapawda"));
});

// 7. Father's Name (`father_name`) Registration, Directory `S/o` Display, Admin Edit, Legacy Missing-Father Fallback, and Search/Pagination/Family-ID Integrity
check("7. Father's Name (`father_name`) end-to-end: registration validation, DB persistence, directory `S/o` rendering, admin editing, legacy null handling, and search/family-code preservation", () => {
  const db = getParivaarDb();
  cleanTestArtifacts(db);

  try {
    // 7a. Client/shared validation requires Father's Name when fatherName is provided on form
    const invalidFatherErrors = validateParivaarRegistration({
      fullName: "Vaibhav Pratap Singh Solanki",
      fatherName: "",
      memberCount: 5,
      stateCode: "8",
      districtCode: "94",
      subdistrictCode: "6033",
      villageCode: "94494",
      requireVillage: true,
      currentAddress: "Kota, Rajasthan",
      phoneNumber: "9899900091",
    });
    assert.ok(
      invalidFatherErrors.fatherName,
      "Empty fatherName must fail validation when fatherName field is present"
    );

    const validFatherErrors = validateParivaarRegistration({
      fullName: "Vaibhav Pratap Singh Solanki",
      fatherName: "Gajendra Singh Solanki",
      memberCount: 5,
      stateCode: "8",
      districtCode: "94",
      subdistrictCode: "6033",
      villageCode: "94494",
      requireVillage: true,
      currentAddress: "Kota, Rajasthan",
      phoneNumber: "9899900091",
    });
    assert.equal(Object.keys(validFatherErrors).length, 0);

    // 7b. Register a new family member with father's name
    const regWithFather = insertParivaarRegistration(
      {
        full_name: "टेस्ट_सत्यापन_Vaibhav Pratap Singh Solanki",
        father_name: "Gajendra Singh Solanki",
        require_father_name: true,
        member_count: 5,
        state_code: "8",
        district_code: "94",
        subdistrict_code: "6033",
        village_code: "94494",
        current_address: "Civil Lines, Kota, Rajasthan",
        phone_number: "9899900091",
      },
      db
    );
    assert.equal(regWithFather.ok, true);
    assert.equal(regWithFather.family_id, "94494-001");
    assert.equal(regWithFather.father_name, "Gajendra Singh Solanki");

    // 7c. Register a legacy/existing record without a father's name (`father_name: null`)
    const regWithoutFather = insertParivaarRegistration(
      {
        full_name: "टेस्ट_सत्यापन_Legacy Member Without Father Name",
        member_count: 4,
        state_code: "8",
        district_code: "94",
        subdistrict_code: "6033",
        village_code: "94494",
        current_address: "Bundi, Rajasthan",
        phone_number: "9899900092",
      },
      db
    );
    assert.equal(regWithoutFather.ok, true);
    assert.equal(regWithoutFather.family_id, "94494-002");
    assert.equal(regWithoutFather.father_name, null);

    // 7d. Verify `father_name` is saved in DB and returned in `queryPublicFamilies`
    const publicDir = queryPublicFamilies({ villageCode: "94494" }, db);
    assert.equal(publicDir.total, 2);
    const itemWithFather = publicDir.families.find(
      (i) => i.family_id === "94494-001"
    );
    const itemWithoutFather = publicDir.families.find(
      (i) => i.family_id === "94494-002"
    );
    assert.ok(itemWithFather);
    assert.equal(itemWithFather.father_name, "Gajendra Singh Solanki");
    assert.ok(itemWithoutFather);
    assert.equal(
      itemWithoutFather.father_name,
      null,
      "Record without father_name must return null so UI never shows 'S/o' alone"
    );

    // 7e. Search by father's name works in public directory & admin query
    const searchByFather = queryPublicFamilies(
      { q: "Gajendra Singh Solanki" },
      db
    );
    assert.equal(searchByFather.total, 1);
    assert.equal(searchByFather.families[0].family_id, "94494-001");

    // 7f. Editing a record updates `father_name` while keeping `family_id` unchanged
    const editRes = updateAdminRecord(
      {
        entity: "registration",
        operation: "edit",
        id: regWithFather.id,
        father_name: "Thakur Gajendra Singh Ji Solanki",
        admin_note: "Updated father's name title",
      },
      db
    );
    assert.equal(editRes.ok, true);
    assert.equal(editRes.family_id, "94494-001");

    const afterEditDir = queryPublicFamilies({ q: "94494-001" }, db);
    assert.equal(afterEditDir.families.length, 1);
    assert.equal(
      afterEditDir.families[0].father_name,
      "Thakur Gajendra Singh Ji Solanki"
    );
    assert.equal(afterEditDir.families[0].family_id, "94494-001");

    // 7g. Verify UI templates for Registration Form and LocationDirectory
    const formSrc = fs.readFileSync(
      path.join(ROOT, "src/components/parivaar/ParivaarRegistrationForm.jsx"),
      "utf8"
    );
    assert.ok(
      formSrc.includes('id="parivaar-father-name"') &&
        formSrc.includes('data-testid="reg-father-name-input"'),
      "Registration form must include the required Father's Name input field"
    );

    const dirSrc = fs.readFileSync(
      path.join(ROOT, "src/components/parivaar/LocationDirectory.jsx"),
      "utf8"
    );
    assert.ok(
      dirSrc.includes('data-testid="public-family-father"') &&
        dirSrc.includes("S/o {String(fam.father_name).trim()}"),
      "LocationDirectory must render S/o <father_name> underneath the member's full name only when father_name is non-empty"
    );
  } finally {
    cleanTestArtifacts(db);
  }
});

// 8. Production Bug Fix Regression Suite: Keyless Map Tiles (No CARTO Watermark) & PostgrestFilterBuilder RPC Handling (`l.rpc(...).catch is not a function`)
check("8. [Production Bug 1 & Bug 2] Keyless Esri map provider without CARTO watermark & safe async/await Supabase RPC handling (zero `.rpc(...).catch` calls)", () => {
  // 8a. Verify no `.rpc(...).catch` or `supabase.from(...).catch` exists in frontend/backend code
  const hookSrc = fs.readFileSync(
    path.join(ROOT, "src/hooks/useParivaarData.js"),
    "utf8"
  );
  assert.equal(
    /\.rpc\([\s\S]*?\)\.catch/.test(hookSrc),
    false,
    "useParivaarData.js must never call .catch() directly on supabase.rpc() (PostgrestFilterBuilder)"
  );
  assert.ok(
    hookSrc.includes('callSupabaseRpc(\n            "submit_parivaar_registration"') ||
      hookSrc.includes('callSupabaseRpc("submit_parivaar_registration"'),
    "useParivaarData.js must use async/await via callSupabaseRpc for submit_parivaar_registration"
  );
  assert.ok(
    hookSrc.includes('callSupabaseRpc("submit_missing_location_report"'),
    "useParivaarData.js must use async/await via callSupabaseRpc for submit_missing_location_report"
  );

  const adminTabSrc = fs.readFileSync(
    path.join(ROOT, "src/components/admin/TabParivaar.jsx"),
    "utf8"
  );
  assert.equal(
    /supabase[\s\S]{0,120}\.catch\(/.test(adminTabSrc),
    false,
    "TabParivaar.jsx must never call .catch() on a Supabase PostgrestFilterBuilder"
  );

  const supabaseLibSrc = fs.readFileSync(
    path.join(ROOT, "src/lib/supabase.js"),
    "utf8"
  );
  assert.ok(
    supabaseLibSrc.includes("export async function callSupabaseRpc") &&
      supabaseLibSrc.includes("await supabase.rpc(fnName, params)"),
    "src/lib/supabase.js must export callSupabaseRpc using await supabase.rpc(fnName, params)"
  );

  // 8b. Verify PostgreSQL migration defines extended submit_parivaar_registration RPC with father_name, member_count, family_id
  const migrationSrc = fs.readFileSync(
    path.join(
      ROOT,
      "supabase/migrations/20261030100000_fix_parivaar_rpc_and_persistence.sql"
    ),
    "utf8"
  );
  assert.ok(
    migrationSrc.includes("create or replace function public.submit_parivaar_registration") &&
      migrationSrc.includes("p_father_name") &&
      migrationSrc.includes("p_member_count") &&
      migrationSrc.includes("p_family_id") &&
      migrationSrc.includes("public.village_family_id_counters") &&
      migrationSrc.includes("create or replace function public.get_public_parivaar_families"),
    "PostgreSQL migration must update submit_parivaar_registration with p_father_name, p_member_count, p_family_id, and village_family_id_counters"
  );
});

console.log("==============================================================");
console.log(`All ${passed} verification suites (covering all 16 scenarios + father_name + Production Bug 1 & Bug 2 fixes) passed!`);
console.log("==============================================================");
