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

console.log("derive-fallback 測試通過");
