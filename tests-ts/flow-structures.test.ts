import assert from "node:assert/strict";
import {
  buildFlowCheckPrompt, buildFlowStructureCatalog, buildFlowStructureDirective, checkFlowRules, FLOW_DIRECTIVE_MARK,
  FLOW_STRUCTURE_IDS, FLOW_STRUCTURES, flowStructureFromText, flowStructureNote, normalizeFlowCheck,
  pickFlowStructure, readFlowStructureFromPrompt, readFlowStructureNote,
} from "../src/data/skills/flow-structures";
import { COPYWRITING_FRAMEWORKS, flowFrameworkId, flowStructureOfFramework } from "../src/data/skills/frameworks";
import { planStyles } from "../src/lib/auto-generate";

// 22 型：Jemmy 8、多米 7、加恩 7，每型都有至少 4 個檢查點，代號不重複
assert.equal(FLOW_STRUCTURE_IDS.length, 22);
assert.equal(FLOW_STRUCTURE_IDS.filter((id) => FLOW_STRUCTURES[id].family === "jemmy").length, 8);
assert.equal(FLOW_STRUCTURE_IDS.filter((id) => FLOW_STRUCTURES[id].family === "domy").length, 7);
assert.equal(FLOW_STRUCTURE_IDS.filter((id) => FLOW_STRUCTURES[id].family === "chiukaun").length, 7);
const checkpointIds = FLOW_STRUCTURE_IDS.flatMap((id) => FLOW_STRUCTURES[id].checkpoints.map((c) => c.id));
assert.equal(new Set(checkpointIds).size, checkpointIds.length, "檢查點代號不可重複");
for (const id of FLOW_STRUCTURE_IDS) {
  const s = FLOW_STRUCTURES[id];
  assert.ok(s.checkpoints.length >= 4, id);
  assert.ok(s.brands.length >= 1, id);
  assert.ok(s.checkpoints.every((c) => c.id.startsWith(`${id}-`)), id);
  const directive = buildFlowStructureDirective(id, "平衡空間");
  assert.ok(directive.startsWith(FLOW_DIRECTIVE_MARK), id);
  // 指令本身不可以出現破折號，模型會照著學
  assert.ok(!/[—―─━–]/.test(directive), `${id} 指令裡有破折號`);
  assert.ok(!/[—―─━–]/.test(`${s.name}${s.use}${s.sourceMove}${s.erickTwist}${s.limits || ""}`), `${id} 內容有破折號`);
  assert.ok(directive.includes("像但不模仿"), id);
  assert.ok(buildFlowCheckPrompt(id, "文章").includes(s.checkpoints[0].id), id);
}

// 名稱與代號互轉、從提示詞讀取、任務記號
assert.equal(flowStructureFromText("j3"), "J3");
assert.equal(flowStructureFromText("反常識宣言"), "J3");
assert.equal(flowStructureFromText("D7 好書導讀"), "D7");
assert.equal(flowStructureFromText("亂打"), null);
assert.equal(readFlowStructureFromPrompt("品牌：ABL\n【流量結構】C2\n題目"), "C2");
assert.equal(readFlowStructureFromPrompt("【本篇流量結構】等級階梯"), "J5");
assert.equal(readFlowStructureFromPrompt("沒有指定"), null);
assert.equal(readFlowStructureNote(["規則版本：x", flowStructureNote("D3")]), "D3");
assert.equal(readFlowStructureNote([]), null);

// 自動挑選：符合品牌、避開最近三篇、沒有素材不挑真實經歷型、不挑需要書的型、同 seed 固定
for (let i = 0; i < 30; i++) {
  const id = pickFlowStructure({ brand: "abl", seed: `s${i}`, recent: ["C1", "C6", "C7"] });
  const s = FLOW_STRUCTURES[id];
  assert.ok(s.brands.includes("abl"), `${id} 不適用 ABL`);
  assert.ok(!["C1", "C6", "C7"].includes(id), `${id} 應避開最近用過的`);
  assert.ok(!s.firstPersonReal, `${id} 沒有素材不該挑真實經歷型`);
  assert.ok(!s.needsCitation, `${id} 不該自動挑需要書的型`);
}
assert.equal(pickFlowStructure({ brand: "i8", seed: "x" }), pickFlowStructure({ brand: "i8", seed: "x" }));
assert.ok(Array.from({ length: 40 }, (_, i) => pickFlowStructure({ brand: "erick", seed: `m${i}`, hasMaterial: true }))
  .some((id) => FLOW_STRUCTURES[id].firstPersonReal), "有素材時可以挑到真實經歷型");
const caseOnly = pickFlowStructure({ brand: "nas", genre: "case", seed: "c1" });
assert.ok(FLOW_STRUCTURES[caseOnly].genres.includes("case"));

// 程式規則：破折號、招牌句、示意聲明
const bad = "【標題】\n這人叫小明——他很努力。\n\n（故事情境為示意）\n\n記得敲碗。";
const issues = checkFlowRules(bad, "J1");
assert.ok(issues.some((i) => i.level === "block" && i.message.includes("破折號")));
assert.ok(issues.some((i) => i.area === "像但不模仿" && i.message.includes("這人叫") && i.message.includes("敲碗")));
assert.ok(issues.some((i) => i.level === "block" && i.message.includes("示意")));
const clean = "【你不是不夠努力】\n她叫小晴，三十八歲，換過四份工作。\n\n➤ ❝ 先停下來，看懂自己的節奏 ❞\n\n後來她才懂。";
assert.ok(!checkFlowRules(clean, "J1").some((i) => i.level === "block"));
assert.ok(checkFlowRules(clean, "J1").some((i) => i.area === "像但不模仿" && i.level === "ok"));

// AI 回傳清理：引用的句子必須真的在文章裡，漏掉的步驟補成沒做到
const normalized = normalizeFlowCheck("J1", { checkpoints: [{ id: "J1-1", hit: "yes", evidence: "她叫小晴，三十八歲，換過四份工作。" }, { id: "J1-2", hit: "partial", evidence: "憑空捏造的句子" }] }, clean, true);
assert.equal(normalized.checkpoints.length, FLOW_STRUCTURES.J1.checkpoints.length);
assert.equal(normalized.checkpoints[0].evidence, "她叫小晴，三十八歲，換過四份工作。");
assert.equal(normalized.checkpoints[1].evidence, "", "找不到的句子不可以當證據");
assert.equal(normalized.checkpoints[4].hit, "no");
assert.ok(normalized.score > 0 && normalized.score < 100);
assert.equal(normalizeFlowCheck("J1", null, clean, false).aiAvailable, false);

// 寫作框架下拉：舊大師框架全部移除，預設是自動挑選
assert.equal(COPYWRITING_FRAMEWORKS.default.flowStructureId, "auto");
assert.equal(Object.keys(COPYWRITING_FRAMEWORKS).length, 23);
assert.equal(flowStructureOfFramework(flowFrameworkId("J3")), "J3");
assert.equal(flowStructureOfFramework("default"), "auto");
assert.equal(flowStructureOfFramework(undefined), "auto");
assert.equal(flowStructureOfFramework("funnel_architect"), "auto", "瀏覽器存著的舊代號當成自動挑選");
assert.equal(flowStructureOfFramework("story_argument"), null, "故事論點有自己的流程");

// 自動流水線：每篇都帶結構指令；沒指定開場型時不帶開場型指令，指定時保留
const plan = planStyles("一個題目", "seed-flow", { titles: [], openings: [], amplifiers: [], structures: [] }, "abl");
assert.ok(plan.directive.includes(FLOW_DIRECTIVE_MARK));
assert.ok(FLOW_STRUCTURES[plan.structure].brands.includes("abl"));
assert.ok(!plan.directive.includes("【本篇開場型"), "沒指定開場型時，開場交給流量結構");
const pinned = planStyles("【流量結構】J5\n【本篇開場型】挑戰讀者", "seed-flow", { titles: [], openings: [], amplifiers: [] }, "nas");
assert.equal(pinned.structure, "J5");
assert.ok(pinned.directive.includes("挑戰讀者") && pinned.directive.includes("開場照本篇指定的開場型寫"));
const rotated = planStyles("一個題目", "seed-flow", { titles: [], openings: [], amplifiers: [], structures: [plan.structure] }, "abl");
assert.notEqual(rotated.structure, plan.structure, "上一篇用過的結構這篇要換");

assert.ok(buildFlowStructureCatalog().includes("J1 人物一句開場"));
console.log("flow-structures ok");

// 流水線頁：FB 已送出（全部或部分成功）的文章不再顯示
import { isPublishedQueueStatus } from "../src/lib/auto-pipeline";
assert.equal(isPublishedQueueStatus("sent"), true);
assert.equal(isPublishedQueueStatus("partial"), true);
for (const s of ["pending", "sending", "failed", "cancelled", null, undefined]) assert.equal(isPublishedQueueStatus(s as string | null | undefined), false);

// 2026-11-13：沒有台灣中文版的書直接用英文原名，不讓模型自己翻譯書名
import { getCitationName, englishMainTitle } from "../src/data/skills/story-argument";
import { buildCitationDirective } from "../src/data/skills/citation-rules";
{
  const en = getCitationName({ title: "Atlas of the Heart: Mapping Meaningful Connection", author: "Brené Brown", title_zh: "心的地圖集", author_zh: "布芮妮·布朗", zh_status: "no_zh_edition" });
  assert.ok(en?.title === "Atlas of the Heart" && en?.author === "Brené Brown" && en?.lang === "en", "沒有中文版用英文主書名與英文作者");
  const zh = getCitationName({ title: "Daring Greatly", author: "Brené Brown", title_zh: "脆弱的力量", author_zh: "布芮尼·布朗", zh_status: "confirmed" });
  assert.ok(zh?.title === "脆弱的力量" && zh?.author === "布芮尼·布朗" && zh?.lang === "zh", "有中文版用中文書名與作者");
  assert.ok(getCitationName({ title: "X", author: "Y", title_zh: "某書", author_zh: "某人", zh_status: "unverified" }) === null, "還沒查證的不可引用");
  assert.ok(englishMainTitle("Burnout: The Secret") === "Burnout", "英文主書名去掉副標題");
  const directive = buildCitationDirective({ title: "Atlas of the Heart", author: "Brené Brown" }, "筆記");
  assert.ok(directive.includes("不可以自創中文譯名") && directive.includes("《Atlas of the Heart》"), "英文書的引用指令要求照寫英文、不可自創譯名");
}

// 2026-11-13：整批往後延發佈
import { normalizePostponeDays, selectPostponeJobs, shiftIso, taipeiDayStartIso } from "../src/lib/postpone";
{
  assert.equal(shiftIso("2026-11-14T12:00:00.000Z", 7), "2026-11-21T12:00:00.000Z");
  assert.equal(normalizePostponeDays(0), null);
  assert.equal(normalizePostponeDays(31), null);
  assert.equal(normalizePostponeDays(7), 7);
  assert.equal(taipeiDayStartIso("2026-11-14"), "2026-11-13T16:00:00.000Z");
  const jobs = [
    { id: "a", brand_id: "nas", status: "scheduled", scheduled_at: "2026-11-14T12:00:00Z", queue_id: "q1" },
    { id: "b", brand_id: "abl", status: "scheduled", scheduled_at: "2026-11-15T12:00:00Z", queue_id: "q2" },
    { id: "c", brand_id: "nas", status: "scheduled", scheduled_at: "2026-11-16T12:00:00Z", queue_id: "q3", published: true },
    { id: "d", brand_id: "nas", status: "cancelled", scheduled_at: "2026-11-16T12:00:00Z", queue_id: null },
    { id: "e", brand_id: "nas", status: "scheduled", scheduled_at: "2026-11-10T12:00:00Z", queue_id: "q5" },
  ];
  const picked = selectPostponeJobs(jobs, { brandId: "nas", fromIso: "2026-11-13T16:00:00Z", nowIso: "2026-11-13T14:00:00Z" });
  assert.deepEqual(picked.map((job) => job.id), ["a"], "只延該品牌、還沒發、起始日之後的");
  assert.equal(selectPostponeJobs(jobs, { fromIso: "2026-11-13T16:00:00Z", nowIso: "2026-11-13T14:00:00Z" }).length, 2);
}
