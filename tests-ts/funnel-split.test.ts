import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readFunnelFromPrompt } from "../src/data/brands/conversion";

// 海巡寫進提示詞的就是這兩句，判讀要對得上
assert.equal(readFunnelFromPrompt("本篇目標：破圈，讀者是不認識作者的人，從他的生活場景切入。"), "cold");
assert.equal(readFunnelFromPrompt("本篇目標：建立信任，讀者看過幾篇但還在觀察。"), "warm");
// 欄位值寫法也要認得
assert.equal(readFunnelFromPrompt("funnel：冷流量"), "cold");
assert.equal(readFunnelFromPrompt("funnel：溫流量"), "warm");
// 判讀不出來要回 null，不可以亂猜一個，官網會退回通用 CTA
assert.equal(readFunnelFromPrompt("這是一個沒有標冷暖的題目"), null);
assert.equal(readFunnelFromPrompt(""), null);

// 官網文章要帶著冷暖寫進資料庫，四個產生路徑都要接上
const multi = readFileSync("src/lib/auto-multiplatform.ts", "utf8");
assert.ok(multi.includes("funnel: input.funnel || null"), "官網文章要寫入冷暖");
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
