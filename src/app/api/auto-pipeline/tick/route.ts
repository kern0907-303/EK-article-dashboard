import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { callErickCOO, callSeoOptimizer } from "@/lib/ai-provider";
import { stripDashes, stripMarkdown } from "@/lib/plain-text";
import { inspectForPublish } from "@/lib/brand-guardrail";
import { checkGenreText, blockingIssues } from "@/lib/genre-check";
import { getDefaultFacebookPage } from "@/lib/facebook-pages";
import { AUTO_PIPELINE_ENABLED, isSafeToSchedule } from "@/lib/auto-pipeline";
import { getSupabaseEnv, isQueueEnabled, supabaseHeaders } from "@/lib/publish-queue";
import { PROMPT_VERSION } from "@/data/skills/genres";
import { pipelineDb } from "@/lib/auto-pipeline-server";
import { cardHeadline } from "@/lib/article-image.mjs";
import { AUTO_PIPELINE_CARD_SIZE } from "@/lib/card-layout.mjs";
import { renderCardJpeg } from "@/lib/card-render-server";
import { uploadPublicJpeg } from "@/lib/social-image-server";

const CARD_BRAND_IDS: Record<string, string> = { nas: "brand_b_nas", abl: "brand_c_abl", i8: "brand_a_i8", erick: "personal_brand" };

/** 用文案第一行做 FB 橫式品牌圖卡。失敗只回傳 null，不影響排程。 */
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

function authorized(req: NextRequest): boolean {
  const secret = process.env.AUTO_PIPELINE_CRON_SECRET || "";
  const received = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  return !!secret && received.length === secret.length && timingSafeEqual(Buffer.from(received), Buffer.from(secret));
}

async function updateJob(id: string, fields: Record<string, unknown>, expectedStatus?: string) {
  const statusFilter = expectedStatus ? `&status=eq.${encodeURIComponent(expectedStatus)}` : "";
  const rows = await pipelineDb<any[]>("auto_pipeline_jobs", `id=eq.${encodeURIComponent(id)}${statusFilter}`, {
    method: "PATCH", body: JSON.stringify({ ...fields, updated_at: new Date().toISOString() }),
  });
  return rows.length > 0;
}

async function retryOnce<T>(work: () => Promise<T>): Promise<T> {
  try { return await work(); }
  catch (first) {
    try { return await work(); }
    catch (second) { throw new Error(second instanceof Error ? second.message : String(second || first)); }
  }
}

async function addNotice(batchId: string, text: string) {
  const batches = await pipelineDb<any[]>("auto_pipeline_batches", `id=eq.${encodeURIComponent(batchId)}&select=id,notification_items`);
  const current = batches[0];
  if (!current) return;
  const messages = Array.isArray(current.notification_items) ? current.notification_items : [];
  messages.push(text);
  await pipelineDb("auto_pipeline_batches", `id=eq.${encodeURIComponent(batchId)}`, {
    method: "PATCH", body: JSON.stringify({ notification_items: messages, status: "attention", updated_at: new Date().toISOString() }),
  });
}

async function sendBatchNotice(batchId: string) {
  const jobs = await pipelineDb<any[]>("auto_pipeline_jobs", `batch_id=eq.${encodeURIComponent(batchId)}&select=status`);
  if (jobs.some((job) => ["pending", "generating", "optimizing"].includes(job.status))) return;
  const batches = await pipelineDb<any[]>("auto_pipeline_batches", `id=eq.${encodeURIComponent(batchId)}&select=id,notification_items,notified_at,test_run`);
  const batch = batches[0];
  const terminal = jobs.map((job) => job.status);
  const status = terminal.includes("failed") ? "failed" : terminal.includes("manual") ? "attention" : terminal.every((state) => ["scheduled", "cancelled"].includes(state)) ? "completed" : "running";
  await pipelineDb("auto_pipeline_batches", `id=eq.${encodeURIComponent(batchId)}`, { method: "PATCH", body: JSON.stringify({ status, updated_at: new Date().toISOString() }) });
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!batch || batch.test_run || batch.notified_at || !Array.isArray(batch.notification_items) || !batch.notification_items.length || !token || !chatId) return;
  const body = `自動流水線批次 ${batchId}\n${batch.notification_items.join("\n")}`.slice(0, 3900);
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text: body }),
  });
  if (response.ok) await pipelineDb("auto_pipeline_batches", `id=eq.${encodeURIComponent(batchId)}`, {
    method: "PATCH", body: JSON.stringify({ notified_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
  });
}

export async function POST(req: NextRequest) {
  if (!AUTO_PIPELINE_ENABLED) return NextResponse.json({ error: "自動流水線未啟用" }, { status: 404 });
  if (!authorized(req)) return NextResponse.json({ error: "未授權" }, { status: 401 });
  const env = getSupabaseEnv();
  if (!env) return NextResponse.json({ error: "Supabase 尚未設定" }, { status: 503 });
  try {
    const claimed = await fetch(`${env.url}/rest/v1/rpc/claim_auto_pipeline_job`, {
      method: "POST", headers: supabaseHeaders(env.key), body: "{}", cache: "no-store",
    });
    if (!claimed.ok) throw new Error(`認領任務失敗（${claimed.status}）`);
    const rows = await claimed.json();
    const job = Array.isArray(rows) ? rows[0] : rows;
    if (!job?.id) return NextResponse.json({ success: true, processed: false, reason: "目前沒有待處理項目或另一篇正在執行" });

    const brandName = ({ nas: "NAS 生命數字", abl: "ABL 信息場調和", i8: "I8 企業顧問", erick: "Erick 個人品牌" } as const)[job.brand_id as "nas" | "abl" | "i8" | "erick"];
    let draft = "";
    try {
      const generated = await retryOnce(async () => {
        const result = await callErickCOO([], brandName, process.env.AI_PROVIDER, "expert", "maya_iris", {
          maya: job.prompt,
          iris: `依據以下社群文案主題整理關鍵字，不得增加未提供事實：${job.prompt}`,
        }, undefined, undefined, "facebook");
        const text = result.dispatchData?.social_copy;
        if (typeof text !== "string" || !text.trim()) throw new Error("Maya 沒有回傳社群文案");
        return stripDashes(stripMarkdown(text));
      });
      draft = generated;
      if (!await updateJob(job.id, { status: "optimizing", current_step: "自動健檢與 SEO 優化", draft_content: draft }, "generating")) {
        return NextResponse.json({ success: true, processed: true, status: "cancelled" });
      }
      const optimized = await retryOnce(async () => {
        const result = await callSeoOptimizer(draft, brandName, [], process.env.AI_PROVIDER);
        if (!result.optimized_content?.trim()) throw new Error("SEO 優化器沒有回傳文案");
        return stripDashes(stripMarkdown(result.optimized_content));
      });
      draft = optimized;
      const meta = { genre: "breakdown" as const, funnel: "warm" as const, prompt_version: PROMPT_VERSION };
      const issues = checkGenreText(draft, meta, "facebook");
      const redline = inspectForPublish(draft, job.brand_id);
      const blocks = blockingIssues(issues);
      const warnings = issues.filter((issue) => issue.level === "warn").map((issue) => issue.message);
      const leftover = draft.match(/【需補[^】]*】/g);
      const blockedReason = !redline.passed ? `品牌紅線：${redline.violatedWords.join("、")}` : leftover?.length ? `文案含未補的標記 ${[...new Set(leftover)].join("、")}，請補上依據或刪除後再發` : blocks.map((issue) => issue.message).join("；");
      if (!await updateJob(job.id, { draft_content: draft, warnings, current_step: blockedReason ? "待人工處理" : "生成與優化完成", ...(blockedReason ? { status: "manual", error_reason: blockedReason } : {}) }, "optimizing")) {
        return NextResponse.json({ success: true, processed: true, status: "cancelled" });
      }

      if (blockedReason) {
        if (job.test_run !== true) await addNotice(job.batch_id, `${brandName} 任務 ${job.id}：${blockedReason}`);
      } else if (job.draft_only === true) {
        await updateJob(job.id, { status: "manual", current_step: "生成與優化完成，已保存草稿（驗收模式未排程）", error_reason: null, draft_content: draft }, "optimizing");
      } else if (!isSafeToSchedule(job.scheduled_at) || !isQueueEnabled() || job.brand_id === "erick") {
        const reason = !isSafeToSchedule(job.scheduled_at) ? "預定時間已過或距離現在少於 30 分鐘" : !isQueueEnabled() ? "PUBLISH_QUEUE_ENABLED 尚未啟用" : "Erick 個人檔案目前不可排程";
        await updateJob(job.id, { status: "manual", current_step: "生成與優化完成，待人工排程", error_reason: reason, draft_content: draft }, "optimizing");
        if (job.test_run !== true) await addNotice(job.batch_id, `${brandName} 任務 ${job.id}：${reason}`);
      } else {
        const target = getDefaultFacebookPage(job.brand_id);
        if (target.id === "fb_erick") throw new Error("此粉專不可排程");
        const card = await makeCardUrl(job.brand_id, draft);
        const callEnqueue = (withImage: boolean) => fetch(`${env.url}/rest/v1/rpc/enqueue_auto_pipeline_job`, {
          method: "POST", headers: supabaseHeaders(env.key),
          body: JSON.stringify({ p_job_id: job.id, p_content: draft, p_target_page: target.id, ...(withImage ? { p_image_url: card.url } : {}) }),
        });
        const queueId = await retryOnce(async () => {
          let queued = await callEnqueue(Boolean(card.url));
          // 尚未執行新版 SQL（函式沒有 p_image_url）時，退回舊呼叫方式，圖卡不附但文案照常排程
          if (!queued.ok && card.url && [400, 404].includes(queued.status)) { card.url = null; card.error = "資料庫尚未更新支援圖卡"; queued = await callEnqueue(false); }
          if (!queued.ok) throw new Error(`建立社群排程失敗（${queued.status}）：${(await queued.text()).slice(0, 240)}`);
          return await queued.json() as string | null;
        });
        if (!queueId) {
          const latest = await pipelineDb<any[]>("auto_pipeline_jobs", `id=eq.${encodeURIComponent(job.id)}&select=status`);
          if (latest[0]?.status === "cancelled") return NextResponse.json({ success: true, processed: true, status: "cancelled" });
          throw new Error("建立社群排程失敗：資料庫拒絕無效或已取消的任務");
        }
        await updateJob(job.id, { current_step: card.url ? "已排程，未審（附品牌圖卡）" : `已排程，未審（圖卡失敗，改用圖庫：${card.error || "未知原因"}）` });
      }
      await pipelineDb("auto_pipeline_batches", `id=eq.${encodeURIComponent(job.batch_id)}`, { method: "PATCH", body: JSON.stringify({ status: "running", updated_at: new Date().toISOString() }) });
      try { await sendBatchNotice(job.batch_id); } catch (notificationError) { console.error("Auto pipeline batch finalization/notification failed:", notificationError); }
      return NextResponse.json({ success: true, processed: true, jobId: job.id, status: blockedReason ? "manual" : "complete" });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const markedFailed = await updateJob(job.id, { status: "failed", current_step: "失敗並停止", retry_count: 1, error_reason: reason, ...(draft ? { draft_content: draft } : {}) }, "generating")
        || await updateJob(job.id, { status: "failed", current_step: "失敗並停止", retry_count: 1, error_reason: reason, ...(draft ? { draft_content: draft } : {}) }, "optimizing");
      if (!markedFailed) return NextResponse.json({ success: true, processed: true, status: "cancelled" });
      if (job.test_run !== true) await addNotice(job.batch_id, `${brandName} 任務 ${job.id} 失敗：${reason}`);
      try { await sendBatchNotice(job.batch_id); } catch (notificationError) { console.error("Auto pipeline batch finalization/notification failed:", notificationError); }
      return NextResponse.json({ success: false, processed: true, jobId: job.id, error: reason }, { status: 200 });
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "流水線執行失敗" }, { status: 500 });
  }
}
