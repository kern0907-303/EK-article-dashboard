import { createHash } from "node:crypto";

export function contentMd5(content) {
  return createHash("md5").update(content, "utf8").digest("hex");
}

export function normalizeKnowledgeTags(value) {
  return Array.isArray(value)
    ? value.map(String)
    : String(value || "").split(/[、,，;；]/).map((tag) => tag.trim()).filter(Boolean);
}

export function normalizeKnowledgeRecord(row, importedAt = new Date().toISOString()) {
  return {
    domain: String(row.domain),
    title: String(row.title),
    author: String(row.author || ""),
    domain_tags: normalizeKnowledgeTags(row.domain_tags),
    subdomain: String(row.subdomain || ""),
    source_file: String(row.source_file),
    content: row.content,
    chars: Number.isFinite(row.chars) ? row.chars : [...row.content].length,
    content_md5: contentMd5(row.content),
    imported_at: importedAt,
  };
}

export function buildKnowledgeImportPlan(incoming, existingRows) {
  const existing = new Map(existingRows.map((row) => [row.source_file, row.content_md5]));
  const plan = { inserts: [], updates: [], skipped: 0 };
  for (const row of incoming) {
    const prior = existing.get(row.source_file);
    if (prior === undefined) plan.inserts.push(row);
    else if (prior === row.content_md5) plan.skipped += 1;
    else plan.updates.push(row);
  }
  return plan;
}
