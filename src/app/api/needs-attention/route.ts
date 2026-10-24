import { NextRequest, NextResponse } from "next/server";
import { collectAttention } from "@/lib/needs-attention";
import { getSupabaseEnv, supabaseHeaders } from "@/lib/publish-queue";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RETRY_DELAY_MS = 6 * 60 * 1000;

/** 讀取：集中所有需要人處理的項目。只讀，不改任何資料。登入保護由 src/proxy.ts 處理。 */
export async function GET() {
  try {
    const { items } = await collectAttention();
    return NextResponse.json({ success: true, items, generatedAt: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ success: false, items: [], error: error instanceof Error ? error.message : "讀取待處理項目失敗" }, { status: 500 });
  }
}

/**
 * 只提供窄範圍的待處理動作：
 * - mark_done：流水線任務標記已處理／已審（reviewed=true）
 * - retry：失敗的 Threads/IG 或 FB 排程改回 pending，約 6 分鐘後重新派發
 * - dismiss：失敗且不想再發的排程改為 cancelled（記錄保留）
 * - dismiss_derived：只隱藏一個衍生平台的失敗提醒（錯誤紀錄保留）
 * 修改文案與取消沿用既有的 /api/auto-pipeline、/api/social-queue、/api/publish-queue。
 */
export async function POST(req: NextRequest) {
  try {
    const { action, source, id, platform } = await req.json();
    if (typeof id !== "string" || !UUID_RE.test(id)) return NextResponse.json({ error: "id 格式不正確" }, { status: 400 });
    const env = getSupabaseEnv();
    if (!env) return NextResponse.json({ error: "後台未設定 Supabase 連線資訊" }, { status: 500 });
    const now = new Date().toISOString();

    if (action === "dismiss_derived" && source === "job") {
      if (!["website", "instagram", "threads"].includes(platform)) return NextResponse.json({ error: "平台不支援" }, { status: 400 });
      const currentRes = await fetch(`${env.url}/rest/v1/auto_pipeline_jobs?id=eq.${id}&status=eq.scheduled&select=id,social_results&limit=1`, {
        headers: supabaseHeaders(env.key), cache: "no-store",
      });
      if (!currentRes.ok) throw new Error(`讀取失敗提醒失敗（${currentRes.status}）`);
      const current = (await currentRes.json())[0];
      const results = current?.social_results;
      const outcome = results && typeof results === "object" ? results[platform] : null;
      if (!outcome || outcome.ok !== false || !outcome.error || outcome.dismissed === true) return NextResponse.json({ error: "這項失敗提醒已不存在或已處理" }, { status: 409 });
      const res = await fetch(`${env.url}/rest/v1/auto_pipeline_jobs?id=eq.${id}&status=eq.scheduled`, {
        method: "PATCH", headers: supabaseHeaders(env.key, { Prefer: "return=representation" }),
        body: JSON.stringify({ social_results: { ...results, [platform]: { ...outcome, dismissed: true } }, updated_at: now }),
      });
      if (!res.ok) throw new Error(`移除失敗提醒失敗（${res.status}）`);
      if (!(await res.json()).length) return NextResponse.json({ error: "任務狀態已改變" }, { status: 409 });
      return NextResponse.json({ success: true });
    }

    if (action === "mark_done" && source === "job") {
      const res = await fetch(`${env.url}/rest/v1/auto_pipeline_jobs?id=eq.${id}&status=in.(manual,failed,scheduled)`, {
        method: "PATCH", headers: supabaseHeaders(env.key, { Prefer: "return=representation" }),
        body: JSON.stringify({ reviewed: true, updated_at: now }),
      });
      if (!res.ok) throw new Error(`標記失敗（${res.status}）`);
      const rows = await res.json();
      if (!Array.isArray(rows) || !rows.length) return NextResponse.json({ error: "找不到可標記的任務，可能已被處理" }, { status: 409 });
      return NextResponse.json({ success: true });
    }

    if (action === "retry" && (source === "social_queue" || source === "fb_queue")) {
      const table = source === "social_queue" ? "social_publish_queue" : "publish_queue";
      const body: Record<string, unknown> = { status: "pending", error: null, attempts: 0, scheduled_at: new Date(Date.now() + RETRY_DELAY_MS).toISOString(), updated_at: now };
      const res = await fetch(`${env.url}/rest/v1/${table}?id=eq.${id}&status=eq.failed`, {
        method: "PATCH", headers: supabaseHeaders(env.key, { Prefer: "return=representation" }), body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`重試失敗（${res.status}）：${(await res.text()).slice(0, 160)}`);
      const rows = await res.json();
      if (!Array.isArray(rows) || !rows.length) return NextResponse.json({ error: "這筆已不是失敗狀態，可能已被處理" }, { status: 409 });
      return NextResponse.json({ success: true, scheduledAt: body.scheduled_at });
    }

    if (action === "dismiss" && (source === "social_queue" || source === "fb_queue")) {
      const table = source === "social_queue" ? "social_publish_queue" : "publish_queue";
      const res = await fetch(`${env.url}/rest/v1/${table}?id=eq.${id}&status=eq.failed`, {
        method: "PATCH", headers: supabaseHeaders(env.key, { Prefer: "return=representation" }),
        body: JSON.stringify({ status: "cancelled", updated_at: now }),
      });
      if (!res.ok) throw new Error(`放棄失敗（${res.status}）：${(await res.text()).slice(0, 160)}`);
      const rows = await res.json();
      if (!Array.isArray(rows) || !rows.length) return NextResponse.json({ error: "這筆已不是失敗狀態，可能已被處理" }, { status: 409 });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "不支援的操作" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "操作失敗" }, { status: 500 });
  }
}
