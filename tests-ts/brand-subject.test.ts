import assert from "node:assert/strict";
import { brandSubjectHits, brandSubjectSentences, rewriteBrandSubject, checkFormat } from "../src/lib/quality-gate";

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

console.log("brand-subject 測試通過");
