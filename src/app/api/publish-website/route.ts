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

    // 1. 從 Markdown 內文中解析出文章標題
    let title = "未命名文章";
    const titleMatch = content.match(/^#\s+(.+)$/m);
    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1].trim();
    } else {
      // 兜底：取內文前 20 個字去除符號作為標題
      title = content.substring(0, 25).replace(/[#*_\n\r]/g, "").trim();
      if (content.length > 25) title += "...";
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
