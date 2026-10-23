// 把「待人工處理」的流水線文案，改完後直接排進 FB 發佈佇列（跟自動流程用同一個資料庫函式）。
// 只給伺服器端使用。成功時任務狀態變成 scheduled；失敗時任務退回 manual，內容不遺失。

import { getDefaultFacebookPage } from "@/lib/facebook-pages";
import { PIPELINE_MIN_LEAD_MS } from "@/lib/auto-pipeline";
import { getSupabaseEnv, isQueueEnabled, supabaseHeaders } from "@/lib/publish-queue";
import { pipelineDb } from "@/lib/auto-pipeline-server";
import { cardHeadline } from "@/lib/article-image.mjs";
import { AUTO_PIPELINE_CARD_SIZE } from "@/lib/card-layout.mjs";
import { renderCardJpeg } from "@/lib/card-render-server";
import { uploadPublicJpeg } from "@/lib/social-image-server";

const CARD_BRAND_IDS: Record<string, string> = { nas: "brand_b_nas", abl: "brand_c_abl", i8: "brand_a_i8", erick: "personal_brand" };

async function makeCardUrl(brandId: string, content: string): Promise<{ url: string | null; error?: string }> {
  try {
    const headline = cardHeadline(content);
    if (!headline) return { url: null, error: "找不到可放在圖卡上的標題" };
    const jpeg = await renderCardJpeg({ brandId: CARD_BRAND_IDS[brandId] || "personal_brand", text: headline, index: 1, total: 1, sceneDataUri: null, size: AUTO_PIPELINE_CARD_SIZE });
    return { url: await uploadPublicJpeg(jpeg, brandId) };
  } catch (error) {
    return { url: null, error: error instanceof Error ? error.message.slice(0, 120) : "圖卡失敗" };
  }
}

export type ScheduleOutcome = { ok: true; queueId: string; cardNote: string } | { ok: false; status: number; error: string };

/** 最早可排的時間：現在加上最短提前量再多留 5 分鐘 */
export function earliestScheduleIso(now = Date.now()): string {
  return new Date(now + PIPELINE_MIN_LEAD_MS + 5 * 60 * 1000).toISOString();
}

/**
 * job：auto_pipeline_jobs 的一列（必須是 manual、尚未排程）。content：已通過檢查的最終文案。
 * scheduledAt：要改發佈時間時才給。
 */
export async function scheduleManualJob(job: { id: string; brand_id: string; status: string; queue_id: string | null; scheduled_at: string | null }, content: string, scheduledAt?: string | null): Promise<ScheduleOutcome> {
  const env = getSupabaseEnv();
  if (!env) return { ok: false, status: 500, error: "後台未設定 Supabase 連線資訊" };
  if (job.queue_id) return { ok: false, status: 409, error: "這一則已經排程過了" };
  if (job.brand_id === "erick") return { ok: false, status: 409, error: "Erick 個人檔案不能排程，請複製文案自己發" };
  if (!isQueueEnabled()) return { ok: false, status: 409, error: "排程佇列尚未啟用（PUBLISH_QUEUE_ENABLED）" };
  const when = scheduledAt || job.scheduled_at;
  if (!when || !Number.isFinite(new Date(when).getTime())) return { ok: false, status: 400, error: "請先選發佈時間" };
  if (new Date(when).getTime() < Date.now() + PIPELINE_MIN_LEAD_MS) return { ok: false, status: 409, error: "發佈時間已過，或離現在不到 30 分鐘，請改選較晚的時間" };
  const target = getDefaultFacebookPage(job.brand_id);
  if (target.id === "fb_erick") return { ok: false, status: 409, error: "此粉專不可排程" };

  // 資料庫函式只接受 optimizing 狀態：先把 manual 切過去，失敗再切回來
  const flipped = await pipelineDb<any[]>("auto_pipeline_jobs", `id=eq.${encodeURIComponent(job.id)}&status=eq.manual&queue_id=is.null`, {
    method: "PATCH", body: JSON.stringify({ status: "optimizing", current_step: "手動修改後排程中", scheduled_at: when, draft_content: content, updated_at: new Date().toISOString() }),
  });
  if (!flipped.length) return { ok: false, status: 409, error: "這一則的狀態剛剛變了，請重新整理頁面再試" };
  const revert = async (reason: string) => {
    try { await pipelineDb("auto_pipeline_jobs", `id=eq.${encodeURIComponent(job.id)}&status=eq.optimizing`, { method: "PATCH", body: JSON.stringify({ status: "manual", current_step: "待人工處理", error_reason: reason, draft_content: content, updated_at: new Date().toISOString() }) }); } catch { /* 盡力而為 */ }
  };
  try {
    const card = await makeCardUrl(job.brand_id, content);
    const callEnqueue = (withImage: boolean) => fetch(`${env.url}/rest/v1/rpc/enqueue_auto_pipeline_job`, {
      method: "POST", headers: supabaseHeaders(env.key),
      body: JSON.stringify({ p_job_id: job.id, p_content: content, p_target_page: target.id, ...(withImage ? { p_image_url: card.url } : {}) }),
    });
    let queued = await callEnqueue(Boolean(card.url));
    if (!queued.ok && card.url && [400, 404].includes(queued.status)) { card.url = null; card.error = "資料庫尚未更新支援圖卡"; queued = await callEnqueue(false); }
    if (!queued.ok) throw new Error(`建立排程失敗（${queued.status}）：${(await queued.text()).slice(0, 200)}`);
    const queueId = await queued.json() as string | null;
    if (!queueId) throw new Error("資料庫拒絕這筆排程（時間太近或任務已取消）");
    await pipelineDb("auto_pipeline_jobs", `id=eq.${encodeURIComponent(job.id)}`, {
      method: "PATCH", body: JSON.stringify({ current_step: card.url ? "手動修改後已排程（附品牌圖卡）" : `手動修改後已排程（圖卡失敗，改用圖庫：${card.error || "未知原因"}）`, reviewed: true, updated_at: new Date().toISOString() }),
    });
    return { ok: true, queueId, cardNote: card.url ? "" : card.error || "" };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "排程失敗";
    await revert(reason);
    return { ok: false, status: 500, error: reason };
  }
}
