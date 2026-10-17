import { NextRequest, NextResponse } from "next/server";
import { ingestSnapshots, isCronAuthorized, isExperimentEnabled } from "@/lib/experiment-server";

export const dynamic = "force-dynamic";

/**
 * 每天一次由 Supabase pg_cron 呼叫（Bearer EXPERIMENT_CRON_SECRET）。
 * 讀取 n8n 已經同步好的成效資料，對回我們發出的 Threads / IG 貼文後寫入 post_snapshots。
 * 不會觸發任何額外的 n8n 同步，只讀一次成效資料出口。
 */
export async function POST(req: NextRequest) {
  if (!isExperimentEnabled()) return NextResponse.json({ error: "成效回流未啟用" }, { status: 404 });
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "未授權" }, { status: 401 });
  try {
    return NextResponse.json({ success: true, ...(await ingestSnapshots()) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "快照失敗";
    console.error("[experiment] snapshot failed:", message);
    return NextResponse.json({ error: message.slice(0, 280) }, { status: 502 });
  }
}
