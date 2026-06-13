import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { brandId, brandName, content, aeoSchema, aeoFaq } = await req.json();

    if (!brandId || !content) {
      return NextResponse.json(
        { error: "Missing brandId or content" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: "後台環境變數中未配置 Supabase 連線資訊 (NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY)" },
        { status: 400 }
      );
    }

    // 1. 從 Markdown / 純文字內文中解析出完整且聳動的文章標題
    let title = "未命名文章";
    const lines = content.split(/\r?\n/).map((line: string) => line.trim()).filter((line: string) => line.length > 0);
    if (lines.length > 0) {
      const firstLine = lines[0];
      if (firstLine.startsWith("# ")) {
        title = firstLine.slice(2).trim();
      } else {
        // 如果沒有 # 標題標籤，將第一個非空行直接視為文章主標題
        title = firstLine.replace(/[#*_]/g, "").trim();
      }
    }

    // 對應的品牌 ID 欄位寫入對應的短名
    let finalBrandId = "erick";
    if (brandId.includes("i8")) finalBrandId = "i8";
    else if (brandId.includes("nas")) finalBrandId = "nas";
    else if (brandId.includes("abl")) finalBrandId = "abl";

    // 2. 透過 PostgREST API 直接發送 POST 請求寫入 Supabase 資料庫
    const response = await fetch(`${supabaseUrl}/rest/v1/insights_articles`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Prefer": "return=representation"
      },
      body: JSON.stringify({
        brand_id: finalBrandId,
        title: title,
        content: content,
        aeo_schema: aeoSchema || "",
        aeo_faq: aeoFaq || "",
        status: "published" // 預設直接上架
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Supabase API responded with status ${response.status}: ${errorText}`);
    }

    const responseData = await response.json();

    return NextResponse.json({
      success: true,
      data: responseData
    });
  } catch (error: any) {
    console.error("Error in /api/publish-website:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
