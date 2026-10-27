import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { citedBookTitles, unverifiedCitations, vagueResearchClaim } from "../src/lib/quality-gate";
import { buildCitationDirective } from "../src/data/skills/citation-rules";

// 2026-10-27 回歸案例：這篇實際排進 ABL 的發佈佇列，引了不在知識庫裡的書
const popper = [
  "你第一次聽到調頻這幾個字，腦袋裡冒出的第一個念頭，大概不是好奇，是警覺。",
  "哲學家卡爾．波普爾在他的著作《猜想與反駁》裡提出，一個好的理論，必須是可以被反駁的。",
  "文中引用的觀點，出自卡爾．波普爾所著《猜想與反駁》。",
].join("\n");

assert.deepEqual(citedBookTitles(popper), ["猜想與反駁"], "書名要抓出來且去重");

// 沒有查證過的出處時，任何引用都算違規
assert.deepEqual(unverifiedCitations(popper, null), ["猜想與反駁"]);
// 查證過的是別本時，一樣違規
assert.deepEqual(unverifiedCitations(popper, { title: "心流" }), ["猜想與反駁"]);
// 就是那一本時才放行
assert.deepEqual(unverifiedCitations(popper, { title: "猜想與反駁" }), []);
// 完全沒引用的文章永遠通過
assert.deepEqual(unverifiedCitations("這篇沒有引用任何書，只有自己的觀察。", null), []);

// 沒指名出處的研究宣稱：只提醒不擋稿
assert.ok(vagueResearchClaim("研究顯示睡眠會影響判斷力"));
assert.ok(vagueResearchClaim("專家指出這樣不對"));
assert.equal(vagueResearchClaim("我自己的觀察是這樣"), "");

// 沒有出處時，指令要明確禁止引用
const banned = buildCitationDirective(null, "");
assert.ok(banned.includes("不可以引用任何書籍"));
assert.ok(banned.includes("《》"), "要明講不可以出現書名號");
assert.ok(banned.includes("研究顯示"), "要擋沒有指名出處的說法");

// 有出處時，只能引那一本，而且要照艾瑞克的歸屬格式
const allowed = buildCitationDirective({ title: "心流", author: "契克森米哈伊" }, "筆記內容");
assert.ok(allowed.includes("《心流》"));
assert.ok(allowed.includes("作者某某提出"), "要帶出歸屬格式");
assert.ok(allowed.includes("出自契克森米哈伊所著《心流》"), "要帶出文末出處格式");
assert.ok(allowed.includes("不要副標題"));
assert.ok(allowed.includes("一律用中文"), "書名作者要用中文");
assert.ok(allowed.includes("寧可不引用"), "用不到就不要硬引");
// 筆記內容要截斷，不要把整本塞進提示詞
assert.ok(buildCitationDirective({ title: "A", author: "B" }, "x".repeat(99999)).length < 9000);

// 自動流水線一定要接上知識庫，而且未查證引用必須擋稿
const gen = readFileSync("src/lib/auto-generate.ts", "utf8");
assert.ok(gen.includes("chooseKnowledgeSource"), "FB 主稿要從知識庫取出處");
assert.ok(gen.includes("unverifiedCitations(draft, source.citation)"), "要比對實際引用");
assert.ok(/uncited\.length[\s\S]{0,200}?引經據典只能用知識庫/.test(gen), "未查證引用要變成擋稿原因");
assert.ok(gen.includes("citationDirective"), "引用規則要進提示詞");

console.log("citation-guard 測試通過");
