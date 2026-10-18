import { NextRequest, NextResponse } from "next/server";
import { enforceCopyRules, type GatePlatform } from "@/lib/quality-gate";

/**
 * 純檢查端點，給編輯 AI（Paperclip）與 n8n 在審稿前先呼叫。
 * 回傳自動修正後的文字與還擋著的問題，規則與發布路徑共用同一份（src/lib/quality-gate.ts）。
 * 編輯 AI 只需要判斷語氣與跨平台一致，格式、免責聲明、縮寫、編造人名由這裡定論。
 */
export async function POST(req: NextRequest) {
  try {
    const { content, platform } = await req.json();
    if (typeof content !== "string" || !content.trim()) return NextResponse.json({ error: "缺少 content" }, { status: 400 });
    const target: GatePlatform = ["facebook", "instagram", "threads", "website", "slide"].includes(platform) ? platform : "facebook";
    const result = enforceCopyRules(content, target);
    return NextResponse.json({ success: true, passed: result.blockers.length === 0, text: result.text, fixes: result.fixes, blockers: result.blockers, warnings: result.warnings });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "檢查失敗" }, { status: 500 });
  }
}
