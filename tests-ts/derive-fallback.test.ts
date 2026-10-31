import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { robustJSONParse } from "../src/lib/ai-provider";

// 2026-10-31：Anthropic 沒額度那五十分鐘內，衍生稿改寫連續四次失敗，
// Telegram 收到「AI 改寫失敗，改用機械式截斷（AI 回傳格式無法解析）」。
// 查出來跟文章長度無關（失敗的母稿平均 1276 字，比成功的 1316 字還短），
// 真正原因有兩個：
// 一、completeText 只有 Anthropic 與 OpenAI 兩家，沒有 Gemini，
//     而有額度的正是 Gemini；Anthropic 失敗還被安靜吞掉。
// 二、parseDerived 用最陽春的 JSON.parse，模型稍微包一層就整個失敗。

const complete = readFileSync(new URL("../src/lib/social-image-server.ts", import.meta.url), "utf8");
assert.ok(complete.includes("GEMINI_API_KEY"), "completeText 要有 Gemini 這一家");
assert.ok(complete.includes("[completeText] 三家都沒成功"), "三家都失敗要留下紀錄，不可以安靜吞掉");
// 被截斷的半截內容拿去解析一定失敗，要當成失敗換下一家
assert.ok(complete.includes("max_tokens"), "Anthropic 被截斷要判斷出來");
assert.ok(complete.includes('finish_reason !== "length"'), "OpenAI 被截斷要判斷出來");
assert.ok(complete.includes('finishReason !== "MAX_TOKENS"'), "Gemini 被截斷要判斷出來");
// OpenAI 原本沒有給輸出上限，長文很容易被模型預設值切斷
assert.ok(complete.includes("max_completion_tokens"), "OpenAI 要帶輸出上限");

const multi = readFileSync(new URL("../src/lib/auto-multiplatform.ts", import.meta.url), "utf8");
assert.ok(multi.includes("robustJSONParse(raw)"), "衍生稿要把原始回應交給寬鬆解析");
assert.ok(!multi.includes("JSON.parse(raw.slice"), "不可以再自己切括號加陽春的 JSON.parse");

// 寬鬆解析實際能救的是這兩種：包一層程式碼區塊、JSON 後面多寫一句說明。
// 尾逗號它救不回來，不要在這裡假裝可以。
const body = '{"threads":"甲","instagram":"乙","slides":["丙","丁"]}';
assert.equal((robustJSONParse(body) as any).threads, "甲");
assert.equal((robustJSONParse("```json\n" + body + "\n```") as any).instagram, "乙", "包程式碼區塊要能救回來");
assert.equal((robustJSONParse(body + "\n\n以上是三個版本，請確認。") as any).instagram, "乙", "後面多一句說明要能救回來");

// 2026-10-31 第二輪：補上三家回退之後，重跑那四篇仍然失敗。
// 新埋的診斷紀錄直接給出答案：
//   anthropic HTTP 400 額度不足；openai 回傳被長度上限截斷；gemini 回傳被 maxOutputTokens 截斷。
// 也就是輸出上限本身就不夠。規格要求 Threads 400-460 字、IG 900-1500 字、
// 輪播 5-7 張各 40 字，合計約 1500 到 2240 個中文字，3000 tokens 裝不下。
assert.ok(multi.includes("+ note, 8000)"), "衍生稿的輸出上限要夠裝下規格要求的字數");
assert.ok(!multi.includes("+ note, 3000)"), "3000 會被截斷，不可以退回去");

const carousel = readFileSync(new URL("../src/app/api/carousel-slides/route.ts", import.meta.url), "utf8");
assert.ok(!carousel.includes("article.slice(0, 6000), 900)"), "輪播 900 太緊，同樣會被截斷");

// 這是艾瑞克要的審核機制：目前全自動，改寫失敗卻照樣排程發出。
// 機械截斷的內容通過得了品管與品牌紅線，因為它本來就是已經過關的母稿，
// 所以品管擋不住它，必須在排程之前單獨擋一次。
assert.ok(multi.includes('if (derived.source !== "ai")'), "改寫沒成功就不可以排程");
assert.ok(multi.includes("不排程以免把母稿原文直接貼到社群"), "要說清楚為什麼不排程");
// 官網在這之前就處理完了，擋 IG 與 Threads 不會連帶影響官網
assert.ok(multi.indexOf('want("website")') < multi.indexOf('if (derived.source !== "ai")'), "官網必須在這道閘門之前完成");

console.log("derive-fallback 測試通過");
