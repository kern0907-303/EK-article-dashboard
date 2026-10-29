import { NextRequest, NextResponse } from "next/server";
import { AUTO_PIPELINE_ENABLED } from "@/lib/auto-pipeline";
import { getSupabaseEnv, supabaseHeaders } from "@/lib/publish-queue";
import { pipelineDb } from "@/lib/auto-pipeline-server";
import { existingDerivatives, markDerivativesStale } from "@/data/skills/derivative-sync";
import {
  brandNameOf, firstLine, makeCardUrl, rewriteExamples,
  RULES_VERSION_PREFIX, rulesVersionNote,
} from "@/lib/auto-generate";

/**
 * 一鍵重寫：主題與論點不變，只換掉故事與舉例。
 *
 * 為什麼需要：待處理中心原本只有兩條路，自己動手改字，或整篇重新生成。重新生成會換掉題目
 * 與論點，但實際要處理的狀況是「題目對、例子不妥或看不懂」。
 *
 * 該接的都接上（這是這支端點的重點，不是只改文字）：
 * 1. publish_queue.content：真的會發出去的那一份跟著換。
 * 2. publish_queue.image_url：標題圖卡重做。重做失敗沿用舊圖，不影響換稿。
 * 3. auto_pipeline_jobs.draft_content 與 warnings：草稿與提醒跟著換。
 * 4. reviewed 設回 false：重寫過就要再看一次，回到待審稿。
 * 5. social_results.rules_version 清掉：官網、IG、Threads 會被標成待同步，
 *    艾瑞克確認內容之後再按同步，一次跑一個平台。
 *
 * 防呆：新稿沒通過品管、品牌紅線或引用查證就整則不採用，舊稿原樣保留。
 * 一次只處理一篇（要帶 jobId），不做批次。
 *
 * 需要登入（不在 proxy 的公開路徑清單裡）。
 */
export const maxDuration = 300;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const headline = (text: string): string => firstLine(text).replace(/[【】]/g, "").slice(0, 40);

async function retryOnce<T>(work: () => Promise<T>): Promise<T> {
  try { return await work(); }
  catch (first) {
    try { return await work(); }
    catch (second) { throw new Error(second instanceof Error ? second.message : String(second || first)); }
  }
}

export async function POST(req: NextRequest) {
  if (!AUTO_PIPELINE_ENABLED) return NextResponse.json({ error: "自動流水線尚未啟用" }, { status: 404 });
  try {
    const body = await req.json().catch(() => ({}));
    const jobId = typeof body?.jobId === "string" && UUID_RE.test(body.jobId) ? body.jobId : "";
    if (!jobId) return NextResponse.json({ error: "缺少 jobId" }, { status: 400 });
    const note = String(body?.note || "").trim().slice(0, 500);
    const env = getSupabaseEnv();
    if (!env) return NextResponse.json({ error: "後台未設定 Supabase 連線資訊" }, { status: 500 });

    const rows = await pipelineDb<any[]>("auto_pipeline_jobs", `id=eq.${encodeURIComponent(jobId)}&select=*&limit=1`);
    const job = rows[0];
    if (!job) return NextResponse.json({ error: "找不到這個任務" }, { status: 404 });
    if (!["scheduled", "manual"].includes(String(job.status))) return NextResponse.json({ error: "這個狀態不能重寫" }, { status: 409 });

    let queued: any = null;
    if (job.queue_id) {
      const queueRows = await pipelineDb<any[]>("publish_queue", `id=eq.${encodeURIComponent(job.queue_id)}&select=id,status,content,article_id,scheduled_at&limit=1`);
      queued = queueRows[0] || null;
      if (queued && queued.status !== "pending") return NextResponse.json({ error: "排程已進入派發或完成，無法再重寫" }, { status: 409 });
    }
    const before = String(queued?.content || job.draft_content || "");
    if (!before.trim()) return NextResponse.json({ error: "這個任務還沒有文案可以重寫" }, { status: 409 });

    const result = await rewriteExamples({ brandId: String(job.brand_id), draft: before, note, retry: retryOnce });
    if (result.blockedReason) {
      return NextResponse.json({ error: `重寫的版本沒通過檢查，已保留原稿：${result.blockedReason}`, blocked: true }, { status: 422 });
    }
    if (!result.changed) {
      return NextResponse.json({ error: "重寫後內容跟原稿一樣，沒有更新。可以在說明欄寫清楚哪一段看不懂，再按一次。", blocked: true }, { status: 422 });
    }

    // 排程列先換，沒換成功就不動任務，避免兩邊內容不一致
    if (queued) {
      const patch: Record<string, unknown> = { content: result.draft, updated_at: new Date().toISOString() };
      const card = await makeCardUrl(String(job.brand_id), result.draft);
      if (card.url) patch.image_url = card.url;
      else if (card.error) result.notes.push(`標題圖卡重做失敗，沿用舊圖：${card.error}`.slice(0, 160));
      const res = await fetch(`${env.url}/rest/v1/publish_queue?id=eq.${encodeURIComponent(job.queue_id)}&status=eq.pending`, {
        method: "PATCH", headers: supabaseHeaders(env.key, { Prefer: "return=representation" }), body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(`更新排程文案失敗（${res.status}）`);
      const updated = await res.json();
      if (!Array.isArray(updated) || !updated.length) return NextResponse.json({ error: "排程在更新前已進入派發" }, { status: 409 });
    }

    // 主稿換了，跟著舊主稿產生的衍生稿就不同步，清掉規則版本讓它們被標成待同步
    const stalePlatforms = existingDerivatives(job.social_results, Boolean(queued?.article_id));
    const social = markDerivativesStale(job.social_results, Boolean(queued?.article_id));

    const keepVersion = Array.isArray(job.warnings)
      ? job.warnings.filter((item: unknown) => typeof item === "string" && (item.startsWith(RULES_VERSION_PREFIX) || item.startsWith("標題強化：") || item.startsWith("發文前提醒")))
      : [];
    const hasDerivative = stalePlatforms.length > 0;
    const nextWarnings = [...new Set([
      ...(keepVersion.length ? keepVersion : [rulesVersionNote()]),
      "已一鍵重寫例子，題目與論點未變",
      ...result.notes,
      ...result.fixes.map((fix: string) => `自動修正：${fix}`),
      ...result.warnNotes,
      hasDerivative ? "主稿換了，官網、IG、Threads 還是舊例子，請在確認內容後按同步。" : "",
    ].filter(Boolean))];

    await pipelineDb("auto_pipeline_jobs", `id=eq.${encodeURIComponent(jobId)}`, {
      method: "PATCH",
      body: JSON.stringify({
        draft_content: result.draft,
        warnings: nextWarnings,
        current_step: "已一鍵重寫例子，等待確認",
        social_results: social,
        reviewed: false,
        updated_at: new Date().toISOString(),
      }),
    });

    return NextResponse.json({
      success: true, jobId, brandName: brandNameOf(String(job.brand_id)),
      before, after: result.draft,
      beforeTitle: headline(before), afterTitle: headline(result.draft),
      titleKept: firstLine(before) === firstLine(result.draft),
      notes: result.notes, warnNotes: result.warnNotes, stalePlatforms, hasDerivative,
      queued: Boolean(queued),
      message: hasDerivative
        ? "FB 主稿已換成新例子。看過內容沒問題再按同步，官網、IG、Threads 會一個一個跟著換。"
        : "FB 主稿已換成新例子。這篇還沒有其他平台的稿，排程時才會生成，到時候就是新版。",
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "重寫失敗" }, { status: 500 });
  }
}
