import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { reviewedAfterPipelineEdit } from "../src/lib/auto-pipeline";

// 2026-11-01：艾瑞克改了一篇 I8 的標題，存檔後系統要他「去待處理中心按同步」，
// 但同一次存檔把 reviewed 設成 true，而未審清單只撈 reviewed=false 且兩天內的，
// 那則因此從清單消失，同步按鈕永遠按不到。
// 另一則 ABL 排在 12/22 的也卡著，連兩天內那個條件都沾不上邊。

// 留下待同步的衍生稿就不算審完，否則會被自己藏起來
assert.equal(reviewedAfterPipelineEdit("queue-1", false, true), false, "有待同步就不可以標已審");
assert.equal(reviewedAfterPipelineEdit(null, true, true), false, "剛排程但有待同步，也不算審完");
// 沒有待同步時維持原本行為
assert.equal(reviewedAfterPipelineEdit("queue-1", false, false), true);
assert.equal(reviewedAfterPipelineEdit(null, true, false), true);
assert.equal(reviewedAfterPipelineEdit(null, false, false), false, "沒排程的草稿存檔不算審完");
// 舊呼叫方式不傳第三個參數也要照舊
assert.equal(reviewedAfterPipelineEdit("queue-1", false), true);

const route = readFileSync(new URL("../src/app/api/auto-pipeline/route.ts", import.meta.url), "utf8");
assert.ok(route.includes("reviewedAfterPipelineEdit(current.queue_id, !!scheduledNow, contentChanged && hadDerivatives)"),
  "存檔時要把待同步狀態傳進去，不然旗標還是錯的");

// 光靠旗標不夠：未審清單只看兩天內，排在更遠的那則還是不會出現，
// 所以要有一段不依賴 reviewed、也不限兩天的掃描。
const attention = readFileSync(new URL("../src/lib/needs-attention.ts", import.meta.url), "utf8");
assert.ok(attention.includes("2b."), "要有專門掃待同步的那一段");
assert.ok(attention.includes("const pending = readStalePlatforms(job.social_results);"), "依待同步平台列出來");
assert.ok(attention.includes("alreadyListed"), "已經列過的不要重複列");
const sweepAt = attention.indexOf("const pending = readStalePlatforms(job.social_results);");
const multiAt = attention.indexOf("const multi = await safeQuery");
assert.ok(multiAt > 0 && multiAt < sweepAt, "掃描要用 multi 那份查詢，它沒有 reviewed 與兩天的限制");

console.log("stale-sync-visible 測試通過");
