import { NextRequest, NextResponse } from "next/server";
import { inspectForPublish } from "@/lib/brand-guardrail";

/**
 * 純檢查端點：只回報紅線結果，不做任何發布動作。
 *
 * 存在理由：/api/publish 與 /api/publish-website 會順便檢查，但那兩支
 * 檢查完就會真的送出去。n8n 的「情報包轉文案」流程需要在生成之後、
 * 寫入草稿之前先驗一次，這時還不該發布任何東西。
 *
 * 規則來源與發布路徑完全相同（src/lib/brand-guardrail.ts），
 * 不會出現兩套標準。
 */
export async function POST(req: NextRequest) {
  try {
    const { content, brandId } = await req.json();

    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "缺少 content" }, { status: 400 });
    }
    if (!brandId || typeof brandId !== "string") {
      return NextResponse.json({ error: "缺少 brandId" }, { status: 400 });
    }

    const result = inspectForPublish(content, brandId);

    return NextResponse.json({
      success: true,
      passed: result.passed,
      context: result.context,
      violatedWords: result.violatedWords,
      suggestion: result.suggestion,
    });
  } catch (error: any) {
    console.error("Error in /api/guardrail/check:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
