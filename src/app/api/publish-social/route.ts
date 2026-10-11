import { NextRequest, NextResponse } from "next/server";
import { stripDashes } from "@/lib/plain-text";
import { inspectForPublish, resolveBrandContext } from "@/lib/brand-guardrail";
import { brandKeyFromId } from "@/data/skills/genres";
import { publicImagePrefix } from "@/lib/social-image-server";
import { validateCarouselUrls } from "@/lib/carousel-slides.mjs";

export const dynamic = "force-dynamic";
// n8n 建立貼文後會等 30 秒才發佈，所以整體請求要給足時間
const REQUEST_TIMEOUT_MS = 180_000;

interface PublishAnswer {
  ok?: boolean;
  stage?: string;
  error?: string;
  account?: string;
  postId?: string;
  url?: string | null;
}

/**
 * Threads / Instagram 發文。
 * 實際發文由 n8n 的 social_publish_api 完成（token 只存在 n8n，儀表板拿不到）。
 * 登入保護由 src/proxy.ts 統一處理。Facebook 發文仍走原本的 /api/publish，不受影響。
 */
export async function POST(req: NextRequest) {
  try {
    const { brandId, platform, content: rawContent, imageUrl, imageUrls, force } = await req.json();
    const content = typeof rawContent === "string" ? stripDashes(rawContent).trim() : "";

    if (!brandId || !content) {
      return NextResponse.json({ error: "缺少 brandId 或內容" }, { status: 400 });
    }
    if (platform !== "threads" && platform !== "instagram") {
      return NextResponse.json({ error: "platform 必須是 threads 或 instagram" }, { status: 400 });
    }
    // 圖片必須是儀表板自己生成並存放的，不接受任意網址。Instagram 一定要有圖；Threads 有圖就帶圖，沒有就發純文字。
    const prefix = publicImagePrefix();
    const hasImage = typeof imageUrl === "string" && imageUrl.length > 0;
    if (platform === "instagram" && !(Array.isArray(imageUrls) && imageUrls.length >= 2) && (!prefix || !hasImage || !imageUrl.startsWith(prefix))) {
      return NextResponse.json({ error: "Instagram 發文必須使用儀表板生成的配圖，請先按「生成配圖」" }, { status: 400 });
    }
    if (platform === "threads" && hasImage && (!prefix || !imageUrl.startsWith(prefix))) {
      return NextResponse.json({ error: "配圖必須是儀表板生成的圖片，請重新生成配圖" }, { status: 400 });
    }

    // 輪播：兩張以上才算，單張沿用 imageUrl
    const carousel = validateCarouselUrls(platform, imageUrls, prefix);
    if (!carousel.ok) {
      return NextResponse.json({ error: carousel.error }, { status: 400 });
    }

    const brandKey = brandKeyFromId(String(brandId));
    if (brandKey === "erick") {
      return NextResponse.json({ error: "Erick 個人品牌沒有串接 Threads / Instagram 帳號，請切換到 ABL、NAS 或 I8" }, { status: 400 });
    }

    const guardrail = inspectForPublish(content, String(brandId));
    // I8 的對外內容紅線不可略過；其他品牌沿用既有覆核流程
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

    const url = process.env.SOCIAL_PUBLISH_URL;
    const key = process.env.SOCIAL_METRICS_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: "後台尚未設定 SOCIAL_PUBLISH_URL 與 SOCIAL_METRICS_KEY，無法發文" }, { status: 503 });
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": key },
      body: JSON.stringify({
        platform,
        brand: brandKey,
        text: content,
        imageUrl: carousel.urls.length ? undefined : hasImage ? imageUrl : undefined,
        imageUrls: carousel.urls.length ? carousel.urls : undefined,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    let answer: PublishAnswer = {};
    try {
      answer = (await res.json()) as PublishAnswer;
    } catch {
      // 回應不是 JSON，下面依狀態碼處理
    }

    if (res.status === 401 || res.status === 403) {
      return NextResponse.json({ error: "發文入口拒絕了密鑰，請確認 Render 與 n8n 的密鑰一致" }, { status: 502 });
    }
    if (!res.ok || !answer.ok) {
      const stage = answer.stage ? `（${answer.stage}）` : "";
      return NextResponse.json({ error: `${answer.error || `發文入口回應 ${res.status}`}${stage}` }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      platform,
      brand: resolveBrandContext(String(brandId)),
      account: answer.account || null,
      postId: answer.postId || null,
      url: answer.url || null,
    });
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : "發文失敗";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
