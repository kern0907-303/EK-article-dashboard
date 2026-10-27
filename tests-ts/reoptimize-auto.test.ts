import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const panel = readFileSync("src/components/ReoptimizePanel.tsx", "utf8");
const route = readFileSync("src/app/api/auto-pipeline/reoptimize/route.ts", "utf8");

// 一鍵重寫的順序固定：官網先做，因為 FB 留言的連結指向官網文章
assert.match(panel, /const DERIVED: Platform\[\] = \["website", "instagram", "threads"\]/);

// 一鍵之前一定要先確認 FB 主稿是新規則，還有舊的就不准動衍生稿
assert.match(panel, /platform: "facebook"[\s\S]{0,400}?staleCount[\s\S]{0,200}?return;/);

// 隨時可以停：迴圈每一輪都要檢查停止旗標
assert.match(panel, /while \(left > 0 && !stopRef\.current/);
// 空轉保護：沒有進度要收手，而且有輪數上限
assert.match(panel, /stuck >= 2/);
assert.match(panel, /rounds\+\+ < 40/);

// 手動模式必須保留，而且一鍵執行時要鎖住避免兩邊同時動同一批
assert.ok(panel.includes("看看有幾篇要改"), "手動試算按鈕要保留");
assert.ok(panel.includes("void call(false, platform)"), "手動重寫按鈕要保留");
assert.match(panel, /disabled=\{busy \|\| autoRunning \|\| staleCount === 0\}/);

// 伺服器端的防呆一個都不能因為一鍵而放寬
assert.ok(route.includes("FB 主稿還是舊規則，請先重寫主稿"), "主稿過期要擋住衍生稿");
assert.ok(route.includes("距離發佈時間太近"), "接近發佈時間的不可以動");
assert.match(route, /Math\.min\(Math\.max\(Number\(body\?\.limit\) \|\| 1, 1\), 10\)/);
assert.ok(route.includes("新稿沒通過品管，保留舊稿"), "新稿沒過品管要保留舊稿");
// 一次只能一個平台，陣列要被擋掉
assert.ok(route.includes("Array.isArray(body?.platform)") || route.includes("一次只能一個平台"), "平台只能單選");

console.log("reoptimize-auto 測試通過");
