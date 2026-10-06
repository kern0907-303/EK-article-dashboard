// 排程佇列（Supabase 表 publish_queue）的共用型別與輔助函式。
// 表結構見 docs/sql/2026-09-30_publish_queue.sql。
// 只給伺服器端 API route 使用（會讀 service role 金鑰），不要在 client 元件 import 這個檔案的函式。

export type QueueStatus = "pending" | "sending" | "sent" | "partial" | "failed" | "cancelled";

/** n8n runner 寫回的每個粉專結果 */
export interface QueuePageResult {
  pageId: string;
  ok: boolean;
  fbPostId?: string;
  error?: string;
}

export interface QueueItem {
  id: string;
  brand_id: "i8" | "nas" | "abl" | "erick";
  target_pages: string[];
  content: string;
  image_url: string | null;
  article_id: string | null;
  source: "manual" | "auto_pipeline";
  is_test: boolean;
  scheduled_at: string;
  status: QueueStatus;
  results: QueuePageResult[];
  error: string | null;
  attempts: number;
  test_mode: boolean;
  created_at: string;
  sent_at: string | null;
}

/** 排程時間必須至少晚於現在 5 分鐘（留給取消、修改與派發的緩衝），最遠 30 天 */
export const QUEUE_MIN_LEAD_MS = 5 * 60 * 1000;
export const QUEUE_MAX_LEAD_MS = 30 * 24 * 60 * 60 * 1000;

/** n8n 資料表沒有 API 憑證、目前無法自動發文的粉專（個人檔案無法用 API 發文） */
export const UNSCHEDULABLE_PAGE_IDS: string[] = ["fb_erick"];

/**
 * 功能開關。n8n 的排程執行器還沒上線前，Dashboard 若接受排程，
 * 只會排進表裡卻永遠不會發出（等於重演「假排程」）。
 * 所以 Render 上要設 PUBLISH_QUEUE_ENABLED=true 才會接受新排程。
 */
export function isQueueEnabled(): boolean {
  return process.env.PUBLISH_QUEUE_ENABLED === "true";
}

/** 前端品牌 ID 轉成資料表用的短名，規則與 /api/publish-website 一致 */
export function toShortBrandId(brandId: string): "i8" | "nas" | "abl" | "erick" {
  if (brandId.includes("i8")) return "i8";
  if (brandId.includes("nas")) return "nas";
  if (brandId.includes("abl")) return "abl";
  return "erick";
}

export function getSupabaseEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

export function supabaseHeaders(key: string, extra: Record<string, string> = {}): Record<string, string> {
  return {
    "Content-Type": "application/json",
    apikey: key,
    Authorization: `Bearer ${key}`,
    ...extra,
  };
}
