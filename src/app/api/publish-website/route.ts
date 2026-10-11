import { NextRequest, NextResponse } from "next/server";
import { inspectForPublish } from "@/lib/brand-guardrail";
import { articleUpdateUrl, existingArticleQuery, pickExistingId } from "@/lib/publish-dedupe";
import { publicImagePrefix } from "@/lib/social-image-server";
import { withCoverImage } from "@/lib/article-image.mjs";

export async function POST(req: NextRequest) {
  try {
    const { brandId, brandName, content: rawContent, aeoSchema, aeoFaq, force, promptVersion, modelVersion, imageUrl } = await req.json();
    let content = rawContent;

    if (!brandId || !content) {
      return NextResponse.json(
        { error: "Missing brandId or content" },
        { status: 400 }
      );
    }

    // I8 的對外內容紅線不可由前端 force 略過；其他品牌沿用既有覆核流程。
    const guardrail = inspectForPublish(content, brandId);
    if (!guardrail.passed && (!force || guardrail.context === "I8")) {
      return NextResponse.json(
        {
          error: "品牌紅線檢查未通過",
          blocked: true,
          violatedWords: guardrail.violatedWords,
          context: guardrail.context,
          suggestion: guardrail.suggestion,
        },
        { status: 422 }
      );
    }

    // 配圖：放在標題正下方，官網會把文章裡第一張圖當封面與社群分享圖。只接受自己儲存桶的圖。
    if (typeof imageUrl === "string" && imageUrl) {
      const prefix = publicImagePrefix();
      if (!prefix || !imageUrl.startsWith(prefix)) {
        return NextResponse.json({ error: "配圖必須是儀表板生成的圖片，請重新生成配圖" }, { status: 400 });
      }
      content = withCoverImage(content, imageUrl);
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
    const baseRow: Record<string, unknown> = {
      brand_id: finalBrandId,
      title: title,
      content: content,
      aeo_schema: aeoSchema || "",
      aeo_faq: aeoFaq || "",
      status: "published" // 預設直接上架
    };
    // 同品牌、同標題已經有一筆就更新那一筆，避免按兩次發佈就出現兩篇一模一樣的文章。
    // 查詢失敗時退回原本的新增行為，不讓去重檢查擋住發佈。
    let existingId: string | null = null;
    try {
      const existing = await fetch(existingArticleQuery(supabaseUrl, finalBrandId, title), {
        headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}` },
      });
      existingId = existing.ok ? pickExistingId(await existing.json()) : null;
    } catch {
      existingId = null;
    }

    const insertRow = async (row: Record<string, unknown>) =>
      fetch(existingId ? articleUpdateUrl(supabaseUrl, existingId) : `${supabaseUrl}/rest/v1/insights_articles`, {
        method: existingId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
          "Prefer": "return=representation"
        },
        body: JSON.stringify(row)
      });

    // 文體生成的文章會帶 prompt_version / model_version，之後可回頭比較哪一版提示詞寫得比較好。
    // 資料表還沒新增這兩個欄位時，自動退回不帶版本欄位的寫入，避免整個發佈失敗。
    let response: Response;
    if (promptVersion || modelVersion) {
      response = await insertRow({ ...baseRow, prompt_version: promptVersion || null, model_version: modelVersion || null });
      if (!response.ok && response.status === 400) {
        const t = await response.clone().text();
        if (/prompt_version|model_version|column/i.test(t)) {
          console.warn("[publish-website] insights_articles 尚未有版本欄位，改為不帶版本寫入：", t.slice(0, 200));
          response = await insertRow(baseRow);
        }
      }
    } else {
      response = await insertRow(baseRow);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Supabase API responded with status ${response.status}: ${errorText}`);
    }

    const responseData = await response.json();

    return NextResponse.json({
      success: true,
      updated: Boolean(existingId),
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
