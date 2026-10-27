import { NextRequest, NextResponse } from "next/server";
import { AUTO_PIPELINE_ENABLED } from "@/lib/auto-pipeline";
import { getSupabaseEnv } from "@/lib/publish-queue";
import { pipelineDb } from "@/lib/auto-pipeline-server";
import { rewriteWebsiteArticle } from "@/lib/auto-multiplatform";
import { brandSubjectHits } from "@/lib/quality-gate";

// 修正「品牌當主詞發言」的官網文章（2026-10-20 之後建立的）：
// 1. 有 FB 排程連到它的：用新規則在原文章位置重寫（article_id 與網址不變）。
// 2. 沒有 FB 排程連到、但同品牌 5 分鐘內有另一篇有連結的（補齊時重複產生的）：改為草稿（下架，不刪除）。
// 3. 其餘不動，只在結果裡列出。
// 需要登入。dryRun=true 只列清單；每次最多重寫 limit 篇（預設 1）。
export const maxDuration = 300;

const BRANDS = { nas: "平衡空間", abl: "艾伯林量子調頻", i8: "初八企業顧問" } as const;
const SINCE = "2026-10-20T00:00:00Z";

export async function POST(req: NextRequest) {
  if (!AUTO_PIPELINE_ENABLED) return NextResponse.json({ error: "自動流水線尚未啟用" }, { status: 404 });
  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dryRun === true;
    const limit = Math.min(Math.max(Number(body?.limit) || 1, 1), 2);
    const env = getSupabaseEnv();
    if (!env) return NextResponse.json({ error: "後台未設定 Supabase 連線資訊" }, { status: 500 });

    const rewrite: Array<{ id: string; brand: keyof typeof BRANDS; title: string; master: string; cover: string | null }> = [];
    const retire: Array<{ id: string; brand: string; title: string }> = [];
    const leftAlone: Array<{ id: string; brand: string; title: string; reason: string }> = [];

    for (const brand of Object.keys(BRANDS) as Array<keyof typeof BRANDS>) {
      const articles = await pipelineDb<any[]>("insights_articles", `brand_id=eq.${brand}&created_at=gte.${encodeURIComponent(SINCE)}&order=created_at.desc&limit=100&select=id,title,content,status,created_at`);
      const linkedIds = new Map<string, any>();
      for (const article of articles) {
        const queued = await pipelineDb<any[]>("publish_queue", `article_id=eq.${encodeURIComponent(String(article.id))}&select=id,content,image_url&limit=1`);
        if (queued[0]) linkedIds.set(String(article.id), queued[0]);
      }
      for (const article of articles) {
        if (article.status !== "published") continue;
        if (!brandSubjectHits(`${article.title}\n${article.content}`).length) continue;
        const id = String(article.id);
        const linked = linkedIds.get(id);
        if (linked) { rewrite.push({ id, brand, title: article.title, master: String(linked.content || ""), cover: linked.image_url || null }); continue; }
        const t = new Date(article.created_at).getTime();
        const twin = articles.find((other) => String(other.id) !== id && linkedIds.has(String(other.id)) && Math.abs(new Date(other.created_at).getTime() - t) <= 5 * 60 * 1000);
        if (twin) retire.push({ id, brand, title: article.title });
        else leftAlone.push({ id, brand, title: article.title, reason: "沒有排程連到它，也找不到同時間的重複篇，不自動處理" });
      }
    }

    if (dryRun) return NextResponse.json({ success: true, dryRun: true, rewrite: rewrite.map(({ master: _m, cover: _c, ...rest }) => rest), retire, leftAlone });

    const retired: string[] = [];
    for (const item of retire) {
      await pipelineDb("insights_articles", `id=eq.${encodeURIComponent(item.id)}`, { method: "PATCH", body: JSON.stringify({ status: "draft" }) });
      retired.push(item.id);
    }
    const rewritten: Array<{ id: string; ok: boolean; error?: string }> = [];
    for (const item of rewrite.slice(0, limit)) {
      try {
        await rewriteWebsiteArticle({ env, articleId: item.id, brandShort: item.brand, brandName: BRANDS[item.brand], master: item.master, coverUrl: item.cover });
        rewritten.push({ id: item.id, ok: true });
      } catch (error) {
        rewritten.push({ id: item.id, ok: false, error: (error instanceof Error ? error.message : String(error)).slice(0, 200) });
      }
    }
    return NextResponse.json({ success: true, retired, rewritten, remaining: Math.max(rewrite.length - limit, 0), leftAlone });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "修正失敗" }, { status: 500 });
  }
}
