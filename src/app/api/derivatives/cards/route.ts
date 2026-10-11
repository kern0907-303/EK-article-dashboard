import { NextRequest, NextResponse } from "next/server";
import { isDerivativesEnabled } from "@/lib/derivatives-core.mjs";
import { parseCarouselSlides } from "@/lib/card-slides.mjs";
import { derivativesDb } from "@/lib/derivatives-server";
import { renderCardJpeg, sceneToDataUri } from "@/lib/card-render-server";
import { buildImagePrompt, generateImageBuffer, uploadPublicJpeg } from "@/lib/social-image-server";
import { brandKeyFromId } from "@/data/skills/genres";
import { CARD_SIZES, DEFAULT_CARD_SIZE } from "@/lib/card-layout.mjs";
import { getImageJob } from "@/lib/image-jobs-server";
import { publicImagePrefix } from "@/lib/social-image-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * 把 IG 衍生稿的「第 N 張」文字做成圖卡（4:5 JPEG），存到公開儲存桶，網址寫回衍生稿的 check_results.card_images。
 * background：color 用品牌色底（不花生圖額度，預設）；scene 另外生成一張情境圖當共用底圖（會用到 OpenAI 額度）；
 * comfy 使用 Mac mini 上 ComfyUI 已生好的底圖（免費，jobId 是 /api/image-jobs 建立的工作，必須已完成）。
 * 只在按下「生成圖卡」時呼叫，不會自動執行。
 */
export async function POST(request: NextRequest) {
  if (!isDerivativesEnabled()) return NextResponse.json({ error: "多平台衍生功能尚未啟用。" }, { status: 404 });
  try {
    const body = await request.json();
    const id = typeof body?.id === "string" ? body.id : "";
    const background = body?.background === "scene" ? "scene" : body?.background === "comfy" ? "comfy" : "color";
    const jobId = typeof body?.jobId === "string" ? body.jobId : "";
    const sizeKey = typeof body?.size === "string" && body.size in CARD_SIZES ? body.size : DEFAULT_CARD_SIZE;
    if (!id) return NextResponse.json({ error: "缺少衍生稿 ID。" }, { status: 400 });

    const rows = await derivativesDb<any[]>("derivative_posts", `id=eq.${encodeURIComponent(id)}&limit=1`);
    const post = rows[0];
    if (!post) return NextResponse.json({ error: "找不到衍生稿。" }, { status: 404 });
    if (post.platform !== "IG") return NextResponse.json({ error: "只有 IG 衍生稿可以生成圖卡。" }, { status: 400 });

    const slides = parseCarouselSlides(post.content);
    if (slides.length < 2) return NextResponse.json({ error: "衍生稿裡找不到至少兩張的輪播文字，請先確認稿件有「第 1 張：…」「第 2 張：…」的格式。" }, { status: 422 });

    const folder = `cards/${brandKeyFromId(String(post.parent_brand_id))}`;
    let sceneDataUri: string | null = null;
    let sceneNote = "";
    if (background === "comfy") {
      if (!jobId) return NextResponse.json({ error: "缺少本機生圖工作 ID。" }, { status: 400 });
      const job = await getImageJob(jobId);
      if (!job || job.status !== "done" || !job.result_url) return NextResponse.json({ error: "本機底圖還沒完成，請稍後再試。" }, { status: 409 });
      // 只接受我們自己儲存桶裡的圖，避免被指到別的網址
      const prefix = publicImagePrefix();
      if (!prefix || !job.result_url.startsWith(prefix)) return NextResponse.json({ error: "底圖網址不在允許範圍。" }, { status: 400 });
      const res = await fetch(job.result_url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) return NextResponse.json({ error: `讀取本機底圖失敗（${res.status}）` }, { status: 502 });
      sceneDataUri = await sceneToDataUri(Buffer.from(await res.arrayBuffer()), sizeKey);
    } else if (background === "scene") {
      try {
        const brand = brandKeyFromId(String(post.parent_brand_id));
        const prompt = await buildImagePrompt(slides.map((slide) => slide.text).join("\n"), brand === "erick" ? "nas" : brand);
        const { buffer } = await generateImageBuffer(prompt);
        sceneDataUri = await sceneToDataUri(buffer, sizeKey);
      } catch (error) {
        // 情境圖失敗就退回品牌色底，不讓整批圖卡做不出來
        sceneNote = `情境底圖生成失敗，已改用品牌色底：${error instanceof Error ? error.message.slice(0, 120) : "未知原因"}`;
      }
    }

    const cardImages: Array<{ slide: number; url: string }> = [];
    for (const slide of slides) {
      const jpeg = await renderCardJpeg({ brandId: post.parent_brand_id, text: slide.text, index: slide.index, total: slides.length, sceneDataUri, size: sizeKey });
      const url = await uploadPublicJpeg(jpeg, folder);
      cardImages.push({ slide: slide.index, url });
    }

    const checkResults = { ...(post.check_results || {}), card_images: cardImages, card_background: sceneDataUri ? (background === "comfy" ? "comfy" : "scene") : "color", card_size: sizeKey, card_generated_at: new Date().toISOString() };
    const updated = await derivativesDb<any[]>("derivative_posts", `id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ check_results: checkResults, updated_at: new Date().toISOString() }),
    });
    return NextResponse.json({ success: true, card_images: cardImages, note: sceneNote, row: updated[0] });
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : "生成圖卡失敗";
    return NextResponse.json({ error: message.replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[已遮蔽]").slice(0, 300) }, { status: 500 });
  }
}
