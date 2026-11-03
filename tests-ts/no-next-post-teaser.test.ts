import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyMechanicalFixes } from "../src/lib/quality-gate";

// 他明確說過不要出跨篇預告的系列文。讀者多半只會看到其中一篇，
// 被預告的那一篇他不會記得，也不一定讀得到，等於把結尾浪費在不會兌現的承諾上。
// 2026-11-03 查到待發的 19 則 IG 與 12 則 FB 母稿都還有這種句子，
// 代表當時只有口頭約定、規則沒有進系統。

// 整句移除，其他內容不動
const a = applyMechanicalFixes("先看見，再決定下一步。\n\n下一篇，我會談什麼是調頻。\n\n文中引用的觀點，出自某書。");
assert.ok(!a.text.includes("下一篇"), "預告句要移除");
assert.ok(a.text.includes("先看見，再決定下一步。"), "正文不可被誤刪");
assert.ok(a.text.includes("文中引用的觀點"), "引用行不可被誤刪");
assert.ok(a.fixes.some((f) => f.includes("下一篇預告")), "要回報移除了幾句");

// 同一行裡混著正文與預告，只移除預告那一句
const b = applyMechanicalFixes("這件事今天就能開始。下次再聊為什麼。");
assert.ok(!b.text.includes("下次再聊"), "下次再聊也算預告");
assert.ok(b.text.includes("這件事今天就能開始。"), "同一行的正文要留著");

// 「下一步」不是預告，不可以誤殺
const c = applyMechanicalFixes("先看清楚現在在哪裡，再決定下一步。");
assert.equal(c.text, "先看清楚現在在哪裡，再決定下一步。");
assert.ok(!c.fixes.some((f) => f.includes("下一篇預告")), "不可以誤判");

// 沒有預告時不要留下多餘的修正紀錄
const d = applyMechanicalFixes("一段普通的文字。");
assert.equal(d.text, "一段普通的文字。");

// 提示詞也要寫進去，不能只靠機械修正把生成的東西擦掉
const genres = readFileSync(new URL("../src/data/skills/genres.ts", import.meta.url), "utf8");
assert.ok(genres.includes("不預告下一篇"), "文體規則要禁止跨篇預告");
const story = readFileSync(new URL("../src/data/skills/story-argument.ts", import.meta.url), "utf8");
assert.ok(story.includes("不預告下一篇"), "故事論點架構也要禁止跨篇預告");

console.log("no-next-post-teaser 測試通過");
