import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// 2026-11-02：時間軸把兩篇 ABL 標成有問題（一篇 manual、一篇有平台還沒補草稿），
// 但待處理中心兩篇都撈不到，因為 reviewed 都是 true。
// 時間軸的判斷不看 reviewed，待處理中心卻看，兩邊因此不一致，
// 畫面一邊說有問題、一邊找不到人處理。
const attention = readFileSync(new URL("../src/lib/needs-attention.ts", import.meta.url), "utf8");
assert.ok(attention.includes("2c."), "要有「有平台還沒補草稿」這一段");
assert.ok(attention.includes("還沒補草稿"), "理由要說清楚");
// 這一段不依賴 reviewed，所以不可以給「標記已審」，那會是一顆按了沒反應的按鈕
assert.ok(/canMarkDone: false, canCancel: false, canDismiss: false, stalePlatforms: readStalePlatforms/.test(attention),
  "不給沒作用的按鈕");
// 失敗的平台由上一段負責，這裡只管從來沒有草稿的
assert.ok(attention.includes("if (results[platform]?.ok === false) return false;"), "失敗的不要重複列");
// 只看一週內，避免把幾個月後的排程全部灌進清單
assert.ok(attention.includes("now + 7 * DAY"), "限定一週內，不要灌爆清單");

// 官網狀態要以文章實際發佈狀態為準，草稿不可以顯示成已上線
const timeline = readFileSync(new URL("../src/lib/pipeline-timeline.ts", import.meta.url), "utf8");
assert.ok(timeline.includes('label: "草稿未上線"'), "草稿要老實顯示");
assert.ok(!/results\.website\?\.ok \|\| \(websiteArticleId/.test(timeline), "不可以只憑衍生步驟成功就說已上線");
assert.ok(timeline.includes("...fbRows.map((row: any) => row.article_id),"), "排程列上的文章 id 也要查發佈狀態");

console.log("missing-drafts-visible 測試通過");
