import { getSupabaseEnv, supabaseHeaders } from "@/lib/publish-queue";
import { withRecipeTags } from "@/data/skills/recipe-genres";
import { readFlowStructureFromPrompt } from "@/data/skills/flow-structures";
import { readGenreFromPrompt } from "@/data/skills/genres";
import type { BatchSource, PipelineEntry } from "@/lib/auto-pipeline";

export interface PipelineJobRow {
  id: string;
  batch_id: string;
  brand_id: "nas" | "abl" | "i8" | "erick";
  project_id: string | null;
  prompt: string;
  scheduled_at: string | null;
  status: string;
  current_step: string;
  retry_count: number;
  error_reason: string | null;
  draft_content: string | null;
  queue_id: string | null;
  reviewed: boolean;
  created_at: string;
  updated_at: string;
}

export function pipelineSupabaseUrl(table: string, query = ""): string | null {
  const env = getSupabaseEnv();
  return env ? `${env.url}/rest/v1/${table}${query ? `?${query}` : ""}` : null;
}

export async function pipelineDb<T = any>(table: string, query = "", init: RequestInit = {}): Promise<T> {
  const env = getSupabaseEnv();
  if (!env) throw new Error("未設定 Supabase 連線資訊");
  // 最後一道防線：NUL 進不了 Postgres 的 text 欄位，送出去會整個 PATCH 被擋下（22P05），
  // 結果草稿一個字都存不進去。文字清理那層已經擋過一次，這裡再擋一次，
  // 因為 warnings、social_results 這些欄位不一定經過文字清理。
  const body = typeof init.body === "string" ? init.body.replace(/\\u0000/g, "").replace(/\u0000/g, "") : init.body;
  const response = await fetch(`${env.url}/rest/v1/${table}${query ? `?${query}` : ""}`, {
    ...init,
    ...(body === undefined ? {} : { body }),
    headers: supabaseHeaders(env.key, { Prefer: "return=representation", ...(init.headers as Record<string, string> || {}) }),
    cache: "no-store",
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase ${table} ${init.method || "GET"} 失敗（${response.status}）：${text.slice(0, 280)}`);
  }
  if (response.status === 204) return [] as T;
  return response.json() as Promise<T>;
}

export function makeBatchRow(source: BatchSource) {
  return { source, status: "pending", test_run: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
}

/**
 * 任務提示詞開頭補上配方標籤（2026-11-28 自然流量測試）：
 * 【本篇結構型】題目有指定流量結構就填代號，沒有就填「未指定」；
 * 【本篇組別】三個新文體（數字對照、身體入口、貫徹）是「新配方」，其他是「對照組」。
 * 已經寫了的不重複加。之後每一則發出去的貼文都能用這兩行分組比較成效。
 */
export function tagJobPrompt(prompt: string): string {
  return withRecipeTags(prompt, { structure: readFlowStructureFromPrompt(prompt), genre: readGenreFromPrompt(prompt) });
}

export function makeJobRow(batchId: string, entry: PipelineEntry, projectId: string | null) {
  return {
    batch_id: batchId,
    brand_id: entry.brandId,
    project_id: projectId,
    prompt: tagJobPrompt(entry.prompt),
    scheduled_at: entry.scheduledAt,
    status: "pending",
    current_step: "等待執行",
    retry_count: 0,
    error_reason: null,
    draft_content: null,
    queue_id: null,
    reviewed: false,
    draft_only: false,
    test_run: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function encodeEq(value: string): string { return encodeURIComponent(value); }
