import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PIPELINE_PROVIDER_KEY, PIPELINE_PROVIDER_OPTIONS, isAllowedPipelineProvider } from "../src/lib/ai-setting-core.mjs";

// 2026-10-31：艾瑞克問「頁面上可以選擇使用哪個模型，確認功能正常」。
// 查出來的實情是首頁右上角那個下拉只寫進 localStorage，
// 自動發文那條路四個地方都直接讀 process.env.AI_PROVIDER，
// 所以頁面上選什麼，每晚自動發的文章完全不理。

// 自動發文不能有 mock：它會安靜產出假文章再照排程發出去
assert.ok(!isAllowedPipelineProvider("mock"), "自動發文不可以選 mock");
assert.ok(!isAllowedPipelineProvider("n8n"), "自動發文不可以選 n8n");
assert.ok(isAllowedPipelineProvider(""), "空值代表沿用環境變數");
assert.ok(isAllowedPipelineProvider("anthropic"));
assert.ok(isAllowedPipelineProvider("openai:gpt-6.1-sol"));
assert.ok(!isAllowedPipelineProvider("openai:rm -rf"), "模型名稱不照收");
assert.equal(PIPELINE_PROVIDER_KEY, "ai_provider");
// 每個選項都要寫清楚它管得到什麼，不要讓人以為整家都換了
for (const option of PIPELINE_PROVIDER_OPTIONS) assert.ok(option.note && option.label, "每個選項都要有說明");

const generate = readFileSync(new URL("../src/lib/auto-generate.ts", import.meta.url), "utf8");
// 不可以再有硬寫的環境變數，否則頁面上的選擇又管不到自動發文
assert.ok(!generate.includes("process.env.AI_PROVIDER"), "auto-generate 不該再直接讀 AI_PROVIDER");
assert.ok(generate.includes("getPipelineProvider()"), "改成讀資料庫設定");
// 五個呼叫點都要換到，不能只改一個
assert.equal(generate.split("await getPipelineProvider()").length - 1, 5, "五個呼叫點都要讀同一份設定");

const setting = readFileSync(new URL("../src/lib/ai-setting-server.ts", import.meta.url), "utf8");
// 讀不到設定不該讓整篇生成失敗
assert.ok(setting.includes("process.env.AI_PROVIDER"), "讀不到設定要退回環境變數");
assert.ok(/catch/.test(setting), "設定讀取失敗要吞掉並退回");

const picker = readFileSync(new URL("../src/components/PipelineBrainPicker.tsx", import.meta.url), "utf8");
// 頁面要老實說哪些角色是寫死的，不然這個下拉又會被誤解成整家切換
assert.ok(picker.includes("Maya") && picker.includes("Iris"), "要列出各角色固定的供應商");

// 「只要 Claude 有額度就自動執行」：不可以有任何把供應商記成壞掉而停用的設計
const provider = readFileSync(new URL("../src/lib/ai-provider.ts", import.meta.url), "utf8");
assert.ok(!/circuitBreaker|disabledProvider|providerCooldown/i.test(provider), "不可以把失敗的供應商記起來停用，否則 Claude 補額度後不會自己回來");
const derivatives = readFileSync(new URL("../src/lib/derivatives-ai.ts", import.meta.url), "utf8");
assert.ok(derivatives.includes('PROVIDER_FALLBACK = ["anthropic"'), "Claude 要排第一順位，補額度後下一篇就會自己用回它");

console.log("pipeline-provider-setting 通過");
