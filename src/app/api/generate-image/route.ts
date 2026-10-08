import { NextRequest, NextResponse } from "next/server";
import { brandKeyFromId } from "@/data/skills/genres";
import { buildImagePrompt, generateImageBuffer, toInstagramJpeg, uploadPublicJpeg } from "@/lib/social-image-server";

export const dynamic = "force-dynamic";

/**
 * 依文章內容生成 Instagram 配圖（情境圖，圖上不放字），存到公開儲存桶並回傳網址。
 * 登入保護由 src/proxy.ts 統一處理。這個動作會用到 OpenAI 額度，所以只在使用者按下「生成配圖」時才呼叫。
 */
export async function POST(req: NextRequest) {
  try {
    const { brandId, content } = await req.json();
    const article = typeof content === "string" ? content.trim() : "";
    if (!brandId || !article) {
      return NextResponse.json({ error: "缺少 brandId 或文章內容" }, { status: 400 });
    }
    const brand = brandKeyFromId(String(brandId));
    if (brand === "erick") {
      return NextResponse.json({ error: "Erick 個人品牌沒有串接 Instagram 帳號，請切換到 ABL、NAS 或 I8" }, { status: 400 });
    }

    const prompt = await buildImagePrompt(article, brand);
    const { buffer, model } = await generateImageBuffer(prompt);
    const jpeg = await toInstagramJpeg(buffer);
    const imageUrl = await uploadPublicJpeg(jpeg, brand);

    return NextResponse.json({ success: true, imageUrl, prompt, model });
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : "生成配圖失敗";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
