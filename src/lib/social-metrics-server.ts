// 成效分頁的資料來源：向 n8n 的唯讀資料出口（social_metrics_api）要資料。
// 密鑰只存在伺服器端環境變數，瀏覽器拿不到。
// 伺服器端快取 30 分鐘，避免每次打開分頁都消耗 n8n 執行額度。

export interface SocialAccountDaily {
  date: string | null;
  platform: string | null;
  account_id: string | null;
  account_label: string | null;
  followers: number | null;
  views_day: number | null;
  reach_day: number | null;
  interactions_day: number | null;
}

export interface SocialPost {
  platform: string | null;
  account_id: string | null;
  account_label: string | null;
  post_id: string | null;
  url: string | null;
  published_at: string | null;
  post_type: string | null;
  text_preview: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  reach: number | null;
}

export interface SocialSyncLog {
  run_at: string | null;
  platform: string | null;
  account_id: string | null;
  status: string | null;
  rows_written: number | null;
  error_message: string | null;
}

export interface SocialMetrics {
  generated_at: string;
  account_daily: SocialAccountDaily[];
  posts: SocialPost[];
  sync_log: SocialSyncLog[];
}

export type SocialMetricsResult =
  | { ok: true; data: SocialMetrics; fetchedAt: number; cached: boolean; stale: boolean }
  | { ok: false; status: number; error: string };

const CACHE_TTL_MS = 30 * 60 * 1000;
const FORCE_MIN_GAP_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 20_000;

let cache: { at: number; data: SocialMetrics } | null = null;
let lastNetworkAt = 0;

export function isSocialMetricsConfigured(): boolean {
  return !!(process.env.SOCIAL_METRICS_URL && process.env.SOCIAL_METRICS_KEY);
}

function looksLikeMetrics(value: unknown): value is SocialMetrics {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v.account_daily) && Array.isArray(v.posts) && Array.isArray(v.sync_log);
}

/**
 * 取得成效資料。
 * - 預設吃快取（30 分鐘內不重打 n8n）。
 * - force=true 代表使用者按了「重新整理」，但距離上次真的打 n8n 不到 5 分鐘時仍回快取，保護額度。
 */
export async function getSocialMetrics(force: boolean): Promise<SocialMetricsResult> {
  const url = process.env.SOCIAL_METRICS_URL;
  const key = process.env.SOCIAL_METRICS_KEY;
  if (!url || !key) {
    return { ok: false, status: 503, error: "後台尚未設定 SOCIAL_METRICS_URL 與 SOCIAL_METRICS_KEY" };
  }

  const now = Date.now();
  if (cache) {
    const age = now - cache.at;
    const fresh = age < CACHE_TTL_MS;
    const forceBlocked = force && now - lastNetworkAt < FORCE_MIN_GAP_MS;
    if ((fresh && !force) || forceBlocked) {
      return { ok: true, data: cache.data, fetchedAt: cache.at, cached: true, stale: false };
    }
  }

  lastNetworkAt = now;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "X-Api-Key": key, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      if (cache) return { ok: true, data: cache.data, fetchedAt: cache.at, cached: true, stale: true };
      const hint = res.status === 401 || res.status === 403 ? "（密鑰不符，請確認 Render 與 n8n 的值一致）" : "";
      return { ok: false, status: 502, error: `資料出口回應 ${res.status}${hint}` };
    }
    const json: unknown = await res.json();
    if (!looksLikeMetrics(json)) {
      if (cache) return { ok: true, data: cache.data, fetchedAt: cache.at, cached: true, stale: true };
      return { ok: false, status: 502, error: "資料出口回傳的格式不是預期的成效資料" };
    }
    cache = { at: Date.now(), data: json };
    return { ok: true, data: json, fetchedAt: cache.at, cached: false, stale: false };
  } catch (error) {
    if (cache) return { ok: true, data: cache.data, fetchedAt: cache.at, cached: true, stale: true };
    const message = error instanceof Error && error.message ? error.message : "連線失敗";
    return { ok: false, status: 502, error: `無法連到資料出口：${message}` };
  }
}
