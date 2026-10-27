import { readFunnelFromPrompt } from "@/data/brands/conversion";
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getDefaultFacebookPage } from "@/lib/facebook-pages";
import { AUTO_PIPELINE_ENABLED, isSafeToSchedule } from "@/lib/auto-pipeline";
import { getSupabaseEnv, isQueueEnabled, supabaseHeaders } from "@/lib/publish-queue";
import { pipelineDb } from "@/lib/auto-pipeline-server";
import { isMultiplatformEnabled, runMultiplatform, summarize } from "@/lib/auto-multiplatform";
import { resolveExperimentArm, type ExperimentAssignment } from "@/lib/experiment-server";
import { amplifierNote, brandNameOf, generateFacebookDraft, makeCardUrl, recentStyleHistory, rulesVersionNote } from "@/lib/auto-generate";

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

/** 流水線生成 FB 主稿的說話聲音規則（編輯器的文體提示詞才有這條，流水線路徑要自己帶） */

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

    const brandName = brandNameOf(String(job.brand_id));
    let draft = "";
    // 成效回流實驗（EXPERIMENT_ENABLED=true 才會生效）：依預定發文日查當天的結構臂，查不到就照原流程
    let experiment: ExperimentAssignment | null = null;
    // 標題型、開場型與文體由共用核心決定，與「重新優化」走同一份規則
    const history = await recentStyleHistory(String(job.brand_id), String(job.id));
    try {
      experiment = await resolveExperimentArm(String(job.brand_id), String(job.scheduled_at || ""));
      const generated = await generateFacebookDraft({
        brandId: String(job.brand_id), prompt: String(job.prompt), seed: String(job.id), history, retry: retryOnce,
        ...(experiment ? { experimentDirective: experiment.directive } : {}),
        onFirstDraft: (first) => updateJob(job.id, { status: "optimizing", current_step: "自動健檢與 SEO 優化", draft_content: first }, "generating"),
      });
      if (generated.cancelled) return NextResponse.json({ success: true, processed: true, status: "cancelled" });
      draft = generated.draft;
      const postReminders = generated.postReminders;
      const negatedHits = generated.guardrailHits.filter((hit) => hit.negated);
      if (negatedHits.length) {
        console.info("[auto-pipeline] guardrail negation pass", JSON.stringify(negatedHits.map(({ word, sentence, category }) => ({ word, sentence, category }))));
      }
      const warnings = [rulesVersionNote(), amplifierNote(generated.amplifier), ...generated.styleNotes, ...postReminders, ...generated.warnNotes, ...generated.fixes.map((fix) => `自動修正：${fix}`)];
      const blockedReason = generated.blockedReason;
      if (!await updateJob(job.id, { draft_content: draft, warnings, current_step: blockedReason ? "待人工處理" : "生成與優化完成", ...(blockedReason ? { status: "manual", error_reason: blockedReason } : {}) }, "optimizing")) {
        return NextResponse.json({ success: true, processed: true, status: "cancelled" });
      }

      if (postReminders.length && !blockedReason && job.test_run !== true) await addNotice(job.batch_id, `${brandName} 任務 ${job.id}：有 ${postReminders.length} 則發文前提醒（不在文章裡），請到自動流水線頁面查看`);
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
        // 多平台延伸（預設關閉）：官網文章、IG 輪播、Threads。FB 已排好，這裡任何失敗都只通知，不影響 FB。
        if (isMultiplatformEnabled() && job.test_run !== true) {
          try {
            const multi = await runMultiplatform({
              env, jobId: job.id, brandShort: job.brand_id, brandName, master: draft,
              fbScheduledAt: job.scheduled_at, fbQueueId: String(queueId), coverUrl: card.url,
              funnel: readFunnelFromPrompt(String(job.prompt || "")),
              ...(experiment ? { experiment: { experiment_id: experiment.experimentId, variable: experiment.variable, arm: experiment.arm } } : {}),
            });
            const summary = summarize(multi);
            await updateJob(job.id, { current_step: summary.step });
            if (summary.problems.length) await addNotice(job.batch_id, `${brandName} 任務 ${job.id}：${summary.problems.join("；")}`);
            try { await updateJob(job.id, { social_results: multi }); } catch { /* 資料表尚未新增 social_results 欄位時略過 */ }
          } catch (multiError) {
            const reason = multiError instanceof Error ? multiError.message : String(multiError);
            console.error("Auto pipeline multiplatform step failed:", reason);
            await addNotice(job.batch_id, `${brandName} 任務 ${job.id}：FB 已排程，但官網、IG、Threads 排程失敗：${reason.slice(0, 200)}`);
          }
        }
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
