import { contentMd5 } from "./knowledge-note-core.mjs";

export const KNOWLEDGE_IMPORT_FIELDS = [
  "domain", "title_en", "author_en", "title_zh", "title_zh_subtitle", "author_zh",
  "translator_zh", "publisher_zh", "zh_source_url", "zh_status", "domain_tags", "subdomain", "source_file",
];

const LEGACY_FIELDS = ["domain", "title_en", "author_en", "domain_tags", "subdomain", "source_file"];
const LEGACY_ALIASES = ["domain", "title", "author", "domain_tags", "subdomain", "source_file"];
export const KNOWLEDGE_IMPORT_DOMAINS = [
  "business-strategy", "emotions-psychology", "life-philosophy", "shenxinling-planning", "natural-science",
];
export const KNOWLEDGE_ZH_STATUSES = ["confirmed", "unverified", "no_zh_edition"];
const IMPORT_COMPARE_FIELDS = [
  "domain", "title", "author", "domain_tags", "subdomain", "source_file", "chars", "content_md5",
  "title_zh", "title_zh_subtitle", "author_zh", "translator_zh", "publisher_zh", "zh_source_url", "zh_status",
];

function unquote(value) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "null") return "";
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try { return JSON.parse(trimmed); } catch { return trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\"); }
  }
  if (trimmed.length >= 2 && trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }
  return trimmed;
}

function splitCommaList(value) {
  const output = [];
  let part = "";
  let quote = "";
  for (const char of value) {
    if ((char === '"' || char === "'") && (!quote || quote === char)) quote = quote ? "" : char;
    if (char === "," && !quote) {
      const cleaned = unquote(part);
      if (cleaned) output.push(cleaned);
      part = "";
    } else part += char;
  }
  const cleaned = unquote(part);
  if (cleaned) output.push(cleaned);
  return output;
}

function parseFrontMatter(text) {
  const source = text.replace(/^\uFEFF/u, "");
  if (!source.startsWith("---\n") && !source.startsWith("---\r\n")) {
    return { error: "檔案開頭缺少 --- 資料區。" };
  }
  const lines = source.split(/\r?\n/u);
  let closingLine = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index] === "---") { closingLine = index; break; }
  }
  if (closingLine < 0) return { error: "資料區缺少結尾 ---。" };
  const values = {};
  const keys = [];
  for (const line of lines.slice(1, closingLine)) {
    const match = line.match(/^([a-z_]+)\s*:\s*(.*)$/u);
    if (!match) return { error: "資料區欄位格式錯誤。" };
    const [, key, raw] = match;
    if (Object.hasOwn(values, key)) return { error: "資料區欄位重複：" + key };
    values[key] = unquote(raw);
    keys.push(key);
  }

  let legacy = false;
  const currentFieldsMatch = KNOWLEDGE_IMPORT_FIELDS.every((key, index) => keys[index] === key);
  const hasV2StoryRatio = currentFieldsMatch
    && keys.length === KNOWLEDGE_IMPORT_FIELDS.length + 1
    && keys.at(-1) === "story_unassigned_ratio";
  if ((keys.length === KNOWLEDGE_IMPORT_FIELDS.length && currentFieldsMatch) || hasV2StoryRatio) {
    // Current 13-column format.
    if (hasV2StoryRatio) {
      const ratio = Number(values.story_unassigned_ratio);
      if (!Number.isFinite(ratio) || ratio < 0 || ratio > 1) {
        return { error: "story_unassigned_ratio 必須介於 0 與 1。" };
      }
    }
  } else if (
    (keys.length === LEGACY_FIELDS.length && keys.every((key, index) => key === LEGACY_FIELDS[index])) ||
    (keys.length === LEGACY_ALIASES.length && keys.every((key, index) => key === LEGACY_ALIASES[index]))
  ) {
    legacy = true;
  } else {
    return { error: "資料區欄位必須依序符合 13 個新版欄位，或 6 個舊版欄位。" };
  }

  const lineEnding = source.includes("\r\n") ? "\r\n" : "\n";
  const closingOffset = lines.slice(0, closingLine + 1).join(lineEnding).length;
  const bodyStart = closingOffset + lineEnding.length;
  const body = source.slice(bodyStart);
  const domainTags = splitCommaList(values.domain_tags || "");
  const confirmedChineseOriginal = values.zh_status === "confirmed"
    && !values.title_en?.trim()
    && !values.author_en?.trim()
    && Boolean(values.title_zh?.trim())
    && Boolean(values.author_zh?.trim());
  const record = {
    domain: values.domain || "",
    title: values.title_en?.trim() ? values.title_en :
      (confirmedChineseOriginal ? values.title_zh : values.title_en ?? values.title ?? ""),
    author: values.author_en?.trim() ? values.author_en :
      (confirmedChineseOriginal ? values.author_zh : values.author_en ?? values.author ?? ""),
    title_zh: legacy ? "" : values.title_zh || "",
    title_zh_subtitle: legacy ? "" : values.title_zh_subtitle || "",
    author_zh: legacy ? "" : values.author_zh || "",
    translator_zh: legacy ? "" : values.translator_zh || "",
    publisher_zh: legacy ? "" : values.publisher_zh || "",
    zh_source_url: legacy ? "" : values.zh_source_url || "",
    zh_status: legacy ? "unverified" : values.zh_status || "",
    domain_tags: domainTags,
    subdomain: values.subdomain || "",
    source_file: values.source_file || "",
    content: body,
    chars: [...body].length,
    content_md5: contentMd5(body),
  };
  return { record, legacy };
}

function normalizeBookPart(value) {
  return String(value || "").normalize("NFKC").toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
}

export function knowledgeBookKey(domain, title) {
  return normalizeBookPart(domain) + "\u0000" + normalizeBookPart(title);
}

export function applyKnowledgeImportOverrides(record, override = {}) {
  if (!record) return record;
  const next = { ...record };
  for (const field of ["title_zh", "author_zh", "zh_status"]) {
    if (typeof override[field] === "string") next[field] = override[field].trim();
  }
  return next;
}

export function validateKnowledgeImportRecord(record) {
  const problems = [];
  if (!record || typeof record !== "object") return ["資料區無法解析。"];
  if (!KNOWLEDGE_IMPORT_DOMAINS.includes(record.domain)) problems.push("domain 不在允許的領域清單內。");
  const confirmedChineseOriginal = record.zh_status === "confirmed"
    && Boolean(record.title_zh?.trim()) && Boolean(record.author_zh?.trim());
  if (!record.title?.trim() && !confirmedChineseOriginal) {
    problems.push("title_en 不可空白；confirmed 中文原著可用 title_zh 與 author_zh。");
  }
  if (!record.source_file?.trim()) problems.push("source_file 不可空白。");
  if (!record.content?.trim()) problems.push("正文不可空白。");
  if (!KNOWLEDGE_ZH_STATUSES.includes(record.zh_status)) problems.push("zh_status 必須是 confirmed、unverified 或 no_zh_edition。");
  if (record.zh_status === "confirmed" && (!record.title_zh?.trim() || !record.author_zh?.trim())) {
    problems.push("zh_status 為 confirmed 時，title_zh 與 author_zh 都不可空白。");
  }
  return problems;
}

export function knowledgeImportWarnings(record) {
  const warnings = [];
  if (/[A-Za-z]/u.test(record.title_zh || "")) warnings.push("中文書名含英文字母，請確認（EQ 等縮寫可保留）。");
  if (/[:：]/u.test(record.title_zh || "")) warnings.push("中文書名含冒號，請確認是否只保留主書名。");
  if (record.zh_status === "confirmed" && !record.zh_source_url?.trim()) warnings.push("中文資料已確認但缺少 zh_source_url。");
  if (record.zh_status === "unverified" || record.zh_status === "no_zh_edition") warnings.push("此狀態不會被自動挑選引用。");
  return warnings;
}

function sameImportFields(a, b) {
  return IMPORT_COMPARE_FIELDS.every((field) => {
    if (field === "domain_tags") return JSON.stringify([...(a.domain_tags || [])]) === JSON.stringify([...(b.domain_tags || [])]);
    return (a[field] ?? "") === (b[field] ?? "");
  });
}

export function classifyKnowledgeImportFiles(files, existingRows) {
  const rows = files.map((file, index) => {
    const parsed = file.record ? { record: file.record, legacy: Boolean(file.legacy) } : parseFrontMatter(file.content || "");
    const overrideKeys = file.override && typeof file.override === "object" ? Object.keys(file.override) : [];
    const disallowedOverride = Boolean(parsed.record && parsed.record.zh_status !== "unverified" && overrideKeys.some((key) => ["title_zh", "author_zh", "zh_status"].includes(key)));
    const record = parsed.record ? applyKnowledgeImportOverrides(parsed.record, file.override) : null;
    const problems = [
      ...(file.problems || []),
      ...(parsed.error ? [parsed.error] : []),
      ...(disallowedOverride ? ["只有 unverified 筆記可在預覽中修改中文書目欄位。"] : []),
      ...validateKnowledgeImportRecord(record),
    ];
    return {
      row_key: String(index), file_name: file.filename || file.file_name || "檔案 " + (index + 1),
      record, legacy: Boolean(parsed.legacy || file.legacy), problems, warnings: record ? knowledgeImportWarnings(record) : [],
      classification: "problem", matched_id: null,
    };
  });

  const candidatesByKey = new Map();
  const sourceByName = new Map();
  for (const row of rows) {
    if (!row.record) continue;
    const title = normalizeBookPart(row.record.title);
    const domain = normalizeBookPart(row.record.domain);
    if (domain && title) {
      const key = knowledgeBookKey(row.record.domain, row.record.title);
      if (!candidatesByKey.has(key)) candidatesByKey.set(key, []);
      candidatesByKey.get(key).push(row);
    }
    if (row.record.source_file) {
      if (!sourceByName.has(row.record.source_file)) sourceByName.set(row.record.source_file, []);
      sourceByName.get(row.record.source_file).push(row);
    }
  }
  for (const group of [...candidatesByKey.values(), ...sourceByName.values()]) {
    if (group.length < 2) continue;
    for (const row of group) {
      const peers = group.filter((candidate) => candidate !== row).map((candidate) => candidate.file_name);
      const message = "同一次上傳有重複書目，另一個檔案：" + peers.join("、") + "。";
      if (!row.problems.includes(message)) row.problems.push(message);
    }
  }

  const existingByKey = new Map();
  const existingBySource = new Map();
  for (const existing of existingRows || []) {
    const key = knowledgeBookKey(existing.domain, existing.title);
    if (!existingByKey.has(key)) existingByKey.set(key, []);
    existingByKey.get(key).push(existing);
    if (existing.source_file) {
      if (!existingBySource.has(existing.source_file)) existingBySource.set(existing.source_file, []);
      existingBySource.get(existing.source_file).push(existing);
    }
  }
  for (const row of rows) {
    if (!row.record || row.problems.length) continue;
    const record = row.record;
    const titleMatches = existingByKey.get(knowledgeBookKey(record.domain, record.title)) || [];
    if (titleMatches.length > 1) {
      row.problems.push("資料庫有多筆相同書目，需先人工處理才能避免誤更新。");
      continue;
    }
    const sourceMatches = existingBySource.get(record.source_file) || [];
    if (sourceMatches.some((existing) => existing.domain !== record.domain)) {
      row.problems.push("source_file 已被資料庫中的其他領域書目使用。");
      continue;
    }
    const sameDomainSourceMatches = sourceMatches.filter((existing) => existing.domain === record.domain);
    if (sameDomainSourceMatches.length > 1) {
      row.problems.push("資料庫有多筆相同領域與來源檔名，需先人工處理才能避免誤更新。");
      continue;
    }
    let matches = titleMatches;
    if (sameDomainSourceMatches.length === 1) {
      const sourceMatch = sameDomainSourceMatches[0];
      if (titleMatches.length === 1 && titleMatches[0].id !== sourceMatch.id) {
        row.problems.push("資料庫有多筆可能相同書目，需先人工處理才能避免誤更新。");
        continue;
      }
      matches = sameDomainSourceMatches;
      if (String(sourceMatch.title || "").trim()) row.preserve_title = true;
      else row.title_to_fill = record.title_zh?.trim() || record.title;
    }
    if (matches.length === 0) {
      row.classification = "insert";
      continue;
    }
    row.matched_id = matches[0].id;
    row.classification = sameImportFields(record, matches[0]) ? "skip" : "update";
  }
  return rows;
}

export function toKnowledgeImportPreviewRow(row) {
  const record = row.record;
  return {
    row_key: row.row_key,
    file_name: row.file_name,
    title_en: record?.title || "",
    author_en: record?.author || "",
    title_zh: record?.title_zh || "",
    title_zh_subtitle: record?.title_zh_subtitle || "",
    author_zh: record?.author_zh || "",
    zh_status: record?.zh_status || "unverified",
    domain: record?.domain || "",
    classification: row.problems.length ? "problem" : row.classification,
    problems: row.problems,
    warnings: row.warnings,
    body_preview: record?.content ? [...record.content.trim()].slice(0, 160).join("") : "",
  };
}

export function createKnowledgeImportBatchId(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date).map(({ type, value }) => [type, value]));
  return "imp-" + parts.year + parts.month + parts.day + "-" + parts.hour + parts.minute + parts.second;
}

export class KnowledgeImportValidationError extends Error {
  constructor(message, rows = []) { super(message); this.name = "KnowledgeImportValidationError"; this.rows = rows; }
}

export function knowledgeImportDeleteConfirmationTitle(note) {
  return String(note?.title_zh || "").trim() || String(note?.title || "").trim();
}

export async function deleteKnowledgeNoteWithBackup(store, { noteId, confirmationTitle, backupId, now = new Date().toISOString() }) {
  const note = await store.getNote(noteId);
  if (!note) return { kind: "missing" };
  const requiredTitle = knowledgeImportDeleteConfirmationTitle(note);
  if (!requiredTitle) return { kind: "unconfirmable" };
  if (typeof confirmationTitle !== "string" || confirmationTitle.trim() !== requiredTitle) {
    return { kind: "confirmation-mismatch" };
  }

  const backup = {
    batch_id: backupId,
    created_at: now,
    summary: { operation: "single_note_delete", status: "deleted", original_id: note.id, deleted_at: now },
    snapshot: [structuredClone(note)],
    inserted_ids: [],
    undone_at: null,
  };
  const savedBackup = await store.insertDeletionBackup(backup);
  if (!savedBackup || savedBackup.batch_id !== backupId) {
    throw new Error("刪除備份未能確認寫入，原資料未刪除。");
  }

  const deleted = await store.deleteNote(noteId, note);
  if (!deleted || deleted.id !== note.id) return { kind: "changed", backupId };
  return { kind: "deleted", note, backupId, deletedAt: now };
}

// 人工還原單筆刪除備份時，使用 backupId 替換下方的值：
// INSERT INTO public.knowledge_notes
// SELECT (jsonb_populate_record(NULL::public.knowledge_notes, item.row_data)).*
// FROM public.knowledge_import_batches AS backup
// CROSS JOIN LATERAL jsonb_array_elements(backup.snapshot) AS item(row_data)
// WHERE backup.batch_id = '<backup_id>'
//   AND backup.summary->>'operation' = 'single_note_delete'
//   AND NOT EXISTS (SELECT 1 FROM public.knowledge_notes AS note WHERE note.id = item.row_data->>'id');

function importRequestFingerprint(files, selectedRowKeys) {
  const chosen = new Set(selectedRowKeys.map(String));
  const inputs = files.map((file, index) => chosen.has(String(index)) ? {
    filename: file.filename || file.file_name || "",
    content: file.content || "",
    override: file.override || {},
  } : null).filter(Boolean);
  return contentMd5(JSON.stringify({ selected: [...chosen].sort(), inputs }));
}

export async function commitKnowledgeImportBatch(store, { batchId, files, selectedRowKeys, warningsAcknowledged, now = new Date().toISOString() }) {
  const requestFingerprint = importRequestFingerprint(files, selectedRowKeys);
  const priorBatch = await store.getBatch(batchId);
  if (priorBatch) {
    if (priorBatch.summary?.request_fingerprint !== requestFingerprint) {
      throw new KnowledgeImportValidationError("批次編號已被其他匯入使用，請重新產生預覽。");
    }
    return { batch: priorBatch, idempotent: true };
  }
  const existingRows = await store.listNotes();
  const classified = classifyKnowledgeImportFiles(files, existingRows);
  const selected = new Set(selectedRowKeys.map(String));
  const selectedRows = classified.filter((row) => selected.has(row.row_key));
  if (!selectedRows.length) throw new KnowledgeImportValidationError("請至少選擇一筆資料。", classified);
  const invalid = selectedRows.filter((row) => row.problems.length);
  if (invalid.length) throw new KnowledgeImportValidationError("所選資料有問題，請修正後重新預覽。", classified);
  const hasWarnings = selectedRows.some((row) => row.warnings.length);
  if (hasWarnings && !warningsAcknowledged) throw new KnowledgeImportValidationError("請先勾選已閱讀警告。", classified);

  const inserts = selectedRows.filter((row) => row.classification === "insert");
  const updates = selectedRows.filter((row) => row.classification === "update");
  const skipped = selectedRows.filter((row) => row.classification === "skip");
  const snapshots = updates.map((row) => existingRows.find((note) => note.id === row.matched_id)).filter(Boolean);
  const batch = {
    batch_id: batchId,
    created_at: now,
    summary: { status: "processing", inserted: 0, updated: 0, skipped: skipped.length, failed: 0, request_fingerprint: requestFingerprint },
    snapshot: snapshots,
    inserted_ids: [],
    undone_at: null,
  };
  await store.insertBatch(batch);
  const insertedIds = [];
  try {
    for (const row of updates) {
      const record = { ...row.record };
      if (row.title_to_fill) record.title = row.title_to_fill;
      else if (row.preserve_title) delete record.title;
      await store.updateNote(row.matched_id, { ...record, import_batch_id: batchId });
    }
    for (const row of inserts) {
      const inserted = await store.insertNote({ ...row.record, imported_at: now, import_batch_id: batchId });
      if (!inserted?.id) throw new Error("新增筆記後未取得 id。");
      insertedIds.push(inserted.id);
    }
    const summary = { status: "completed", inserted: insertedIds.length, updated: updates.length, skipped: skipped.length, failed: 0, request_fingerprint: requestFingerprint };
    const completed = await store.updateBatch(batchId, { summary, snapshot: snapshots, inserted_ids: insertedIds });
    return { batch: completed || { ...batch, summary, inserted_ids: insertedIds }, idempotent: false };
  } catch (error) {
    const snapshotIds = new Set(snapshots.map((snapshot) => snapshot.id));
    const possiblePartialRows = await store.listNotes().catch(() => []);
    const partialInsertedIds = possiblePartialRows
      .filter((note) => note.import_batch_id === batchId && !snapshotIds.has(note.id))
      .map((note) => note.id);
    await store.deleteInsertedNotes([...new Set([...insertedIds, ...partialInsertedIds])], batchId).catch(() => undefined);
    for (const snapshot of [...snapshots].reverse()) await store.restoreSnapshot(snapshot, batchId).catch(() => undefined);
    await store.updateBatch(batchId, {
      summary: { status: "failed", inserted: 0, updated: 0, skipped: skipped.length, failed: 1, request_fingerprint: requestFingerprint },
      inserted_ids: [],
    }).catch(() => undefined);
    throw error;
  }
}

export async function undoKnowledgeImportBatch(store, batchId, now = new Date().toISOString()) {
  const batch = await store.getBatch(batchId);
  if (!batch) throw new KnowledgeImportValidationError("找不到這個匯入批次。");
  if (batch.summary?.operation === "single_note_delete") {
    throw new KnowledgeImportValidationError("這是單筆刪除備份，請使用備份資料的 SQL 還原，不可用匯入批次撤銷。");
  }
  if (batch.undone_at) return { batch, idempotent: true };
  await store.deleteInsertedNotes(Array.isArray(batch.inserted_ids) ? batch.inserted_ids : [], batchId);
  for (const snapshot of Array.isArray(batch.snapshot) ? batch.snapshot : []) {
    await store.restoreSnapshot(snapshot, batchId);
  }
  const updated = await store.updateBatch(batchId, {
    undone_at: now,
    summary: { ...(batch.summary || {}), status: "undone", undone: true },
  });
  return { batch: updated || { ...batch, undone_at: now }, idempotent: false };
}
