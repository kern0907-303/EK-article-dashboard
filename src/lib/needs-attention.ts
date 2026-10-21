import { pipelineDb } from "@/lib/auto-pipeline-server";

export type AttentionKind = "review" | "manual" | "failed" | "blocked";
export type AttentionSource = "job" | "fb_queue" | "social_queue";

export interface AttentionItem {
  key: string;
  kind: AttentionKind;
  brand: string;
  platform: string;
  scheduledAt: string | null;
  reason: string;
  text: string;
  /** 完整內容，給詳情與修改用 */
  full: string;
  advice: string;
  source: AttentionSource;
  refId: string;
  jobId: string | null;
  canEdit: boolean;
  canRetry: boolean;
  /** 重試前需要再確認的風險說明（例如結果不明，重試可能重複發文） */
  retryRisk: string | null;
  canMarkDone: boolean;
  canCancel: boolean;
  /** 失敗且不想重試時，放棄這則（改為已取消） */
  canDismiss: boolean;
}

const DAY = 24 * 60 * 60 * 1000;
const BRAND_LABEL: Record<string, string> = { nas: "NAS", abl: "ABL", i8: "I8", erick: "Erick" };
const PLATFORM_LABEL: Record<string, string> = { threads: "Threads", instagram: "IG", website: "官網", facebook: "FB" };

function brandOf(value: unknown): string {
  const text = String(value ?? "").toLowerCase();
  if (text.includes("nas")) return "nas";
  if (text.includes("abl")) return "abl";
  if (text.includes("i8")) return "i8";
  return text === "erick" || text.includes("erick") ? "erick" : text || "erick";
}

function snippet(value: unknown, max = 90): string {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

async function safeQuery<T>(table: string, query: string): Promise<T[]> {
  try { return await pipelineDb<T[]>(table, query); } catch { return []; }
}

/** 只讀：把需要人處理的項目從三張表集中，不改任何資料。 */
export async function collectAttention(): Promise<{ items: AttentionItem[] }> {
  const now = Date.now();
  const iso = (ms: number) => encodeURIComponent(new Date(ms).toISOString());
  const items: AttentionItem[] = [];

  // 1. 流水線任務：待人工、失敗、24~48 小時內要發但還沒審的
  const jobSelect = "id,brand_id,scheduled_at,status,error_reason,draft_content,prompt,queue_id,reviewed,current_step";
  const [problemJobs, unreviewedJobs] = await Promise.all([
    safeQuery<any>("auto_pipeline_jobs", `status=in.(manual,failed)&reviewed=eq.false&order=scheduled_at.asc&limit=100&select=${jobSelect}`),
    safeQuery<any>("auto_pipeline_jobs", `status=eq.scheduled&reviewed=eq.false&scheduled_at=gte.${iso(now)}&scheduled_at=lt.${iso(now + 2 * DAY)}&order=scheduled_at.asc&limit=100&select=${jobSelect}`),
  ]);

  for (const job of problemJobs) {
    const brand = brandOf(job.brand_id);
    const reason = String(job.error_reason || job.current_step || "");
    const blocked = job.status === "manual" && brand !== "erick" && /品管|紅線|阻擋|違規|未通過|禁用詞|請改寫/.test(reason);
    const kind: AttentionKind = job.status === "failed" ? "failed" : blocked ? "blocked" : "manual";
    items.push({
      key: `job:${job.id}`, kind, brand, platform: "FB", scheduledAt: job.scheduled_at,
      reason: reason || (kind === "failed" ? "流水線任務失敗" : "流水線停在人工處理"),
      text: snippet(job.draft_content || job.prompt), full: String(job.draft_content || job.prompt || ""), source: "job", refId: job.id, jobId: job.id,
      advice: kind === "failed" ? "看原因後到自動流水線頁面重新建立，或取消這則。"
        : kind === "blocked" ? "修改文案後儲存，系統會重新跑品管，通過才算處理完。"
        : brand === "erick" ? "個人帳號無法排程，複製文案自己發，發完按「我已處理」。"
        : "確認內容與時間沒問題後，到自動流水線頁面排程，或標記已處理。",
      canEdit: kind !== "failed" && !!job.draft_content, canRetry: false, retryRisk: null, canMarkDone: true, canCancel: false, canDismiss: false,
    });
  }
  for (const job of unreviewedJobs) {
    items.push({
      key: `job:${job.id}`, kind: "review", brand: brandOf(job.brand_id), platform: "FB", scheduledAt: job.scheduled_at,
      reason: "兩天內要發佈，還沒有審稿",
      text: snippet(job.draft_content || job.prompt), full: String(job.draft_content || job.prompt || ""), source: "job", refId: job.id, jobId: job.id,
      advice: "讀過內容沒問題就標記已審，需要調整就先修改。官網、IG、Threads 衍生稿跟著這一則。",
      canEdit: !!job.draft_content, canRetry: false, retryRisk: null, canMarkDone: true, canCancel: true, canDismiss: false,
    });
  }

  // 2. 流水線的衍生平台失敗（官網、IG、Threads）
  const multi = await safeQuery<any>("auto_pipeline_jobs", `status=eq.scheduled&scheduled_at=gte.${iso(now - DAY)}&order=scheduled_at.asc&limit=100&select=id,brand_id,scheduled_at,social_results,draft_content`);
  for (const job of multi) {
    const results = job.social_results;
    if (!results || typeof results !== "object") continue;
    for (const platform of ["website", "instagram", "threads"]) {
      const outcome = (results as Record<string, any>)[platform];
      if (outcome && outcome.ok === false && outcome.error) {
        items.push({
          key: `multi:${job.id}:${platform}`, kind: "failed", brand: brandOf(job.brand_id), platform: PLATFORM_LABEL[platform], scheduledAt: job.scheduled_at,
          reason: `${PLATFORM_LABEL[platform]} 衍生草稿沒做成：${snippet(outcome.error, 80)}`,
          text: snippet(job.draft_content), full: String(job.draft_content ?? ""), source: "job", refId: job.id, jobId: job.id,
          advice: "這一則 FB 不受影響。可請工程端用補齊草稿功能重跑這則，或自己在多平台衍生頁手動做。",
          canEdit: false, canRetry: false, retryRisk: null, canMarkDone: false, canCancel: false, canDismiss: false,
        });
      }
    }
  }

  // 3. FB 排程發送失敗（7 天內）
  const fbRows = await safeQuery<any>("publish_queue", `status=in.(failed,partial)&scheduled_at=gte.${iso(now - 7 * DAY)}&order=scheduled_at.desc&limit=50&select=id,brand_id,content,scheduled_at,status,error,results`);
  for (const row of fbRows) {
    const results: any[] = Array.isArray(row.results) ? row.results : [];
    const anySent = results.some((entry) => entry && entry.ok && entry.fbPostId);
    items.push({
      key: `fb:${row.id}`, kind: "failed", brand: brandOf(row.brand_id), platform: "FB", scheduledAt: row.scheduled_at,
      reason: row.status === "partial" ? "部分粉專已發出、部分失敗" : `FB 發佈失敗：${snippet(row.error || "未記錄原因", 80)}`,
      text: snippet(row.content), full: String(row.content ?? ""), source: "fb_queue", refId: row.id, jobId: null,
      advice: anySent ? "已有粉專成功發出，重試會重複發文，請到 Facebook 確認後再決定。" : "先確認不是內容問題，再按重試，系統會在約 6 分鐘後重新派發。",
      canEdit: false, canRetry: !anySent && row.status === "failed", retryRisk: null, canMarkDone: false, canCancel: false, canDismiss: row.status === "failed",
    });
  }

  // 4. Threads / IG 發送失敗（7 天內）
  const socialRows = await safeQuery<any>("social_publish_queue", `status=eq.failed&scheduled_at=gte.${iso(now - 7 * DAY)}&order=scheduled_at.desc&limit=50&select=id,brand,platform,content,scheduled_at,error,attempts`);
  for (const row of socialRows) {
    const unknown = /結果不明/.test(String(row.error || ""));
    items.push({
      key: `social:${row.id}`, kind: "failed", brand: brandOf(row.brand), platform: PLATFORM_LABEL[row.platform] || String(row.platform), scheduledAt: row.scheduled_at,
      reason: `${PLATFORM_LABEL[row.platform] || row.platform} 發佈失敗：${snippet(row.error || "未記錄原因", 80)}`,
      text: snippet(row.content), full: String(row.content ?? ""), source: "social_queue", refId: row.id, jobId: null,
      advice: unknown ? "上次結果不明，可能其實已發出。先到平台確認，沒有發出再重試。" : "多半是暫時性錯誤，直接重試；重複失敗再看原因。",
      canEdit: false, canRetry: true, retryRisk: unknown ? "上次結果不明，這則可能已經發出，重試會造成重複發文。確定要重試嗎？" : null, canMarkDone: false, canCancel: false, canDismiss: true,
    });
  }

  // 去重（同一個 key 只留一筆），並依預定發佈時間由近到遠
  const seen = new Set<string>();
  const unique = items.filter((item) => (seen.has(item.key) ? false : (seen.add(item.key), true)));
  unique.sort((a, b) => (a.scheduledAt ? new Date(a.scheduledAt).getTime() : Infinity) - (b.scheduledAt ? new Date(b.scheduledAt).getTime() : Infinity));
  return { items: unique };
}

export { BRAND_LABEL };
