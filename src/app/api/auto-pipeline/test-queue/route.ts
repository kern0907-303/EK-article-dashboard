import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { AUTO_PIPELINE_ENABLED, buildAutoPipelineQueueRecord } from "@/lib/auto-pipeline";
import { getSupabaseEnv, supabaseHeaders } from "@/lib/publish-queue";
import { pipelineDb } from "@/lib/auto-pipeline-server";
import { getDefaultFacebookPage } from "@/lib/facebook-pages";

function authorized(req: NextRequest) {
  const expected = process.env.AUTO_PIPELINE_CRON_SECRET || "";
  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  return !!expected && expected.length === provided.length && timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

/** 僅限人工驗收：標記測試、60 天後，dispatch_publish_queue 明確排除 is_test。 */
export async function POST(req: NextRequest) {
  if (!AUTO_PIPELINE_ENABLED) return NextResponse.json({ error: "自動流水線未啟用" }, { status: 404 });
  if (!authorized(req)) return NextResponse.json({ error: "未授權" }, { status: 401 });
  const env = getSupabaseEnv();
  if (!env) return NextResponse.json({ error: "Supabase 尚未設定" }, { status: 503 });
  try {
    const { jobId } = await req.json();
    if (typeof jobId !== "string") return NextResponse.json({ error: "缺少 jobId" }, { status: 400 });
    const jobs = await pipelineDb<any[]>("auto_pipeline_jobs", `id=eq.${encodeURIComponent(jobId)}&test_run=eq.true&draft_only=eq.true&select=*`);
    const job = jobs[0];
    if (!job?.draft_content || job.status !== "manual") return NextResponse.json({ error: "找不到已完成且未排程的測試草稿" }, { status: 404 });
    const target = getDefaultFacebookPage(job.brand_id);
    if (target.id === "fb_erick") return NextResponse.json({ error: "Erick 個人檔案不可排程" }, { status: 400 });
    const row = buildAutoPipelineQueueRecord({ brand_id: job.brand_id, target_pages: [target.id], content: job.draft_content, scheduled_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), is_test: true });
    const response = await fetch(`${env.url}/rest/v1/publish_queue`, { method: "POST", headers: supabaseHeaders(env.key, { Prefer: "return=representation" }), body: JSON.stringify(row) });
    if (!response.ok) throw new Error(`建立測試排程失敗（${response.status}）：${(await response.text()).slice(0, 240)}`);
    const rows = await response.json();
    await pipelineDb("auto_pipeline_jobs", `id=eq.${encodeURIComponent(jobId)}`, { method: "PATCH", body: JSON.stringify({ queue_id: rows[0].id, current_step: "測試排程（不派發）", updated_at: new Date().toISOString() }) });
    return NextResponse.json({ success: true, queue: rows[0] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "建立測試排程失敗" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!AUTO_PIPELINE_ENABLED) return NextResponse.json({ error: "自動流水線未啟用" }, { status: 404 });
  if (!authorized(req)) return NextResponse.json({ error: "未授權" }, { status: 401 });
  const env = getSupabaseEnv();
  if (!env) return NextResponse.json({ error: "Supabase 尚未設定" }, { status: 503 });
  try {
    const { queueId, jobId } = await req.json();
    if (typeof queueId === "string") {
      const res = await fetch(`${env.url}/rest/v1/publish_queue?id=eq.${encodeURIComponent(queueId)}&source=eq.auto_pipeline&is_test=eq.true&status=eq.pending`, {
        method: "DELETE", headers: supabaseHeaders(env.key, { Prefer: "return=representation" }),
      });
      if (!res.ok) throw new Error(`清除測試排程失敗（${res.status}）`);
      const rows = await res.json();
      if (!Array.isArray(rows) || !rows.length) return NextResponse.json({ error: "找不到可清理的測試排程" }, { status: 404 });
    }
    if (typeof jobId === "string") {
      await pipelineDb("auto_pipeline_jobs", `id=eq.${encodeURIComponent(jobId)}&status=eq.manual&queue_id=is.null`, { method: "DELETE" });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "清理測試資料失敗" }, { status: 500 });
  }
}
