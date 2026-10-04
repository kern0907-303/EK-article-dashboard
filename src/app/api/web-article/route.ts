import { NextRequest, NextResponse } from "next/server";
import { callWebArticle } from "@/lib/ai-provider";
import { checkText, resolveBrandContext } from "@/lib/brand-guardrail";
import { stripMarkdown } from "@/lib/plain-text";
import { extractProtected, restoreProtected } from "@/lib/protect-blocks";
import { dropHashtagLines } from "@/lib/web-article";

/** 由社群貼文產生官網文章（按鈕觸發，不會自動執行） */
export async function POST(req: NextRequest) {
  try {
    const { socialCopy, brandId, brandName, keywords, brandGuidelines, aiProvider } = await req.json();

    if (!socialCopy || typeof socialCopy !== "string" || socialCopy.trim().length < 30) {
      return NextResponse.json({ error: "沒有足夠的社群文案可以改寫成官網文章（至少 30 字）" }, { status: 400 });
    }
    if (!brandName) {
      return NextResponse.json({ error: "Missing brandName parameter" }, { status: 400 });
    }

    // 圖表與圖片先換成佔位標記，產生完再原樣放回
    const prot = extractProtected(socialCopy);
    const result = await callWebArticle(prot.text, brandName, keywords || [], brandGuidelines, aiProvider);

    const cleaned = stripMarkdown(dropHashtagLines(result.article));
    const context = resolveBrandContext(brandId || "");
    const violations = checkText(cleaned, context).violatedWords;

    return NextResponse.json({
      success: true,
      data: {
        article: restoreProtected(cleaned, prot),
        is_local_check: result.is_local_check,
        guardrail_violations: violations,
      },
    });
  } catch (error: any) {
    console.error("API Error in /api/web-article:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
