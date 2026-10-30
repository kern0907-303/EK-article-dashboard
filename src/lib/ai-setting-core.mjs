export const PIPELINE_PROVIDER_KEY = "ai_provider";

/**
 * 自動發文能選的設定值。
 *
 * 刻意不收 mock 與 n8n：mock 會安靜地產出假文章並照排程發出去，
 * 自動流水線不能有這個選項。
 *
 * 要注意這個值能管到什麼、管不到什麼：
 * 每個寫作角色的供應商是刻意寫死的（Maya 走 Claude、Iris 走 Gemini、
 * Jack 與 Leon 走 OpenAI、SEO 審稿走 Claude），這是品質設計，不該被
 * 一個下拉整家覆蓋。所以 openai:模型 這種值真正有效的部分是「所有
 * OpenAI 步驟改用哪個模型」，而單純寫 anthropic / gemini / openai
 * 只會改到沒有固定供應商的步驟（目前是選書）的第一順位。
 */
export const PIPELINE_PROVIDER_OPTIONS = [
  { value: "", label: "伺服器預設（環境變數 AI_PROVIDER）", note: "維持現狀" },
  { value: "openai:gpt-6.1-sol", label: "OpenAI 步驟改用 GPT-6.1 Sol", note: "影響所有 OpenAI 呼叫" },
  { value: "openai:gpt-6-luna", label: "OpenAI 步驟改用 GPT-6 Luna（最省）", note: "影響所有 OpenAI 呼叫" },
  { value: "anthropic", label: "選書第一順位：Claude", note: "只影響沒有固定供應商的步驟" },
  { value: "openai", label: "選書第一順位：OpenAI", note: "只影響沒有固定供應商的步驟" },
  { value: "gemini", label: "選書第一順位：Gemini", note: "只影響沒有固定供應商的步驟" },
];

export function isAllowedPipelineProvider(value) {
  return PIPELINE_PROVIDER_OPTIONS.some((option) => option.value === String(value ?? ""));
}
