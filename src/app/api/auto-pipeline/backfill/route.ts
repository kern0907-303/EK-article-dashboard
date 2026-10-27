import { readFunnelFromPrompt } from "@/data/brands/conversion";
import { NextRequest, NextResponse } from "next/server";
import { AUTO_PIPELINE_ENABLED } from "@/lib/auto-pipeline";
import { getSupabaseEnv } from "@/lib/publish-queue";
import { pipelineDb } from "@/lib/auto-pipeline-server";
import { isMultiplatformEnabled, runMultiplatform, summarize } from "@/lib/auto-multiplatform";
import { publishedWebsiteBrands, websiteArticleId } from "@/lib/pipeline-website-status";

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

    // 指定平台模式（多平台衍生頁每個空欄位的「生成」按鈕）：只補選到的平台，已經有的略過，其他不動
    const wanted = Array.isArray(body?.platforms) ? [...new Set((body.platforms as unknown[]).filter((item): item is "website" | "instagram" | "threads" => item === "website" || item === "instagram" || item === "threads"))] : [];
    if (wanted.length && typeof body?.queueId === "string") {
      // 已發佈的 FB 母稿仍能補官網文章；IG / Threads 不可用過去的排程時間補發。
      const websiteOnly = wanted.length === 1 && wanted[0] === "website";
      const queueRows = await pipelineDb<any[]>("publish_queue", `id=eq.${encodeURIComponent(body.queueId)}&status=${websiteOnly ? "in.(pending,sent)" : "eq.pending"}&source=eq.auto_pipeline&select=id,content,image_url,scheduled_at,target_pages,article_id&limit=1`);
      const row = queueRows[0];
      if (!row) return NextResponse.json({ error: websiteOnly ? "找不到可用的 FB 母稿；必須是待發或已發佈。" : "這一篇的 FB 排程已不是待發狀態，無法補做社群平台。" }, { status: 409 });
      if (!websiteOnly && new Date(row.scheduled_at).getTime() < Date.now() + 35 * 60 * 1000) return NextResponse.json({ error: "FB 發佈時間不到 35 分鐘，來不及補做其他平台。請先改 FB 的排程時間。" }, { status: 409 });
      const brand = BRAND_BY_PAGE[Array.isArray(row.target_pages) ? String(row.target_pages[0] || "") : ""];
      if (!brand) return NextResponse.json({ error: "不是 NAS、ABL、I8 的粉專" }, { status: 409 });
      const jobs = await pipelineDb<any[]>("auto_pipeline_jobs", `queue_id=eq.${encodeURIComponent(row.id)}&select=id,social_results&limit=1`);
      const job = jobs[0];
      if (!job) return NextResponse.json({ error: "找不到對應的流水線任務" }, { status: 409 });
      const previousArticleId = websiteArticleId(job.social_results?.website);
      const published = previousArticleId ? await publishedWebsiteBrands([previousArticleId]) : new Map<string, string>();
      const existingArticleId = row.article_id || (previousArticleId && published.get(previousArticleId) === brand ? previousArticleId : null);
      const social = await pipelineDb<any[]>("social_publish_queue", `job_id=eq.${encodeURIComponent(job.id)}&status=neq.cancelled&select=platform`);
      const have = new Set(social.map((item) => String(item.platform)));
      const todoPlatforms = wanted.filter((platform) => platform === "website" ? !existingArticleId : !have.has(platform));
      if (!todoPlatforms.length) return NextResponse.json({ success: true, processed: 0, done: [], message: "選到的平台都已經有草稿了" });
      const multi = await runMultiplatform({
        env, jobId: job.id, brandShort: brand, brandName: BRAND_NAME[brand], master: String(row.content || ""),
        fbScheduledAt: row.scheduled_at, fbQueueId: String(row.id), coverUrl: row.image_url || null,
        funnel: readFunnelFromPrompt(String(job.prompt || "")),
        only: todoPlatforms, ...(existingArticleId ? { existingArticleId: String(existingArticleId) } : {}),
      });
      const NAME = { website: "官網", instagram: "IG", threads: "Threads" } as const;
      const problems = todoPlatforms.flatMap((platform) => { const o = multi[platform]; return !o.ok ? [`${NAME[platform]}：${o.error || "失敗"}`] : o.error ? [`${NAME[platform]}：${o.error}`] : []; });
      const previous = job.social_results && typeof job.social_results === "object" ? job.social_results : {};
      const merged = { ...previous, ...Object.fromEntries(todoPlatforms.map((platform) => [platform, multi[platform]])) };
      try {
        await pipelineDb("auto_pipeline_jobs", `id=eq.${encodeURIComponent(job.id)}`, { method: "PATCH", body: JSON.stringify({ social_results: merged, updated_at: new Date().toISOString() }) });
      } catch { /* social_results 欄位不存在時略過 */ }
      const outcomes = Object.fromEntries(todoPlatforms.map((platform) => [platform, multi[platform]]));
      return NextResponse.json({ success: true, processed: 1, done: [{ queueId: row.id, step: problems.length ? "有平台失敗" : "已排程", problems, outcomes }] });
    }

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
        funnel: readFunnelFromPrompt(String(item.job.prompt || "")),
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
