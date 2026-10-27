import assert from "node:assert/strict";
import {
  bannedOpeningWarning, buildOpeningDirective, detectOpeningStyle, OPENING_STYLES, OPENING_STYLE_IDS,
  openingStyleFromText, pickOpeningStyle, readOpeningStyleFromPrompt, repeatedOpeningWarning,
} from "../src/data/skills/opening-styles";
import { buildSubheadDirective, extractSubheads, SUBHEAD_RULES, subheadWarning } from "../src/data/skills/subhead-rules";

// 清單：九型，名稱不重複，每型都有規則、範例與出處
assert.equal(OPENING_STYLE_IDS.length, 9);
assert.equal(new Set(OPENING_STYLE_IDS.map((id) => OPENING_STYLES[id].name)).size, 9);
for (const id of OPENING_STYLE_IDS) {
  assert.ok(OPENING_STYLES[id].rule.length > 10, id);
  assert.ok(OPENING_STYLES[id].examples.length >= 1, id);
  assert.ok(OPENING_STYLES[id].source.includes("Caples"), id);
}
// 需要真實素材的兩型
assert.deepEqual(OPENING_STYLE_IDS.filter((id) => OPENING_STYLES[id].requiresMaterial), ["authority", "witness"]);

// 名稱與代號互轉、從提示詞讀取
assert.equal(openingStyleFromText("挑戰讀者"), "challenge");
assert.equal(openingStyleFromText("story"), "story");
assert.equal(openingStyleFromText("亂打"), null);
assert.equal(readOpeningStyleFromPrompt("【本篇標題型】原話引用\n【本篇開場型】社論式\n其他"), "editorial");
assert.equal(readOpeningStyleFromPrompt("沒有指定"), null);

// 判型
assert.equal(detectOpeningStyle("「我只是想休息一下。」她說完這句，停了幾秒。"), "witness");
assert.equal(detectOpeningStyle("那天她把看護送到門口，回頭看了一眼客廳。"), "story");
assert.equal(detectOpeningStyle("我看了二十年，最常被弄錯的就是這一件事。"), "firstperson");
assert.equal(detectOpeningStyle("你已經把能調的都調過一遍了，然後還是這樣。"), "you");
assert.equal(detectOpeningStyle("這一篇不是寫給還在找標準答案的人。"), "challenge");
assert.equal(detectOpeningStyle(""), null);
assert.equal(detectOpeningStyle("每一個要負責的位置，都有一段沒有人教的空白期。"), null);

// 挑型：避開最近 3 篇，沒有素材時不挑需要素材的型，同 seed 結果固定
const noMaterial = pickOpeningStyle([], "job-1", false);
assert.ok(!OPENING_STYLES[noMaterial].requiresMaterial);
assert.equal(pickOpeningStyle([], "job-1", false), noMaterial);
const avoided = pickOpeningStyle(["story", "story", "you"], "job-2", true);
assert.ok(!["story", "you"].includes(avoided));
assert.ok(OPENING_STYLE_IDS.includes(pickOpeningStyle(OPENING_STYLE_IDS, "job-3", true)));

// 連續三篇同型才提醒
assert.ok(repeatedOpeningWarning("story", ["story", "story"]).includes("說故事"));
assert.equal(repeatedOpeningWarning("story", ["story", "you"]), "");

// 禁用開頭：這是目前 58% 的罐頭開場
assert.ok(bannedOpeningWarning("很多人都有這種感覺，努力了卻還是卡住。").includes("很多人"));
assert.ok(bannedOpeningWarning("你有沒有過這種經驗？").includes("你有沒有"));
assert.equal(bannedOpeningWarning("那天她把看護送到門口。"), "");
// 泛稱出現在後面不算違規
assert.equal(bannedOpeningWarning("她站在門口沒有進去。很多人都是這樣。"), "");

// 指令文字：要講清楚只管開場，而且帶禁用開頭
const directive = buildOpeningDirective("story", "scene");
assert.ok(directive.includes("說故事") && directive.includes("很多人"));
assert.ok(directive.includes("標題已經用了同一個手法"), "標題型場景切片與開場型說故事會撞，要提醒");
assert.ok(!buildOpeningDirective("story", "number").includes("標題已經用了同一個手法"));
assert.ok(!/[—–─―]|--/.test(directive));

// 小標：兩套規則存在且不同
assert.equal(SUBHEAD_RULES.facebook.count[0], 3);
assert.ok(SUBHEAD_RULES.website.rule.includes("問句小標"));
assert.ok(!SUBHEAD_RULES.facebook.rule.includes("AI 搜尋擷取"));
assert.ok(buildSubheadDirective("website").includes("導航"));

const article = ["標題放這裡", "", "第一段內容，講一個具體的場景，長度夠長才會被當成內文。", "", "狀態不是性格", "", "這一段在解釋狀態與性格的差別，寫得比較長一點。", "", "先看見再調整", "", "最後一段收尾，給一個小動作。"].join("\n");
assert.deepEqual(extractSubheads(article), ["狀態不是性格", "先看見再調整"]);
assert.ok(subheadWarning(article, "facebook").includes("只有 2 個小標"));
assert.ok(subheadWarning(article, "website").includes("問句小標"));
assert.equal(subheadWarning(["標題放這裡", "", "第一段內文，寫得夠長。", "", "狀態不是性格", "", "內文。", "", "先看見再調整", "", "內文。", "", "今天可以做的一件事", "", "內文。"].join("\n"), "facebook"), "");

console.log("opening-styles tests passed");
