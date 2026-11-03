import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// 2026-11-03：三篇 ABL 系列文被取消後又放回排程，但只有流水線任務改回 scheduled，
// FB、IG、Threads 三個排程列還停在 cancelled。
// 結果時間軸照常顯示、時間也在未來，那天卻什麼都不會發；
// 按補齊還會被擋，因為補齊要求 FB 必須是待發。
// 任務狀態與排程列狀態是兩套、可以各走各的，所以兩邊都要有東西盯著。

const timeline = readFileSync(new URL("../src/lib/pipeline-timeline.ts", import.meta.url), "utf8");
assert.ok(/const ghost = futureJob &&/.test(timeline), "時間軸要判斷空殼");
assert.ok(timeline.includes('fb.state === "cancelled"'), "FB 被取消要算空殼");
assert.ok(timeline.includes('fb.state === "failed"'), "FB 失敗也要算");
assert.ok(timeline.includes("FB 母稿已取消，那天不會發"), "理由要講白話，不要只說有問題");
assert.ok(/needsYou: ghost \|\|/.test(timeline), "空殼要讓卡片標紅，才會出現在只看有問題的");

const attention = readFileSync(new URL("../src/lib/needs-attention.ts", import.meta.url), "utf8");
assert.ok(attention.includes("2d."), "待處理中心要有空殼這一類");
assert.ok(attention.includes("ghost:"), "要有自己的 key，不要跟其他類別互相蓋掉");
assert.ok(attention.includes("那天不會發"), "理由要講白話");
// 查不到 FB 那一列時不要亂報，可能只是查詢失敗
assert.ok(attention.includes("if (!fbStatus ||"), "查不到狀態就不要列，避免查詢失敗變成假警報");
// 已發、發送中、待發都不是空殼
for (const ok of ['"pending"', '"sending"', '"sent"']) {
  assert.ok(attention.includes(ok), `${ok} 要被排除在空殼之外`);
}
// 這一類不靠 reviewed，所以不可以給「標記已審」那種按了不會消失的按鈕
assert.ok(/key, kind: "manual"[\s\S]{0,900}?canMarkDone: false, canCancel: true/.test(attention),
  "空殼要給放棄這則，不要給沒作用的標記已審");

console.log("ghost-schedule 測試通過");
