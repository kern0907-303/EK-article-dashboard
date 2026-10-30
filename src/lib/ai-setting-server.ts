import "server-only";
import { pipelineDb } from "@/lib/auto-pipeline-server";
import { PIPELINE_PROVIDER_KEY, isAllowedPipelineProvider } from "@/lib/ai-setting-core.mjs";

let cached: { value: string; at: number } | null = null;
const CACHE_MS = 30_000;

/**
 * 自動流水線要用哪個模型。
 *
 * 首頁右上角那個「AI 大腦」只寫進瀏覽器的 localStorage，所以它從來管不到
 * 每晚自動發文那條路（那條路以前是直接讀 process.env.AI_PROVIDER）。
 * 這張設定表讓頁面上的選擇真的管到自動發文；沒設定時行為跟改之前一樣，
 * 仍然沿用環境變數。
 */
export async function getPipelineProvider(): Promise<string | undefined> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value || process.env.AI_PROVIDER;
  try {
    const rows = await pipelineDb<any[]>("app_settings", `key=eq.${PIPELINE_PROVIDER_KEY}&select=value`);
    const raw = rows?.[0]?.value;
    const value = typeof raw === "string" && isAllowedPipelineProvider(raw.trim()) ? raw.trim() : "";
    cached = { value, at: Date.now() };
    return value || process.env.AI_PROVIDER;
  } catch (error) {
    // 設定讀不到不該讓整篇生成失敗，退回環境變數就好
    console.warn("[settings] 讀不到 ai_provider 設定，沿用環境變數：", error instanceof Error ? error.message : error);
    return process.env.AI_PROVIDER;
  }
}

export async function setPipelineProvider(value: string): Promise<void> {
  await pipelineDb("app_settings", "", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({ key: PIPELINE_PROVIDER_KEY, value, updated_at: new Date().toISOString() }),
  });
  cached = { value, at: Date.now() };
}

export async function readPipelineProviderSetting(): Promise<string> {
  const rows = await pipelineDb<any[]>("app_settings", `key=eq.${PIPELINE_PROVIDER_KEY}&select=value`);
  const raw = rows?.[0]?.value;
  return typeof raw === "string" ? raw : "";
}
