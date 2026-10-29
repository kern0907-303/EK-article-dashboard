import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildRevisePrompt } from "../src/data/skills/revise-prompt";
import { buildCitationDirective } from "../src/data/skills/citation-rules";

const draft = "開花不是為了換來誰\n\n" + "這是一段內文。".repeat(40);

// 修改模式必須帶上一版全文，而且講明是修不是重寫
const revise = buildRevisePrompt(draft, ["品牌名稱當主詞：平衡空間想說的是"], null);
assert.ok(revise.includes(draft), "要把上一版全文帶上");
assert.ok(revise.includes("不是重新創作") && revise.includes("不要換題目"), "要講明只做修改");
assert.ok(revise.includes("1. 品牌名稱當主詞：平衡空間想說的是"), "問題要逐條列出");
assert.ok(revise.includes("不可以引用任何書籍"), "沒有出處時要禁止引用");

// 有出處時只准引那一本，而且是中文
const withCite = buildRevisePrompt(draft, ["引用有問題：《心流》"], { title: "自我慈悲", author: "克莉絲汀·聶夫" });
assert.ok(withCite.includes("只能引用《自我慈悲》"));
assert.ok(withCite.includes("一個英文字母都不可以出現"));

// 成本：修改提示詞必須明顯短於第一稿那一包。第一稿光是書籍筆記就吃掉大半
const firstDraftCitation = buildCitationDirective({ title: "自我慈悲", author: "克莉絲汀·聶夫" }, "筆".repeat(9000));
assert.ok(firstDraftCitation.length < 3200, "書籍筆記要截斷在 2500 字上下，不要整本塞進去");
assert.ok(revise.length < firstDraftCitation.length, "修改提示詞要比單是引用指令還短");

// 重寫要跳過 Iris 並改用便宜模型
const provider = readFileSync("src/lib/ai-provider.ts", "utf8");
assert.ok(provider.includes("subPromptsInput.reviseMode === true"), "要能辨識修改模式");
assert.ok(/reviseMode \? "gemini" : "anthropic"/.test(provider), "修改模式要用便宜模型");
assert.ok(/reviseMode[\s\S]{0,120}?Promise\.resolve\('\{"seo_keywords"/.test(provider), "修改模式要跳過 Iris");
assert.ok(provider.includes('runQueryWithFallback(prompt, config, true, mayaPreferred, mayaOptions)'), "Maya 要吃得到這個選擇");

// 第一稿不可以被改成便宜模型
const gen = readFileSync("src/lib/auto-generate.ts", "utf8");
const firstCall = gen.slice(gen.indexOf("const generated = await retry"), gen.indexOf("let draft = generated.text"));
assert.ok(!firstCall.includes("reviseMode"), "第一稿要維持原本的模型");
assert.ok(gen.includes("buildRevisePrompt(draft, problems, source.citation,"), "重寫要走精簡提示詞");
// SEO 優化器保留（艾瑞克 2026-10-28 決定：那是 FB 的品質把關，不是 SEO）
assert.ok(gen.includes("callSeoOptimizer"), "SEO 優化器要保留");

console.log("revise-cost 測試通過");
