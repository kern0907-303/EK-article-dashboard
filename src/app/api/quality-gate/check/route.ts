import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { enforceCopyRules, type GatePlatform } from "@/lib/quality-gate";

/**
 * 純檢查端點，給編輯 AI（Paperclip）與 n8n 在審稿前先呼叫。
 * 回傳自動修正後的文字與還擋著的問題，規則與發布路徑共用同一份（src/lib/quality-gate.ts）。
 * 編輯 AI 只需要判斷語氣與跨平台一致，格式、免責聲明、縮寫、由這裡定論。
 */
function authorized(req: NextRequest): boolean {
  const secret = process.env.AUTO_PIPELINE_CRON_SECRET || "";
  const received = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  return !!secret && received.length === secret.length && timingSafeEqual(Buffer.from(received), Buffer.from(secret));
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "未授權" }, { status: 401 });
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
