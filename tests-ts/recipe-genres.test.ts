// 自然流量測試第一輪：配方標籤、身體入口（艾伯林專用）、貫徹（初八專用）、三個新配方的共用規矩、成效回流查詢。
import assert from "node:assert/strict";
import { buildGenrePrompt, GENRES, genresForBrand, readGenreFromPrompt } from "../src/data/skills/genres";
import {
  BODY_ENTRY_LAYERS, BODY_ENTRY_SEEDS, BODY_ENTRY_STRUCTURES, buildBodyEntryJobPrompt, buildFollowThroughJobPrompt, checkBodyEntryText,
  checkFollowThroughText, checkRecipeCommon, FOLLOW_THROUGH_ENTRY, FOLLOW_THROUGH_SCENES, FOLLOW_THROUGH_STRUCTURES, pickRecipeStructure,
  readRecipeGroup, readStructureTag, rotate, withRecipeTags,
} from "../src/data/skills/recipe-genres";
import { buildNumerologyJobPrompt, NUMEROLOGY_FACTS } from "../src/data/skills/numerology-compare";
import { planStyles } from "../src/lib/auto-generate";
import { tagJobPrompt } from "../src/lib/auto-pipeline-server";
import { readFlowStructureFromPrompt, FLOW_STRUCTURES } from "../src/data/skills/flow-structures";
import { attributeJob, fbResultsContain, shortcodeFromUrl } from "../src/lib/post-attribution";
import { checkGenreText } from "../src/lib/genre-check";
import { structureAllowedForGenre } from "../src/data/skills/genre-structures";

const empty = { titles: [], openings: [], amplifiers: [], structures: [] };

// 一、配方標籤
{
  const old = "本篇目標：破圈。\n【本篇標題型】反直覺\n【本篇文體】拆解\n品牌：平衡空間";
  const tagged = tagJobPrompt(old);
  assert.ok(tagged.startsWith("【本篇結構型】未指定\n【本篇組別】對照組\n"), tagged);
  assert.equal(tagJobPrompt(tagged), tagged, "已經有標籤就不重複加");
  assert.ok(tagJobPrompt("【本篇流量結構】J3\n【本篇文體】拆解").startsWith("【本篇結構型】J3\n【本篇組別】對照組"));
  assert.ok(tagJobPrompt("【本篇文體】數字對照").includes("【本篇組別】新配方"));
  assert.equal(readRecipeGroup(old), "對照組", "舊任務沒有標籤，一律視為對照組");
  assert.equal(readStructureTag(old), null);
  assert.equal(readStructureTag("【本篇結構型】未指定"), null);
  assert.equal(readStructureTag("【本篇結構型】J4"), "J4");
  assert.equal(readFlowStructureFromPrompt("【本篇結構型】C7\n其他"), "C7", "流水線讀得到【本篇結構型】");
  assert.equal(readFlowStructureFromPrompt("【本篇結構型】未指定"), null);
  assert.ok(withRecipeTags("x", { structure: "D6", group: "新配方" }).startsWith("【本篇結構型】D6\n【本篇組別】新配方"));
  // 數字對照的流水線題目也帶標籤
  const nPrompt = buildNumerologyJobPrompt(NUMEROLOGY_FACTS[0], "J3");
  assert.equal(readStructureTag(nPrompt), "J3");
  assert.equal(readRecipeGroup(nPrompt), "新配方");
}

// 二、選單：身體入口只在艾伯林，貫徹只在初八
{
  assert.ok(genresForBrand("abl").some((g) => g.id === "bodyEntry" && g.name === "身體入口"));
  assert.ok(genresForBrand("i8").some((g) => g.id === "followThrough" && g.name === "貫徹"));
  for (const brand of ["nas", "i8", "erick"] as const) assert.ok(!genresForBrand(brand).some((g) => g.id === "bodyEntry"), `${brand} 不可有身體入口`);
  for (const brand of ["nas", "abl", "erick"] as const) assert.ok(!genresForBrand(brand).some((g) => g.id === "followThrough"), `${brand} 不可有貫徹`);
  assert.ok(!genresForBrand("abl").some((g) => g.id === "numerology"));
  assert.throws(() => buildGenrePrompt("nas", { genre: "bodyEntry", funnel: "cold", claim: "", material: "", metaphor: "", length: "", cta: "" }));
  assert.throws(() => buildGenrePrompt("abl", { genre: "followThrough", funnel: "cold", claim: "", material: "", metaphor: "", length: "", cta: "" }));
  const p = buildGenrePrompt("abl", { genre: "bodyEntry", funnel: "warm", claim: "", material: "肩膀", metaphor: "", length: "", cta: "" });
  assert.ok(p.includes("【本篇部位】肩膀") && p.includes("【本篇層次】") && p.includes("【七層】") && p.includes("【新配方共用規矩】"));
  assert.ok(p.includes("冷") , "新配方一律冷流量");
  const q = buildGenrePrompt("i8", { genre: "followThrough", funnel: "warm", claim: "", material: "", metaphor: "", length: "", cta: "" });
  assert.ok(q.includes(FOLLOW_THROUGH_ENTRY) && q.includes("站在老闆這一邊"));
  assert.ok(GENRES.bodyEntry.claimOptional && GENRES.followThrough.claimOptional);
}

// 三、結構限制：身體入口 J2、J4、C7；貫徹 D6、J6
{
  for (const id of [...BODY_ENTRY_STRUCTURES]) assert.ok(FLOW_STRUCTURES[id].brands.includes("abl") && FLOW_STRUCTURES[id].genres.includes("bodyEntry"));
  for (const id of [...FOLLOW_THROUGH_STRUCTURES]) assert.ok(FLOW_STRUCTURES[id].brands.includes("i8") && FLOW_STRUCTURES[id].genres.includes("followThrough"));
  const seed = BODY_ENTRY_SEEDS[0];
  const prompt = buildBodyEntryJobPrompt(seed, "感受", "J4");
  assert.equal(readGenreFromPrompt(prompt), "bodyEntry");
  const plan = planStyles(prompt, "job-1", empty, "abl");
  assert.equal(plan.genre, "bodyEntry");
  assert.equal(plan.structure, "J4");
  assert.ok(plan.directive.includes("【本篇文體：身體入口】"));
  assert.equal(planStyles(prompt, "job-1", empty, "nas").genre, null, "別的品牌不認身體入口");
  // 題目指定了範圍外的結構不採用
  const odd = planStyles("【本篇文體】身體入口\n【本篇流量結構】J1", "job-2", empty, "abl");
  assert.ok((BODY_ENTRY_STRUCTURES as readonly string[]).includes(odd.structure));
  for (let i = 0; i < 20; i += 1) {
    const free = planStyles("【本篇文體】貫徹", `job-${i}`, { ...empty, structures: ["D6"] }, "i8");
    assert.equal(free.genre, "followThrough");
    assert.equal(free.structure, "J6", "避開最近用過的那一型");
  }
  const ft = buildFollowThroughJobPrompt(FOLLOW_THROUGH_SCENES[0], "D6", true);
  assert.equal(planStyles(ft, "job-3", empty, "i8").structure, "D6");
  assert.equal(planStyles(ft, "job-3", empty, "abl").genre, null, "別的品牌不認貫徹");
  assert.ok(ft.includes("【本篇組別】新配方") && ft.includes("【本篇結構型】D6"));
  assert.equal(rotate(["J2", "J4", "C7"], 4), "J4");
  assert.ok(["J4", "C7"].includes(pickRecipeStructure(BODY_ENTRY_STRUCTURES, ["J2"], "s")));
  assert.equal(BODY_ENTRY_SEEDS.length, 10);
  assert.equal(BODY_ENTRY_LAYERS.length, 7);
}

// 四、擋稿
{
  const ok = "【早上醒來牙根痠】\n\n週一早上，她醒來發現牙根痠，整晚咬著牙。\n\n可能是白天的話沒說出口，可能是擔心明天的會，也可能只是太累。\n\n這幾天留意一下，你什麼時候會咬緊牙。";
  assert.equal(checkBodyEntryText(ok).filter((i) => i.level === "block").length, 0, JSON.stringify(checkBodyEntryText(ok)));
  const bad = (text: string) => checkBodyEntryText(`${ok}\n${text}`).some((i) => i.level === "block");
  assert.ok(bad("這是牙周病的前兆"), "病名");
  assert.ok(bad("調整頻率之後會改善"), "頻率與效果");
  assert.ok(bad("療效很好"));
  assert.ok(bad("原因就是你太壓抑"), "不可寫成定論");
  assert.ok(bad("壓抑的憤怒會造成胃痛"), "疾病與情緒對應");
  assert.ok(bad("歡迎私訊我"), "不放行動呼籲");
  assert.ok(bad("露易絲．賀說喉嚨代表表達"), "露易絲．賀要寫成她提出的看法");
  assert.ok(!bad("露易絲．賀提出的看法是，喉嚨和表達有關"));
  assert.ok(bad("讓你承擔了這麼久"), "照抄範例");
  assert.ok(bad("撐了一整天，扛著全家"), "卡住撐扛合計兩次以上");
  assert.ok(bad("下一篇再說"), "跨篇預告");
  assert.ok(bad("故事情境為示意"));
  assert.ok(bad("—— 破折號"));
  assert.ok(bad("**粗體**"));

  const okI8 = `【會議決定了，一週後沒人動】\n\n週一開會定好的事，下週一再問，大家都說還在排。\n\n${FOLLOW_THROUGH_ENTRY}\n\n這件事難在每個人都有理由。`;
  assert.equal(checkFollowThroughText(okI8).filter((i) => i.level === "block").length, 0, JSON.stringify(checkFollowThroughText(okI8)));
  const badI8 = (text: string) => checkFollowThroughText(`${okI8}\n${text}`).some((i) => i.level === "block");
  assert.ok(badI8("其實是老闆有問題"));
  assert.ok(badI8("能量不對"));
  assert.ok(badI8("七成的公司都這樣"));
  assert.ok(badI8("成長 30% "));
  assert.ok(checkFollowThroughText("每個公司最難的，是規定要被執行。").some((i) => i.level === "block"), "入口句要逐字照用");
  assert.equal(checkRecipeCommon("純文字，沒有問題。").length, 0);
}

// 五、成效回流：用貼文代號查回任務、文體、結構型、組別
{
  const job = { id: "j1", brand_id: "abl", prompt: buildBodyEntryJobPrompt(BODY_ENTRY_SEEDS[1], "看法", "C7"), warnings: ["本篇流量結構：C7 哲理短章"], scheduled_at: "2026-12-01T02:10:00Z" };
  const a = attributeJob(job);
  assert.equal(a.genre, "身體入口");
  assert.equal(a.structureTag, "C7");
  assert.equal(a.group, "新配方");
  const legacy = attributeJob({ id: "j0", brand_id: "nas", prompt: "【本篇文體】拆解", warnings: [] });
  assert.equal(legacy.group, "對照組");
  assert.equal(legacy.structureTag, "未指定");
  assert.equal(attributeJob(null).group, "對照組", "手動排程沒有任務，算對照組");
  assert.ok(fbResultsContain([{ ok: true, pageId: "fb_nas", fbPostId: "165873860149140_1804339348364772" }], "1804339348364772"));
  assert.ok(fbResultsContain([{ fbPostId: "165873860149140_1804339348364772" }], "165873860149140_1804339348364772"));
  assert.equal(shortcodeFromUrl("https://www.threads.com/@abliene358/post/DgQuIe1CnWR"), "DgQuIe1CnWR");
  assert.equal(shortcodeFromUrl("https://www.instagram.com/p/DgRXUUVilur/"), "DgRXUUVilur");
}

// 六、Codex 審查後補的：標籤在中間也要移到開頭；主工作區發文前檢查也套新配方規矩；結構限制共用
{
  const moved = withRecipeTags("題目第一行\n【本篇組別】新配方\n【本篇結構型】J4\n其他", {});
  assert.ok(moved.startsWith("【本篇結構型】J4\n【本篇組別】新配方\n題目第一行"), moved);
  assert.equal(moved.split("【本篇組別】").length, 2, "不重複");
  const issues = checkGenreText("【標題】\n\n肩膀撐了一天，扛著全家，下一篇再說。", { genre: "bodyEntry", funnel: "cold", prompt_version: "genre-v4" }, "facebook", "abl");
  assert.ok(issues.some((i) => i.code === "recipe" && i.level === "block"), JSON.stringify(issues));
  assert.ok(!checkGenreText("【標題】\n\n肩膀撐了一天，扛著全家。", { genre: "breakdown", funnel: "cold", prompt_version: "genre-v4" }, "facebook", "abl").some((i) => i.code === "recipe"), "舊文體不套新規矩");
  assert.ok(structureAllowedForGenre("bodyEntry", "J2") && !structureAllowedForGenre("bodyEntry", "J1"));
  assert.ok(structureAllowedForGenre("followThrough", "J6") && !structureAllowedForGenre("followThrough", "C7"));
  assert.ok(structureAllowedForGenre("breakdown", "J1"), "沒限制的文體不擋");
}

console.log("recipe genres tests passed");
