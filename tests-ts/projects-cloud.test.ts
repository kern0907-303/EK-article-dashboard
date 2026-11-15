import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildProjectFactsDirective, normalizeProjectInput } from "../src/lib/projects-server";
import { mergeServerProjects } from "../src/lib/projects-store";

// 寫入檢查：id 格式、名稱必填、所屬品牌只收四個
const ok = normalizeProjectInput({ id: "project_nas2027_navigation", name: " 平衡空間 2027 年度導航 ", guidelines: "事實表", parent_brand: "brand_b_nas" });
assert.deepEqual(ok, { id: "project_nas2027_navigation", name: "平衡空間 2027 年度導航", guidelines: "事實表", parent_brand: "brand_b_nas" });
assert.equal(typeof normalizeProjectInput({ id: "brand_b_nas", name: "x" }), "string", "非 project_ 開頭要擋");
assert.equal(typeof normalizeProjectInput({ id: "project_a b", name: "x" }), "string", "id 不能有空白");
assert.equal(typeof normalizeProjectInput({ id: "project_a", name: "  " }), "string", "名稱必填");
assert.equal(typeof normalizeProjectInput(null), "string");
assert.equal(typeof normalizeProjectInput({ id: "project_a", name: "x", guidelines: "字".repeat(20001) }), "string", "事實表有上限");
const badParent = normalizeProjectInput({ id: "project_a", name: "x", parent_brand: "brand_z" });
assert.ok(typeof badParent !== "string" && badParent.parent_brand === null, "不認得的品牌存成 null");

// 流水線指令：有內容才附，標題固定
assert.equal(buildProjectFactsDirective(""), "");
assert.equal(buildProjectFactsDirective(null), "");
assert.equal(buildProjectFactsDirective("  "), "");
assert.equal(buildProjectFactsDirective("價格 980"), "【本專案事實表（優先，價格與規則以此為準）】\n價格 980");

// 合併：雲端有的以雲端名稱與事實表為準、保留本地其他欄位；只在雲端的補進來；只在本地的保留
const local = [
  { id: "project_a", name: "舊名", guidelines: "舊表", social_copy: "本地文案" },
  { id: "project_local", name: "只在本機", guidelines: "x", social_copy: "" },
];
const merged = mergeServerProjects(local, [
  { id: "project_a", name: "新名", guidelines: "新表", parent_brand: "brand_b_nas" },
  { id: "project_new", name: "手機建的", guidelines: "雲端表", parent_brand: null },
]);
assert.equal(merged.length, 3);
assert.deepEqual(merged[0], { id: "project_a", name: "新名", guidelines: "新表", social_copy: "本地文案" });
assert.equal(merged[1].id, "project_local");
assert.equal(merged[2].id, "project_new");
assert.equal(merged[2].guidelines, "雲端表");
assert.equal(merged[2].social_copy, "");

// 接線檢查：流水線兩條路都要帶專案事實表，重新優化要撈 project_id
const tick = readFileSync("src/app/api/auto-pipeline/tick/route.ts", "utf8");
assert.ok(tick.includes("getProjectGuidelines(") && tick.includes("projectGuidelines"), "tick 要帶專案事實表");
const reopt = readFileSync("src/app/api/auto-pipeline/reoptimize/route.ts", "utf8");
assert.ok(reopt.includes("social_results,project_id"), "重新優化要撈 project_id");
assert.ok(reopt.includes("projectGuidelines: await getProjectGuidelines("), "重新優化要帶專案事實表");
const gen = readFileSync("src/lib/auto-generate.ts", "utf8");
assert.ok(gen.includes("buildProjectFactsDirective(projectGuidelines)"), "Maya 指令要附專案事實表");
const storage = readFileSync("src/lib/storage.ts", "utf8");
assert.ok(storage.includes("pushProjectToServer({ id: brandId, guidelines: updatedFields.brand_guidelines })"), "改事實表要推回雲端");
const selector = readFileSync("src/components/ProjectSelector.tsx", "utf8");
assert.ok(selector.includes("loadProjectsFromServer()") && selector.includes("pushProjectToServer(newProject)"), "專案選單要讀寫雲端");

console.log("projects-cloud: all passed");
