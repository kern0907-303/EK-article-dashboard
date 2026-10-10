import assert from "node:assert/strict";
import test from "node:test";
import { CARD_MAX_SLIDES, cardFontSize, cleanCardText, parseCarouselSlides } from "../src/lib/card-slides.mjs";
import { igCaptionWithTags, parseIgParts, parseThreadParts } from "../src/lib/derivative-parts.mjs";
import { deriveChecks } from "../src/lib/derivatives-core.mjs";

const IG = `說明文字：調和不是一夕之間改變人生。
先慢慢看見自己。
標籤：人生調頻、自我覺察、#穩定
第 1 張：調和不是一夕之間改變人生
第 2 張：先看見，再談改變
第 3 張：不逼迫自己的節奏
也是一種前進`;

test("輪播文字依序取出，多行合併，說明與標籤不混進去", () => {
  const slides = parseCarouselSlides(IG);
  assert.equal(slides.length, 3);
  assert.deepEqual(slides.map((s) => s.index), [1, 2, 3]);
  assert.equal(slides[0].text, "調和不是一夕之間改變人生");
  assert.equal(slides[2].text, "不逼迫自己的節奏\n也是一種前進");
});

test("輪播最多 10 張，空張被略過，沒有輪播時回傳空陣列", () => {
  const many = Array.from({ length: 14 }, (_, i) => `第 ${i + 1} 張：句子${i + 1}`).join("\n");
  assert.equal(parseCarouselSlides(many).length, CARD_MAX_SLIDES);
  assert.equal(parseCarouselSlides("第 1 張：\n第 2 張：有字").length, 1);
  assert.deepEqual(parseCarouselSlides("說明文字：只有說明"), []);
});

test("字級依字數遞減，封面比內頁大", () => {
  assert.ok(cardFontSize("短句", true) > cardFontSize("短句", false));
  assert.ok(cardFontSize("字".repeat(10)) > cardFontSize("字".repeat(60)));
  assert.equal(cardFontSize("字".repeat(300)), 44);
});

test("卡片文字去掉破折號與 Markdown 符號", () => {
  const out = cleanCardText("先停下來——看見自己 - 再說 **重點** # 標題");
  assert.ok(!/[—\-*#]/.test(out), out);
});

test("Threads 單則與串文拆成可分別複製的片段", () => {
  const parts = parseThreadParts("單則版：一句話版本\n串文第 1 則：第一則\n接續內容\n串文第 2 則：第二則\n串文第 3 則：第三則");
  assert.deepEqual(parts.map((p) => p.label), ["單則版", "串文第 1 則", "串文第 2 則", "串文第 3 則"]);
  assert.equal(parts[1].text, "第一則\n接續內容");
});

test("IG 說明與標籤合併成可直接貼的文字", () => {
  const { caption, tags } = parseIgParts(IG);
  assert.equal(caption, "調和不是一夕之間改變人生。\n先慢慢看見自己。");
  assert.deepEqual(tags, ["人生調頻", "自我覺察", "穩定"]);
  assert.equal(igCaptionWithTags(IG), "調和不是一夕之間改變人生。\n先慢慢看見自己。\n\n#人生調頻 #自我覺察 #穩定");
  assert.equal(igCaptionWithTags("沒有說明"), "");
});

test("deriveChecks 會帶入額外阻擋項目，且不重複", () => {
  const base = { parentText: "母文", content: "內容", platform: "Threads", languageVersion: "zh-TW" };
  assert.deepEqual(deriveChecks(base).blockers, []);
  const result = deriveChecks({ ...base, extraBlockers: ["文體禁用詞：立刻翻轉", "文體禁用詞：立刻翻轉"] });
  assert.deepEqual(result.blockers, ["文體禁用詞：立刻翻轉"]);
  assert.equal(result.status, "needs_review");
});
