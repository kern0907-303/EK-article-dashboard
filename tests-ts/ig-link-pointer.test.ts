import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pointIgLinkToBio } from "../src/lib/derivatives-core.mjs";

// 2026-11-02：IG 與 Threads 的衍生稿是從 FB 主稿改寫的，主稿寫「連結我放在留言區第一則」，
// 這句話原封不動被帶到 IG。但 Threads/IG 的排程執行器根本不貼留言，
// 待發的 72 則 IG 裡有 50 則在叫讀者去看一個不存在的留言。
// 決定：IG 改指個人簡介（IG 本來的慣例），Threads 另外補首則留言。

// 指路連結的句子要改
assert.equal(pointIgLinkToBio("詳細資訊與連結我放在留言區第一則。"), "詳細資訊與連結我放在個人簡介。");
assert.equal(pointIgLinkToBio("連結放在留言裡。"), "連結放在個人簡介。");
assert.equal(pointIgLinkToBio("小測的網址在第一則留言。"), "小測的網址在個人簡介。");
// 邀請互動的句子不可以動，那不是指路
assert.equal(pointIgLinkToBio("歡迎在留言區和我聊聊。"), "歡迎在留言區和我聊聊。");
assert.equal(pointIgLinkToBio("你也有同樣的狀況嗎？留言告訴我。"), "你也有同樣的狀況嗎？留言告訴我。");
// 同一段裡兩種都有時，只改指路那一句
assert.equal(
  pointIgLinkToBio("連結我放在留言區第一則。歡迎在留言區跟我說你的狀況。"),
  "連結我放在個人簡介。歡迎在留言區跟我說你的狀況。",
);
// 不要留下「個人簡介第一則」這種殘句
assert.ok(!pointIgLinkToBio("連結在留言區第一則").includes("第一則"));
// 空值不要炸
assert.equal(pointIgLinkToBio(""), "");
assert.equal(pointIgLinkToBio(null), "");

const multi = readFileSync(new URL("../src/lib/auto-multiplatform.ts", import.meta.url), "utf8");
// IG 發佈前一定要過這道機械修正，光靠提示詞不可靠
assert.ok(multi.includes("pointIgLinkToBio(derived.instagram)"), "IG 內容要套用機械修正");
// Threads 不可以被改掉，它會有首則留言
assert.ok(!multi.includes("pointIgLinkToBio(derived.threads)"), "Threads 維持留言區寫法");
// 提示詞也要寫清楚，讓模型一開始就寫對
assert.ok(multi.includes("IG 的連結指路一律寫個人簡介"), "提示詞要有 IG 規則");
assert.ok(multi.includes("Threads 版的連結指路維持留言區第一則"), "提示詞要說明 Threads 不同");

const derivatives = readFileSync(new URL("../src/lib/derivatives-ai.ts", import.meta.url), "utf8");
assert.ok(derivatives.includes("連結放在個人簡介"), "編輯器那條衍生路徑也要有同一條規則");

console.log("ig-link-pointer 測試通過");
