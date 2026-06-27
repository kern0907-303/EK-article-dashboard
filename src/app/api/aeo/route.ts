import { NextRequest, NextResponse } from "next/server";
import { generateAEOData } from "@/lib/ai-provider";

export async function POST(req: NextRequest) {
  try {
    const { brandName, keywords, aiProvider } = await req.json();

    if (!brandName) {
      return NextResponse.json(
        { error: "Missing brandName parameter" },
        { status: 400 }
      );
    }

    const result = await generateAEOData(brandName, keywords || [], aiProvider);

    return NextResponse.json({
      schemaMarkup: result.schemaMarkup || "",
      aeoFaq: result.aeoFaq || ""
    });
  } catch (error: any) {
    console.error("API Error in /api/aeo:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
