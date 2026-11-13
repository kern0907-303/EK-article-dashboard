import { NextRequest, NextResponse } from "next/server";
import { callFlowStructureCheck } from "@/lib/ai-provider";
import { FLOW_STRUCTURES, flowStructureFromText } from "@/data/skills/flow-structures";

// 對照檢視：檢查文章有沒有照指定的流量結構寫。需要登入（不在 proxy 的公開清單裡）。
export async function POST(req: NextRequest) {
  try {
    const { text, structureId, aiProvider } = await req.json();
    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "請先貼上要檢查的文章" }, { status: 400 });
    }
    const id = flowStructureFromText(String(structureId || ""));
    if (!id || !FLOW_STRUCTURES[id]) {
      return NextResponse.json({ error: "請選一個要對照的流量結構" }, { status: 400 });
    }
    const result = await callFlowStructureCheck(text, id, typeof aiProvider === "string" ? aiProvider : undefined);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("API Error in /api/structure-check:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "檢查失敗" }, { status: 500 });
  }
}
