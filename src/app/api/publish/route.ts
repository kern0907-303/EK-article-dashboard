import { NextRequest, NextResponse } from "next/server";
import { inspectForPublish } from "@/lib/brand-guardrail";
import { FACEBOOK_PAGES, getDefaultFacebookPage, getFacebookPagesByIds } from "@/lib/facebook-pages";

export async function POST(req: NextRequest) {
  try {
    const { brandId, targetPages: rawTargetPages, content, action, scheduleTime, force } = await req.json();

    if (!brandId || !content) {
      return NextResponse.json(
        { error: "Missing brandId or content" },
        { status: 400 }
      );
    }

    // 2026-09 階段 0：n8n 發文流程目前不讀取 scheduleTime，收到「排程」請求會立刻發文，
    // 使用者卻會看到「已排程」的成功訊息。排程機制（publish_queue）完成前，
    // 一律拒絕 schedule，避免預期在未來發出的貼文被立刻發布。
    if (action === "schedule") {
      return NextResponse.json(
        {
          error: "排程功能尚未啟用（n8n 端尚未實作延後發布），為避免貼文被立刻發出，已拒絕此請求。",
          notImplemented: true,
        },
        { status: 501 }
      );
    }

    // 解析目標粉專：若前端未傳入，則自動以當前品牌預設粉專為主
    let targetPageIds: string[] = [];
    if (Array.isArray(rawTargetPages) && rawTargetPages.length > 0) {
      targetPageIds = rawTargetPages;
    } else if (typeof rawTargetPages === "string" && rawTargetPages.trim().length > 0) {
      targetPageIds = [rawTargetPages.trim()];
    } else {
      const defaultPage = getDefaultFacebookPage(brandId);
      targetPageIds = [defaultPage.id];
    }

    const targetPageConfigs = getFacebookPagesByIds(targetPageIds);
    const targetPageDetails = targetPageConfigs.length > 0
      ? targetPageConfigs.map((p) => ({
          id: p.id,
          name: p.name,
          pageName: p.pageName,
          brandKey: p.brandKey,
          badge: p.badge,
        }))
      : [{
          id: targetPageIds[0] || "fb_default",
          name: "預設粉絲專頁",
          pageName: "預設粉絲專頁",
          brandKey: "erick",
          badge: "預設粉專",
        }];

    // 品牌紅線檢查（以主品牌或目標粉專品牌為準）
    const guardrail = inspectForPublish(content, brandId);
    // I8 的對外內容紅線不可由前端 force 略過；其他品牌沿用既有覆核流程。
    if (!guardrail.passed && (!force || guardrail.context === "I8")) {
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

    // 不再以硬編碼網址當 fallback：環境變數漏設時應明確失敗，而不是靜默打到正式 webhook。
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
    if (!n8nWebhookUrl) {
      return NextResponse.json(
        { error: "後台未設定 N8N_WEBHOOK_URL，無法發布" },
        { status: 500 }
      );
    }

    if (n8nWebhookUrl === "mock") {
      console.warn("N8N_WEBHOOK_URL is set to 'mock'. Simulating success in mock mode.");
      return NextResponse.json({
        success: true,
        message: "N8N_WEBHOOK_URL is configured as 'mock'. Simulating success across target fan pages.",
        simulated: true,
        targetPages: targetPageIds,
        targetPageDetails,
        data: {
          brandId,
          targetPages: targetPageIds,
          targetPageDetails,
          content,
          action: action || "now",
          scheduleTime: scheduleTime || null,
          timestamp: Date.now(),
        },
      });
    }

    // 發送請求至 n8n Webhook（帶入完整的多粉專分流參數）
    const response = await fetch(n8nWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brandId,
        targetPages: targetPageIds,
        targetPageDetails,
        content,
        action: action || "now",
        scheduleTime: scheduleTime || null,
        timestamp: Date.now(),
      }),
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
      targetPages: targetPageIds,
      targetPageDetails,
      data: responseData,
    });
  } catch (error: any) {
    console.error("Error in /api/publish:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
