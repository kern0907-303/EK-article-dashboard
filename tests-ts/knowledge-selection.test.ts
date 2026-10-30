import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildNumberedKnowledgeCatalog, resolveKnowledgeSelection } from "../src/lib/derivatives-core.mjs";

// 2026-10-31 回歸案例：艾瑞克看了兩天、三個品牌各近 10 篇，沒有任何一篇引用知識庫的書。
// 不是還沒排到。選書這一支有兩個會讓它永遠失敗、而且不留痕跡的設計：
// 一、要模型把 uuid 原樣抄回來，抄錯一個字元就對不到任何一本。
// 二、所有失敗路徑都安靜回 null，查不出原因。

const directory = [
  { id: "11111111-1111-1111-1111-111111111111", title: "Flow", author: "Csikszentmihalyi", title_zh: "心流", author_zh: "米哈里·契克森米哈伊", domain: "emotions", subdomain: "動機" },
  { id: "22222222-2222-2222-2222-222222222222", title: "Atomic Habits", author: "James Clear", title_zh: "原子習慣", author_zh: "詹姆斯·克利爾", domain: "life", subdomain: "習慣" },
];

// 目錄用編號，模型只要回一個整數
const catalog = buildNumberedKnowledgeCatalog(directory);
assert.deepEqual(catalog.map((item) => item.no), [1, 2]);
// 書名作者要用中文，跟文章實際要寫的是同一組字
assert.equal(catalog[0].title, "心流");
assert.equal(catalog[0].author, "米哈里·契克森米哈伊");
// uuid 不可以出現在送給模型的目錄裡，不然它又會想抄 uuid
assert.ok(!JSON.stringify(catalog).includes("11111111"), "目錄不要帶 uuid");

// 回編號對得到
assert.equal(resolveKnowledgeSelection(directory, { no: 2 })?.id, directory[1].id);
assert.equal(resolveKnowledgeSelection(directory, { no: "1" })?.id, directory[0].id);
assert.equal(resolveKnowledgeSelection(directory, { number: 2 })?.id, directory[1].id);
// 舊格式回 uuid 也要還能用，不要讓改版把既有行為弄壞
assert.equal(resolveKnowledgeSelection(directory, { id: directory[1].id })?.id, directory[1].id);
// 沒有貼近的書時模型回 0，要當成沒選到
assert.equal(resolveKnowledgeSelection(directory, { no: 0 }), null);
// 超出範圍、亂回、空值都要安全
assert.equal(resolveKnowledgeSelection(directory, { no: 99 }), null);
assert.equal(resolveKnowledgeSelection(directory, { id: "not-a-real-id" }), null);
assert.equal(resolveKnowledgeSelection(directory, null), null);
assert.equal(resolveKnowledgeSelection(directory, "3" as unknown), null);
assert.equal(resolveKnowledgeSelection([], { no: 1 }), null);

// 選書不可以因為 AI_PROVIDER 沒設就整支死掉。
// 其他路徑（Maya、官網改寫、社群改寫）都有自己的回退或直接讀金鑰，所以文章照樣生得出來，
// 只有這一支會死，症狀就是「文案正常但永遠沒有引用」。
const ai = readFileSync("src/lib/derivatives-ai.ts", "utf8");
// 2026-10-31 實際事故（Render 日誌）：
//   anthropic failed: Your credit balance is too low to access the Anthropic API
// 主稿、官網、社群那幾支都有 runQueryWithFallback，所以照樣產出；
// 選書這一支是單一供應商、失敗就丟錯，再被吞掉，所以文章永遠沒有引用。
assert.ok(ai.includes("PROVIDER_FALLBACK"), "選書要有供應商回退清單");
assert.ok(/for \(const provider of order\)/.test(ai), "要一家一家試");
assert.ok(/console\.warn\("\[knowledge\] 供應商失敗，換下一家："/.test(ai), "換家要留日誌");
assert.ok(ai.includes("所有供應商都失敗。"), "全部失敗才丟錯，而且要帶每一家的原因");
assert.ok(ai.includes("callOneProvider"), "單一供應商呼叫要拆出來給回退用");
// AI_PROVIDER 是 mock、n8n 或沒設都不可以讓選書整支死掉
assert.ok(/\(PROVIDER_FALLBACK as readonly string\[\]\)\.includes\(wanted\) \? wanted : PROVIDER_FALLBACK\[0\]/.test(ai), "供應商值不認得時要走預設順序");
assert.ok(!/provider === "mock" \|\| provider === "n8n"\) throw/.test(ai), "不可以再因為 mock 直接丟錯");

// 同一次事故的第二件事：Anthropic 沒額度回退到 OpenAI，OpenAI 也全部 400，
//   openai failed: 模型 gpt-6-luna：'temperature' does not support 0.7
// 等於「Claude 沒額度轉 GPT」那張安全網一直是斷的，實際上都掉到 Gemini。
const provider = readFileSync("src/lib/ai-provider.ts", "utf8");
assert.ok(/\/temperature\/i\.test\(firstError\)/.test(provider), "模型不收 temperature 時要拿掉重送");
assert.ok(/delete requestBody\.temperature/.test(provider), "重送前要真的拿掉那個欄位");
assert.ok(/response = await send\(\)/.test(provider), "要重送一次，不是只記錯誤");
assert.ok(provider.includes("不接受指定的 temperature"), "重送要留日誌，下次才查得到");
assert.ok(ai.includes("buildNumberedKnowledgeCatalog"), "要用編號目錄");
assert.ok(ai.includes("resolveKnowledgeSelection"), "要用編號對映");
assert.ok(!/\\"id\\":\\"目錄中的原始 id\\"/.test(ai), "不要再叫模型回 uuid");

// 每一條失敗路徑都要留下原因，不可以安靜回 null
assert.ok(/const fail = \(reason: string/.test(ai), "要有統一的失敗回報");
assert.ok(ai.includes("console.warn(\"[knowledge] 沒有取到出處：\""), "失敗要寫進日誌");
assert.ok(ai.includes("知識庫目錄是空的"));
assert.ok(ai.includes("選書步驟沒有對到目錄裡的書"));
assert.ok(ai.includes("讀不到筆記內容"));
assert.ok(ai.includes("筆記與目錄不一致"));
assert.ok(!/catch \{\s*\n\s*\/\/ 知識來源暫時不可用/.test(ai), "catch 不可以吞掉錯誤訊息");

// 原因要一路帶到 warnings，艾瑞克才看得出為什麼這篇沒有引用
const gen = readFileSync("src/lib/auto-generate.ts", "utf8");
assert.ok(/reason: source\.reason \|\| "選書步驟沒有回傳出處"/.test(gen), "取不到時要帶原因");
assert.ok(gen.includes("本篇沒有取到知識庫出處，已禁止引用。原因："), "warnings 要寫出原因");
assert.ok(/中文欄位不完整或未確認/.test(gen), "中文欄位沒過也要說清楚是哪一欄");

console.log("knowledge-selection 測試通過");
