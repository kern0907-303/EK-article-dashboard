import { NextRequest, NextResponse } from "next/server";
import { inspectForPublish } from "@/lib/brand-guardrail";
import { FACEBOOK_PAGES } from "@/lib/facebook-pages";
import {
  QUEUE_MAX_LEAD_MS,
  QUEUE_MIN_LEAD_MS,
  UNSCHEDULABLE_PAGE_IDS,
  getSupabaseEnv,
  isQueueEnabled,
  supabaseHeaders,
  toShortBrandId,
} from "@/lib/publish-queue";

const errorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 列出排程。永遠回 200：表不存在或尚未啟用時 enabled=false，前端據此顯示狀態。 */
export async function GET(req: NextRequest) {
  const env = getSupabaseEnv();
  if (!env) {
    return NextResponse.json({ success: false, enabled: false, data: [], error: "未設定 Supabase 連線資訊" });
  }

  const { searchParams } = new URL(req.url);
  const brandId = searchParams.get("brandId");
  const rawLimit = parseInt(searchParams.get("limit") || "30", 10);
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 30, 1), 100);

  let url = `${env.url}/rest/v1/publish_queue?order=scheduled_at.desc&limit=${limit}`;
  if (brandId) url += `&brand_id=eq.${toShortBrandId(brandId)}`;

  try {
    const res = await fetch(url, { headers: supabaseHeaders(env.key), cache: "no-store" });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ success: false, enabled: false, data: [], error: `讀取排程失敗（${res.status}）：${text.slice(0, 200)}` });
    }
    const data = await res.json();
    return NextResponse.json({ success: true, enabled: isQueueEnabled(), data });
  } catch (error) {
    return NextResponse.json({ success: false, enabled: false, data: [], error: errorMessage(error, "讀取排程失敗") });
  }
}

/** 建立排程 */
export async function POST(req: NextRequest) {
  try {
    const { brandId, targetPages, content, articleId, scheduledAt, imageUrl, testMode, force } = await req.json();

    if (!brandId || !content) {
      return NextResponse.json({ error: "缺少 brandId 或 content" }, { status: 400 });
    }
    if (articleId === undefined || articleId === null || String(articleId).trim() === "") {
      return NextResponse.json({ error: "缺少 articleId：排程前文章必須先上架官網" }, { status: 400 });
    }

    if (!isQueueEnabled()) {
      return NextResponse.json(
        {
          error: "排程佇列尚未啟用（n8n 排程執行器就緒後，需在 Render 設定 PUBLISH_QUEUE_ENABLED=true）。",
          notEnabled: true,
        },
        { status: 501 }
      );
    }

    const env = getSupabaseEnv();
    if (!env) {
      return NextResponse.json({ error: "後台未設定 Supabase 連線資訊" }, { status: 500 });
    }

    // 粉專：只接受已知的粉專，且排除沒有 API 憑證的
    const validIds = new Set(FACEBOOK_PAGES.map((p) => p.id));
    const pages: string[] = Array.isArray(targetPages) ? Array.from(new Set(targetPages.map(String))) : [];
    if (pages.length === 0) {
      return NextResponse.json({ error: "請至少選擇一個粉專" }, { status: 400 });
    }
    const unknown = pages.filter((p) => !validIds.has(p));
    if (unknown.length > 0) {
      return NextResponse.json({ error: `未知的粉專：${unknown.join("、")}` }, { status: 400 });
    }
    const blocked = pages.filter((p) => UNSCHEDULABLE_PAGE_IDS.includes(p));
    if (blocked.length > 0) {
      return NextResponse.json(
        { error: `這些粉專目前沒有 API 憑證，無法排程：${blocked.join("、")}。請取消勾選。` },
        { status: 400 }
      );
    }

    // 時間：轉成 UTC ISO，並檢查範圍
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

    if (imageUrl !== undefined && imageUrl !== null && imageUrl !== "" && !/^https:\/\//i.test(String(imageUrl))) {
      return NextResponse.json({ error: "imageUrl 必須是 https 網址" }, { status: 400 });
    }

    // 品牌紅線：與立即發布同一套規則（I8 不可用 force 略過）
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

    const res = await fetch(`${env.url}/rest/v1/publish_queue`, {
      method: "POST",
      headers: supabaseHeaders(env.key, { Prefer: "return=representation" }),
      body: JSON.stringify({
        brand_id: toShortBrandId(brandId),
        target_pages: pages,
        content,
        image_url: imageUrl || null,
        article_id: String(articleId),
        scheduled_at: when.toISOString(),
        status: "pending",
        results: [],
        test_mode: testMode === true,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Supabase 寫入排程失敗（${res.status}）：${text.slice(0, 300)}`);
    }

    const rows = await res.json();
    return NextResponse.json({ success: true, data: Array.isArray(rows) ? rows[0] : rows });
  } catch (error) {
    console.error("Error in POST /api/publish-queue:", error);
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

    const res = await fetch(`${env.url}/rest/v1/publish_queue?id=eq.${id}&status=eq.pending`, {
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
    console.error("Error in PATCH /api/publish-queue:", error);
    return NextResponse.json({ error: errorMessage(error, "Internal Server Error") }, { status: 500 });
  }
}
