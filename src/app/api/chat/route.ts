import { NextRequest, NextResponse } from "next/server";
import { callErickCOO } from "@/lib/ai-provider";

export async function POST(req: NextRequest) {
  try {
    const { history, brandName, aiProvider, stage, expertType, subPrompts, brandGuidelines, prevData, platform } = await req.json();

    if (stage !== "expert" && (!history || !Array.isArray(history))) {
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

    // 呼叫模組化 AI 服務（Erick 營運長）
    const result = await callErickCOO(history || [], brandName, aiProvider, stage, expertType, subPrompts, brandGuidelines, prevData, platform);

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
