import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { AUTO_PIPELINE_ENABLED, PIPELINE_MAX_BATCH_SIZE, type PipelineEntry } from "@/lib/auto-pipeline";
import { getSupabaseEnv } from "@/lib/publish-queue";
import { makeBatchRow, makeJobRow, pipelineDb } from "@/lib/auto-pipeline-server";

function authorized(req: NextRequest) {
  const expected = process.env.AUTO_PIPELINE_CRON_SECRET || "";
  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  return !!expected && expected.length === provided.length && timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

/** 只建立兩篇 draft_only 驗收工作；worker 明確禁止為它們建立排程。 */
export async function POST(req: NextRequest) {
  if (!AUTO_PIPELINE_ENABLED) return NextResponse.json({ error: "自動流水線未啟用" }, { status: 404 });
  if (!authorized(req)) return NextResponse.json({ error: "未授權" }, { status: 401 });
  if (!getSupabaseEnv()) return NextResponse.json({ error: "Supabase 尚未設定" }, { status: 503 });
  try {
    const { entries } = await req.json() as { entries: PipelineEntry[] };
    if (!Array.isArray(entries) || entries.length !== 2 || entries.length > PIPELINE_MAX_BATCH_SIZE || entries.some((entry) => !entry.brandId || !entry.prompt?.trim())) {
      return NextResponse.json({ error: "驗收批次必須剛好兩篇，且每篇都要有品牌與提示詞。" }, { status: 400 });
    }
    const batchRows = await pipelineDb<any[]>("auto_pipeline_batches", "", { method: "POST", body: JSON.stringify({ ...makeBatchRow("manual"), test_run: true }) });
    const batch = batchRows[0];
    const rows = entries.map((entry) => ({ ...makeJobRow(batch.id, entry, null), draft_only: true, test_run: true }));
    const jobs = await pipelineDb<any[]>("auto_pipeline_jobs", "", { method: "POST", body: JSON.stringify(rows) });
    return NextResponse.json({ success: true, batch, jobs });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "建立驗收草稿失敗" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!AUTO_PIPELINE_ENABLED) return NextResponse.json({ error: "自動流水線未啟用" }, { status: 404 });
  if (!authorized(req)) return NextResponse.json({ error: "未授權" }, { status: 401 });
  try {
    const { batchId } = await req.json();
    if (typeof batchId !== "string") return NextResponse.json({ error: "缺少驗收批次 ID" }, { status: 400 });
    const batches = await pipelineDb<any[]>("auto_pipeline_batches", `id=eq.${encodeURIComponent(batchId)}&test_run=eq.true&select=id`);
    if (!batches.length) return NextResponse.json({ error: "找不到驗收批次" }, { status: 404 });
    const jobs = await pipelineDb<any[]>("auto_pipeline_jobs", `batch_id=eq.${encodeURIComponent(batchId)}&test_run=eq.true&select=id,queue_id`);
    const env = getSupabaseEnv();
    if (!env) return NextResponse.json({ error: "Supabase 尚未設定" }, { status: 503 });
    for (const job of jobs) {
      if (!job.queue_id) continue;
      const response = await fetch(`${env.url}/rest/v1/publish_queue?id=eq.${encodeURIComponent(job.queue_id)}&source=eq.auto_pipeline&is_test=eq.true&status=eq.pending`, { method: "DELETE", headers: { apikey: env.key, Authorization: `Bearer ${env.key}` } });
      if (!response.ok) throw new Error(`清理驗收排程失敗（${response.status}）`);
    }
    await pipelineDb("auto_pipeline_jobs", `batch_id=eq.${encodeURIComponent(batchId)}&test_run=eq.true`, { method: "DELETE" });
    await pipelineDb("auto_pipeline_batches", `id=eq.${encodeURIComponent(batchId)}&test_run=eq.true`, { method: "DELETE" });
    return NextResponse.json({ success: true, deletedJobs: jobs.length, deletedQueueRows: jobs.filter((job) => job.queue_id).length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "清理驗收資料失敗" }, { status: 500 });
  }
}
