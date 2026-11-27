// 文體「數字對照」：只開放平衡空間、每三篇一篇（到 2026-12-31）、事實表避開最近 9 篇、
// 結構只在七型之間輪替並避開最近 3 篇、提示詞帶入事實表與範例、額外擋稿規則。
import assert from "node:assert/strict";
import { buildGenrePrompt, GENRES, genresForBrand, readGenreFromPrompt } from "../src/data/skills/genres";
import {
  buildNumerologyJobPrompt, checkNumerologyText, NUMEROLOGY_FACTS, NUMEROLOGY_SCHEDULE, NUMEROLOGY_STRUCTURES,
  numerologyNote, numerologyScheduleActive, pickFactItem, pickNumerologyStructure, readNumerologyNote, shouldUseNumerology,
} from "../src/data/skills/numerology-compare";
import { planStyles } from "../src/lib/auto-generate";
import { FLOW_STRUCTURES, pickFlowStructure } from "../src/data/skills/flow-structures";

// 1. 只有平衡空間的選單有數字對照
assert.ok(genresForBrand("nas").some((g) => g.id === "numerology" && g.name === "數字對照"));
for (const brand of ["abl", "i8", "erick"] as const) {
  assert.ok(!genresForBrand(brand).some((g) => g.id === "numerology"), `${brand} 不可出現數字對照`);
  assert.throws(() => buildGenrePrompt(brand, { genre: "numerology", funnel: "cold", claim: "", material: "", metaphor: "", length: "", cta: "" }));
}

// 2. 主工作區提示詞：帶事實表、寫作規則、範例與「不可照抄」，不放入口橋接
{
  const prompt = buildGenrePrompt("nas", { genre: "numerology", funnel: "cold", claim: "", material: "生日八個數字裡 1 的個數", metaphor: "", length: "", cta: "" });
  assert.ok(prompt.includes("【事實表】") && prompt.includes("【寫作規則】") && prompt.includes("不可照抄"));
  assert.ok(prompt.includes("【本篇骨子】只用事實表的這一項當論點：生日八個數字裡 1 的個數"));
  assert.ok(prompt.includes("主命數不會是 0"));
  assert.ok(GENRES.numerology.claimOptional && !GENRES.numerology.materialRequired);
}

// 3. 比例：前面兩篇都不是數字對照才排，到期日後不排；別的品牌、指定文體、階段專案、有真實素材都不換
const base = { brandId: "nas", prompt: "這週的選題", scheduledAt: "2026-12-01T02:00:00Z", recentFlags: [] as boolean[] };
assert.equal(NUMEROLOGY_SCHEDULE.every, 3);
assert.equal(NUMEROLOGY_SCHEDULE.until, "2026-12-31");
assert.equal(shouldUseNumerology({ ...base, recentFlags: [false, false] }), true);
assert.equal(shouldUseNumerology({ ...base, recentFlags: [true, false] }), false);
assert.equal(shouldUseNumerology({ ...base, recentFlags: [false, true] }), false);
assert.equal(shouldUseNumerology({ ...base, recentFlags: [false, false, true] }), true);
assert.equal(shouldUseNumerology({ ...base, brandId: "abl" }), false);
assert.equal(shouldUseNumerology({ ...base, projectId: "p1" }), false);
assert.equal(shouldUseNumerology({ ...base, prompt: "【本篇文體】邀請" }), false);
assert.equal(shouldUseNumerology({ ...base, prompt: "附上我的口述逐字稿" }), false);
assert.equal(shouldUseNumerology({ ...base, scheduledAt: "2026-12-31T15:00:00Z" }), true, "台北 12/31 23:00 還算");
assert.equal(shouldUseNumerology({ ...base, scheduledAt: "2026-12-31T16:30:00Z" }), false, "台北 2027-01-01 之後不排");
assert.equal(numerologyScheduleActive("2027-01-02T00:00:00Z"), false);
// 模擬連續九篇：每三篇剛好一篇
{
  const flags: boolean[] = [];
  for (let i = 0; i < 9; i += 1) flags.unshift(shouldUseNumerology({ ...base, recentFlags: flags }));
  assert.equal(flags.filter(Boolean).length, 3);
}

// 4. 事實表：避開最近 9 篇用過的項目
{
  const recent = NUMEROLOGY_FACTS.slice(0, 9).map((item) => item.id);
  for (let i = 0; i < 30; i += 1) assert.ok(!recent.includes(pickFactItem(recent, `seed-${i}`).id));
  assert.ok(NUMEROLOGY_FACTS.length > 9, "項目數要多於避開的篇數，否則會無項可挑");
}

// 5. 結構：只在七型之間，避開最近 3 篇
{
  const recent = ["J3", "D1", "C5"];
  for (let i = 0; i < 30; i += 1) {
    const id = pickNumerologyStructure(recent, `seed-${i}`);
    assert.ok((NUMEROLOGY_STRUCTURES as readonly string[]).includes(id) && !recent.includes(id));
  }
  for (const id of NUMEROLOGY_STRUCTURES) assert.ok(FLOW_STRUCTURES[id]?.brands.includes("nas"), `${id} 要能用在平衡空間`);
  // 主工作區自動挑結構時也只會落在七型之內
  for (let i = 0; i < 20; i += 1) assert.ok((NUMEROLOGY_STRUCTURES as readonly string[]).includes(pickFlowStructure({ brand: "nas", genre: "numerology", seed: `m-${i}` })));
}

// 6. 流水線題目：planStyles 讀得到文體與結構，別的品牌不認
{
  const item = NUMEROLOGY_FACTS[1];
  const prompt = buildNumerologyJobPrompt(item, "J4");
  assert.equal(readGenreFromPrompt(prompt), "numerology");
  const plan = planStyles(prompt, "job-1", { titles: [], openings: [], amplifiers: [], structures: [] }, "nas");
  assert.equal(plan.genre, "numerology");
  assert.equal(plan.structure, "J4");
  assert.ok(plan.directive.includes("【本篇文體：數字對照】") && plan.directive.includes("【事實表】"));
  const other = planStyles(prompt, "job-1", { titles: [], openings: [], amplifiers: [], structures: [] }, "abl");
  assert.equal(other.genre, null, "其他品牌不可出現數字對照");
  const free = planStyles("【本篇文體】數字對照", "job-2", { titles: [], openings: [], amplifiers: [], structures: ["J3", "J4", "J5"] }, "nas");
  assert.ok(["D1", "D5", "C5", "C7"].includes(free.structure), "沒指定結構時避開最近 3 篇");
}

// 題目指定了七型以外的結構，數字對照不採用
{
  const odd = planStyles("【本篇文體】數字對照\n【本篇流量結構】J1", "job-3", { titles: [], openings: [], amplifiers: [], structures: [] }, "nas");
  assert.ok((NUMEROLOGY_STRUCTURES as readonly string[]).includes(odd.structure));
}

// 7. 記號：寫進 warnings 之後讀得回來
assert.equal(readNumerologyNote([numerologyNote(NUMEROLOGY_FACTS[3])]), NUMEROLOGY_FACTS[3].id);
assert.equal(readNumerologyNote(["其他提醒"]), null);

// 8. 額外擋稿
{
  const ok = "【標題】\n\n數數看你的生日有幾個 1。\n\n這幾天留意一下身邊那個人。";
  assert.equal(checkNumerologyText(ok).filter((i) => i.level === "block").length, 0);
  const bad = (text: string) => checkNumerologyText(`${ok}\n${text}`).some((i) => i.level === "block");
  assert.ok(bad("這是注定的"));
  assert.ok(bad("他可能會外遇"));
  assert.ok(bad("加 LINE 領取"));
  assert.ok(bad("一次 1200 元"));
  assert.ok(bad("下一篇再說"));
  assert.ok(bad("小芳的先生"), "照抄範例人名要擋");
  assert.ok(checkNumerologyText("【標題】\n\n數數看").some((i) => i.level === "warn"), "少了這幾天留意要提醒");
}

console.log("numerology compare tests passed");
