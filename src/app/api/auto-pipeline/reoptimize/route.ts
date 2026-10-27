import { readFunnelFromPrompt } from "@/data/brands/conversion";
import { NextRequest, NextResponse } from "next/server";
import { AUTO_PIPELINE_ENABLED } from "@/lib/auto-pipeline";
import { getSupabaseEnv, supabaseHeaders } from "@/lib/publish-queue";
import { pipelineDb } from "@/lib/auto-pipeline-server";
import { rewriteSocialPost, rewriteWebsiteArticle } from "@/lib/auto-multiplatform";
import {
  amplifierNote, brandNameOf, firstLine, generateFacebookDraft, isCurrentRules, makeCardUrl,
  recentStyleHistory, RULES_VERSION, RULES_VERSION_PREFIX, rulesVersionNote,
} from "@/lib/auto-generate";

/**
 * 用目前這一版規則，重寫已經排程但還沒發出去的內容。
 *
 * 為什麼需要：規則改了之後，已排程的文章還是舊規則寫的。沒有這個機制，新規則要等好幾週
 * 才會全部換過來，迭代速度被排程長度綁死。
 *
 * 防呆設計：
 * 1. 一次只做一個平台（platform 是單一字串，傳陣列直接退回），不會四個平台一起跑。
 * 2. 預設是試算（dryRun），只列出哪些會被改，不動任何資料。
 * 3. 要重寫官網、IG、Threads 之前，FB 主稿必須已經是這一版規則。衍生稿是從主稿改寫出來的，
 *    主稿還是舊的就先擋下，避免用舊主稿產生新衍生稿。
 * 4. 只處理排程列仍然是 pending 的；距離「該平台自己的發佈時間」不到 minLeadMinutes 分鐘的不碰。
 * 5. 新稿沒通過品管或品牌紅線就整則不採用，舊稿原樣保留，不會把排程換成壞的。
 * 6. 一次最多 limit 篇（1 到 10），避免單次請求過久與一次燒掉太多額度。
 *
 * 需要登入（不在 proxy 的公開路徑清單裡）。
 */
export const maxDuration = 300;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PLATFORMS = ["facebook", "website", "instagram", "threads"] as const;
type Platform = (typeof PLATFORMS)[number];
const PLATFORM_LABEL: Record<Platform, string> = { facebook: "Facebook 主稿", website: "官網文章", instagram: "IG 輪播", threads: "Threads" };

async function retryOnce<T>(work: () => Promise<T>): Promise<T> {
  try { return await work(); }
  catch (first) {
    try { return await work(); }
    catch (second) { throw new Error(second instanceof Error ? second.message : String(second || first)); }
  }
}

const idList = (ids: string[]): string => ids.map((id) => encodeURIComponent(id)).join(",");
const headline = (text: string): string => firstLine(text).replace(/[【】]/g, "").slice(0, 40);

/** 衍生平台的規則版本記在 social_results.rules_version 裡，不需要改資料表 */
const derivedRulesVersion = (socialResults: unknown, platform: Platform): string =>
  String((socialResults as { rules_version?: Record<string, string> })?.rules_version?.[platform] || "");

interface Row {
  id: string; brand_id: string; prompt: string; scheduled_at: string; queue_id: string;
  draft_content: string | null; warnings: unknown; social_results: unknown;
}
interface Candidate {
  row: Row;
  /** 這個平台自己的發佈時間 */
  dueAt: string;
  /** 目前的內容，用來顯示舊標題 */
  current: string;
  stale: boolean;
  /** 不能動的原因，空字串代表可以動 */
  blocked: string;
  /** FB 主稿，衍生平台改寫時當母稿 */
  master: string;
  articleId?: string;
  coverUrl?: string | null;
  socialRowId?: string;
}

export async function POST(req: NextRequest) {
  if (!AUTO_PIPELINE_ENABLED) return NextResponse.json({ error: "自動流水線尚未啟用" }, { status: 404 });
  try {
    const body = await req.json().catch(() => ({}));
    if (Array.isArray(body?.platform)) return NextResponse.json({ error: "一次只能重寫一個平台" }, { status: 400 });
    const platform: Platform = PLATFORMS.includes(body?.platform) ? body.platform : "facebook";
    const dryRun = body?.dryRun !== false;
    const limit = Math.min(Math.max(Number(body?.limit) || 1, 1), 10);
    const minLeadMinutes = Math.min(Math.max(Number(body?.minLeadMinutes) || 60, 40), 24 * 60);
    const onlyJobId = typeof body?.jobId === "string" && UUID_RE.test(body.jobId) ? body.jobId : null;
    const brand = typeof body?.brand === "string" && ["nas", "abl", "i8"].includes(body.brand) ? body.brand : null;
    const env = getSupabaseEnv();
    if (!env) return NextResponse.json({ error: "後台未設定 Supabase 連線資訊" }, { status: 500 });

    const cutoff = Date.now() + minLeadMinutes * 60 * 1000;
    const jobs = await pipelineDb<Row[]>("auto_pipeline_jobs", [
      "status=eq.scheduled", "queue_id=not.is.null",
      `scheduled_at=gt.${encodeURIComponent(new Date(Date.now() - 24 * 3600 * 1000).toISOString())}`,
      brand ? `brand_id=eq.${brand}` : "", onlyJobId ? `id=eq.${onlyJobId}` : "",
      "order=scheduled_at.asc&limit=120&select=id,brand_id,prompt,scheduled_at,queue_id,draft_content,warnings,social_results",
    ].filter(Boolean).join("&"));

    const queueRows = jobs.length
      ? await pipelineDb<any[]>("publish_queue", `id=in.(${idList(jobs.map((job) => job.queue_id))})&select=id,status,content,article_id,image_url,scheduled_at`)
      : [];
    const queueById = new Map(queueRows.map((row) => [String(row.id), row]));
    const socialRows = jobs.length && (platform === "instagram" || platform === "threads")
      ? await pipelineDb<any[]>("social_publish_queue", `job_id=in.(${idList(jobs.map((job) => job.id))})&platform=eq.${platform}&select=id,job_id,status,content,scheduled_at`)
      : [];
    const socialByJob = new Map(socialRows.map((row) => [String(row.job_id), row]));

    const candidates: Candidate[] = [];
    for (const row of jobs) {
      const queued = queueById.get(String(row.queue_id));
      const master = String(queued?.content || row.draft_content || "");
      const base = {
        row, master,
        articleId: queued?.article_id ? String(queued.article_id) : undefined,
        coverUrl: (queued?.image_url as string | null) || null,
      };
      // 衍生平台的共同前提：FB 主稿必須已經是這一版規則
      const masterStale = !isCurrentRules(row.warnings);
      if (platform === "facebook") {
        if (queued?.status !== "pending") continue;
        candidates.push({
          ...base, dueAt: String(queued.scheduled_at), current: master, stale: masterStale,
          blocked: new Date(queued.scheduled_at).getTime() < cutoff ? "距離發佈時間太近" : "",
        });
        continue;
      }
      if (platform === "website") {
        if (!base.articleId) continue;
        candidates.push({
          ...base, dueAt: String(queued?.scheduled_at || row.scheduled_at), current: master,
          stale: derivedRulesVersion(row.social_results, "website") !== RULES_VERSION,
          blocked: masterStale ? "FB 主稿還是舊規則，請先重寫主稿" : "",
        });
        continue;
      }
      const social = socialByJob.get(String(row.id));
      if (!social || social.status !== "pending") continue;
      candidates.push({
        ...base, socialRowId: String(social.id), dueAt: String(social.scheduled_at),
        current: String(social.content || ""),
        stale: derivedRulesVersion(row.social_results, platform) !== RULES_VERSION,
        blocked: masterStale ? "FB 主稿還是舊規則，請先重寫主稿"
          : new Date(social.scheduled_at).getTime() < cutoff ? "距離發佈時間太近" : "",
      });
    }

    const todo = candidates.filter((item) => item.stale && !item.blocked);

    if (dryRun) {
      const blockedByMaster = candidates.filter((item) => item.blocked.includes("主稿")).length;
      return NextResponse.json({
        success: true, dryRun: true, platform, platformLabel: PLATFORM_LABEL[platform], rulesVersion: RULES_VERSION,
        total: candidates.length, staleCount: todo.length,
        items: candidates.slice(0, 60).map((item) => ({
          jobId: item.row.id, brandName: brandNameOf(item.row.brand_id), scheduledAt: item.dueAt,
          title: headline(item.current), stale: item.stale, blocked: item.blocked,
        })),
        note: blockedByMaster
          ? `有 ${blockedByMaster} 篇的 FB 主稿還是舊規則。衍生稿是從主稿改寫的，請先把主稿重寫完，再回來重寫${PLATFORM_LABEL[platform]}。`
          : todo.length ? `有 ${todo.length} 篇的${PLATFORM_LABEL[platform]}還是舊規則，一次最多 ${limit} 篇。`
          : `已排程的${PLATFORM_LABEL[platform]}都已經是目前這版規則。`,
      });
    }

    const done: Array<{ jobId: string; brandName: string; scheduledAt: string; before: string; after: string; beforeFull: string; afterFull: string; notes: string[] }> = [];
    const skipped: Array<{ jobId: string; reason: string }> = [];
    for (const item of (onlyJobId ? candidates.filter((c) => !c.blocked) : todo).slice(0, limit)) {
      const { row } = item;
      try {
        if (platform === "facebook") {
          const fresh = await pipelineDb<any[]>("publish_queue", `id=eq.${encodeURIComponent(row.queue_id)}&status=eq.pending&select=id,scheduled_at&limit=1`);
          if (!fresh.length) { skipped.push({ jobId: row.id, reason: "排程已不是待發狀態" }); continue; }
          if (new Date(fresh[0].scheduled_at).getTime() < cutoff) { skipped.push({ jobId: row.id, reason: "距離發佈時間太近" }); continue; }

          const history = await recentStyleHistory(String(row.brand_id), String(row.id));
          const generated = await generateFacebookDraft({
            brandId: String(row.brand_id), prompt: String(row.prompt), seed: `${row.id}-reopt`, history, retry: retryOnce,
          });
          if (generated.blockedReason) { skipped.push({ jobId: row.id, reason: `新稿沒通過品管，保留舊稿：${generated.blockedReason}` }); continue; }

          // 標題換了，圖卡也要重做。圖卡失敗沿用舊圖，不影響換稿。
          const card = await makeCardUrl(String(row.brand_id), generated.draft);
          const patch: Record<string, unknown> = { content: generated.draft, updated_at: new Date().toISOString() };
          if (card.url) patch.image_url = card.url;
          const res = await fetch(`${env.url}/rest/v1/publish_queue?id=eq.${encodeURIComponent(row.queue_id)}&status=eq.pending`, {
            method: "PATCH", headers: supabaseHeaders(env.key, { Prefer: "return=representation" }), body: JSON.stringify(patch),
          });
          if (!res.ok) throw new Error(`更新排程文案失敗（${res.status}）`);
          const updated = await res.json();
          if (!Array.isArray(updated) || !updated.length) { skipped.push({ jobId: row.id, reason: "排程在更新前已進入派發" }); continue; }

          const priorReminders = Array.isArray(row.warnings)
            ? row.warnings.filter((w: unknown) => typeof w === "string" && !w.startsWith(RULES_VERSION_PREFIX) && w.startsWith("發文前提醒"))
            : [];
          // 主稿換了，之前跟著舊主稿產生的衍生稿就不同步了，把它們的規則版本清掉，試算時才會被列出來
          const previous = row.social_results && typeof row.social_results === "object" ? { ...(row.social_results as Record<string, unknown>) } : {};
          const hadDerivatives = Boolean(item.articleId) || Boolean((previous as any).instagram) || Boolean((previous as any).threads);
          delete previous.rules_version;
          const notes = [...generated.styleNotes, ...generated.warnNotes, ...generated.fixes.map((fix) => `自動修正：${fix}`),
            hadDerivatives ? "主稿換了，官網、IG、Threads 要再各自重寫一次才會同步。" : ""].filter(Boolean);
          await pipelineDb("auto_pipeline_jobs", `id=eq.${encodeURIComponent(row.id)}`, {
            method: "PATCH",
            body: JSON.stringify({
              draft_content: generated.draft,
              warnings: [rulesVersionNote(), amplifierNote(generated.amplifier), ...priorReminders, ...generated.postReminders, ...notes],
              current_step: `已用 ${RULES_VERSION} 重新優化主稿`,
              social_results: previous, reviewed: false, updated_at: new Date().toISOString(),
            }),
          });
          done.push({
            jobId: row.id, brandName: brandNameOf(row.brand_id), scheduledAt: item.dueAt,
            before: headline(item.current), after: headline(generated.draft),
            beforeFull: item.current, afterFull: generated.draft, notes,
          });
          continue;
        }

        if (!item.master.trim()) { skipped.push({ jobId: row.id, reason: "找不到 FB 主稿，無法改寫" }); continue; }
        let after = "";
        let afterFull = "";
        let beforeFull = item.current;
        const notes: string[] = [];
        if (platform === "website") {
          const written = await rewriteWebsiteArticle({
            env, brandShort: row.brand_id as "nas" | "abl" | "i8", brandName: brandNameOf(row.brand_id),
            master: item.master, coverUrl: item.coverUrl || null, articleId: String(item.articleId),
            funnel: readFunnelFromPrompt(String(row.prompt || "")),
          });
          after = `官網文章已重寫（編號 ${written.articleId}，網址不變）`;
          afterFull = written.article;
          // 官網的「目前內容」欄位放的是 FB 主稿，不是官網舊文，不要當成舊版顯示
          beforeFull = "";
        } else {
          const result = await rewriteSocialPost({
            env, brandShort: row.brand_id as "nas" | "abl" | "i8", master: item.master,
            platform, rowId: String(item.socialRowId),
          });
          after = headline(result.text);
          afterFull = result.text;
          if (result.note) notes.push(result.note);
          if (result.slides) notes.push(`輪播重做 ${result.slides} 張`);
        }

        // 把這個平台的規則版本記進 social_results，不動其他平台的結果
        const previous = row.social_results && typeof row.social_results === "object" ? { ...(row.social_results as Record<string, unknown>) } : {};
        previous.rules_version = { ...((previous.rules_version as Record<string, string>) || {}), [platform]: RULES_VERSION };
        try {
          await pipelineDb("auto_pipeline_jobs", `id=eq.${encodeURIComponent(row.id)}`, {
            method: "PATCH",
            body: JSON.stringify({ social_results: previous, current_step: `已用 ${RULES_VERSION} 重新優化${PLATFORM_LABEL[platform]}`, updated_at: new Date().toISOString() }),
          });
        } catch { notes.push("內容已更新，但規則版本沒記錄成功，下次試算仍會把它列為舊規則"); }

        done.push({
          jobId: row.id, brandName: brandNameOf(row.brand_id), scheduledAt: item.dueAt,
          before: headline(item.current), after, beforeFull, afterFull, notes,
        });
      } catch (error) {
        skipped.push({ jobId: row.id, reason: error instanceof Error ? error.message.slice(0, 200) : "重新優化失敗" });
      }
    }

    return NextResponse.json({
      success: true, platform, platformLabel: PLATFORM_LABEL[platform], rulesVersion: RULES_VERSION,
      processed: done.length, remaining: Math.max(todo.length - done.length, 0), done, skipped,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "重新優化失敗" }, { status: 500 });
  }
}
