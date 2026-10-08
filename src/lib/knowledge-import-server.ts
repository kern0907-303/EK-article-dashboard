import "server-only";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE, isGateEnabled, isValidToken } from "@/lib/auth";
import { getSupabaseEnv, supabaseHeaders } from "@/lib/publish-queue";
import {
  commitKnowledgeImportBatch,
  createKnowledgeImportBatchId,
  KnowledgeImportValidationError,
  toKnowledgeImportPreviewRow,
  undoKnowledgeImportBatch,
  classifyKnowledgeImportFiles,
} from "@/lib/knowledge-import-core.mjs";

export class KnowledgeImportDatabaseError extends Error {
  constructor(readonly status: number) {
    super("知識庫資料操作失敗，HTTP " + status + "。");
    this.name = "KnowledgeImportDatabaseError";
  }
}

export async function isKnowledgeImportAuthorized(request: NextRequest): Promise<boolean> {
  if (!isGateEnabled()) return false;
  return isValidToken(request.cookies.get(AUTH_COOKIE)?.value);
}

async function supabaseRequest<T>(table: string, query = "", init: RequestInit = {}): Promise<T> {
  const env = getSupabaseEnv();
  if (!env) throw new Error("尚未設定伺服器端資料庫連線。");
  const suffix = query ? "?" + query : "";
  const response = await fetch(env.url.replace(/\/$/u, "") + "/rest/v1/" + table + suffix, {
    ...init,
    headers: supabaseHeaders(env.key, (init.headers || {}) as Record<string, string>),
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) throw new KnowledgeImportDatabaseError(response.status);
  if (!text) return null as T;
  try { return JSON.parse(text) as T; } catch { throw new Error("資料庫回應格式無法解析。"); }
}

const NOTE_SELECT = "id,domain,title,author,domain_tags,subdomain,source_file,content,chars,content_md5,imported_at,title_zh,title_zh_subtitle,author_zh,translator_zh,publisher_zh,zh_source_url,zh_status,import_batch_id";
const NOTE_OVERVIEW_SELECT = "id,domain,title,author,domain_tags,subdomain,source_file,chars,content_md5,imported_at,title_zh,title_zh_subtitle,author_zh,translator_zh,publisher_zh,zh_source_url,zh_status,import_batch_id";

export async function getKnowledgeImportOverview() {
  const [notes, batches] = await Promise.all([
    supabaseRequest<any[]>("knowledge_notes", "select=" + NOTE_OVERVIEW_SELECT + "&order=domain.asc,title.asc&limit=10000"),
    supabaseRequest<any[]>("knowledge_import_batches", "select=batch_id,created_at,summary,inserted_ids,undone_at&order=created_at.desc&limit=10"),
  ]);
  return { notes: notes || [], batches: batches || [] };
}

export async function getKnowledgeImportNotes() {
  return supabaseRequest<any[]>("knowledge_notes", "select=" + NOTE_SELECT + "&order=domain.asc,title.asc&limit=10000");
}

export async function getKnowledgeImportNote(id: string) {
  const rows = await supabaseRequest<any[]>(
    "knowledge_notes",
    "select=id,domain,title,title_zh,title_zh_subtitle,author_zh,translator_zh,publisher_zh,zh_source_url,zh_status&id=eq." + encodeURIComponent(id) + "&limit=1",
  );
  return rows?.[0] || null;
}

export async function updateUnverifiedKnowledgeNote(id: string, patch: Record<string, unknown>) {
  const current = await getKnowledgeImportNote(id);
  if (!current) return { kind: "missing" as const, note: null };
  if (current.zh_status !== "unverified") return { kind: "not-unverified" as const, note: null };
  const next = { ...current, ...patch };
  if (!["confirmed", "unverified", "no_zh_edition"].includes(String(next.zh_status))) {
    throw new KnowledgeImportValidationError("zh_status 值無效。");
  }
  if (next.zh_status === "confirmed" && (!String(next.title_zh || "").trim() || !String(next.author_zh || "").trim())) {
    throw new KnowledgeImportValidationError("標記 confirmed 前，請補齊中文書名與作者。");
  }
  const rows = await supabaseRequest<any[]>(
    "knowledge_notes",
    "id=eq." + encodeURIComponent(id) + "&zh_status=eq.unverified&select=id,domain,title,author,title_zh,title_zh_subtitle,author_zh,translator_zh,publisher_zh,zh_source_url,zh_status,import_batch_id",
    { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(patch) },
  );
  return rows?.[0] ? { kind: "updated" as const, note: rows[0] } : { kind: "not-unverified" as const, note: null };
}

function asFileParts(form: FormData) {
  const files = form.getAll("files").filter((part): part is File => typeof part !== "string");
  return files;
}

function parseOverrides(value: FormDataEntryValue | null): Record<string, Record<string, string>> {
  if (typeof value !== "string" || !value) return {};
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, Record<string, string>>;
  } catch { return {}; }
}

async function getInputFiles(form: FormData) {
  const files = asFileParts(form);
  if (!files.length) throw new KnowledgeImportValidationError("請至少選擇一個 .md 檔。");
  if (files.length > 50) throw new KnowledgeImportValidationError("單次最多上傳 50 個檔案。");
  const overrides = parseOverrides(form.get("overrides"));
  const input = await Promise.all(files.map(async (file, index) => {
    const problems: string[] = [];
    if (!file.name.toLowerCase().endsWith(".md")) problems.push("只接受 .md 檔案。");
    if (file.size > 500 * 1024) problems.push("單檔不可超過 500 KB。");
    const content = file.size <= 500 * 1024 ? await file.text() : "";
    return {
      filename: file.name,
      content,
      problems,
      override: overrides[String(index)] || {},
    };
  }));
  return input;
}

export async function previewKnowledgeImport(form: FormData) {
  const input = await getInputFiles(form);
  const existing = await supabaseRequest<any[]>(
    "knowledge_notes",
    "select=id,domain,title,author,domain_tags,subdomain,source_file,chars,content_md5,title_zh,title_zh_subtitle,author_zh,translator_zh,publisher_zh,zh_source_url,zh_status,import_batch_id&limit=10000",
  );
  const rows = classifyKnowledgeImportFiles(input, existing || []);
  const classifications = { insert: 0, update: 0, skip: 0, problem: 0 };
  for (const row of rows) classifications[row.problems.length ? "problem" : row.classification as keyof typeof classifications] += 1;
  return {
    batch_id: createKnowledgeImportBatchId(),
    count: rows.length,
    classifications,
    rows: rows.map(toKnowledgeImportPreviewRow),
  };
}

function makeKnowledgeImportStore() {
  return {
    async listNotes() {
      return (await supabaseRequest<any[]>("knowledge_notes", "select=" + NOTE_SELECT + "&limit=10000")) || [];
    },
    async getBatch(batchId: string) {
      const rows = await supabaseRequest<any[]>(
        "knowledge_import_batches",
        "select=batch_id,created_at,summary,snapshot,inserted_ids,undone_at&batch_id=eq." + encodeURIComponent(batchId) + "&limit=1",
      );
      return rows?.[0] || null;
    },
    async insertBatch(row: Record<string, unknown>) {
      return supabaseRequest<any[]>("knowledge_import_batches", "", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(row),
      });
    },
    async updateBatch(batchId: string, patch: Record<string, unknown>) {
      const rows = await supabaseRequest<any[]>(
        "knowledge_import_batches",
        "batch_id=eq." + encodeURIComponent(batchId) + "&select=batch_id,created_at,summary,snapshot,inserted_ids,undone_at",
        { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(patch) },
      );
      return rows?.[0] || null;
    },
    async updateNote(id: string, patch: Record<string, unknown>) {
      const rows = await supabaseRequest<any[]>(
        "knowledge_notes",
        "id=eq." + encodeURIComponent(id) + "&select=id",
        { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(patch) },
      );
      if (!rows?.length) throw new Error("更新筆記時找不到目標資料。");
    },
    async insertNote(row: Record<string, unknown>) {
      const rows = await supabaseRequest<any[]>(
        "knowledge_notes?select=id",
        "",
        { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(row) },
      );
      return rows?.[0] || null;
    },
    async deleteInsertedNotes(ids: string[], batchId: string) {
      const safeIds = ids.filter((id) => /^[0-9a-f-]{36}$/iu.test(id));
      if (!safeIds.length) return;
      const inList = safeIds.map((id) => encodeURIComponent(id)).join(",");
      await supabaseRequest<any[]>(
        "knowledge_notes",
        "id=in.(" + inList + ")&import_batch_id=eq." + encodeURIComponent(batchId),
        { method: "DELETE", headers: { Prefer: "return=minimal" } },
      );
    },
    async restoreSnapshot(snapshot: Record<string, unknown>, batchId: string) {
      const id = typeof snapshot.id === "string" ? snapshot.id : "";
      if (!/^[0-9a-f-]{36}$/iu.test(id)) return;
      const patch = { ...snapshot };
      delete patch.id;
      await supabaseRequest<any[]>(
        "knowledge_notes",
        "id=eq." + encodeURIComponent(id) + "&import_batch_id=eq." + encodeURIComponent(batchId),
        { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(patch) },
      );
    },
  };
}

export async function commitKnowledgeImport(form: FormData) {
  const batchId = String(form.get("batch_id") || "");
  if (!/^imp-\d{8}-\d{6}$/u.test(batchId)) throw new KnowledgeImportValidationError("批次編號無效，請重新預覽。");
  const input = await getInputFiles(form);
  const selectedRaw = String(form.get("selected_row_keys") || "[]");
  let selectedRowKeys: string[];
  try {
    const value = JSON.parse(selectedRaw);
    if (!Array.isArray(value) || value.some((item) => !/^\d+$/u.test(String(item)))) throw new Error();
    selectedRowKeys = value.map(String);
  } catch { throw new KnowledgeImportValidationError("匯入選取資料格式錯誤，請重新預覽。"); }
  if (!selectedRowKeys.length) throw new KnowledgeImportValidationError("請至少選擇一筆資料。");
  return commitKnowledgeImportBatch(makeKnowledgeImportStore(), {
    batchId,
    files: input,
    selectedRowKeys,
    warningsAcknowledged: form.get("warnings_acknowledged") === "true",
  });
}

export async function undoKnowledgeImport(batchId: string) {
  return undoKnowledgeImportBatch(makeKnowledgeImportStore(), batchId);
}

export function safeKnowledgeImportError(error: unknown) {
  if (error instanceof KnowledgeImportValidationError) return { status: 400, message: error.message, rows: error.rows };
  if (error instanceof KnowledgeImportDatabaseError) {
    return { status: 503, message: "資料庫操作失敗（HTTP " + error.status + "），請確認 SQL 已套用後重試。" };
  }
  return { status: 500, message: "知識庫匯入操作失敗，請稍後重試。" };
}

export const KNOWLEDGE_IMPORT_PATCH_FIELDS = [
  "title_zh", "title_zh_subtitle", "author_zh", "translator_zh", "publisher_zh", "zh_source_url", "zh_status",
] as const;
