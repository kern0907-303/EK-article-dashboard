// 成效回流（2026-11-28）：每一則已發出的貼文，都能查回它的任務、文體、結構型、組別。
//
// 貼文代號存在哪：
// - Facebook：publish_queue.results[].fbPostId（例 165873860149140_1804339348364772），排程列的 id 等於任務的 queue_id。
// - Instagram、Threads：social_publish_queue.result.postId 與 post_url，由 n8n 發文後寫回；排程列帶 job_id。
// 純函式，資料庫查詢在 src/app/api/post-attribution/route.ts。

import { readGenreFromPrompt, GENRES } from "@/data/skills/genres";
import { readFlowStructureNote } from "@/data/skills/flow-structures";
import { readRecipeGroup, readStructureTag, STRUCTURE_UNSPECIFIED, type RecipeGroup } from "@/data/skills/recipe-genres";

export interface JobLite { id: string; brand_id: string; prompt: string | null; warnings?: unknown; scheduled_at?: string | null; queue_id?: string | null }

export interface Attribution {
  jobId: string | null;
  brand: string | null;
  /** 文體名稱；讀不到就是 null（例如手動排程） */
  genre: string | null;
  /** 任務提示詞的【本篇結構型】；舊任務沒寫的一律「未指定」 */
  structureTag: string;
  /** 實際寫出來用的流量結構（任務 warnings 的結構記號），沒有就是 null */
  structureUsed: string | null;
  /** 新配方或對照組；舊任務與手動排程一律對照組 */
  group: RecipeGroup;
  scheduledAt: string | null;
}

export function attributeJob(job: JobLite | null | undefined): Attribution {
  if (!job) return { jobId: null, brand: null, genre: null, structureTag: STRUCTURE_UNSPECIFIED, structureUsed: null, group: "對照組", scheduledAt: null };
  const prompt = String(job.prompt || "");
  const genre = readGenreFromPrompt(prompt);
  return {
    jobId: job.id,
    brand: job.brand_id,
    genre: genre ? GENRES[genre].name : null,
    structureTag: readStructureTag(prompt) || STRUCTURE_UNSPECIFIED,
    structureUsed: readFlowStructureNote(job.warnings),
    group: readRecipeGroup(prompt),
    scheduledAt: job.scheduled_at || null,
  };
}

/** 平台貼文代號的正規化：FB 代號可能帶或不帶粉專前綴（頁面ID_貼文ID），比對時兩種都認 */
export function postIdVariants(postId: string): string[] {
  const id = String(postId || "").trim();
  if (!id) return [];
  const tail = id.includes("_") ? id.split("_").pop() as string : id;
  return [...new Set([id, tail])];
}

/** FB 排程列的 results 裡有沒有這個貼文代號 */
export function fbResultsContain(results: unknown, postId: string): boolean {
  const variants = postIdVariants(postId);
  const list = Array.isArray(results) ? results : [];
  return list.some((item) => {
    const fb = String((item as { fbPostId?: unknown })?.fbPostId || "");
    return fb && postIdVariants(fb).some((v) => variants.includes(v));
  });
}

/** 從 Threads、IG 的貼文網址取出短代碼（/post/XXXX 或 /p/XXXX） */
export function shortcodeFromUrl(url: string | null | undefined): string | null {
  const match = String(url || "").match(/\/(?:post|p|reel)\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}
