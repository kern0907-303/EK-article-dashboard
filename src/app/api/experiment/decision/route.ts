import { NextRequest, NextResponse } from "next/server";
import { applyDecision, isAnalystAuthorized, isExperimentEnabled } from "@/lib/experiment-server";

export const dynamic = "force-dynamic";

/**
 * 成效分析員提交決策（Bearer EXPERIMENT_ANALYST_SECRET）。
 * 所有硬規則都在這裡檢查：最短觀察天數、樣本門檻、勝出機率、一次只改一個變數、冠軍沿用、日期範圍。
 * 任何一項不符就整份拒絕（422），什麼都不寫入，原因逐條回傳。
 */
export async function POST(req: NextRequest) {
  if (!isExperimentEnabled()) return NextResponse.json({ error: "成效回流未啟用" }, { status: 404 });
  if (!isAnalystAuthorized(req)) return NextResponse.json({ error: "未授權" }, { status: 401 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "請求內容不是 JSON" }, { status: 400 }); }
  const result = await applyDecision(body);
  if (!result.ok) return NextResponse.json({ success: false, errors: result.errors }, { status: result.status });
  return NextResponse.json({ success: true, applied: result.applied });
}
