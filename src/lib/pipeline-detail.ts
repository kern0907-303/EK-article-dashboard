import { pipelineDb } from "@/lib/auto-pipeline-server";

export interface PlatformDetail {
  exists: boolean;
  status: string;
  title?: string;
  text: string;
  scheduledAt: string | null;
  slides?: number;
  error?: string | null;
  limit?: number;
  queueRowId?: string;
}
export interface PipelineDetail {
  jobId: string;
  brand: string;
  scheduledAt: string | null;
  fbQueueId: string | null;
  fb: PlatformDetail;
  website: PlatformDetail;
  instagram: PlatformDetail;
  threads: PlatformDetail;
}

const empty = (limit?: number): PlatformDetail => ({ exists: false, status: "none", text: "", scheduledAt: null, ...(limit ? { limit } : {}) });
async function safe<T>(table: string, query: string): Promise<T[]> {
  try { return await pipelineDb<T[]>(table, query); } catch { return []; }
}

/** 只讀：單一流水線任務在四個平台的完整內容與狀態。 */
export async function collectDetail(jobId: string): Promise<PipelineDetail | null> {
  const jobs = await safe<any>("auto_pipeline_jobs", `id=eq.${encodeURIComponent(jobId)}&select=id,brand_id,scheduled_at,queue_id,draft_content,prompt&limit=1`);
  const job = jobs[0];
  if (!job) return null;
  const fbRows = job.queue_id ? await safe<any>("publish_queue", `id=eq.${encodeURIComponent(job.queue_id)}&select=id,status,scheduled_at,article_id,content,error&limit=1`) : [];
  const fbRow = fbRows[0];
  const social = await safe<any>("social_publish_queue", `job_id=eq.${encodeURIComponent(jobId)}&status=neq.cancelled&select=id,platform,status,content,image_urls,scheduled_at,error&order=scheduled_at.desc`);
  const articles = fbRow?.article_id ? await safe<any>("insights_articles", `id=eq.${encodeURIComponent(String(fbRow.article_id))}&select=id,title,content,status&limit=1`) : [];
  const article = articles[0];

  // 上次生成失敗的原因（social_results 欄位不存在或沒有紀錄就略過）
  const resultRows = await safe<any>("auto_pipeline_jobs", `id=eq.${encodeURIComponent(jobId)}&select=social_results&limit=1`);
  const results = resultRows[0]?.social_results && typeof resultRows[0].social_results === "object" ? resultRows[0].social_results : {};
  const lastError = (key: string): string | null => (results[key] && results[key].ok === false && results[key].error ? String(results[key].error) : null);
  const emptyWith = (key: string, limit?: number): PlatformDetail => ({ ...empty(limit), error: lastError(key) });

  const fromSocial = (platform: string, limit: number): PlatformDetail => {
    const row = social.find((item) => item.platform === platform);
    if (!row) return emptyWith(platform, limit);
    return {
      exists: true, status: row.status, text: String(row.content || ""), scheduledAt: row.scheduled_at, error: row.error || null, limit,
      slides: Array.isArray(row.image_urls) ? row.image_urls.length : undefined, queueRowId: row.id,
    };
  };
  return {
    jobId, brand: String(job.brand_id), scheduledAt: job.scheduled_at, fbQueueId: job.queue_id || null,
    fb: fbRow ? { exists: true, status: fbRow.status, text: String(fbRow.content || job.draft_content || ""), scheduledAt: fbRow.scheduled_at, error: fbRow.error || null, queueRowId: fbRow.id }
      : { exists: !!job.draft_content, status: "draft", text: String(job.draft_content || ""), scheduledAt: job.scheduled_at },
    website: article ? { exists: true, status: article.status, title: article.title, text: String(article.content || ""), scheduledAt: fbRow?.scheduled_at || null } : emptyWith("website"),
    instagram: fromSocial("instagram", 2200),
    threads: fromSocial("threads", 500),
  };
}
