import { NextRequest, NextResponse } from "next/server";
import { inspectForPublish } from "@/lib/brand-guardrail";
import { CAROUSEL_TARGET_MAX, parseSlidesJson, sanitizeSlides, splitArticleToSlides } from "@/lib/carousel-slides.mjs";
import { completeText } from "@/lib/social-image-server";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

const SYSTEM =
  "你是社群編輯，要把一篇繁體中文長文濃縮成 Instagram 輪播圖卡的文字，每張圖卡一個重點。規則：" +
  "1. 共 5 到 7 張。2. 第 1 張是封面鉤子，讓人想往下滑，從文章核心矛盾或標題改寫，不要只是複製標題。" +
  "3. 中間每張只講一個重點，一句到兩句，口語、像在對一個人說話。4. 最後一張是溫和的收尾或一個讓人想留言的問題，不要推銷、不要催促。" +
  "5. 每張不超過 40 個字。6. 只能使用文章裡已經有的觀點與事實，不可編造數字、案例或承諾。" +
  "7. 文字裡不可以出現任何破折號（——、—、─、-）和 Markdown 符號（# * 等），停頓用逗號或句號。" +
  "8. 不可以出現「立刻」「保證」「一定會」這類絕對或催促的說法，也不要出現【需補】這類標記。" +
  '只輸出 JSON，格式：{"slides":["第一張文字","第二張文字"]}，不要任何其他說明。';

/**
 * 把長文濃縮成輪播圖卡文字。mode=ai 呼叫文字模型（會用到額度），mode=auto 只做機械式切段（免費）。
 * AI 失敗時自動退回切段，並在 note 說明。登入保護由 src/proxy.ts 統一處理。
 */
export async function POST(req: NextRequest) {
  try {
    const { brandId, content, mode } = await req.json();
    const article = typeof content === "string" ? content.trim() : "";
    if (!brandId || !article) return NextResponse.json({ error: "缺少 brandId 或文章內容" }, { status: 400 });

    let slides: string[] = [];
    let source: "ai" | "auto" = "auto";
    let note = "";
    if (mode !== "auto") {
      try {
        const raw = await completeText(SYSTEM, article.slice(0, 6000), 900);
        slides = sanitizeSlides(parseSlidesJson(raw), 10);
        if (slides.length >= 2) source = "ai";
        else note = "AI 回傳的內容無法使用，已改用自動切段。";
      } catch (error) {
        note = `AI 濃縮失敗，已改用自動切段：${error instanceof Error ? error.message.slice(0, 100) : "未知原因"}`;
      }
    }
    if (source !== "ai") slides = splitArticleToSlides(article, CAROUSEL_TARGET_MAX);
    if (slides.length < 2) return NextResponse.json({ error: "文章太短，切不出至少兩張輪播文字。" }, { status: 422 });

    // 圖卡文字也過一次品牌紅線，只提醒不擋，真正發佈時各平台路由仍會把關說明文字
    const guardrail = inspectForPublish(slides.join("\n"), String(brandId));
    return NextResponse.json({
      success: true,
      slides,
      source,
      note,
      warnings: guardrail.passed ? [] : guardrail.violatedWords,
    });
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : "產生輪播文字失敗";
    return NextResponse.json({ error: message.replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[已遮蔽]").slice(0, 300) }, { status: 500 });
  }
}
