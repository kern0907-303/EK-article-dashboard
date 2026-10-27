import assert from "node:assert/strict";
import {
  buildTitleDirective, detectTitleStyle, pickTitleStyle, readTitleStyleFromPrompt,
  repeatedStyleWarning, TITLE_STYLES, TITLE_STYLE_IDS, titleStyleFromText,
} from "../src/data/skills/title-styles";
import { buildGenreDirective, readGenreFromPrompt } from "../src/data/skills/genres";

// 清單本身：八型、名稱不重複、每型都有規則與範例
assert.equal(TITLE_STYLE_IDS.length, 8);
assert.equal(new Set(TITLE_STYLE_IDS.map((id) => TITLE_STYLES[id].name)).size, 8);
for (const id of TITLE_STYLE_IDS) {
  assert.ok(TITLE_STYLES[id].rule.length > 10, id);
  assert.ok(TITLE_STYLES[id].examples.length >= 2, id);
}

// 名稱與代號互轉
assert.equal(titleStyleFromText("原話引用"), "quote");
assert.equal(titleStyleFromText("blunt"), "blunt");
assert.equal(titleStyleFromText("隨便亂打"), null);
assert.equal(readTitleStyleFromPrompt("本篇目標：破圈\n【本篇標題型】場景切片\n其他"), "scene");
assert.equal(readTitleStyleFromPrompt("沒有指定"), null);

// 判型：用真實出現過的標題測
assert.equal(detectTitleStyle("醒來就覺得沉，不是你的問題，是狀態在說話"), "contrast");
assert.equal(detectTitleStyle("道理都懂，為什麼還是做不到？"), "question");
assert.equal(detectTitleStyle("老闆最常扛的三件不該扛的事"), "number");
assert.equal(detectTitleStyle("「我只是想休息一下」，這句話她說了三年"), "quote");
assert.equal(detectTitleStyle("撐住從來不是辦法"), "blunt");
assert.equal(detectTitleStyle("給那個永遠最後一個下班的人"), "target");
assert.equal(detectTitleStyle("自卑不是你的缺陷，它是你當時最誠實的回應"), "contrast");
assert.equal(detectTitleStyle(""), null);
// 不可誤判：數量詞不在前段、或只是「最後一個」「用兩個」這種說法，一律判不出，才不會誤發提醒
assert.equal(detectTitleStyle("給那個永遠最後一個下班的人"), "target");
assert.equal(detectTitleStyle("睡前三分鐘自我覺察練習：用兩個問題看見今天的自己"), null);
assert.equal(detectTitleStyle("你沒有變壞，你只是現在狀態很緊，性格與狀態是兩件不同的事"), null);
assert.equal(detectTitleStyle("睡不著的兩種，處理方式完全不同"), "number");

// 挑型：避開最近 3 篇用過的，同一個 seed 結果固定
const avoided = pickTitleStyle(["contrast", "contrast", "question"], "job-1");
assert.ok(!["contrast", "question"].includes(avoided));
assert.equal(pickTitleStyle(["contrast", "contrast", "question"], "job-1"), avoided);
// 全部都用過時仍要給得出一型，不可以當掉
assert.ok(TITLE_STYLE_IDS.includes(pickTitleStyle(TITLE_STYLE_IDS, "job-2")));

// 連續三篇同型才提醒
assert.ok(repeatedStyleWarning("contrast", ["contrast", "contrast"]).includes("否定對比"));
assert.equal(repeatedStyleWarning("contrast", ["contrast", "question"]), "");
assert.equal(repeatedStyleWarning(null, ["contrast", "contrast"]), "");

// 指令文字：要講清楚只管標題，不動品牌規範
const directive = buildTitleDirective("quote");
assert.ok(directive.includes("原話引用") && directive.includes("紅線"));
assert.ok(!/[—–─―]|--/.test(directive));

// 文體指令：附加用，不取代整份提示詞
assert.equal(readGenreFromPrompt("【本篇文體】拆解文"), "breakdown");
assert.equal(readGenreFromPrompt("【本篇文體】觀點表態"), null);
assert.ok(buildGenreDirective("case").includes("案例文"));

console.log("title-styles tests passed");
