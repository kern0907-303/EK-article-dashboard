export const KNOWLEDGE_TITLE_HEADERS = [
  "source_file",
  "domain",
  "title_en",
  "author_en",
  "title_zh",
  "title_zh_subtitle",
  "author_zh",
  "translator_zh",
  "publisher_zh",
  "zh_source_url",
  "zh_status",
  "note",
];

export const KNOWLEDGE_TITLE_STATUSES = ["confirmed", "unverified", "no_zh_edition"];

const UPDATE_COLUMNS = [
  "title_zh",
  "title_zh_subtitle",
  "author_zh",
  "translator_zh",
  "publisher_zh",
  "zh_source_url",
  "zh_status",
];

/** Parse UTF-8 CSV, including BOM, quoted commas, escaped quotes, and embedded newlines. */
export function parseKnowledgeTitlesCsv(input) {
  if (typeof input !== "string") throw new TypeError("CSV 內容必須是文字。");
  const text = input.replace(/^\uFEFF/u, "");
  const records = [];
  let row = [];
  let field = "";
  let quoted = false;
  let closedQuote = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
        closedQuote = true;
      } else {
        field += character;
      }
      continue;
    }

    if (closedQuote) {
      if (character === ",") {
        row.push(field);
        field = "";
        closedQuote = false;
      } else if (character === "\r" || character === "\n") {
        row.push(field);
        records.push(row);
        row = [];
        field = "";
        closedQuote = false;
        if (character === "\r" && text[index + 1] === "\n") index += 1;
      } else if (!/\s/u.test(character)) {
        throw new Error(`CSV 第 ${records.length + 1} 列的引號後出現非分隔字元。`);
      }
      continue;
    }

    if (character === '"') {
      if (field.length) throw new Error(`CSV 第 ${records.length + 1} 列的欄位引號位置不正確。`);
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\r" || character === "\n") {
      row.push(field);
      if (row.some((value) => value.length > 0)) records.push(row);
      row = [];
      field = "";
      if (character === "\r" && text[index + 1] === "\n") index += 1;
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error("CSV 結尾有未關閉的引號。");
  if (closedQuote || field.length || row.length) {
    row.push(field);
    if (row.some((value) => value.length > 0)) records.push(row);
  }
  if (!records.length) throw new Error("CSV 沒有標題列。");

  const headers = records[0].map((header) => header.trim());
  if (headers.length !== KNOWLEDGE_TITLE_HEADERS.length || headers.some((header, index) => header !== KNOWLEDGE_TITLE_HEADERS[index])) {
    throw new Error(`CSV 欄位必須依序為：${KNOWLEDGE_TITLE_HEADERS.join(", " )}`);
  }

  const rows = records.slice(1).map((values, index) => {
    if (values.length !== headers.length) throw new Error(`CSV 第 ${index + 2} 列欄位數不符。`);
    return Object.fromEntries(headers.map((header, column) => [header, values[column]]));
  });
  const seen = new Set();
  for (const [index, record] of rows.entries()) {
    record.source_file = record.source_file.trim();
    record.zh_status = record.zh_status.trim();
    if (!record.source_file) throw new Error(`CSV 第 ${index + 2} 列缺少 source_file。`);
    if (seen.has(record.source_file)) throw new Error(`CSV 含重複 source_file：${record.source_file}`);
    seen.add(record.source_file);
    if (!KNOWLEDGE_TITLE_STATUSES.includes(record.zh_status)) {
      throw new Error(`CSV 第 ${index + 2} 列的 zh_status 不合法。`);
    }
  }
  return rows;
}

function nullable(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

/** Construct a minimal PATCH body; article content and import metadata remain untouched. */
export function toKnowledgeTitlePatch(record) {
  return {
    title_zh: nullable(record.title_zh),
    title_zh_subtitle: nullable(record.title_zh_subtitle),
    author_zh: nullable(record.author_zh),
    translator_zh: nullable(record.translator_zh),
    publisher_zh: nullable(record.publisher_zh),
    zh_source_url: nullable(record.zh_source_url),
    zh_status: record.zh_status,
  };
}

/** Match by source_file only. Equal book titles remain separate source records. */
export function buildKnowledgeTitleImportPlan(csvRows, existingRows) {
  const existing = new Map(existingRows.map((row) => [row.source_file, row.domain]));
  const statusCounts = Object.fromEntries(KNOWLEDGE_TITLE_STATUSES.map((status) => [status, 0]));
  const matched = [];
  const missingSourceFiles = [];
  const domainMismatches = [];

  for (const row of csvRows) {
    statusCounts[row.zh_status] += 1;
    if (!existing.has(row.source_file)) {
      missingSourceFiles.push(row.source_file);
      continue;
    }
    const existingDomain = existing.get(row.source_file);
    if (existingDomain && row.domain && existingDomain !== row.domain) {
      domainMismatches.push({ source_file: row.source_file, csv_domain: row.domain, database_domain: existingDomain });
      continue;
    }
    matched.push(row);
  }

  return { matched, missingSourceFiles, domainMismatches, statusCounts };
}

export function getKnowledgeTitleUpdateColumns() {
  return [...UPDATE_COLUMNS];
}
