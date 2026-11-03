import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// 2026-11-03：時間軸卡片標紅說「有平台還沒補草稿」，但卡片上沒有任何可以按的東西，
// 待處理中心也只寫「到多平台衍生頁補草稿」卻沒有連結，等於叫人自己去找那一頁。
// 多平台衍生頁本來就吃 ?jobId=，只是從來沒有人把入口放出來。

const timeline = readFileSync(new URL("../src/components/PipelineTimeline.tsx", import.meta.url), "utf8");
assert.ok(timeline.includes("/derivatives?jobId="), "時間軸每張卡片都要有進得去的連結");
assert.ok(timeline.includes("去處理"), "有問題的卡片要明講是去處理");
assert.ok(timeline.includes("打開這一篇"), "沒問題的卡片也要能打開");

const attention = readFileSync(new URL("../src/app/needs-attention/page.tsx", import.meta.url), "utf8");
assert.ok(attention.includes("/derivatives?jobId="), "待處理中心要有進得去的連結");
assert.ok(attention.includes("開啟多平台衍生頁"), "連結文字要說清楚按了會去哪裡");

// 衍生頁要真的讀得懂 jobId，否則連結點進去是空的
const page = readFileSync(new URL("../src/components/PipelineDerivatives.tsx", import.meta.url), "utf8");
assert.ok(page.includes('get("jobId")'), "衍生頁要吃 jobId 參數");

console.log("timeline-has-exit 測試通過");
