import { NextRequest, NextResponse } from "next/server";

/**
 * 名單捕捉接口。
 *
 * 三個品牌測驗（/nas/quiz、/abl/check、/i8/diagnosis）送出的 email 都走這裡，
 * 由後端轉送到 n8n，再寫入 Google Sheet 並寄出結果信。
 *
 * 為什麼經過後端而不是前端直接打 n8n：
 * 1. webhook 網址不暴露在瀏覽器，避免被灌垃圾名單
 * 2. 可以在這裡統一做驗證與欄位正規化
 */

const ALLOWED_BRANDS = ["nas", "abl", "i8", "erick"];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name, email, brand, source, stage,
      resultType, resultTitle, resultBody, resultNextStep, brandLabel,
    } = body;

    // --- 驗證 ---
    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "email 格式不正確" }, { status: 400 });
    }
    if (!brand || !ALLOWED_BRANDS.includes(brand)) {
      return NextResponse.json({ error: "未知的品牌代號" }, { status: 400 });
    }
    if (!resultType || typeof resultType !== "string") {
      return NextResponse.json({ error: "缺少測驗結果類型" }, { status: 400 });
    }

    const webhookUrl = process.env.N8N_LEAD_WEBHOOK_URL;
    if (!webhookUrl) {
      console.error("[/api/lead] N8N_LEAD_WEBHOOK_URL 未設定，名單無法寫入");
      return NextResponse.json(
        { error: "名單服務尚未設定，請聯繫管理者" },
        { status: 500 }
      );
    }

    const payload = {
      name: (name || "").toString().trim().slice(0, 80) || "未留名",
      email: email.trim().toLowerCase(),
      brand,
      source: (source || "").toString().slice(0, 120),
      stage: (stage || "").toString().slice(0, 20),
      result_type: resultType,
      result_title: (resultTitle || "").toString().slice(0, 200),
      // 結果內容由前端帶過來，n8n 只負責排版與寄送，
      // 避免同一份文案在兩個系統各維護一份而走鐘
      result_body: (resultBody || "").toString().slice(0, 2000),
      result_next_step: (resultNextStep || "").toString().slice(0, 1000),
      brand_label: (brandLabel || "").toString().slice(0, 60),
      timestamp: new Date().toISOString(),
    };

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`n8n 回應 ${res.status}: ${text.slice(0, 200)}`);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error in /api/lead:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
