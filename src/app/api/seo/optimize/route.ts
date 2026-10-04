import { NextRequest, NextResponse } from "next/server";
import { callSeoOptimizer } from "@/lib/ai-provider";
import { checkText, resolveBrandContext } from "@/lib/brand-guardrail";
import { stripMarkdown } from "@/lib/plain-text";
import { extractProtected, restoreProtected } from "@/lib/protect-blocks";

export async function POST(req: NextRequest) {
  try {
    const { content, brandId, brandName, keywords, aiProvider } = await req.json();

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

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        title: stripMarkdown(result.title),
        meta_description: stripMarkdown(result.meta_description),
        optimized_content: restoreProtected(optimized, prot),
        faq,
        guardrail_violations: violations,
      },
    });
  } catch (error: any) {
    console.error("API Error in /api/seo/optimize:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
