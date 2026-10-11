import "server-only";
import { getSupabaseEnv, supabaseHeaders } from "@/lib/publish-queue";
import { isWorkerOnline } from "@/lib/image-jobs.mjs";

export type ImageJob = {
  id: string; purpose: string; brand_id: string; size_key: string; prompt: string; negative: string; seed: number;
  status: "pending" | "running" | "done" | "failed" | "cancelled";
  result_url: string | null; error: string | null; attempts: number; created_at: string; claimed_at: string | null; finished_at: string | null;
};

async function db<T>(table: string, query = "", init: RequestInit = {}): Promise<T> {
  const env = getSupabaseEnv();
  if (!env) throw new Error("伺服器未設定 Supabase 連線資訊。");
  const response = await fetch(`${env.url}/rest/v1/${table}${query ? `?${query}` : ""}`, {
    ...init,
    headers: supabaseHeaders(env.key, init.headers as Record<string, string> | undefined),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    const text = await response.text();
    if (response.status === 404 || /does not exist|schema cache/i.test(text)) throw new Error("還沒建立生圖工作表，請先在 Supabase 執行 docs/sql/2026-10-11_image_jobs.sql。");
    throw new Error(`生圖工作表回應 HTTP ${response.status}：${text.slice(0, 200)}`);
  }
  if (response.status === 204) return [] as T;
  return response.json() as Promise<T>;
}

export async function createImageJob(input: { purpose: string; brandId: string; sizeKey: string; prompt: string; negative: string; seed: number }): Promise<ImageJob> {
  const rows = await db<ImageJob[]>("image_jobs", "", {
    method: "POST", headers: { Prefer: "return=representation" },
    body: JSON.stringify({ purpose: input.purpose, brand_id: input.brandId, size_key: input.sizeKey, prompt: input.prompt, negative: input.negative, seed: input.seed }),
  });
  return rows[0];
}

export async function getImageJob(id: string): Promise<ImageJob | null> {
  const rows = await db<ImageJob[]>("image_jobs", `id=eq.${encodeURIComponent(id)}&limit=1`);
  return rows[0] || null;
}

/** 只有還在等待的單可以取消 */
export async function cancelImageJob(id: string): Promise<boolean> {
  const rows = await db<ImageJob[]>("image_jobs", `id=eq.${encodeURIComponent(id)}&status=eq.pending`, {
    method: "PATCH", headers: { Prefer: "return=representation" },
    body: JSON.stringify({ status: "cancelled", finished_at: new Date().toISOString() }),
  });
  return rows.length > 0;
}

export async function readWorkerStatus(): Promise<{ online: boolean; seenAt: string | null }> {
  try {
    const rows = await db<Array<{ seen_at: string }>>("image_worker_heartbeat", "select=seen_at&order=seen_at.desc&limit=1");
    const seenAt = rows[0]?.seen_at || null;
    return { online: isWorkerOnline(seenAt), seenAt };
  } catch {
    return { online: false, seenAt: null };
  }
}
