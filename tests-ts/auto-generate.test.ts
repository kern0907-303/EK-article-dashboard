import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { amplifierNote, firstLine, firstParagraph, isCurrentRules, planStyles, readAmplifierNote, RULES_VERSION, rulesVersionNote } from "../src/lib/auto-generate";
import { AMPLIFIER_IDS, pickAmplifier, TITLE_AMPLIFIERS } from "../src/data/skills/title-amplifiers";
import { buildTitleDirective, TITLE_STYLES, TITLE_STYLE_IDS } from "../src/data/skills/title-styles";
import { OPENING_STYLES, OPENING_STYLE_IDS } from "../src/data/skills/opening-styles";
import { SUBHEAD_RULES } from "../src/data/skills/subhead-rules";
import { GENRES, GENRE_LIST } from "../src/data/skills/genres";

// 規則版本：寫進 warnings 用來分辨哪些已排程的稿是舊規則寫的
assert.match(RULES_VERSION, /^rules-\d{4}-\d{2}-\d{2}[a-z]?$/);
assert.equal(rulesVersionNote(), `規則版本：${RULES_VERSION}`);
assert.equal(isCurrentRules([rulesVersionNote(), "發文前提醒（不在文章裡）：補個案"]), true);
assert.equal(isCurrentRules(["規則版本：rules-2026-01-01"]), false);
assert.equal(isCurrentRules([]), false);
assert.equal(isCurrentRules(null), false);

// 取標題與第一段：第一段要跳過單獨一行的小標
const article = ["【標題在這裡】", "", "狀態不是性格", "", "那天她把看護送到門口，回頭看了一眼客廳。", "", "後面的內文。"].join("\n");
assert.equal(firstLine(article), "【標題在這裡】");
assert.equal(firstParagraph(article), "那天她把看護送到門口，回頭看了一眼客廳。");
assert.equal(firstParagraph(""), "");

// 題目階段指定的優先，而且四層指令都要附上去
const planned = planStyles("【本篇標題型】原話引用\n【本篇開場型】挑戰讀者\n【本篇文體】拆解", "seed-1", { titles: [], openings: [], amplifiers: [] });
assert.equal(planned.titleStyle, "quote");
assert.equal(planned.openingStyle, "challenge");
assert.ok(planned.directive.includes("原話引用") && planned.directive.includes("挑戰讀者"));
assert.ok(planned.directive.includes("拆解文"), "文體骨架也要附上去");
assert.ok(planned.directive.includes("視覺節奏"), "小標規則要附上去，而且是社群那一套");

// 沒指定時避開最近用過的，同 seed 結果固定
const a = planStyles("隨便一個題目", "seed-2", { titles: ["contrast", "contrast", "question"], openings: ["story", "story", "you"], amplifiers: [] });
assert.ok(!["contrast", "question"].includes(a.titleStyle));
assert.ok(!["story", "you"].includes(a.openingStyle));
assert.deepEqual(planStyles("隨便一個題目", "seed-2", { titles: ["contrast", "contrast", "question"], openings: ["story", "story", "you"], amplifiers: [] }), a);

// 沒有素材時不會挑到需要素材的開場型；「沒有附素材」這種否定說法也不算有素材
for (const seed of ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"]) {
  assert.ok(!["authority", "witness"].includes(planStyles("一個沒有附素材的題目", seed, { titles: [], openings: [], amplifiers: [] }).openingStyle), `${seed} 不該挑到需要素材的型`);
  assert.ok(!["authority", "witness"].includes(planStyles("這篇沒有逐字稿", seed, { titles: [], openings: [], amplifiers: [] }).openingStyle), `${seed} 否定說法不算有素材`);
}
// 提示詞真的帶了逐字稿就可以挑
assert.ok(Array.from({ length: 12 }, (_, i) => planStyles("口述逐字稿如下：…", `m${i}`, { titles: [], openings: [], amplifiers: [] }).openingStyle)
  .some((id) => id === "authority" || id === "witness"));

// 重新優化與流水線必須走同一個生成函式，不可以各寫一份
const reopt = readFileSync("src/app/api/auto-pipeline/reoptimize/route.ts", "utf8");
const tick = readFileSync("src/app/api/auto-pipeline/tick/route.ts", "utf8");
for (const [name, src] of [["reoptimize", reopt], ["tick", tick]] as const) {
  assert.ok(src.includes("generateFacebookDraft"), `${name} 要走共用核心`);
  assert.ok(!src.includes("callSeoOptimizer("), `${name} 不該自己呼叫 SEO 優化器`);
}

// 重新優化的防呆
assert.ok(reopt.includes("一次只能重寫一個平台"), "傳陣列要退回");
assert.ok(reopt.includes("status=eq.scheduled") && reopt.includes("status=eq.pending"), "只處理已排程且排程列仍待發的");
assert.ok(reopt.includes("generated.blockedReason"), "新稿沒過品管要保留舊稿");
assert.ok(reopt.includes("dryRun"), "要有試算模式");
assert.ok(reopt.includes("FB 主稿還是舊規則，請先重寫主稿"), "主稿還舊時不可以重寫衍生稿");
assert.ok(reopt.includes("rules_version"), "衍生平台的規則版本要記錄");
assert.ok(reopt.includes("delete previous.rules_version"), "主稿換了要讓衍生稿重新被列為待重寫");

// 衍生稿重寫：時間與排程列不變，只換內容，沒過關就不動
const multi = readFileSync("src/lib/auto-multiplatform.ts", "utf8");
assert.ok(multi.includes("export async function rewriteSocialPost"));
assert.ok(/rewriteSocialPost[\s\S]{0,2600}status=eq\.pending/.test(multi), "只改仍待發的排程列");
assert.ok(/rewriteSocialPost[\s\S]{0,2600}未通過品牌紅線/.test(multi), "紅線沒過要擋下");

// 標題強化手法：來自 Schwartz 38 條，疊在標題型上，一次一個，避開最近用過與會撞的
assert.equal(AMPLIFIER_IDS.length, 14);
for (const id of AMPLIFIER_IDS) {
  assert.equal(TITLE_AMPLIFIERS[id].source.author, "Eugene Schwartz", id);
  assert.match(TITLE_AMPLIFIERS[id].source.chapter || "", /^第 4 章第 \d+ 條$/, id);
}
assert.equal(new Set(AMPLIFIER_IDS.map((id) => TITLE_AMPLIFIERS[id].name)).size, 14);
// 與標題型重複的手法不會被挑到
assert.notEqual(pickAmplifier([], "x", "number"), "measure");
assert.notEqual(pickAmplifier([], "x", "target"), "excluded");
// 避開最近三次，同 seed 固定
const picked = pickAmplifier(["metaphor", "paradox", "warn"], "seed-amp");
assert.ok(!["metaphor", "paradox", "warn"].includes(picked));
assert.equal(pickAmplifier(["metaphor", "paradox", "warn"], "seed-amp"), picked);
// 記進 warnings 再讀回來
assert.equal(readAmplifierNote([amplifierNote("nameIt")]), "nameIt");
assert.equal(readAmplifierNote(["規則版本：x"]), null);
// 標題指令會帶上強化手法，而且不帶時不會出現
assert.ok(buildTitleDirective("scene", "sensory").includes("感官化"));
assert.ok(!buildTitleDirective("scene").includes("感官化"));

// 每一條規則都要說得出出處
for (const id of TITLE_STYLE_IDS) assert.ok(TITLE_STYLES[id].source.book, `標題型 ${id} 缺出處`);
for (const id of OPENING_STYLE_IDS) assert.ok(OPENING_STYLES[id].source.book, `開場型 ${id} 缺出處`);
for (const channel of ["facebook", "website"] as const) assert.ok(SUBHEAD_RULES[channel].source.book, `小標 ${channel} 缺出處`);
for (const genre of GENRE_LIST) assert.ok(GENRES[genre.id].source?.book, `文體 ${genre.id} 缺出處`);

console.log("auto-generate tests passed");
