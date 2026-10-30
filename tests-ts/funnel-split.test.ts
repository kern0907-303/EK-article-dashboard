import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { funnelEntryPath, normalizeFunnel, readFunnelFromPrompt } from "../src/data/brands/conversion";

// 2026-10-30 分層改名：破圈＝supercold（導計算器），建立信任＝cold（導卡點五型小測）。
// 原本用 cold／warm，而且「沒有標記」被當成超冷流量，補標記會悄悄換掉入口，所以改成明確兩層。
assert.equal(readFunnelFromPrompt("本篇目標：破圈，讀者是不認識作者的人，從他的生活場景切入。"), "supercold");
assert.equal(readFunnelFromPrompt("本篇目標：建立信任，讀者看過幾篇但還在觀察。"), "cold");
// 欄位值寫法也要認得
assert.equal(readFunnelFromPrompt("funnel：冷流量"), "supercold");
assert.equal(readFunnelFromPrompt("funnel：超冷流量"), "supercold");
assert.equal(readFunnelFromPrompt("funnel：溫流量"), "cold");
// 兩種標記同時出現時，建立信任優先，不可以被「冷流量」這三個字搶走
assert.equal(readFunnelFromPrompt("【ABL｜冷流量信任系列】本篇目標：建立信任"), "cold");
// 判讀不出來要回 null，不可以亂猜一個，官網會退回通用 CTA
assert.equal(readFunnelFromPrompt("這是一個沒有標分層的題目"), null);
assert.equal(readFunnelFromPrompt(""), null);

// 資料庫舊值：warm 過去代表建立信任，就是現在的 cold。
// 舊的 cold 由資料庫一次性改成 supercold，這裡不猜，否則 cold 會有兩種意思。
assert.equal(normalizeFunnel("supercold"), "supercold");
assert.equal(normalizeFunnel("cold"), "cold");
assert.equal(normalizeFunnel("warm"), "cold");
assert.equal(normalizeFunnel(""), null);
assert.equal(normalizeFunnel(null), null);
assert.equal(normalizeFunnel("hot"), null);

// 每一層的入口。FB 首則留言直接把人帶到這裡，不再多繞一層文章頁
assert.equal(funnelEntryPath("supercold"), "/nas/calculator/");
assert.equal(funnelEntryPath("cold"), "/nas/quiz");
assert.equal(funnelEntryPath(null), null);

// 官網文章要帶著冷暖寫進資料庫，四個產生路徑都要接上
const multi = readFileSync("src/lib/auto-multiplatform.ts", "utf8");
assert.ok(multi.includes("funnel: input.funnel || null"), "官網文章要寫入分層");
assert.ok(/funnel\?: TrafficFunnel \| null/.test(multi), "輸入型別要有冷暖");
assert.ok(multi.includes('"coverUrl" | "funnel"'), "重寫官網文章也要能帶冷暖");

for (const path of [
  "src/app/api/auto-pipeline/tick/route.ts",
  "src/app/api/auto-pipeline/backfill/route.ts",
  "src/app/api/auto-pipeline/reoptimize/route.ts",
]) {
  const source = readFileSync(path, "utf8");
  assert.ok(source.includes("readFunnelFromPrompt"), `${path} 要判讀冷暖`);
}
// backfill 有兩個產生路徑，兩個都要帶
assert.equal(
  (readFileSync("src/app/api/auto-pipeline/backfill/route.ts", "utf8").match(/funnel: readFunnelFromPrompt/g) || []).length,
  2,
  "backfill 兩處都要帶冷暖",
);

console.log("funnel-split 測試通過");
