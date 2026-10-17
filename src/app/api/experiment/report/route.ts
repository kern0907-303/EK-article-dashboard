import { NextRequest, NextResponse } from "next/server";
import { buildReport, isAnalystAuthorized, isExperimentEnabled } from "@/lib/experiment-server";

export const dynamic = "force-dynamic";

/** 成效分析員每天讀一次（Bearer EXPERIMENT_ANALYST_SECRET）。唯讀，內容是結算好的數字與伺服器判定，不含密鑰。 */
export async function GET(req: NextRequest) {
  if (!isExperimentEnabled()) return NextResponse.json({ error: "成效回流未啟用" }, { status: 404 });
  if (!isAnalystAuthorized(req)) return NextResponse.json({ error: "未授權" }, { status: 401 });
  try {
    return NextResponse.json(await buildReport());
  } catch (error) {
    const message = error instanceof Error ? error.message : "報告失敗";
    console.error("[experiment] report failed:", message);
    return NextResponse.json({ error: message.slice(0, 280) }, { status: 502 });
  }
}
