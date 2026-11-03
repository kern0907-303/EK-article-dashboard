import { pipelineDb } from "@/lib/auto-pipeline-server";
import { readStalePlatforms, type DerivativePlatform } from "@/data/skills/derivative-sync";
import { publishedWebsiteBrands, websiteArticleId } from "@/lib/pipeline-website-status";

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
  derivativePlatform?: "website" | "instagram" | "threads";
  canEdit: boolean;
  /** 流水線任務是否已經排進 FB 佇列（沒排的改完要一併排程發佈） */
  queued?: boolean;
  canRetry: boolean;
  /** 重試前需要再確認的風險說明（例如結果不明，重試可能重複發文） */
  retryRisk: string | null;
  canMarkDone: boolean;
  canCancel: boolean;
  /** 失敗且不想重試時，放棄這則（改為已取消） */
  canDismiss: boolean;
  /** 主稿改過、還沒跟著同步的衍生平台。空陣列代表都同步了 */
  stalePlatforms: DerivativePlatform[];
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

  // 1. 流水線任務：待人工、失敗、還沒審的
  //
  // 審稿不看日期。原本只撈兩天內要發的，結果排在兩天後的文章在這裡完全看不到，
  // 審稿按鈕等於消失，只能等時間逼近才出現。需要審就給按鈕，不管多久以後發。
  const jobSelect = "id,brand_id,scheduled_at,status,error_reason,draft_content,prompt,queue_id,reviewed,current_step,social_results";
  const [problemJobs, unreviewedJobs] = await Promise.all([
    safeQuery<any>("auto_pipeline_jobs", `status=in.(manual,failed)&reviewed=eq.false&order=scheduled_at.asc&limit=100&select=${jobSelect}`),
    safeQuery<any>("auto_pipeline_jobs", `status=eq.scheduled&reviewed=eq.false&scheduled_at=gte.${iso(now)}&order=scheduled_at.asc&limit=200&select=${jobSelect}`),
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
      advice: kind === "failed" ? "按「重新生成」會把這則放回流水線重跑，預定發佈時間不變。真的不要了就按「放棄這則」。"
        : kind === "blocked" ? "修改文案後儲存，系統會重新跑品管，通過才算處理完。"
        : brand === "erick" ? "個人帳號無法排程，複製文案自己發，發完按「我已處理」。"
        : "確認內容與時間沒問題後，到自動流水線頁面排程，或標記已處理。",
      // 失敗的任務原本只剩「我已處理」可按，按下去只是把它藏起來，那個發文時段就沒了。
      // 給它兩條真正的出路：放回流水線重跑，或明確放棄。
      canEdit: kind !== "failed" && !!job.draft_content, queued: !!job.queue_id,
      canRetry: kind === "failed", retryRisk: null,
      canMarkDone: true, canCancel: false, canDismiss: kind === "failed" && !job.queue_id,
      stalePlatforms: readStalePlatforms(job.social_results),
    });
  }
  for (const job of unreviewedJobs) {
    items.push({
      key: `job:${job.id}`, kind: "review", brand: brandOf(job.brand_id), platform: "FB", scheduledAt: job.scheduled_at,
      reason: "還沒有審稿",
      text: snippet(job.draft_content || job.prompt), full: String(job.draft_content || job.prompt || ""), source: "job", refId: job.id, jobId: job.id,
      advice: "讀過內容沒問題就標記已審，需要調整就先修改。官網、IG、Threads 衍生稿跟著這一則。",
      canEdit: !!job.draft_content, queued: !!job.queue_id, canRetry: false, retryRisk: null, canMarkDone: true, canCancel: true, canDismiss: false,
      stalePlatforms: readStalePlatforms(job.social_results),
    });
  }

  // 2. 流水線的衍生平台失敗（官網、IG、Threads）
  const multi = await safeQuery<any>("auto_pipeline_jobs", `status=eq.scheduled&scheduled_at=gte.${iso(now - DAY)}&order=scheduled_at.asc&limit=100&select=id,brand_id,scheduled_at,queue_id,social_results,draft_content`);
  const websiteFailures = multi.filter((job) => job.social_results?.website?.ok === false);
  const queueIds = [...new Set(websiteFailures.map((job) => job.queue_id).filter(Boolean))];
  const fbLinks = queueIds.length
    ? await safeQuery<{ id: string; article_id: string | null }>("publish_queue", `id=in.(${queueIds.join(",")})&select=id,article_id`)
    : [];
  const linkedArticleByQueue = new Map(fbLinks.map((row) => [row.id, row.article_id]));
  const publishedArticles = await publishedWebsiteBrands(websiteFailures.flatMap((job) => [
    websiteArticleId(job.social_results.website), linkedArticleByQueue.get(job.queue_id),
  ].filter((id): id is string => typeof id === "string")));
  for (const job of multi) {
    const results = job.social_results;
    if (!results || typeof results !== "object") continue;
    for (const platform of ["website", "instagram", "threads"]) {
      const outcome = (results as Record<string, any>)[platform];
      if (outcome && outcome.ok === false && outcome.error && outcome.dismissed !== true) {
        if (platform === "website") {
          const articleIds = [websiteArticleId(outcome), linkedArticleByQueue.get(job.queue_id)];
          if (articleIds.some((id) => id && brandOf(publishedArticles.get(id)) === brandOf(job.brand_id))) continue;
        }
        items.push({
          key: `multi:${job.id}:${platform}`, kind: "failed", brand: brandOf(job.brand_id), platform: PLATFORM_LABEL[platform], scheduledAt: job.scheduled_at,
          reason: `${PLATFORM_LABEL[platform]} 衍生草稿沒做成：${snippet(outcome.error, 80)}`,
          text: snippet(job.draft_content), full: String(job.draft_content ?? ""), source: "job", refId: job.id, jobId: job.id,
          derivativePlatform: platform as "website" | "instagram" | "threads",
          advice: platform === "website" ? "官網文章沒生成成功，還沒有可修改的官網草稿。這一則 FB 不受影響；到多平台衍生頁重新生成，或只移除這項失敗提醒。" : "這一則 FB 不受影響。到多平台衍生頁重試；也可以只移除這項失敗提醒，原紀錄會保留。",
          canEdit: false, canRetry: false, retryRisk: null, canMarkDone: false, canCancel: false, canDismiss: true, stalePlatforms: [],
        });
      }
    }
  }

  // 2b. 主稿改過、衍生稿還沒跟上的（不看 reviewed、不看兩天內）
  //
  // 2026-11-01：艾瑞克改了一篇 I8 的標題，存檔後系統要他「去待處理中心按同步」，
  // 但那次存檔同時把 reviewed 設成 true，而未審清單只撈 reviewed=false 且兩天內的，
  // 於是那則從清單消失，同步按鈕再也按不到。另一則 ABL 排在 12/22 的也一樣卡著。
  // 這一段不依賴 reviewed，也不限兩天，只要還有待同步的平台就一定列出來。
  const alreadyListed = new Set(items.map((item) => item.key));
  for (const job of multi) {
    const pending = readStalePlatforms(job.social_results);
    if (!pending.length) continue;
    const key = `job:${job.id}`;
    if (alreadyListed.has(key)) continue;
    items.push({
      key, kind: "review", brand: brandOf(job.brand_id), platform: "FB", scheduledAt: job.scheduled_at,
      reason: `主稿改過，${pending.map((platform) => PLATFORM_LABEL[platform]).join("、")} 還是舊內容`,
      text: snippet(job.draft_content), full: String(job.draft_content ?? ""), source: "job", refId: job.id, jobId: job.id,
      advice: "讀過主稿沒問題就按同步，其他平台才會換成新版。改錯了就先改主稿再同步。不想同步、願意讓其他平台維持舊內容，就按「我已處理」。",
      canEdit: !!job.draft_content, queued: !!job.queue_id, canRetry: false, retryRisk: null,
      // 2026-11-02：這裡原本是 false，結果只靠這段掃描列出來的文章沒有審稿按鈕可按。
      canMarkDone: true, canCancel: false, canDismiss: false, stalePlatforms: pending,
    });
  }

  // 2c. 有平台還沒補草稿（不看 reviewed）
  //
  // 2026-11-02：流水線時間軸會把這種狀況標成「有平台還沒補草稿」，但待處理中心
  // 完全沒有這一類，而且兩邊的判斷不一致：時間軸不看 reviewed，待處理中心看。
  // 結果畫面一邊說有問題、一邊找不到人處理。這一段跟時間軸用同一個條件。
  const socialByJobId = new Map<string, Set<string>>();
  const multiJobIds = multi.map((job: any) => job.id);
  if (multiJobIds.length) {
    const rows = await safeQuery<any>("social_publish_queue", `job_id=in.(${multiJobIds.join(",")})&status=neq.cancelled&select=job_id,platform`);
    for (const row of rows) {
      const set = socialByJobId.get(row.job_id) || new Set<string>();
      set.add(String(row.platform));
      socialByJobId.set(row.job_id, set);
    }
  }
  const withinWeek = (at: unknown) => {
    const time = new Date(String(at || "")).getTime();
    return Number.isFinite(time) && time > now && time < now + 7 * DAY;
  };
  for (const job of multi) {
    if (brandOf(job.brand_id) === "erick" || !withinWeek(job.scheduled_at)) continue;
    const results = (job.social_results && typeof job.social_results === "object") ? job.social_results as Record<string, any> : {};
    const have = socialByJobId.get(job.id) || new Set<string>();
    // ok === false 是「失敗」，上面那段已經列過，這裡只管從來沒有草稿的
    const missing = (["website", "instagram", "threads"] as const).filter((platform) => {
      if (results[platform]?.ok === false) return false;
      if (platform === "website") return !results.website?.ok && !linkedArticleByQueue.get(job.queue_id);
      return !have.has(platform);
    });
    if (!missing.length) continue;
    const key = `job:${job.id}`;
    if (items.some((item) => item.key === key)) continue;
    items.push({
      key, kind: "manual", brand: brandOf(job.brand_id), platform: "FB", scheduledAt: job.scheduled_at,
      reason: `${missing.map((platform) => PLATFORM_LABEL[platform]).join("、")} 還沒補草稿`,
      text: snippet(job.draft_content), full: String(job.draft_content ?? ""), source: "job", refId: job.id, jobId: job.id,
      advice: "到自動流水線的多平台衍生頁，在空著的平台按「生成」，補好這一則就會自動離開清單。FB 不受影響，照原本時間發。不補也可以，那一天就少那幾個平台。",
      canEdit: !!job.draft_content, queued: !!job.queue_id, canRetry: false, retryRisk: null,
      // 這一段不看 reviewed，所以「標記已審」按了項目也不會消失，那會變成一顆沒作用的按鈕。
      // 真正讓它離開清單的動作是把草稿補上，入口在多平台衍生頁。
      canMarkDone: false, canCancel: false, canDismiss: false, stalePlatforms: readStalePlatforms(job.social_results),
    });
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
      canEdit: false, canRetry: !anySent && row.status === "failed", retryRisk: null, canMarkDone: false, canCancel: false, canDismiss: row.status === "failed", stalePlatforms: [],
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
      canEdit: false, canRetry: true, retryRisk: unknown ? "上次結果不明，這則可能已經發出，重試會造成重複發文。確定要重試嗎？" : null, canMarkDone: false, canCancel: false, canDismiss: true, stalePlatforms: [],
    });
  }

  // 去重（同一個 key 只留一筆），並依預定發佈時間由近到遠
  const seen = new Set<string>();
  const unique = items.filter((item) => (seen.has(item.key) ? false : (seen.add(item.key), true)));
  unique.sort((a, b) => (a.scheduledAt ? new Date(a.scheduledAt).getTime() : Infinity) - (b.scheduledAt ? new Date(b.scheduledAt).getTime() : Infinity));
  return { items: unique };
}

export { BRAND_LABEL };
