// 編輯 AI 擋下之後，自動把被取消的衍生稿重做一次。
//
// 問題：編輯 AI（Paperclip）退稿時會把 IG、Threads 的排程列設成 cancelled，
// 但系統裡沒有任何東西會把它們補回來。結果是 FB 照常發、官網照常上線，
// 只有 IG 和 Threads 永遠空著，要等人自己翻到那張卡片才會發現。
// 2026-11-02 之前已經重複發生好幾次（I8 11/4 那篇就是放了一週沒人知道）。
//
// 做法：每次流水線 tick 先跑一次這個復原流程，一次只處理一篇、只補真正缺的平台。
// 關鍵限制是「每個平台只自動重做一次」，記在 job.social_results.auto_redo 裡。
// 重做完又被編輯 AI 擋下，就不再自動重做，留給待處理中心，讓人去看為什麼一直被擋。
// 否則兩邊會無限互打，把 AI 額度燒光。

import { pipelineDb } from "@/lib/auto-pipeline-server";
import { isMultiplatformEnabled, runMultiplatform } from "@/lib/auto-multiplatform";
import { readFunnelFromPrompt } from "@/data/brands/conversion";

export type RedoPlatform = "instagram" | "threads";

const BRAND_BY_PAGE: Record<string, "nas" | "abl" | "i8"> = { fb_nas: "nas", fb_abl: "abl", fb_i8: "i8" };
const BRAND_NAME = { nas: "平衡空間", abl: "艾伯林量子調頻", i8: "初八企業顧問" } as const;

/** FB 發佈前至少要留這麼多時間，否則來不及補做其他平台（與 backfill 同一個門檻） */
const LEAD_MS = 35 * 60 * 1000;

export interface RedoQueueRow {
  platform?: unknown;
  status?: unknown;
  error?: unknown;
}

/**
 * 判斷一篇任務要自動重做哪些平台。純函式，不碰網路，方便測。
 *
 * 要重做的條件全部成立才算：
 * 1. 這個平台有一列是 cancelled，而且錯誤訊息看得出來是編輯 AI 退的
 * 2. 這個平台沒有任何還活著的列（待發、已發、發送中都算活著），不然會變成重複貼文
 * 3. 這個平台還沒有被自動重做過
 */
export function planRedo(rows: RedoQueueRow[], alreadyRedone: unknown): RedoPlatform[] {
  const done = new Set(
    Array.isArray(alreadyRedone) ? alreadyRedone.map((item) => String(item)) : []
  );
  const out: RedoPlatform[] = [];
  for (const platform of ["instagram", "threads"] as RedoPlatform[]) {
    if (done.has(platform)) continue;
    const mine = rows.filter((row) => String(row.platform ?? "").toLowerCase() === platform);
    const alive = mine.some((row) => String(row.status ?? "") !== "cancelled");
    if (alive) continue;
    const blockedByEditor = mine.some(
      (row) => String(row.status ?? "") === "cancelled" && /編輯 AI/.test(String(row.error ?? ""))
    );
    if (blockedByEditor) out.push(platform);
  }
  return out;
}

/** FB 母稿還來得及補其他平台嗎 */
export function fbStillUsable(status: unknown, scheduledAt: unknown, now = Date.now()): boolean {
  if (String(status ?? "") !== "pending") return false;
  const time = new Date(String(scheduledAt ?? "")).getTime();
  return Number.isFinite(time) && time > now + LEAD_MS;
}

export interface RedoOutcome {
  jobId: string;
  platforms: RedoPlatform[];
  problems: string[];
}

/**
 * 跑一次復原：最多處理一篇任務。
 *
 * 刻意一次只做一篇，理由跟 tick 一次只生成一篇一樣——這段會呼叫 AI，
 * 一次做太多會讓單一請求超時，也會在額度不足時一口氣燒掉一堆重試。
 * 任何一步失敗都只回報、不丟例外，呼叫端（tick）不應該因為復原失敗就停掉主流程。
 */
export async function runAutoRedo(env: { url: string; key: string }): Promise<RedoOutcome | null> {
  if (!isMultiplatformEnabled()) return null;

  // 只看最近兩週被編輯 AI 退掉的，太舊的時段早就過了，補了也沒用
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const cancelled = await pipelineDb<any[]>(
    "social_publish_queue",
    `status=eq.cancelled&scheduled_at=gte.${encodeURIComponent(since)}&order=scheduled_at.asc&limit=100&select=job_id,platform,status,error`
  );
  const jobIds = [...new Set(
    cancelled
      .filter((row) => /編輯 AI/.test(String(row.error ?? "")) && row.job_id)
      .map((row) => String(row.job_id))
  )];
  if (!jobIds.length) return null;

  for (const jobId of jobIds) {
    const jobs = await pipelineDb<any[]>(
      "auto_pipeline_jobs",
      `id=eq.${encodeURIComponent(jobId)}&status=eq.scheduled&select=id,brand_id,prompt,queue_id,social_results&limit=1`
    );
    const job = jobs[0];
    if (!job?.queue_id) continue;

    const rows = await pipelineDb<any[]>(
      "social_publish_queue",
      `job_id=eq.${encodeURIComponent(jobId)}&select=platform,status,error`
    );
    const previous = job.social_results && typeof job.social_results === "object" ? job.social_results : {};
    const platforms = planRedo(rows, previous.auto_redo);
    if (!platforms.length) continue;

    const queueRows = await pipelineDb<any[]>(
      "publish_queue",
      `id=eq.${encodeURIComponent(String(job.queue_id))}&select=id,content,image_url,scheduled_at,status,target_pages&limit=1`
    );
    const master = queueRows[0];
    if (!master || !fbStillUsable(master.status, master.scheduled_at)) continue;

    const brand = BRAND_BY_PAGE[Array.isArray(master.target_pages) ? String(master.target_pages[0] || "") : ""];
    if (!brand) continue;

    const multi = await runMultiplatform({
      env, jobId: String(job.id), brandShort: brand, brandName: BRAND_NAME[brand],
      master: String(master.content || ""), fbScheduledAt: master.scheduled_at,
      fbQueueId: String(master.id), coverUrl: master.image_url || null,
      funnel: readFunnelFromPrompt(String(job.prompt || "")),
      only: platforms,
    });

    const NAME: Record<RedoPlatform, string> = { instagram: "IG", threads: "Threads" };
    const problems = platforms.flatMap((platform) => {
      const outcome = (multi as any)[platform];
      if (!outcome?.ok) return [`${NAME[platform]}：${outcome?.error || "失敗"}`];
      return outcome.error ? [`${NAME[platform]}：${outcome.error}`] : [];
    });

    // 不管成功失敗都記下來，這樣失敗的也不會每個 tick 重試一次
    const merged = {
      ...previous,
      ...Object.fromEntries(platforms.map((platform) => [platform, (multi as any)[platform]])),
      auto_redo: [...new Set([...(Array.isArray(previous.auto_redo) ? previous.auto_redo.map(String) : []), ...platforms])],
    };
    await pipelineDb("auto_pipeline_jobs", `id=eq.${encodeURIComponent(String(job.id))}`, {
      method: "PATCH",
      body: JSON.stringify({
        social_results: merged,
        current_step: problems.length
          ? `編輯 AI 退稿後自動重做衍生稿，仍有問題：${problems.join("；")}`
          : `編輯 AI 退稿後已自動重做 ${platforms.map((platform) => NAME[platform]).join("、")}`,
      }),
    });

    return { jobId: String(job.id), platforms, problems };
  }
  return null;
}
