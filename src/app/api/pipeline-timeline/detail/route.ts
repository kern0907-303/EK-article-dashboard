import { NextRequest, NextResponse } from "next/server";
import { collectDetail } from "@/lib/pipeline-detail";

export const dynamic = "force-dynamic";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 只讀：單一流水線任務四個平台的內容與狀態。登入保護由 src/proxy.ts 處理。 */
export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "id 格式不正確" }, { status: 400 });
  try {
    const detail = await collectDetail(id);
    if (!detail) return NextResponse.json({ error: "找不到這個任務" }, { status: 404 });
    return NextResponse.json({ success: true, detail });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "讀取失敗" }, { status: 500 });
  }
}
