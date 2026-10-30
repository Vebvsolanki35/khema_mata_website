import { Buffer } from "node:buffer";
import zlib from "node:zlib";

/**
 * Prevents Spreadsheet Formula Injection (CSV/XLSX Injection).
 * Any text cell starting with =, +, -, @, tab, or CR is prefixed with a single quote
 * so Excel / Google Sheets / LibreOffice never execute user input as a formula.
 */
export function sanitizeSpreadsheetText(val) {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

function escapeXml(str) {
  return String(str ?? "")
    // Strip control chars invalid in XML 1.0 except tab, LF, CR
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function colIndexToLetter(colIdx) {
  let n = colIdx + 1;
  let letters = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

function buildWorksheetXml(columns, rows) {
  const colDefs = columns
    .map((c, idx) => {
      const width = Math.max(Number(c.width) || 18, 10);
      return `<col min="${idx + 1}" max="${idx + 1}" width="${width}" customWidth="1"/>`;
    })
    .join("");

  const xmlParts = [
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`,
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`,
    `<cols>${colDefs}</cols>`,
    `<sheetData>`,
  ];

  // Header Row (Row 1, style s="1")
  const headerCells = columns
    .map((col, cIdx) => {
      const ref = `${colIndexToLetter(cIdx)}1`;
      const safeHeader = escapeXml(sanitizeSpreadsheetText(col.header));
      return `<c r="${ref}" s="1" t="inlineStr"><is><t xml:space="preserve">${safeHeader}</t></is></c>`;
    })
    .join("");
  xmlParts.push(`<row r="1">${headerCells}</row>`);

  // Data Rows
  for (let rIdx = 0; rIdx < rows.length; rIdx += 1) {
    const rowNum = rIdx + 2;
    const rowObj = rows[rIdx] || {};
    const cellXml = [];

    for (let cIdx = 0; cIdx < columns.length; cIdx += 1) {
      const col = columns[cIdx];
      const ref = `${colIndexToLetter(cIdx)}${rowNum}`;
      const rawVal = rowObj[col.key];

      if (col.type === "number") {
        const num = Number(rawVal);
        const safeNum = Number.isFinite(num) ? num : 0;
        cellXml.push(`<c r="${ref}" t="n"><v>${safeNum}</v></c>`);
      } else {
        const safeStr = escapeXml(sanitizeSpreadsheetText(rawVal ?? ""));
        cellXml.push(
          `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${safeStr}</t></is></c>`
        );
      }
    }

    xmlParts.push(`<row r="${rowNum}">${cellXml.join("")}</row>`);
  }

  xmlParts.push(`</sheetData></worksheet>`);
  return xmlParts.join("");
}

// CRC-32 lookup table for ZIP archive creation
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Packs an array of `{ name, data: Buffer }` entries into a standard ZIP Buffer.
 */
function createZipBuffer(entries) {
  const localFileParts = [];
  const centralDirParts = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, "utf8");
    const uncompressed = Buffer.isBuffer(entry.data)
      ? entry.data
      : Buffer.from(String(entry.data), "utf8");
    const compressed = zlib.deflateRawSync(uncompressed);
    const crc = crc32(uncompressed);

    const localHeader = Buffer.alloc(30 + nameBuf.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // Local file header signature
    localHeader.writeUInt16LE(20, 4); // Version needed to extract (2.0)
    localHeader.writeUInt16LE(0x0800, 6); // UTF-8 filename flag
    localHeader.writeUInt16LE(8, 8); // Compression method: Deflate (8)
    localHeader.writeUInt16LE(0, 10); // File time
    localHeader.writeUInt16LE(0x5521, 12); // File date
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(uncompressed.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28); // Extra field length
    nameBuf.copy(localHeader, 30);

    localFileParts.push(localHeader, compressed);

    const centralHeader = Buffer.alloc(46 + nameBuf.length);
    centralHeader.writeUInt32LE(0x02014b50, 0); // Central directory signature
    centralHeader.writeUInt16LE(20, 4); // Version made by
    centralHeader.writeUInt16LE(20, 6); // Version needed
    centralHeader.writeUInt16LE(0x0800, 8); // UTF-8 flag
    centralHeader.writeUInt16LE(8, 10); // Deflate
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0x5521, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(uncompressed.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    nameBuf.copy(centralHeader, 46);

    centralDirParts.push(centralHeader);
    offset += localHeader.length + compressed.length;
  }

  const centralDirBuf = Buffer.concat(centralDirParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // End of central directory signature
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localFileParts, centralDirBuf, eocd]);
}

/**
 * Builds a multi-sheet OpenXML `.xlsx` workbook buffer.
 * @param {Array<{ name: string, columns: Array<{ key: string, header: string, type?: 'text'|'number', width?: number }>, rows: Array<Object> }>} sheets
 * @returns {Buffer}
 */
export function buildXlsxWorkbookBuffer(sheets) {
  const safeSheets = (sheets || []).map((s, idx) => ({
    ...s,
    sheetId: idx + 1,
    name: String(s.name || `Sheet${idx + 1}`)
      .replace(/[\\/?*[\]:]/g, " ")
      .slice(0, 31),
  }));

  const contentTypesXml = [
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`,
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`,
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`,
    `<Default Extension="xml" ContentType="application/xml"/>`,
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>`,
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>`,
    ...safeSheets.map(
      (s) =>
        `<Override PartName="/xl/worksheets/sheet${s.sheetId}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    ),
    `</Types>`,
  ].join("");

  const rootRelsXml = [
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`,
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`,
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>`,
    `</Relationships>`,
  ].join("");

  const workbookXml = [
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`,
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`,
    `<sheets>`,
    ...safeSheets.map(
      (s) =>
        `<sheet name="${escapeXml(s.name)}" sheetId="${s.sheetId}" r:id="rId${s.sheetId}"/>`
    ),
    `</sheets>`,
    `</workbook>`,
  ].join("");

  const workbookRelsXml = [
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`,
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`,
    ...safeSheets.map(
      (s) =>
        `<Relationship Id="rId${s.sheetId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${s.sheetId}.xml"/>`
    ),
    `<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`,
    `</Relationships>`,
  ].join("");

  const stylesXml = [
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`,
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`,
    `<fonts count="2">`,
    `<font><sz val="11"/><name val="Calibri"/></font>`,
    `<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>`,
    `</fonts>`,
    `<fills count="3">`,
    `<fill><patternFill patternType="none"/></fill>`,
    `<fill><patternFill patternType="gray125"/></fill>`,
    `<fill><patternFill patternType="solid"><fgColor rgb="FF8B1A1A"/></patternFill></fill>`,
    `</fills>`,
    `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>`,
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>`,
    `<cellXfs count="2">`,
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>`,
    `<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>`,
    `</cellXfs>`,
    `</styleSheet>`,
  ].join("");

  const entries = [
    { name: "[Content_Types].xml", data: contentTypesXml },
    { name: "_rels/.rels", data: rootRelsXml },
    { name: "xl/workbook.xml", data: workbookXml },
    { name: "xl/_rels/workbook.xml.rels", data: workbookRelsXml },
    { name: "xl/styles.xml", data: stylesXml },
  ];

  for (const s of safeSheets) {
    entries.push({
      name: `xl/worksheets/sheet${s.sheetId}.xml`,
      data: buildWorksheetXml(s.columns, s.rows),
    });
  }

  return createZipBuffer(entries);
}

/**
 * Builds a UTF-8 (with BOM for Excel Devanagari compatibility) CSV buffer
 * with formula-injection protection.
 */
export function buildCsvBuffer(columns, rows) {
  const escapeCsvCell = (val, type) => {
    if (type === "number") {
      const n = Number(val);
      return Number.isFinite(n) ? String(n) : "0";
    }
    const safe = sanitizeSpreadsheetText(val ?? "");
    if (/[",\r\n]/.test(safe)) {
      return `"${safe.replace(/"/g, '""')}"`;
    }
    return `"${safe}"`;
  };

  const lines = [];
  lines.push(columns.map((c) => escapeCsvCell(c.header, "text")).join(","));

  for (const r of rows) {
    lines.push(columns.map((c) => escapeCsvCell(r[c.key], c.type)).join(","));
  }

  // Prepend UTF-8 BOM (\uFEFF) so Microsoft Excel opens Hindi/Devanagari CSVs accurately
  return Buffer.from(`\uFEFF${lines.join("\r\n")}\r\n`, "utf8");
}
