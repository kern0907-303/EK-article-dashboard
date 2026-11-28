import { NextRequest, NextResponse } from "next/server";
import { pipelineDb } from "@/lib/auto-pipeline-server";
import { getSocialMetrics } from "@/lib/social-metrics-server";
import { attributeJob, fbResultsContain, postIdVariants, shortcodeFromUrl, type Attribution, type JobLite } from "@/lib/post-attribution";

export const dynamic = "force-dynamic";

/**
 * 成效回流：用平台貼文代號查回任務、文體、結構型、組別。
 * 登入保護由 src/proxy.ts 統一處理。
 *
 * ?postId=xxx（可加 &platform=facebook|instagram|threads）查單一則。
 * 不帶 postId：拿成效分頁已快取的 n8n social_posts（不額外打 n8n，快取 30 分鐘），逐則對回排程列，
 * 回傳對得上與對不上的筆數，對不上的列出原因。
 */

interface SocialRow { id: string; platform: string; brand: string | null; job_id: string | null; post_url: string | null; result: { postId?: string } | null; sent_at: string | null }
interface FbRow { id: string; brand_id: string; results: unknown; sent_at: string | null }

const LOOKBACK_DAYS = 120;
const idList = (ids: string[]) => ids.map((id) => encodeURIComponent(id)).join(",");

async function loadRows() {
  const since = encodeURIComponent(new Date(Date.now() - LOOKBACK_DAYS * 86400_000).toISOString());
  const [social, fb] = await Promise.all([
    pipelineDb<SocialRow[]>("social_publish_queue", `status=eq.sent&sent_at=gte.${since}&select=id,platform,brand,job_id,post_url,result,sent_at&limit=2000`),
    // FB 多粉專部分成功時狀態是 partial，results 裡仍有成功的貼文代號
    pipelineDb<FbRow[]>("publish_queue", `status=in.(sent,partial)&sent_at=gte.${since}&select=id,brand_id,results,sent_at&limit=2000`),
  ]);
  const fbIds = fb.map((row) => row.id);
  const jobIds = [...new Set(social.map((row) => row.job_id).filter((id): id is string => Boolean(id)))];
  const jobs: JobLite[] = [];
  for (let i = 0; i < jobIds.length; i += 100) {
    jobs.push(...await pipelineDb<JobLite[]>("auto_pipeline_jobs", `id=in.(${idList(jobIds.slice(i, i + 100))})&select=id,brand_id,prompt,warnings,scheduled_at,queue_id`));
  }
  for (let i = 0; i < fbIds.length; i += 100) {
    jobs.push(...await pipelineDb<JobLite[]>("auto_pipeline_jobs", `queue_id=in.(${idList(fbIds.slice(i, i + 100))})&select=id,brand_id,prompt,warnings,scheduled_at,queue_id`));
  }
  const jobById = new Map(jobs.map((job) => [job.id, job]));
  const jobByQueue = new Map(jobs.filter((job) => job.queue_id).map((job) => [String(job.queue_id), job]));
  return { social, fb, jobById, jobByQueue };
}

type Loaded = Awaited<ReturnType<typeof loadRows>>;

function find(loaded: Loaded, postId: string, platform?: string | null, url?: string | null): { source: string; rowId: string; attribution: Attribution } | null {
  const variants = postIdVariants(postId);
  const code = shortcodeFromUrl(url);
  const p = String(platform || "").toLowerCase();
  if (!p || p.includes("threads") || p.includes("instagram") || p === "ig") {
    const row = loaded.social.find((r) => (r.result?.postId && variants.includes(String(r.result.postId)))
      || (code && shortcodeFromUrl(r.post_url) === code));
    if (row) return { source: `social_publish_queue（${row.platform}）`, rowId: row.id, attribution: attributeJob(row.job_id ? loaded.jobById.get(row.job_id) : null) };
  }
  if (!p || p.includes("facebook") || p === "fb") {
    const row = loaded.fb.find((r) => fbResultsContain(r.results, postId));
    if (row) return { source: "publish_queue（facebook）", rowId: row.id, attribution: attributeJob(loaded.jobByQueue.get(row.id)) };
  }
  return null;
}

async function lookupOne(postId: string): Promise<{ source: string; rowId: string; attribution: Attribution } | null> {
  for (const id of postIdVariants(postId)) {
    const social = await pipelineDb<SocialRow[]>("social_publish_queue", `result->>postId=eq.${encodeURIComponent(id)}&select=id,platform,brand,job_id,post_url,result,sent_at&limit=1`);
    if (social[0]) {
      const jobs = social[0].job_id ? await pipelineDb<JobLite[]>("auto_pipeline_jobs", `id=eq.${encodeURIComponent(social[0].job_id)}&select=id,brand_id,prompt,warnings,scheduled_at,queue_id`) : [];
      return { source: `social_publish_queue（${social[0].platform}）`, rowId: social[0].id, attribution: attributeJob(jobs[0]) };
    }
  }
  if (postId.includes("_")) {
    const fb = await pipelineDb<FbRow[]>("publish_queue", `results=cs.${encodeURIComponent(JSON.stringify([{ fbPostId: postId }]))}&select=id,brand_id,results,sent_at&limit=1`);
    if (fb[0]) {
      const jobs = await pipelineDb<JobLite[]>("auto_pipeline_jobs", `queue_id=eq.${encodeURIComponent(fb[0].id)}&select=id,brand_id,prompt,warnings,scheduled_at,queue_id`);
      return { source: "publish_queue（facebook）", rowId: fb[0].id, attribution: attributeJob(jobs[0]) };
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const params = new URL(req.url).searchParams;
    const postId = params.get("postId");
    const loaded = await loadRows();
    if (postId) {
      // 查單一則：直接用貼文代號查，不受 ${LOOKBACK_DAYS} 天與列數上限影響
      const direct = await lookupOne(postId);
      if (direct) return NextResponse.json({ success: true, ...direct });
      const hit = find(loaded, postId, params.get("platform"), params.get("url"));
      if (!hit) return NextResponse.json({ success: false, error: `排程列裡找不到貼文代號 ${postId}（只查最近 ${LOOKBACK_DAYS} 天已發出的）` }, { status: 404 });
      return NextResponse.json({ success: true, ...hit });
    }
    const metrics = await getSocialMetrics(false);
    if (!metrics.ok) return NextResponse.json({ success: false, error: metrics.error }, { status: metrics.status });
    const rows = metrics.data.posts.map((post) => {
      const hit = post.post_id ? find(loaded, post.post_id, post.platform, post.url) : null;
      return { platform: post.platform, account: post.account_label, post_id: post.post_id, url: post.url, published_at: post.published_at, matched: Boolean(hit), ...(hit ? { queueRow: hit.rowId, ...hit.attribution } : {}) };
    });
    const unmatched = rows.filter((row) => !row.matched);
    return NextResponse.json({
      success: true,
      fetchedAt: metrics.fetchedAt,
      total: rows.length,
      matched: rows.length - unmatched.length,
      unmatchedByPlatform: unmatched.reduce<Record<string, number>>((acc, row) => { const k = String(row.platform || "未知"); acc[k] = (acc[k] || 0) + 1; return acc; }, {}),
      rows,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "查詢失敗" }, { status: 500 });
  }
}
