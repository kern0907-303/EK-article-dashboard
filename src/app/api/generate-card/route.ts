import { NextRequest, NextResponse } from "next/server";
import { brandKeyFromId } from "@/data/skills/genres";
import { cardHeadline } from "@/lib/article-image.mjs";
import { CAROUSEL_LIMITS, CAROUSEL_MIN, sanitizeSlides } from "@/lib/carousel-slides.mjs";
import { CARD_SIZES, DEFAULT_CARD_SIZE } from "@/lib/card-layout.mjs";
import { renderCardJpeg } from "@/lib/card-render-server";
import { uploadPublicJpeg } from "@/lib/social-image-server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * 依文章標題做一張品牌樣式的文字圖卡（色底、有品牌標誌、字在圖上），存到公開儲存桶並回傳網址。
 * 不呼叫 AI、不花額度，按下按鈕才執行。登入保護由 src/proxy.ts 統一處理。
 */
export async function POST(req: NextRequest) {
  try {
    const { brandId, content, size, text: overrideText, slides: rawSlides } = await req.json();
    // 輪播：一次把每張文字做成圖卡（同一種版型，右下角顯示 1 / N），回傳整組網址
    if (Array.isArray(rawSlides)) {
      if (!brandId) return NextResponse.json({ error: "缺少 brandId" }, { status: 400 });
      const slides = sanitizeSlides(rawSlides, CAROUSEL_LIMITS.instagram);
      if (slides.length < CAROUSEL_MIN) return NextResponse.json({ error: `輪播至少要 ${CAROUSEL_MIN} 張有文字的圖卡` }, { status: 400 });
      const slideSize = typeof size === "string" && size in CARD_SIZES ? size : DEFAULT_CARD_SIZE;
      const urls: string[] = [];
      for (let i = 0; i < slides.length; i += 1) {
        const jpeg = await renderCardJpeg({ brandId: String(brandId), text: slides[i], index: i + 1, total: slides.length, sceneDataUri: null, size: slideSize });
        urls.push(await uploadPublicJpeg(jpeg, `cards/${brandKeyFromId(String(brandId))}`));
      }
      return NextResponse.json({ success: true, imageUrls: urls, slides, size: slideSize });
    }

    const article = typeof content === "string" ? content : "";
    if (!brandId || (!article.trim() && !overrideText)) {
      return NextResponse.json({ error: "缺少 brandId 或文章內容" }, { status: 400 });
    }
    const sizeKey = typeof size === "string" && size in CARD_SIZES ? size : DEFAULT_CARD_SIZE;
    const headline = typeof overrideText === "string" && overrideText.trim() ? overrideText.trim().slice(0, 80) : cardHeadline(article);
    if (!headline) return NextResponse.json({ error: "找不到可以放在圖卡上的標題" }, { status: 422 });

    const jpeg = await renderCardJpeg({ brandId: String(brandId), text: headline, index: 1, total: 1, sceneDataUri: null, size: sizeKey });
    const imageUrl = await uploadPublicJpeg(jpeg, `cards/${brandKeyFromId(String(brandId))}`);
    return NextResponse.json({ success: true, imageUrl, text: headline, size: sizeKey });
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : "生成圖卡失敗";
    return NextResponse.json({ error: message.replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[已遮蔽]").slice(0, 300) }, { status: 500 });
  }
}
