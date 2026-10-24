import { pipelineDb } from "@/lib/auto-pipeline-server";
import { publishedWebsiteBrands, websiteArticleId } from "@/lib/pipeline-website-status";

export type CellState = "sent" | "pending" | "failed" | "none" | "cancelled" | "na";
export interface TimelineCell { state: CellState; label: string; at: string | null }
export interface TimelineRow {
  id: string;
  brand: string;
  title: string;
  scheduledAt: string | null;
  jobStatus: string;
  reviewed: boolean;
  note: string | null;
  needsYou: boolean;
  fb: TimelineCell;
  website: TimelineCell;
  instagram: TimelineCell;
  threads: TimelineCell;
}

const HOUR = 60 * 60 * 1000;

async function safe<T>(table: string, query: string): Promise<T[]> {
  try { return await pipelineDb<T[]>(table, query); } catch { return []; }
}
const brandOf = (value: unknown) => {
  const text = String(value ?? "").toLowerCase();
  return text.includes("nas") ? "nas" : text.includes("abl") ? "abl" : text.includes("i8") ? "i8" : "erick";
};
function titleOf(draft: unknown, prompt: unknown): string {
  const text = String(draft || prompt || "").split(/\r?\n/).map((line) => line.trim()).find(Boolean) || "（尚未生成）";
  return text.length > 40 ? `${text.slice(0, 40)}…` : text;
}
function hm(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + 8 * HOUR);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}
function fromQueueStatus(status: string | undefined, at: string | null, labels: { pending: string }): TimelineCell {
  if (status === "sent") return { state: "sent", label: "已發佈", at };
  if (status === "pending" || status === "sending") return { state: "pending", label: `${labels.pending} ${hm(at)}`.trim(), at };
  if (status === "failed" || status === "partial") return { state: "failed", label: "失敗", at };
  if (status === "cancelled") return { state: "cancelled", label: "已取消", at };
  return { state: "none", label: "尚無草稿", at: null };
}

/** 只讀：把每個流水線任務在 FB、官網、IG、Threads 的狀態併成一列。 */
export async function collectTimeline(): Promise<TimelineRow[]> {
  const since = encodeURIComponent(new Date(Date.now() - 36 * HOUR).toISOString());
  const jobs = await safe<any>("auto_pipeline_jobs", `scheduled_at=gte.${since}&status=in.(pending,generating,optimizing,scheduled,manual,failed)&order=scheduled_at.asc&limit=200&select=id,brand_id,scheduled_at,status,queue_id,draft_content,prompt,reviewed,current_step,error_reason,social_results`)
    .then((rows) => rows.length ? rows : safe<any>("auto_pipeline_jobs", `scheduled_at=gte.${since}&status=in.(pending,generating,optimizing,scheduled,manual,failed)&order=scheduled_at.asc&limit=200&select=id,brand_id,scheduled_at,status,queue_id,draft_content,prompt,reviewed,current_step,error_reason`));
  if (!jobs.length) return [];

  const queueIds = [...new Set(jobs.map((job: any) => job.queue_id).filter(Boolean))];
  const jobIds = jobs.map((job: any) => job.id);
  const [fbRows, socialRows] = await Promise.all([
    queueIds.length ? safe<any>("publish_queue", `id=in.(${queueIds.join(",")})&select=id,status,scheduled_at,article_id,error`) : Promise.resolve([]),
    safe<any>("social_publish_queue", `job_id=in.(${jobIds.join(",")})&status=neq.cancelled&select=id,job_id,platform,status,scheduled_at,error`),
  ]);
  const fbById = new Map<string, any>(fbRows.map((row: any) => [row.id, row]));
  const publishedWebsites = await publishedWebsiteBrands(jobs.map((job: any) => websiteArticleId(job.social_results?.website)).filter((id: string | null): id is string => !!id));
  const socialByJob = new Map<string, any[]>();
  for (const row of socialRows) socialByJob.set(row.job_id, [...(socialByJob.get(row.job_id) || []), row]);

  return jobs.map((job: any): TimelineRow => {
    const brand = brandOf(job.brand_id);
    const fbRow = job.queue_id ? fbById.get(job.queue_id) : undefined;
    const socials = socialByJob.get(job.id) || [];
    const results = (job.social_results && typeof job.social_results === "object") ? job.social_results as Record<string, any> : {};
    const pick = (platform: string) => socials.filter((row) => row.platform === platform).sort((a, b) => String(b.scheduled_at).localeCompare(String(a.scheduled_at)))[0];

    let fb: TimelineCell;
    if (brand === "erick") fb = { state: "pending", label: "需手動發佈", at: job.scheduled_at };
    else if (fbRow) fb = fromQueueStatus(fbRow.status, fbRow.scheduled_at, { pending: "排程中" });
    else if (job.status === "manual") fb = { state: "failed", label: "待人工處理", at: job.scheduled_at };
    else if (["pending", "generating", "optimizing"].includes(job.status)) fb = { state: "pending", label: "生成中", at: job.scheduled_at };
    else fb = { state: "none", label: "未排程", at: null };

    let website: TimelineCell;
    if (brand === "erick") website = { state: "na", label: "不適用", at: null };
    else if (fbRow?.article_id || results.website?.ok || (websiteArticleId(results.website) && brandOf(publishedWebsites.get(websiteArticleId(results.website)!)) === brand)) website = { state: "sent", label: "已上線", at: null };
    else if (results.website?.ok === false) website = { state: "failed", label: "失敗", at: null };
    else website = { state: "none", label: "尚無草稿", at: null };

    const social = (platform: string): TimelineCell => {
      if (brand === "erick") return { state: "na", label: "不適用", at: null };
      const row = pick(platform);
      if (row) return fromQueueStatus(row.status, row.scheduled_at, { pending: "排程中" });
      if (results[platform]?.ok === false) return { state: "failed", label: "失敗", at: null };
      return { state: "none", label: "尚無草稿", at: null };
    };
    const instagram = social("instagram");
    const threads = social("threads");

    const cells = [fb, website, instagram, threads];
    const failed = cells.some((cell) => cell.state === "failed");
    const missing = brand !== "erick" && job.status === "scheduled" && cells.some((cell) => cell.state === "none");
    const unreviewed = job.status === "scheduled" && !job.reviewed && job.scheduled_at && new Date(job.scheduled_at).getTime() - Date.now() < 48 * HOUR && new Date(job.scheduled_at).getTime() > Date.now();
    const note = failed ? "有平台失敗" : missing ? "有平台還沒補草稿" : unreviewed ? "還沒審稿" : job.status === "manual" ? String(job.error_reason || "待人工處理").slice(0, 60) : null;
    return {
      id: job.id, brand, title: titleOf(job.draft_content, job.prompt), scheduledAt: job.scheduled_at, jobStatus: job.status,
      reviewed: !!job.reviewed, note, needsYou: failed || missing || !!unreviewed || job.status === "manual",
      fb, website, instagram, threads,
    };
  });
}
