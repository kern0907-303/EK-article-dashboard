import { NextRequest, NextResponse } from "next/server";
import { callTheoAnalysis } from "@/lib/ai-provider";

export async function POST(req: NextRequest) {
  try {
    const { content, brandName, aiProvider, platform } = await req.json();

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "Invalid or missing content payload" },
        { status: 400 }
      );
    }

    if (!brandName) {
      return NextResponse.json(
        { error: "Missing brandName parameter" },
        { status: 400 }
      );
    }

    // Call the AI analysis provider
    const analysis = await callTheoAnalysis(content, brandName, aiProvider, platform);

    return NextResponse.json({
      success: true,
      data: analysis
    });
  } catch (error: any) {
    console.error("API Error in /api/theo/analyze:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
