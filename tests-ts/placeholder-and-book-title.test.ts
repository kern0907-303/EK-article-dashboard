// 2026-11-25 I8 那篇「你的店被模仿了，然後呢」漏掉的兩種缺陷。
//
// 一、正文留下整張空表，用全形括號包預留字樣，原本的 PLACEHOLDER 只認【】與 {{}}。
// 二、書名後面補了英文原名，書名規則是只用中文寫法。
//
// 「以下是一張簡單的盤點表…」這種引言句不在這裡擋：
// 已上線的 I8 文章有 15 篇都這樣寫，後面接的都是真內容，那是行文習慣不是缺陷。
import assert from "node:assert/strict";
import { applyMechanicalFixes, runQualityGate, gateBlockers } from "../src/lib/quality-gate";

const codes = (text: string) =>
  gateBlockers(runQualityGate(text, { platform: "website" })).map((issue) => issue.code);

// ── 預留字樣 ──────────────────────────────────────────────
{
  const bad = [
    "老闆常常說不清楚客人為什麼會留下來。",
    "客人 A，（填入當時狀況），（填入你的判斷），（回購、介紹、留下來）",
    "客人 B，（填入當時狀況），（填入你的判斷），（回購、介紹、留下來）",
    "寫完之後你會看到一個共同點。",
  ].join("\n");
  assert.ok(codes(bad).includes("placeholder"), "全形括號的預留字樣要擋下來");
}
for (const bad of ["（請填你的答案）", "（待補數字）", "(自行填入日期)", "（需補來源）", "【待補：訪談紀錄】"]) {
  assert.ok(codes(`這是一段正常的內文。${bad}後面還有別的句子。`).includes("placeholder"), `${bad} 要擋`);
}

// 正常的括號註記不可以誤擋
for (const ok of [
  "他那天說的是客人回購，不是新客（這兩件事常常被混在一起）。",
  "以下是一張簡單的盤點表，可以直接用來整理這個問題：",
  "她做的是服務業（餐飲），不是零售。",
]) {
  assert.ok(!codes(`開頭一句話。${ok}結尾一句話。`).includes("placeholder"), `不該擋：${ok}`);
}

// ── 書名帶英文原名 ────────────────────────────────────────
{
  const bad = "本文引用觀點出自麥可．波特所著《競爭策略》（Competitive Strategy）。";
  assert.ok(codes(bad).includes("book_foreign_name"), "書名後面的英文原名要擋");

  const fixed = applyMechanicalFixes(bad);
  assert.equal(fixed.text, "本文引用觀點出自麥可．波特所著《競爭策略》。");
  assert.ok(fixed.fixes.some((f) => f.includes("英文原名")), "修正清單要記下來");
  assert.ok(!codes(fixed.text).includes("book_foreign_name"), "修完就不該再被擋");
}
{
  // 實際查到的另外兩本
  const two = "《創業這條路》（The E-Myth Revisited）與《快思慢想》（Thinking, Fast and Slow）都談過這件事。";
  const fixed = applyMechanicalFixes(two);
  assert.equal(fixed.text, "《創業這條路》與《快思慢想》都談過這件事。");
}
{
  // 書名後面接中文括號註記不可以誤拿掉
  const keep = "《競爭策略》（麥可．波特著）談的是位置。";
  assert.equal(applyMechanicalFixes(keep).text, keep);
  assert.ok(!codes(keep).includes("book_foreign_name"));
}

console.log("placeholder and book title tests passed");

// ── 2026-11-26 再補三條 ────────────────────────────────────
// 11/25 到 11/28 連著六筆排程被編輯 AI 擋下，問題都在官網文章：
// 表格被壓平、殘留結構標記、書名用句子寫出英文原名。

// 壓平的表格
{
  const bad = [
    "三步可以自己跑一遍。",
    "步驟，問自己的問題，目的",
    "往前推三個月，當時做了哪些關鍵決定？，找到決定的起點",
    "確認決策依據，那個決定是根據數字還是感覺？是主動選的還是沒有選擇？，看見判斷的品質",
  ].join("\n");
  assert.ok(codes(bad).includes("flattened_table"), "句末標點後面緊接逗號要擋");
}
// 正常的句子不可以誤擋
for (const ok of [
  "你有沒有想過這件事？想過的話，先把它寫下來。",
  "他問我，那現在該怎麼辦。",
  "這不是能力問題。真正的問題，是判斷沒有被看見。",
]) {
  assert.ok(!codes(`開頭。${ok}結尾句。`).includes("flattened_table"), `不該擋：${ok}`);
}

// 殘留的結構標記
{
  const bad = "前面一段正常的內文。\n\n結尾\n\n最後一句收束的話。";
  assert.ok(codes(bad).includes("structure_marker"), "單獨成行的結尾要擋");
  assert.ok(!codes("他說這是結尾了。").includes("structure_marker"), "句子裡的結尾不該擋");
  assert.ok(!codes("結尾的時候她才說出口。").includes("structure_marker"), "開頭是結尾兩字的句子不該擋");
}

// 書名英文原名的句子寫法
{
  const bad = "本文引用觀點出自麥克·葛伯所著《創業這條路》，原書英文書名為 The E-Myth Revisited。";
  assert.ok(codes(bad).includes("book_foreign_name"), "子句寫法也要擋");
  const fixed = applyMechanicalFixes(bad);
  assert.equal(fixed.text, "本文引用觀點出自麥克·葛伯所著《創業這條路》。");
  assert.ok(!codes(fixed.text).includes("book_foreign_name"), "修完就不該再被擋");
}

console.log("flattened table, structure marker and book clause tests passed");
