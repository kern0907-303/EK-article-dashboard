import { NextResponse } from "next/server";
import { collectTimeline } from "@/lib/pipeline-timeline";

export const dynamic = "force-dynamic";

/** 只讀：自動流水線「依日期」總覽的資料。登入保護由 src/proxy.ts 處理。 */
export async function GET() {
  try {
    return NextResponse.json({ success: true, rows: await collectTimeline() });
  } catch (error) {
    return NextResponse.json({ success: false, rows: [], error: error instanceof Error ? error.message : "讀取總覽失敗" }, { status: 500 });
  }
}
