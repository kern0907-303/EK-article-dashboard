import { NextRequest, NextResponse } from "next/server";
import { getSocialMetrics } from "@/lib/social-metrics-server";

export const dynamic = "force-dynamic";

/**
 * 成效分頁用的唯讀接口。
 * 登入保護由 src/proxy.ts 統一處理（沒有加進公開路徑，所以未登入會被擋）。
 * ?refresh=1 代表使用者按了重新整理；伺服器端仍會限制 5 分鐘內不重打 n8n。
 */
export async function GET(req: NextRequest) {
  const force = new URL(req.url).searchParams.get("refresh") === "1";
  const result = await getSocialMetrics(force);
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }
  return NextResponse.json({
    success: true,
    data: result.data,
    fetchedAt: result.fetchedAt,
    cached: result.cached,
    stale: result.stale,
  });
}
