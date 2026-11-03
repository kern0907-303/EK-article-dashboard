import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { planRedo, fbStillUsable } from "../src/lib/auto-redo";

// 編輯 AI 退稿後，IG 與 Threads 的排程被設成 cancelled，但沒有東西會補回來。
// I8 11/4 那篇就是這樣放了一週，沒人知道。

// 兩個平台都被編輯 AI 退掉、沒有活著的列、也還沒自動重做過，兩個都要補
assert.deepEqual(
  planRedo([
    { platform: "instagram", status: "cancelled", error: "編輯 AI：官網文章與 Facebook 母稿案例對不上" },
    { platform: "threads", status: "cancelled", error: "編輯 AI：官網文章與 Facebook 母稿案例對不上" },
  ], null),
  ["instagram", "threads"]
);

// 已經有活著的列就不要再補，否則會變成重複貼文
assert.deepEqual(
  planRedo([
    { platform: "instagram", status: "cancelled", error: "編輯 AI：退稿" },
    { platform: "instagram", status: "pending", error: null },
    { platform: "threads", status: "cancelled", error: "編輯 AI：退稿" },
  ], null),
  ["threads"]
);

// 已發出去的也算活著
assert.deepEqual(
  planRedo([
    { platform: "threads", status: "cancelled", error: "編輯 AI：退稿" },
    { platform: "threads", status: "sent", error: null },
  ], null),
  []
);

// 不是編輯 AI 退的（例如他自己手動取消）就不要自動補回來
assert.deepEqual(
  planRedo([{ platform: "instagram", status: "cancelled", error: "改用 2027 上市系列取代，整組取消" }], null),
  []
);
assert.deepEqual(planRedo([{ platform: "instagram", status: "cancelled", error: null }], null), []);

// 每個平台只自動重做一次。重做完又被擋，就留給人看，不要無限互打燒額度
assert.deepEqual(
  planRedo([
    { platform: "instagram", status: "cancelled", error: "編輯 AI：又被擋了" },
    { platform: "threads", status: "cancelled", error: "編輯 AI：又被擋了" },
  ], ["instagram"]),
  ["threads"]
);
assert.deepEqual(
  planRedo([{ platform: "threads", status: "cancelled", error: "編輯 AI：又被擋了" }], ["instagram", "threads"]),
  []
);

// FB 母稿的狀態與時間：發佈前不到 35 分鐘就來不及補，已發或已取消的也不補
const now = Date.UTC(2026, 10, 2, 0, 0, 0);
const at = (minutes: number) => new Date(now + minutes * 60 * 1000).toISOString();
assert.equal(fbStillUsable("pending", at(120), now), true);
assert.equal(fbStillUsable("pending", at(34), now), false, "不到 35 分鐘來不及");
assert.equal(fbStillUsable("pending", at(-60), now), false, "時間已過");
assert.equal(fbStillUsable("sent", at(120), now), false, "已發就不是待補的母稿");
assert.equal(fbStillUsable("cancelled", at(120), now), false);
assert.equal(fbStillUsable("pending", "", now), false);
assert.equal(fbStillUsable("pending", null, now), false);

// tick 必須呼叫它，而且要包在 try 裡，復原失敗不可以害主流程停掉
const tick = readFileSync(new URL("../src/app/api/auto-pipeline/tick/route.ts", import.meta.url), "utf8");
assert.ok(tick.includes("runAutoRedo(env)"), "tick 要呼叫自動重做");
const block = tick.slice(tick.indexOf("let redo"), tick.indexOf("claim_auto_pipeline_job"));
assert.ok(/try \{[\s\S]*runAutoRedo\(env\)[\s\S]*\} catch/.test(block), "自動重做要包在 try/catch 裡");

// 自動重做本身要有一次性的記號，否則會無限重試
const lib = readFileSync(new URL("../src/lib/auto-redo.ts", import.meta.url), "utf8");
assert.ok(lib.includes("auto_redo"), "要把已重做的平台記在 social_results.auto_redo");
assert.ok(/只處理一篇|一次只處理一篇|最多處理一篇/.test(lib), "一次只處理一篇，避免單一請求超時");

console.log("auto-redo 測試通過");
