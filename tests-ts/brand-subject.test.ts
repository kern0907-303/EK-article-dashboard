import assert from "node:assert/strict";
import { brandSubjectHits, brandSubjectSentences, rewriteBrandSubject, checkFormat, enforceCopyRules, voiceReport } from "../src/lib/quality-gate";

const subjects = (text: string, brandId?: string) =>
  brandSubjectHits(text, brandId).filter((hit) => hit.reason === "subject");

// 2026-10-27 回歸案例：這幾句實際出現在已排程的文章裡，舊版動詞白名單全部漏掉
for (const bad of [
  "平衡空間想在這裡停一下，問一個問題",
  "平衡空間邀請你問自己一個問題",
  "初八企業顧問談現金流分層管理",
  "艾伯林量子調頻提醒你，狀態先於方法",
  "平衡空間關注的，正是這個過程",
  "平衡空間，想問你一個問題",
]) {
  assert.ok(subjects(bad).length > 0, `應該要擋下來：${bad}`);
}

// 合法用法不可以誤擋
for (const ok of [
  "我在平衡空間帶過一個案子，那個老闆什麼都做對了。",
  "平衡空間的生命數字，說的是同一件事。",
  "那天我去的是初八企業顧問。",
  "#平衡空間 #生命數字",
  "他後來找艾伯林量子調頻做了一次調頻。",
]) {
  assert.deepEqual(subjects(ok), [], `不該擋：${ok}`);
}

// 合法用法也有上限：全文最多出現一次
const twice = "我在平衡空間帶過一個案子。平衡空間的生命數字，說的是同一件事。";
assert.deepEqual(subjects(twice), []);
assert.ok(brandSubjectHits(twice).some((hit) => hit.reason === "repeat"));
// 主題標籤不計入次數
assert.ok(!brandSubjectHits("我在平衡空間帶過一個案子。\n\n#平衡空間").some((hit) => hit.reason === "repeat"));

// 指定品牌時只檢查該品牌，大小寫都要能對上
assert.ok(subjects("初八企業顧問談現金流", "i8").length > 0);
assert.ok(subjects("初八企業顧問談現金流", "I8").length > 0);
assert.deepEqual(subjects("初八企業顧問談現金流", "nas"), []);

// 整句挑出來給 AI 當重寫依據
const article = "平衡空間想在這裡停一下。\n這句沒問題。\n平衡空間邀請你問自己一個問題。";
const sentences = brandSubjectSentences(article, "nas");
assert.ok(sentences.some((line) => line.includes("想在這裡停一下")));
assert.ok(sentences.some((line) => line.includes("邀請你")));
assert.ok(!sentences.some((line) => line.includes("這句沒問題")));

// 機械式修正：句首品牌名換成第一人稱，換完就不該再被擋
const fixed = rewriteBrandSubject("平衡空間想在這裡停一下，問一個問題。\n平衡空間邀請你問自己一個問題。", "nas");
assert.equal(fixed.text, "我想在這裡停一下，問一個問題。\n我邀請你問自己一個問題。");
assert.ok(fixed.fixes.length > 0);
assert.deepEqual(subjects(fixed.text, "nas"), []);
// 合法用法不可以被機械式修正動到
assert.equal(rewriteBrandSubject("我在平衡空間帶過一個案子。", "nas").text, "我在平衡空間帶過一個案子。");
assert.equal(rewriteBrandSubject("平衡空間的生命數字很準。", "nas").text, "平衡空間的生命數字很準。");
assert.equal(rewriteBrandSubject("#平衡空間", "nas").text, "#平衡空間");

// 品管仍會回報（維持 warn，不讓既有排程整批發不出去）
const reported = checkFormat("平衡空間想在這裡停一下，問一個問題。", "facebook");
const voice = reported.find((issue) => issue.code === "brand_voice");
assert.ok(voice, "品管要回報 brand_voice");
assert.equal(voice!.level, "warn");

// 審稿端點（Paperclip）：品牌當主詞要升級成必改項，所以 passed 會是 false
const bad = enforceCopyRules("平衡空間想在這裡停一下，問一個問題。這一段是為了讓你看清楚自己現在卡在哪裡，而不是急著找方法。", "facebook");
assert.deepEqual(bad.blockers, [], "不該變成發布閘的 blocker，否則既有排程會整批發不出去");
assert.ok(bad.voice.hits.length > 0, "voice.hits 要抓到");
assert.ok(!bad.voice.suggestion.includes("平衡空間想"), "suggestion 要是修好的版本");

const okCopy = enforceCopyRules("我在平衡空間帶過一個案子，那個老闆什麼都做對了，結果還是卡住。問題不在方法，在狀態。", "facebook");
assert.deepEqual(okCopy.voice.hits, []);
assert.equal(okCopy.voice.suggestion, okCopy.text, "沒違規時建議版本等於原文");

// voiceReport 單獨使用
assert.deepEqual(voiceReport("我在平衡空間帶過一個案子。").hits, []);
assert.ok(voiceReport("初八企業顧問談現金流", "i8").hits.length > 0);

console.log("brand-subject 測試通過");

// 2026-10-27：這兩條警告在實際重寫的五篇裡 5/5 全中，等於沒有鑑別度，調整過門檻
import { runQualityGate } from "../src/lib/quality-gate";
const codesOf = (text: string) => runQualityGate(text, { platform: "facebook" }).map((i) => i.code);

// 結尾是主題標籤行，不該被判成「結尾沒有標點」
const withTags = `${"這是一段完整的文章內容，用來測試結尾判斷是不是正確。".repeat(6)}\n\n生命數字 #自我探索 #人生節奏 #關係說明書`;
assert.ok(!codesOf(withTags).includes("no_end_punctuation"), "標籤結尾不該誤報");
// 正文真的沒有結尾標點，仍然要報
const noPunct = `${"這是一段完整的文章內容，用來測試結尾判斷是不是正確。".repeat(6)}最後一句沒有標點\n\n#標籤`;
assert.ok(codesOf(noPunct).includes("no_end_punctuation"), "正文沒標點還是要報");
// 正文被截斷在逗號，仍然要擋
const cut = `${"這是一段完整的文章內容，用來測試結尾判斷是不是正確。".repeat(6)}然後他說，\n\n#標籤`;
assert.ok(codesOf(cut).includes("truncated"), "截斷仍要擋");

console.log("警告門檻測試通過");
