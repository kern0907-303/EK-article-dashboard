import { getSupabaseEnv, supabaseHeaders } from "@/lib/publish-queue";
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
  const response = await fetch(`${env.url}/rest/v1/${table}${query ? `?${query}` : ""}`, {
    ...init,
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

export function makeJobRow(batchId: string, entry: PipelineEntry, projectId: string | null) {
  return {
    batch_id: batchId,
    brand_id: entry.brandId,
    project_id: projectId,
    prompt: entry.prompt,
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
