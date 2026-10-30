import { NextRequest, NextResponse } from "next/server";
import { PIPELINE_PROVIDER_OPTIONS, isAllowedPipelineProvider } from "@/lib/ai-setting-core.mjs";
import { readPipelineProviderSetting, setPipelineProvider } from "@/lib/ai-setting-server";

export async function GET() {
  try {
    const value = await readPipelineProviderSetting();
    return NextResponse.json({ value, envDefault: process.env.AI_PROVIDER || "", options: PIPELINE_PROVIDER_OPTIONS });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "讀取模型設定失敗" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const value = typeof body.value === "string" ? body.value.trim() : "";
    if (!isAllowedPipelineProvider(value)) {
      return NextResponse.json({ error: "不支援這個選項。自動發文不開放本地模擬與 n8n，避免安靜產出假文章後照排程發出。" }, { status: 400 });
    }
    await setPipelineProvider(value);
    return NextResponse.json({ success: true, value });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "儲存模型設定失敗" }, { status: 500 });
  }
}
