import { NextRequest, NextResponse } from "next/server";
import { callSeoOptimizer } from "@/lib/ai-provider";
import { checkText, resolveBrandContext } from "@/lib/brand-guardrail";
import { stripMarkdown } from "@/lib/plain-text";
import { extractProtected, restoreProtected } from "@/lib/protect-blocks";
import { scoreArticle, brandAliasesFor } from "@/lib/seo-rules";
import { faqToPlainText, buildFaqJsonLd } from "@/lib/seo-optimizer";

export async function POST(req: NextRequest) {
  try {
    const { content, brandId, brandName, keywords, aiProvider, faqText, schemaText } = await req.json();

    if (!content || typeof content !== "string" || content.trim().length < 30) {
      return NextResponse.json({ error: "沒有可優化的文章內容（至少 30 字）" }, { status: 400 });
    }
    if (!brandName) {
      return NextResponse.json({ error: "Missing brandName parameter" }, { status: 400 });
    }

    // 原文裡的圖表（Mermaid）與圖片先換成佔位標記，優化完再原樣放回，避免圖文在優化後消失
    const prot = extractProtected(content);
    const result = await callSeoOptimizer(prot.text, brandName, keywords || [], aiProvider);

    // 一律清成純文字，並以品牌紅線再檢查一次優化後的全文與 FAQ
    const optimized = stripMarkdown(result.optimized_content);
    const faq = result.faq.map((f) => ({ q: stripMarkdown(f.q), a: stripMarkdown(f.a) }));
    const context = resolveBrandContext(brandId || "");
    const violations = Array.from(
      new Set([
        ...checkText(optimized, context).violatedWords,
        ...checkText(faq.map((f) => `${f.q}${f.a}`).join("\n"), context).violatedWords,
        ...checkText(`${result.title}${result.meta_description}`, context).violatedWords,
      ])
    );

    // 分數一律用程式規則算，不採用 AI 自己打的分數：原文與優化後用同一把尺，才有「改前改後」可比
    const restored = restoreProtected(optimized, prot);
    const kw: string[] = (keywords || []).map((k: any) => (typeof k === "string" ? k : k?.keyword)).filter(Boolean);
    const aliases = brandAliasesFor(brandName);
    const before = scoreArticle({ content, keywords: kw, brandAliases: aliases, faqText, schemaText });
    const after = scoreArticle({
      content: restored,
      keywords: kw,
      brandAliases: aliases,
      faqText: faq.length ? faqToPlainText(faq) : "",
      schemaText: faq.length ? buildFaqJsonLd(faq, result.title, result.meta_description) : "",
    });

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        scores: after.scores,
        scores_before: before.scores,
        checks: after.results.map((r) => ({ area: r.area, item: r.item, status: r.status === "ok" ? "ok" : "warn", note: r.note })),
        title: stripMarkdown(result.title),
        meta_description: stripMarkdown(result.meta_description),
        optimized_content: restored,
        faq,
        guardrail_violations: violations,
      },
    });
  } catch (error: any) {
    console.error("API Error in /api/seo/optimize:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
