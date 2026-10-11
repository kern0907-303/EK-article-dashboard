import { NextRequest, NextResponse } from "next/server";
import { stripDashes } from "@/lib/plain-text";
import { inspectForPublish } from "@/lib/brand-guardrail";
import { brandKeyFromId } from "@/data/skills/genres";
import { publicImagePrefix } from "@/lib/social-image-server";
import { validateCarouselUrls } from "@/lib/carousel-slides.mjs";
import { QUEUE_MAX_LEAD_MS, QUEUE_MIN_LEAD_MS, getSupabaseEnv, supabaseHeaders } from "@/lib/publish-queue";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const THREADS_LIMIT = 500;
const INSTAGRAM_LIMIT = 2200;

const errorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback;

/**
 * Threads / Instagram 排程（Supabase 表 social_publish_queue，與 Facebook 的 publish_queue 分開）。
 * 到期後由 Supabase 派發、n8n「Social Queue Runner」實際發出。登入保護由 src/proxy.ts 統一處理。
 */

/** 列出排程。永遠回 200：表不存在時 enabled=false，前端據此顯示狀態。 */
export async function GET(req: NextRequest) {
  const env = getSupabaseEnv();
  if (!env) {
    return NextResponse.json({ success: false, enabled: false, data: [], error: "未設定 Supabase 連線資訊" });
  }
  const { searchParams } = new URL(req.url);
  const brandId = searchParams.get("brandId");
  const platform = searchParams.get("platform");
  const rawLimit = parseInt(searchParams.get("limit") || "30", 10);
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 30, 1), 100);

  let url = `${env.url}/rest/v1/social_publish_queue?order=scheduled_at.desc&limit=${limit}`;
  if (brandId) {
    const brand = brandKeyFromId(brandId);
    if (brand !== "erick") url += `&brand=eq.${brand}`;
  }
  if (platform === "threads" || platform === "instagram") url += `&platform=eq.${platform}`;

  try {
    const res = await fetch(url, { headers: supabaseHeaders(env.key), cache: "no-store" });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ success: false, enabled: false, data: [], error: `讀取排程失敗（${res.status}）：${text.slice(0, 200)}` });
    }
    const data = await res.json();
    return NextResponse.json({ success: true, enabled: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, enabled: false, data: [], error: errorMessage(error, "讀取排程失敗") });
  }
}

/** 建立排程 */
export async function POST(req: NextRequest) {
  try {
    const { brandId, platform, content: rawContent, imageUrl, imageUrls, scheduledAt, force } = await req.json();
    const content = typeof rawContent === "string" ? stripDashes(rawContent).trim() : "";

    if (!brandId || !content) {
      return NextResponse.json({ error: "缺少 brandId 或內容" }, { status: 400 });
    }
    if (platform !== "threads" && platform !== "instagram") {
      return NextResponse.json({ error: "platform 必須是 threads 或 instagram" }, { status: 400 });
    }
    const brand = brandKeyFromId(String(brandId));
    if (brand === "erick") {
      return NextResponse.json({ error: "Erick 個人品牌沒有串接 Threads / Instagram 帳號，請切換到 ABL、NAS 或 I8" }, { status: 400 });
    }
    const limit = platform === "threads" ? THREADS_LIMIT : INSTAGRAM_LIMIT;
    if (content.length > limit) {
      return NextResponse.json({ error: `${platform === "threads" ? "Threads" : "Instagram"} 文字上限 ${limit} 字，目前 ${content.length} 字，請先縮短` }, { status: 400 });
    }
    const prefix = publicImagePrefix();
    const hasImage = typeof imageUrl === "string" && imageUrl.length > 0;
    const carousel = validateCarouselUrls(platform, imageUrls, prefix);
    if (!carousel.ok) {
      return NextResponse.json({ error: carousel.error }, { status: 400 });
    }
    if (platform === "instagram" && !carousel.urls.length && (!prefix || !hasImage || !imageUrl.startsWith(prefix))) {
      return NextResponse.json({ error: "Instagram 排程必須使用儀表板生成的配圖，請先按「生成配圖」" }, { status: 400 });
    }
    if (platform === "threads" && hasImage && (!prefix || !imageUrl.startsWith(prefix))) {
      return NextResponse.json({ error: "配圖必須是儀表板生成的圖片，請重新生成配圖" }, { status: 400 });
    }

    const when = new Date(scheduledAt);
    if (!scheduledAt || Number.isNaN(when.getTime())) {
      return NextResponse.json({ error: "排程時間格式不正確" }, { status: 400 });
    }
    const lead = when.getTime() - Date.now();
    if (lead < QUEUE_MIN_LEAD_MS) {
      return NextResponse.json({ error: "排程時間至少要晚於現在 5 分鐘" }, { status: 400 });
    }
    if (lead > QUEUE_MAX_LEAD_MS) {
      return NextResponse.json({ error: "排程時間最遠只能設 30 天內" }, { status: 400 });
    }

    // 品牌紅線：與立即發布同一套規則（I8 不可用 force 略過）
    const guardrail = inspectForPublish(content, String(brandId));
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

    const env = getSupabaseEnv();
    if (!env) {
      return NextResponse.json({ error: "後台未設定 Supabase 連線資訊" }, { status: 500 });
    }

    const res = await fetch(`${env.url}/rest/v1/social_publish_queue`, {
      method: "POST",
      headers: supabaseHeaders(env.key, { Prefer: "return=representation" }),
      body: JSON.stringify({
        platform,
        brand,
        content,
        image_url: carousel.urls.length ? carousel.urls[0] : hasImage ? imageUrl : null,
        ...(carousel.urls.length ? { image_urls: carousel.urls } : {}),
        scheduled_at: when.toISOString(),
        status: "pending",
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Supabase 寫入排程失敗（${res.status}）：${text.slice(0, 300)}`);
    }
    const rows = await res.json();
    return NextResponse.json({ success: true, data: Array.isArray(rows) ? rows[0] : rows });
  } catch (error) {
    console.error("Error in POST /api/social-queue:", error);
    return NextResponse.json({ error: errorMessage(error, "Internal Server Error") }, { status: 500 });
  }
}

/** 取消排程：只有還在 pending 的可以取消（已進入 sending 就來不及了） */
export async function PATCH(req: NextRequest) {
  try {
    const { id, action } = await req.json();
    if (action !== "cancel") {
      return NextResponse.json({ error: "不支援的操作" }, { status: 400 });
    }
    if (typeof id !== "string" || !UUID_RE.test(id)) {
      return NextResponse.json({ error: "排程 id 格式不正確" }, { status: 400 });
    }
    const env = getSupabaseEnv();
    if (!env) {
      return NextResponse.json({ error: "後台未設定 Supabase 連線資訊" }, { status: 500 });
    }
    const res = await fetch(`${env.url}/rest/v1/social_publish_queue?id=eq.${id}&status=eq.pending`, {
      method: "PATCH",
      headers: supabaseHeaders(env.key, { Prefer: "return=representation" }),
      body: JSON.stringify({ status: "cancelled", updated_at: new Date().toISOString() }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Supabase 取消排程失敗（${res.status}）：${text.slice(0, 300)}`);
    }
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "這筆排程已不是待發狀態（可能已經發出或取消）" }, { status: 409 });
    }
    return NextResponse.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error("Error in PATCH /api/social-queue:", error);
    return NextResponse.json({ error: errorMessage(error, "Internal Server Error") }, { status: 500 });
  }
}
