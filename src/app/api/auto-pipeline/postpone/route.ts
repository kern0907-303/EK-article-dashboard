import { NextRequest, NextResponse } from "next/server";
import { AUTO_PIPELINE_ENABLED } from "@/lib/auto-pipeline";
import { pipelineDb } from "@/lib/auto-pipeline-server";
import { brandNameOf, firstLine } from "@/lib/auto-generate";
import {
  describeShift, normalizePostponeDays, POSTPONABLE_JOB_STATUSES, POSTPONE_MAX_DAYS, selectPostponeJobs, shiftIso, taipeiDayStartIso,
  type PostponeJob,
} from "@/lib/postpone";

/**
 * 整批往後延發佈。
 *
 * 預設是試算（dryRun），只列出哪些會延、延到幾點，不動任何資料。
 * 正式執行時，FB 排程、IG 與 Threads 排程、任務本身的預定時間一起往後挪同樣天數。
 * 只動還在待發（pending）的排程列；已經在派發或發出去的不碰。
 * 官網文章生成時就已上架，沒有排程時間，不在延後範圍內。
 *
 * 需要登入（不在 proxy 的公開路徑清單裡）。
 */
export const maxDuration = 120;

const BRAND_IDS = ["nas", "abl", "i8", "erick"];
const idList = (ids: string[]): string => ids.map((id) => encodeURIComponent(id)).join(",");

interface JobRow extends PostponeJob { draft_content: string | null; prompt: string | null }
interface QueueRow { id: string; status: string; scheduled_at: string | null; job_id?: string; platform?: string }

export async function POST(req: NextRequest) {
  if (!AUTO_PIPELINE_ENABLED) return NextResponse.json({ error: "自動流水線未啟用" }, { status: 404 });
  try {
    const body = await req.json().catch(() => ({}));
    const days = normalizePostponeDays(body.days);
    if (!days) return NextResponse.json({ error: `延後天數要是 1 到 ${POSTPONE_MAX_DAYS} 天` }, { status: 400 });
    const brandId = typeof body.brandId === "string" && BRAND_IDS.includes(body.brandId) ? body.brandId : "";
    const fromIso = taipeiDayStartIso(body.fromDate);
    if (!fromIso) return NextResponse.json({ error: "請選擇從哪一天開始延後" }, { status: 400 });
    const dryRun = body.dryRun !== false;
    // 正式執行時只延勾選的那幾篇；沒給清單就是試算範圍內全部
    const onlyIds = Array.isArray(body.jobIds) ? new Set(body.jobIds.filter((id: unknown): id is string => typeof id === "string")) : null;
    if (!dryRun && onlyIds && onlyIds.size === 0) return NextResponse.json({ error: "沒有勾選要延後的文章" }, { status: 400 });
    const nowIso = new Date().toISOString();

    const rows = await pipelineDb<JobRow[]>(
      "auto_pipeline_jobs",
      `status=in.(${POSTPONABLE_JOB_STATUSES.join(",")})&scheduled_at=gte.${encodeURIComponent(fromIso)}${brandId ? `&brand_id=eq.${brandId}` : ""}&select=id,brand_id,status,scheduled_at,queue_id,draft_content,prompt&order=scheduled_at.asc&limit=300`,
    );
    const queueIds = rows.map((row) => row.queue_id).filter((id): id is string => Boolean(id));
    const fbRows = queueIds.length ? await pipelineDb<QueueRow[]>("publish_queue", `id=in.(${idList(queueIds)})&select=id,status,scheduled_at`) : [];
    const fbById = new Map(fbRows.map((row) => [row.id, row]));
    // FB 已經發出或正在派發的，整篇不延（避免 IG、Threads 跟 FB 錯開）
    const candidates = selectPostponeJobs(rows.map((row) => {
      const fb = row.queue_id ? fbById.get(row.queue_id) : undefined;
      return { ...row, published: Boolean(fb && fb.status !== "pending") };
    }), { brandId, fromIso, nowIso }).filter((job) => dryRun || !onlyIds || onlyIds.has(job.id));
    const socialRows = candidates.length
      ? await pipelineDb<QueueRow[]>("social_publish_queue", `job_id=in.(${idList(candidates.map((job) => job.id))})&status=eq.pending&select=id,job_id,platform,status,scheduled_at`)
      : [];

    const items = candidates.map((job) => {
      const fb = job.queue_id ? fbById.get(job.queue_id) : undefined;
      const fbAt = fb?.scheduled_at || job.scheduled_at;
      const shift = describeShift(fbAt, days);
      const title = firstLine(job.draft_content || "").replace(/[【】]/g, "").slice(0, 40) || firstLine(job.prompt || "").slice(0, 40) || "（還沒生成）";
      return {
        jobId: job.id, brandName: brandNameOf(job.brand_id), title, before: shift.before, after: shift.after,
        social: socialRows.filter((row) => row.job_id === job.id).length,
      };
    });

    if (dryRun) {
      return NextResponse.json({ success: true, dryRun: true, days, count: items.length, items });
    }

    const done: typeof items = [];
    const skipped: Array<{ title: string; reason: string }> = [];
    for (const job of candidates) {
      const item = items.find((entry) => entry.jobId === job.id)!;
      try {
        if (job.queue_id) {
          const fb = fbById.get(job.queue_id);
          const moved = await pipelineDb<QueueRow[]>("publish_queue", `id=eq.${encodeURIComponent(job.queue_id)}&status=eq.pending`, {
            method: "PATCH", body: JSON.stringify({ scheduled_at: shiftIso(fb?.scheduled_at || job.scheduled_at, days), updated_at: new Date().toISOString() }),
          });
          if (!moved.length) { skipped.push({ title: item.title, reason: "FB 排程已經在派發或發出，沒有延後" }); continue; }
        }
        for (const social of socialRows.filter((row) => row.job_id === job.id)) {
          await pipelineDb("social_publish_queue", `id=eq.${encodeURIComponent(social.id)}&status=eq.pending`, {
            method: "PATCH", body: JSON.stringify({ scheduled_at: shiftIso(social.scheduled_at, days), updated_at: new Date().toISOString() }),
          });
        }
        await pipelineDb("auto_pipeline_jobs", `id=eq.${encodeURIComponent(job.id)}`, {
          method: "PATCH", body: JSON.stringify({ scheduled_at: shiftIso(job.scheduled_at, days), updated_at: new Date().toISOString() }),
        });
        done.push(item);
      } catch (error) {
        skipped.push({ title: item.title, reason: error instanceof Error ? error.message.slice(0, 160) : "延後失敗" });
      }
    }
    return NextResponse.json({ success: true, dryRun: false, days, count: done.length, items: done, skipped });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "延後失敗" }, { status: 500 });
  }
}
