import { NextRequest, NextResponse } from "next/server";
import { AUTO_PIPELINE_ENABLED, PIPELINE_MAX_BATCH_SIZE, parsePipelineBatch, type BatchSource, type PipelineEntry } from "@/lib/auto-pipeline";
import { getSupabaseEnv, supabaseHeaders } from "@/lib/publish-queue";
import { makeBatchRow, makeJobRow, pipelineDb } from "@/lib/auto-pipeline-server";
import { blockingIssues, checkGenreText } from "@/lib/genre-check";
import { PROMPT_VERSION } from "@/data/skills/genres";

function disabled() {
  return NextResponse.json({ error: "自動流水線尚未啟用。設定 AUTO_PIPELINE_ENABLED=true 後才會啟用。", enabled: false }, { status: 404 });
}

export async function GET() {
  if (!AUTO_PIPELINE_ENABLED) return disabled();
  try {
    const [batches, jobs] = await Promise.all([
      pipelineDb<any[]>("auto_pipeline_batches", "order=created_at.desc&limit=50"),
      pipelineDb<any[]>("auto_pipeline_jobs", "order=created_at.desc&limit=200"),
    ]);
    // 把已排程貼文附的圖卡網址帶回來，讓畫面能預覽
    const queueIds = [...new Set(jobs.map((job: any) => job.queue_id).filter(Boolean))];
    const cardByQueue = new Map<string, string>();
    if (queueIds.length) {
      try {
        const queued = await pipelineDb<any[]>("publish_queue", `id=in.(${queueIds.map((id: string) => encodeURIComponent(id)).join(",")})&select=id,image_url`);
        for (const row of queued) if (row.image_url) cardByQueue.set(row.id, row.image_url);
      } catch {}
    }
    const jobsWithCards = jobs.map((job: any) => ({ ...job, card_url: job.queue_id ? cardByQueue.get(job.queue_id) || null : null }));
    return NextResponse.json({ enabled: true, batches, jobs: jobsWithCards });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "讀取流水線失敗" }, { status: 500 });
  }
}

/** 預覽已在瀏覽器完成；僅此明確確認請求會建立批次資料。 */
export async function POST(req: NextRequest) {
  if (!AUTO_PIPELINE_ENABLED) return disabled();
  try {
    const body = await req.json();
    const source = body.source as BatchSource;
    const entries = body.entries as PipelineEntry[];
    const projectId = typeof body.projectId === "string" ? body.projectId : null;
    if (!["manual", "file", "research"].includes(source) || !Array.isArray(entries) || entries.length < 1 || entries.length > PIPELINE_MAX_BATCH_SIZE) {
      return NextResponse.json({ error: `批次資料無效；單批需為 1 到 ${PIPELINE_MAX_BATCH_SIZE} 篇。` }, { status: 400 });
    }
    if (entries.some((entry) => !entry.brandId || !entry.prompt?.trim() || entry.warning?.some((warning) => warning !== "缺少日期"))) {
      return NextResponse.json({ error: "每篇都必須補齊品牌與提示詞，日期格式錯誤需先修正。" }, { status: 400 });
    }
    const env = getSupabaseEnv();
    if (!env) return NextResponse.json({ error: "後台未設定 Supabase 連線資訊" }, { status: 500 });
    const batchRows = await pipelineDb<any[]>("auto_pipeline_batches", "", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(makeBatchRow(source)) });
    const batch = batchRows[0];
    const rows = entries.map((entry) => makeJobRow(batch.id, entry, projectId));
    const jobs = await pipelineDb<any[]>("auto_pipeline_jobs", "", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(rows) });
    return NextResponse.json({ success: true, batch, jobs });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "建立批次失敗" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!AUTO_PIPELINE_ENABLED) return disabled();
  try {
    const { id, batchId, action, content } = await req.json();
    if (typeof id !== "string" && typeof batchId !== "string") return NextResponse.json({ error: "缺少任務或批次 ID" }, { status: 400 });
    const env = getSupabaseEnv();
    if (!env) return NextResponse.json({ error: "後台未設定 Supabase 連線資訊" }, { status: 500 });
    if (action === "reviewed" && typeof id === "string") {
      const jobs = await pipelineDb<any[]>("auto_pipeline_jobs", `id=eq.${encodeURIComponent(id)}&status=eq.scheduled`, {
        method: "PATCH", body: JSON.stringify({ reviewed: true, updated_at: new Date().toISOString() }),
      });
      if (!jobs.length) return NextResponse.json({ error: "找不到可標記審稿的任務" }, { status: 404 });
      return NextResponse.json({ success: true, job: jobs[0] });
    }
    if (action === "edit" && typeof id === "string") {
      const updatedContent = typeof content === "string" ? content : "";
      if (!updatedContent.trim()) return NextResponse.json({ error: "文案不可空白" }, { status: 400 });
      const currentRows = await pipelineDb<any[]>("auto_pipeline_jobs", `id=eq.${encodeURIComponent(id)}&select=*`);
      const current = currentRows[0];
      if (!current || !["scheduled", "manual"].includes(current.status)) return NextResponse.json({ error: "此狀態不可編輯" }, { status: 409 });
      const checked = checkGenreText(updatedContent, { genre: "breakdown", funnel: "warm", prompt_version: PROMPT_VERSION }, "facebook", current.brand_id);
      const issues = blockingIssues(checked);
      const warnings = checked.filter((item) => item.level === "warn").map((item) => item.message);
      const negatedHits = checked.guardrailHits.filter((hit) => hit.negated);
      if (negatedHits.length) {
        console.info("[auto-pipeline] edited draft guardrail negation pass", JSON.stringify(negatedHits.map(({ word, sentence, category }) => ({ word, sentence, category }))));
      }
      if (issues.length) return NextResponse.json({ error: "文案仍有阻擋項目，修正後再儲存。", violations: issues.map((item) => item.message), warnings, guardrailHits: checked.guardrailHits }, { status: 422 });
      if (current.queue_id) {
        const queueRes = await fetch(`${env.url}/rest/v1/publish_queue?id=eq.${encodeURIComponent(current.queue_id)}&source=eq.auto_pipeline&status=eq.pending`, {
          method: "PATCH", headers: supabaseHeaders(env.key, { Prefer: "return=representation" }),
          body: JSON.stringify({ content: updatedContent, updated_at: new Date().toISOString() }),
        });
        if (!queueRes.ok) throw new Error(`更新排程文案失敗（${queueRes.status}）`);
        const queueRows = await queueRes.json();
        if (!Array.isArray(queueRows) || !queueRows.length) return NextResponse.json({ error: "排程已進入派發或完成，無法再修改" }, { status: 409 });
      }
      const priorWarnings = Array.isArray(current.warnings) ? current.warnings.filter((warning: unknown) => typeof warning === "string" && warning.startsWith("發文前提醒（不在文章裡）：")) : [];
      const nextWarnings = [...new Set([...priorWarnings, ...warnings])];
      const updated = await pipelineDb<any[]>("auto_pipeline_jobs", `id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ draft_content: updatedContent, warnings: nextWarnings, reviewed: true, updated_at: new Date().toISOString() }) });
      return NextResponse.json({ success: true, job: updated[0], warnings, guardrailHits: checked.guardrailHits });
    }
    if (action !== "cancel") return NextResponse.json({ error: "不支援的操作" }, { status: 400 });
    const filter = typeof id === "string" ? `id=eq.${encodeURIComponent(id)}` : `batch_id=eq.${encodeURIComponent(batchId)}`;
    const jobs = await pipelineDb<any[]>("auto_pipeline_jobs", `${filter}&status=in.(pending,generating,optimizing,scheduled)`, {});
    if (!jobs.length) return NextResponse.json({ error: "沒有可取消的待處理任務" }, { status: 409 });
    const cancelled: string[] = [];
    for (const job of jobs) {
      const cancelledJob = await fetch(`${env.url}/rest/v1/rpc/cancel_auto_pipeline_job`, {
        method: "POST", headers: supabaseHeaders(env.key), body: JSON.stringify({ p_job_id: job.id }),
      });
      if (!cancelledJob.ok) throw new Error(`撤回流水線排程失敗（${cancelledJob.status}）`);
      if (await cancelledJob.json()) cancelled.push(job.id);
    }
    return NextResponse.json({ success: true, cancelled });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "操作失敗" }, { status: 500 });
  }
}
