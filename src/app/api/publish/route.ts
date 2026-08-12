import { NextRequest, NextResponse } from "next/server";
import { inspectForPublish } from "@/lib/brand-guardrail";

export async function POST(req: NextRequest) {
  try {
    const { brandId, content, action, scheduleTime, force } = await req.json();

    if (!brandId || !content) {
      return NextResponse.json(
        { error: "Missing brandId or content" },
        { status: 400 }
      );
    }

    // 品牌紅線檢查，與 /api/publish-website 同一套規則
    const guardrail = inspectForPublish(content, brandId);
    if (!guardrail.passed && !force) {
      return NextResponse.json(
        {
          error: "品牌紅線檢查未通過",
          blocked: true,
          violatedWords: guardrail.violatedWords,
          context: guardrail.context,
          suggestion: guardrail.suggestion,
        },
        { status: 422 }
      );
    }

    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;

    if (!n8nWebhookUrl) {
      // 先前這裡硬編碼了正式 webhook 作為 fallback，環境變數漏設時會靜默
      // 打到線上流程，難以察覺。改為明確報錯。
      return NextResponse.json(
        { error: "未設定 N8N_WEBHOOK_URL 環境變數" },
        { status: 500 }
      );
    }

    if (n8nWebhookUrl === "mock") {
      console.warn("N8N_WEBHOOK_URL is set to 'mock'. Simulating success in mock mode.");
      return NextResponse.json({
        success: true,
        message: "N8N_WEBHOOK_URL is configured as 'mock'. Simulating success.",
        simulated: true,
        data: {
          brandId,
          content,
          action,
          scheduleTime,
          timestamp: Date.now()
        }
      });
    }

    // 發送請求至 n8n Webhook
    const response = await fetch(n8nWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brandId,
        content,
        action: action || "now",
        scheduleTime: scheduleTime || null,
        timestamp: Date.now()
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`n8n responded with status ${response.status}: ${errorText}`);
    }

    let responseData = {};
    try {
      responseData = await response.json();
    } catch (e) {
      // 容錯處理：若 webhook 僅回傳純文字或空回應
    }

    return NextResponse.json({
      success: true,
      data: responseData
    });
  } catch (error: any) {
    console.error("Error in /api/publish:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
