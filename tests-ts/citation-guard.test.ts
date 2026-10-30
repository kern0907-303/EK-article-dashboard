import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { citedBookTitles, unverifiedCitations, vagueResearchClaim } from "../src/lib/quality-gate";
import { allowedCitationFromTitles, buildCitationDirective } from "../src/data/skills/citation-rules";

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
assert.ok(allowed.includes("副標題"), "要禁止副標題");
assert.ok(allowed.includes("中文寫法"), "書名作者要用中文");
assert.ok(allowed.includes("寧可不引用"), "用不到就不要硬引");
// 筆記內容要截斷，不要把整本塞進提示詞
assert.ok(buildCitationDirective({ title: "A", author: "B" }, "x".repeat(99999)).length < 9000);

// 自動流水線一定要接上知識庫，而且未查證引用必須擋稿
const gen = readFileSync("src/lib/auto-generate.ts", "utf8");
assert.ok(gen.includes("chooseKnowledgeSource"), "FB 主稿要從知識庫取出處");
assert.ok(gen.includes("unverifiedCitations(text, source.citation)"), "要比對實際引用");
assert.ok(/uncited\.length[\s\S]{0,260}?引經據典只能用知識庫/.test(gen), "未查證引用要變成擋稿原因");
assert.ok(gen.includes("citationDirective"), "引用規則要進提示詞");

// 2026-10-27 回歸案例：第一版用了資料表的英文欄位，實際跑出
// 《Self-Compassion: The Proven Power of Being Kind to Yourself》，Dr. Kristin Neff
// 違反「書名作者一律用中文」與「只寫主書名不要副標題」兩條規則
const zh = buildCitationDirective({ title: "自我慈悲", author: "克莉絲汀·聶夫" }, "筆記");
assert.ok(zh.includes("《自我慈悲》") && zh.includes("克莉絲汀·聶夫"));
assert.ok(zh.includes("一個英文字母都不可以出現"), "要明講不可以出現英文原名");
assert.ok(!/Self-Compassion|Kristin/.test(zh), "指令裡不可以夾帶英文原名");

// 英文原名若出現在文章裡，要被當成違規抓出來
const enInBody = "《Self-Compassion: The Proven Power of Being Kind to Yourself》作者 Dr. Kristin Neff 提出，善待自己是可以練的。";
assert.ok(unverifiedCitations(enInBody, { title: "自我慈悲" }).length > 0, "英文書名要被擋");
// 中文正確寫法要放行
assert.deepEqual(unverifiedCitations("《自我慈悲》作者克莉絲汀·聶夫提出，善待自己是可以練的。", { title: "自我慈悲" }), []);

// 取出處時必須用中文欄位，而且中文沒確認就不准引用
const gen2 = readFileSync("src/lib/auto-generate.ts", "utf8");
assert.ok(gen2.includes("note?.title_zh") && gen2.includes("note?.author_zh"), "要用中文欄位");
assert.ok(gen2.includes('note?.zh_status !== "confirmed"'), "中文沒確認就不准引用");
assert.ok(gen2.includes("citationProblems"), "英文原名要納入違規判定");

// 2026-10-28 回歸案例：引用查證原本只做在 FB 主稿。
// 官網文章走 auto-multiplatform 的 callWebArticle 獨立改寫，IG / Threads 走 deriveVersions，
// 兩條路都可以自己憑記憶長出一本書，官網因此掛了十幾篇沒查證的引用。
// 母稿恰好一本書時沿用那一本（已經查證過），其他情況一律不准引用。
assert.deepEqual(allowedCitationFromTitles(["猜想與反駁"]), { title: "猜想與反駁" });
assert.equal(allowedCitationFromTitles([]), null, "母稿沒引用時衍生稿也不准引用");
assert.equal(allowedCitationFromTitles(["心流", "自我慈悲"]), null, "母稿兩本以上無法判斷哪本查證過");

const multi = readFileSync("src/lib/auto-multiplatform.ts", "utf8");
assert.ok(multi.includes("allowedCitationFromTitles(citedBookTitles(master))"), "衍生稿要以母稿為引用依據");
assert.ok(multi.includes("unverifiedCitations(written.article, allowedCitation)"), "官網文章要比對引用");
assert.ok(/官網文章引用未經查證/.test(multi), "官網未查證引用要擋稿，不是只提醒");
assert.ok(multi.includes("unverifiedCitations(optimizedText, allowedCitation)"), "SEO 優化版也要比對引用");
assert.ok(/socialCites/.test(multi), "一鍵重寫社群稿要比對引用");
assert.ok(/const cites = citeBlock\(content\);[\s\S]{0,80}?throw new Error\(cites\)/.test(multi), "初次產生的 IG / Threads 也要擋");
assert.equal((multi.match(/throw new Error\(cites\)/g) || []).length, 2, "IG 與 Threads 兩條路都要擋");

console.log("衍生稿引用查證測試通過");

console.log("citation-guard 測試通過");

// 2026-10-31：選書修好之後，連續三篇都「拿到出處但正文沒用」。
// 原因不是選書，是指令把不引用設成了最省力的選項：
// 前面一整串嚴格格式要求（歸屬寫法、不可出現英文字母、文末固定一行），
// 後面接一句「用不到就完全不要引用」，模型當然選不引用。
// 預設翻成引用，但保留艾瑞克說的「不是每一篇」：真的無關才不引用。
{
  const directive = buildCitationDirective({ title: "心流", author: "米哈里" }, "筆記內容");
  assert.ok(directive.includes("就要引用它一次，不要省略"), "有可用觀點時要引用，不能省略");
  assert.ok(directive.includes("確實與本篇主題無關時，才不引用"), "保留真的無關就不引用的退路");
  assert.ok(!directive.includes("如果這一篇用不到這本書，就完全不要引用"), "舊的那句把不引用設成最省力選項，不可以留著");
  // 沒拿到出處時仍然完全禁止引用，這條是硬規則不可以鬆
  const none = buildCitationDirective(null, "");
  assert.ok(none.includes("不可以引用任何書籍"), "沒有出處就完全禁止引用");
}
