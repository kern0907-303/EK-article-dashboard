import { readFile } from "node:fs/promises";
import { buildKnowledgeImportPlan, normalizeKnowledgeRecord } from "../src/lib/knowledge-note-core.mjs";
import { parseKnowledgeImportResponse } from "../src/lib/knowledge-import-response.mjs";

const inputPath = process.argv[2];
if (!inputPath) throw new Error("用法：node --env-file=.env.local scripts/import-knowledge-notes.mjs <JSONL 路徑>");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) throw new Error("缺少伺服器端 Supabase 設定；請確認環境變數名稱，不要輸出金鑰值。");

const source = await readFile(inputPath, "utf8");
const records = source.split(/\r?\n/).filter((line) => line.trim()).map((line, index) => {
  let row;
  try { row = JSON.parse(line); } catch { throw new Error(`JSONL 第 ${index + 1} 行格式錯誤。`); }
  if (!row.source_file || !row.domain || !row.title || typeof row.content !== "string") {
    throw new Error(`JSONL 第 ${index + 1} 行缺少必要欄位。`);
  }
  return normalizeKnowledgeRecord(row);
});
if (new Set(records.map((row) => row.source_file)).size !== records.length) throw new Error("JSONL 含重複 source_file，已停止匯入。");

const baseUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/knowledge_notes`;
const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };
async function request(url, init = {}) {
  const response = await fetch(url, { ...init, headers: { ...headers, ...(init.headers || {}) }, cache: "no-store" });
  return parseKnowledgeImportResponse(response);
}

const existingRows = await request(`${baseUrl}?select=source_file,content_md5,domain&limit=1000`);
const { inserts, updates, skipped } = buildKnowledgeImportPlan(records, existingRows);

for (const batch of [...inserts, ...updates].reduce((chunks, row, index) => {
  const groupBoundary = index === inserts.length;
  if (groupBoundary || !chunks.length || chunks[chunks.length - 1].length >= 50) chunks.push([]);
  chunks[chunks.length - 1].push(row);
  return chunks;
}, [])) {
  await request(`${baseUrl}?on_conflict=source_file`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(batch),
  });
}

const domainCounts = records.reduce((counts, row) => {
  counts[row.domain] = (counts[row.domain] || 0) + 1;
  return counts;
}, {});
console.log(JSON.stringify({ inserted: inserts.length, updated: updates.length, skipped, total: records.length, domainCounts }, null, 2));
