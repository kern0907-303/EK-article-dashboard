import { NextRequest, NextResponse } from "next/server";
import { callErickCOO } from "@/lib/ai-provider";
import { isGuardBrandKey, scanChatPayload, describeMismatch, GUARD_BRAND_LABEL } from "@/lib/brand-guard";
import { getStoryArgumentSelectionError, type StoryArgumentSelection } from "@/data/skills/story-argument";

export async function POST(req: NextRequest) {
  try {
    const { history, brandName, aiProvider, stage, expertType, subPrompts, brandGuidelines, prevData, platform, copywritingFramework, genre, storyArgument, storyReselection, brandKey, confirmBrandMismatch } = await req.json();

    const storySelectionError = getStoryArgumentSelectionError(storyArgument as StoryArgumentSelection | undefined);
    if (storySelectionError) {
      return NextResponse.json({ error: storySelectionError, code: "STORY_ARGUMENT_SELECTION_REQUIRED" }, { status: 400 });
    }

    if (stage !== "expert" && stage !== "adapt" && (!history || !Array.isArray(history))) {
      return NextResponse.json(
        { error: "Invalid or missing history payload" },
        { status: 400 }
      );
    }

    if (!brandName) {
      return NextResponse.json(
        { error: "Missing brandName parameter" },
        { status: 400 }
      );
    }

    // 品牌錯置檢查：內容明顯在講另一個品牌時先擋下（前端會跳確認視窗，確認後帶 confirmBrandMismatch 重送）
    if (confirmBrandMismatch !== true && isGuardBrandKey(brandKey)) {
      const mismatch = scanChatPayload({ history, subPrompts, genre, prevData }, brandKey);
      if (mismatch) {
        return NextResponse.json(
          {
            error: `品牌可能搞錯了：${describeMismatch(mismatch)}請確認後再生成。`,
            code: "BRAND_MISMATCH",
            mismatch,
            currentBrand: GUARD_BRAND_LABEL[brandKey],
          },
          { status: 409 }
        );
      }
    }

    // 呼叫模組化 AI 服務（Erick 營運長）
    const result = await callErickCOO(history || [], brandName, aiProvider, stage, expertType, subPrompts, brandGuidelines, prevData, platform, copywritingFramework, genre, storyArgument, storyReselection);

    return NextResponse.json({
      content: result.content,
      dispatchData: result.dispatchData || null
    });
  } catch (error: any) {
    console.error("API Error in /api/chat:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
