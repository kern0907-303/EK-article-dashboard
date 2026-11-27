// 重複排程清理的資料庫部分。只給伺服器端使用。
// 規則在 social-dedupe.ts（純函式）；這裡只負責讀列、取消列。
// 只動 status=pending 的列（PATCH 條件帶 status=eq.pending），已發出、發送中的列一律不碰。

import { pipelineDb } from "@/lib/auto-pipeline-server";
import { duplicatesToCancel, DUPLICATE_CANCEL_REASON, type SocialRowLite } from "@/lib/social-dedupe";

const idList = (ids: string[]): string => ids.map((id) => encodeURIComponent(id)).join(",");

export async function cancelDuplicateSocialRows(_env?: unknown): Promise<{ checked: number; cancelled: string[] }> {
  void _env;
  // 往前看 24 小時：排程時間已過但還沒被發出的列，n8n 之後仍可能補發，一樣要清
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const pending = await pipelineDb<SocialRowLite[]>(
    "social_publish_queue",
    `status=eq.pending&scheduled_at=gte.${encodeURIComponent(since)}&order=scheduled_at.asc&limit=1000&select=id,platform,brand,status,job_id,article_id,created_at`,
  );
  if (!pending.length) return { checked: 0, cancelled: [] };
  const jobIds = [...new Set(pending.map((row) => row.job_id).filter((id): id is string => Boolean(id)))];
  const articleIds = [...new Set(pending.map((row) => row.article_id).filter((id): id is string => Boolean(id)))];
  const select = "select=id,platform,brand,status,job_id,article_id,created_at";
  const [byJob, byArticle, jobs] = await Promise.all([
    jobIds.length ? pipelineDb<SocialRowLite[]>("social_publish_queue", `job_id=in.(${idList(jobIds)})&status=neq.cancelled&${select}`) : Promise.resolve([]),
    articleIds.length ? pipelineDb<SocialRowLite[]>("social_publish_queue", `article_id=in.(${idList(articleIds)})&status=neq.cancelled&${select}`) : Promise.resolve([]),
    jobIds.length ? pipelineDb<Array<{ id: string; queue_id: string | null }>>("auto_pipeline_jobs", `id=in.(${idList(jobIds)})&select=id,queue_id`) : Promise.resolve([]),
  ]);
  const queueIds = jobs.map((job) => job.queue_id).filter((id): id is string => Boolean(id));
  const fbRows = queueIds.length
    ? await pipelineDb<Array<{ id: string; article_id: string | null }>>("publish_queue", `id=in.(${idList(queueIds)})&select=id,article_id`)
    : [];
  const articleByQueue = new Map(fbRows.map((row) => [row.id, row.article_id]));
  const fbArticleByJob = Object.fromEntries(jobs.map((job) => [job.id, job.queue_id ? articleByQueue.get(job.queue_id) || null : null]));

  const all = new Map<string, SocialRowLite>();
  for (const row of [...pending, ...byJob, ...byArticle]) all.set(row.id, row);
  const pendingIds = new Set(pending.map((row) => row.id));
  const toCancel = duplicatesToCancel([...all.values()], fbArticleByJob).filter((id) => pendingIds.has(id));

  const cancelled: string[] = [];
  for (const id of toCancel) {
    const rows = await pipelineDb<Array<{ id: string }>>("social_publish_queue", `id=eq.${encodeURIComponent(id)}&status=eq.pending`, {
      method: "PATCH",
      body: JSON.stringify({ status: "cancelled", error: DUPLICATE_CANCEL_REASON, updated_at: new Date().toISOString() }),
    });
    if (rows.length) cancelled.push(id);
  }
  return { checked: all.size, cancelled };
}
