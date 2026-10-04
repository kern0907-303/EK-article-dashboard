import { NextRequest, NextResponse } from "next/server";
import { scoreArticle, brandAliasesFor } from "@/lib/seo-rules";
import { healthHash } from "@/lib/seo-optimizer";

/**
 * 自動健檢：只評分、不改寫，而且不呼叫 AI。
 * 用程式規則（src/lib/seo-rules.ts）計分，同一篇文章每次結果一致，也不花任何 AI 費用。
 */
export async function POST(req: NextRequest) {
  try {
    const { content, brandName, keywords, faqText, schemaText } = await req.json();

    if (!content || typeof content !== "string" || content.trim().length < 30) {
      return NextResponse.json({ error: "沒有可評分的文章內容（至少 30 字）" }, { status: 400 });
    }
    if (!brandName) {
      return NextResponse.json({ error: "Missing brandName parameter" }, { status: 400 });
    }

    const kw: string[] = Array.isArray(keywords)
      ? keywords.map((k: any) => (typeof k === "string" ? k : k?.keyword)).filter((k: any) => typeof k === "string" && k.trim())
      : [];
    const report = scoreArticle({
      content,
      keywords: kw,
      brandAliases: brandAliasesFor(brandName),
      faqText: typeof faqText === "string" ? faqText : "",
      schemaText: typeof schemaText === "string" ? schemaText : "",
    });
    return NextResponse.json({
      success: true,
      data: {
        scores: report.scores,
        checks: report.results.map((r) => ({ area: r.area, item: r.item, status: r.status === "ok" ? "ok" : "warn", note: r.note })),
        top_issues: report.topIssues,
        for_hash: healthHash(content, faqText, schemaText),
        at: Date.now(),
        is_local_check: false,
        engine: report.engine,
      },
    });
  } catch (error: any) {
    console.error("API Error in /api/seo/score:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
