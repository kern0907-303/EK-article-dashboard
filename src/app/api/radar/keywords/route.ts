import { NextResponse } from "next/server";
import { getRadarKeywords, LAYER_WEIGHT } from "@/data/radar/keywords";

/**
 * 話題雷達的關鍵字宇宙。
 *
 * n8n 的每日蒐集流程會呼叫這支，拿到要搜尋的詞。
 * 這樣關鍵字就只有 src/data/radar/keywords.ts 這一份，
 * 可以進版控、可以 code review，不需要進 n8n UI 手改 Code 節點。
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    updatedAt: new Date().toISOString(),
    layerWeight: LAYER_WEIGHT,
    keywords: getRadarKeywords(),
  });
}
