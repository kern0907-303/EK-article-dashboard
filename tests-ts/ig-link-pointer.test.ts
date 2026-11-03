import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pointIgLinkToDm, IG_DM_HINT } from "../src/lib/derivatives-core.mjs";

// IG 的留言與說明欄連結都不能點，個人簡介又只能放一個固定網址，
// 帶不了每篇不同的追蹤參數。IG 唯一能給可點連結又能分篇追蹤的方式是私訊，
// 所以說明欄一律改成叫讀者留關鍵字，由 n8n 的 instagram_comment_dm 把連結私訊出去。

// 指路句一律換成留關鍵字
assert.equal(pointIgLinkToDm("詳細資訊與連結我放在留言區第一則。"), IG_DM_HINT + "。");
assert.equal(pointIgLinkToDm("連結放在留言裡。"), IG_DM_HINT + "。");
assert.equal(pointIgLinkToDm("小測的網址在第一則留言。"), IG_DM_HINT + "。");
// 上一版改成個人簡介的也要跟著換掉，不能留著舊寫法
assert.equal(pointIgLinkToDm("連結放在個人簡介。"), IG_DM_HINT + "。");
assert.equal(pointIgLinkToDm("測驗的網址在個人簡介。"), IG_DM_HINT + "。");
// 沒有「連結」兩個字也要抓到：提到個人簡介就是指路，沒人會閒聊個人簡介
assert.equal(pointIgLinkToDm("詳細說明與免費體驗入口，放在個人簡介。"), IG_DM_HINT + "。");

// 邀請互動的句子不是指路，不可以動
assert.equal(pointIgLinkToDm("歡迎在留言區和我聊聊。"), "歡迎在留言區和我聊聊。");
assert.equal(pointIgLinkToDm("你也有同樣的狀況嗎？留言告訴我。"), "你也有同樣的狀況嗎？留言告訴我。");

// 混在同一段時只換指路那一句
assert.equal(
  pointIgLinkToDm("連結我放在留言區第一則。歡迎在留言區跟我說你的狀況。"),
  IG_DM_HINT + "。歡迎在留言區跟我說你的狀況。"
);

// 換完不可以還留著舊說法
const after = pointIgLinkToDm("連結在留言區第一則。測驗網址在個人簡介。");
assert.ok(!after.includes("第一則"), "不可以還有第一則");
assert.ok(!after.includes("個人簡介"), "不可以還有個人簡介");

assert.equal(pointIgLinkToDm(""), "");
assert.equal(pointIgLinkToDm(null), "");

// 發佈路徑要真的套用，而且只套在 IG
const multi = readFileSync(new URL("../src/lib/auto-multiplatform.ts", import.meta.url), "utf8");
assert.ok(multi.includes("pointIgLinkToDm(derived.instagram)"), "IG 內容要套用機械修正");
assert.ok(!multi.includes("pointIgLinkToDm(derived.threads)"), "Threads 有首則留言，維持留言區寫法");
assert.ok(!multi.includes("pointIgLinkToBio"), "舊的個人簡介版本要移除乾淨");

// 提示詞要跟機械修正講同一件事，而且要禁止在 IG 寫網址
assert.ok(multi.includes("IG 的連結不能點"), "系統提示詞要說明 IG 連結不能點");
const ai = readFileSync(new URL("../src/lib/derivatives-ai.ts", import.meta.url), "utf8");
assert.ok(ai.includes("不要寫任何網址"), "改寫提示詞要禁止 IG 寫網址");
assert.ok(ai.includes("我私訊給你"), "改寫提示詞要指向留關鍵字");
assert.ok(ai.includes("維持母文章的「連結在留言區第一則」寫法"), "Threads 的規則不動");

console.log("ig-link-pointer 測試通過");
