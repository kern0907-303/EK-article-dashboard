import { NextRequest, NextResponse } from "next/server";
import { AUTO_PIPELINE_ENABLED } from "@/lib/auto-pipeline";
import { getSupabaseEnv } from "@/lib/publish-queue";
import { pipelineDb } from "@/lib/auto-pipeline-server";
import { isMultiplatformEnabled, runMultiplatform, summarize } from "@/lib/auto-multiplatform";

// 補齊舊排程：對「FB 已排好、但還沒有官網文章與 IG、Threads 排程」的流水線貼文，
// 以排好的 FB 文案為母稿，補做官網、IG 輪播、Threads。
// 需要登入（走儀表板登入狀態，不是公開路徑）。每次最多處理 limit 篇（預設 1），避免單次請求過久。
// 已經有官網文章、或已有 Threads / IG 排程的貼文一律略過，不會重複產生。
export const maxDuration = 300;

const BRAND_BY_PAGE: Record<string, "nas" | "abl" | "i8"> = { fb_nas: "nas", fb_abl: "abl", fb_i8: "i8" };
const BRAND_NAME = { nas: "平衡空間", abl: "艾伯林量子調頻", i8: "初八企業顧問" } as const;

export async function POST(req: NextRequest) {
  if (!AUTO_PIPELINE_ENABLED) return NextResponse.json({ error: "自動流水線尚未啟用" }, { status: 404 });
  if (!isMultiplatformEnabled()) return NextResponse.json({ error: "AUTO_MULTIPLATFORM_ENABLED 尚未啟用" }, { status: 409 });
  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Math.max(Number(body?.limit) || 1, 1), 3);
    const dryRun = body?.dryRun === true;
    const env = getSupabaseEnv();
    if (!env) return NextResponse.json({ error: "後台未設定 Supabase 連線資訊" }, { status: 500 });

    const nowIso = new Date(Date.now() + 35 * 60 * 1000).toISOString();
    const rows = await pipelineDb<any[]>("publish_queue", `status=eq.pending&source=eq.auto_pipeline&article_id=is.null&scheduled_at=gt.${encodeURIComponent(nowIso)}&order=scheduled_at.asc&limit=200&select=id,content,image_url,scheduled_at,target_pages`);
    const todo: Array<{ row: any; job: any; brand: "nas" | "abl" | "i8" }> = [];
    const skipped: Array<{ queueId: string; reason: string }> = [];
    for (const row of rows) {
      const page = Array.isArray(row.target_pages) ? String(row.target_pages[0] || "") : "";
      const brand = BRAND_BY_PAGE[page];
      if (!brand) { skipped.push({ queueId: row.id, reason: "不是 NAS、ABL、I8 的粉專" }); continue; }
      const jobs = await pipelineDb<any[]>("auto_pipeline_jobs", `queue_id=eq.${encodeURIComponent(row.id)}&select=id,brand_id,social_results&limit=1`);
      const job = jobs[0];
      if (!job) { skipped.push({ queueId: row.id, reason: "找不到對應的流水線任務" }); continue; }
      const social = await pipelineDb<any[]>("social_publish_queue", `job_id=eq.${encodeURIComponent(job.id)}&status=neq.cancelled&select=id&limit=1`);
      if (social.length) { skipped.push({ queueId: row.id, reason: "已有 Threads 或 IG 排程" }); continue; }
      todo.push({ row, job, brand });
    }
    // 指定 queueId 時只處理那一則（多平台衍生頁的「補齊這篇」用）
    const only = typeof body?.queueId === "string" ? body.queueId : null;
    if (only) {
      const picked = todo.filter((item) => String(item.row.id) === only);
      todo.length = 0;
      todo.push(...picked);
    }
    if (dryRun) return NextResponse.json({ success: true, dryRun: true, pending: todo.length, queueIds: todo.map((t) => t.row.id), skipped });

    const done: Array<{ queueId: string; step: string; problems: string[] }> = [];
    for (const item of todo.slice(0, limit)) {
      const multi = await runMultiplatform({
        env, jobId: item.job.id, brandShort: item.brand, brandName: BRAND_NAME[item.brand], master: String(item.row.content || ""),
        fbScheduledAt: item.row.scheduled_at, fbQueueId: String(item.row.id), coverUrl: item.row.image_url || null,
      });
      const summary = summarize(multi);
      await pipelineDb("auto_pipeline_jobs", `id=eq.${encodeURIComponent(item.job.id)}`, {
        method: "PATCH", body: JSON.stringify({ social_results: multi, current_step: `補齊完成：${summary.step}`, updated_at: new Date().toISOString() }),
      });
      done.push({ queueId: item.row.id, step: summary.step, problems: summary.problems });
    }
    return NextResponse.json({ success: true, processed: done.length, remaining: Math.max(todo.length - done.length, 0), done, skipped });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "補齊失敗" }, { status: 500 });
  }
}
