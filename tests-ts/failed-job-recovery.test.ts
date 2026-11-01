import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripControlChars, stripMarkdown } from "../src/lib/plain-text";

// 2026-11-01：一篇 I8 排在 11/3 的文章整個失敗，錯誤訊息還被當成標題顯示：
// Supabase auto_pipeline_jobs PATCH 失敗（400）：22P05 unsupported Unicode escape sequence。
// 模型產出的文字裡混進一個 NUL，Postgres 的 text 欄位不收，整個 PATCH 被擋，
// 草稿一個字都沒存進去（draft_content 是 null）。
// 然後這則變成死路：沒有草稿所以不能編輯，canCancel 寫死 false 所以不能刪，
// 也沒有任何重新生成的路，只剩「我已處理」可按，按了只是藏起來，發文時段就空了。

// NUL 與其他 C0 控制字元要清掉，換行與定位字元要留著
assert.equal(stripControlChars("好\u0000的"), "好的");
assert.equal(stripControlChars("a\u0001b\u001Fc\u007Fd"), "abcd");
assert.equal(stripControlChars("第一行\n第二行\t後面"), "第一行\n第二行\t後面", "換行與定位字元要保留");
assert.equal(stripControlChars(""), "");
// 文字清理這層就要擋掉，因為所有模型產出都經過它
assert.ok(!stripMarkdown("標題\u0000內文").includes("\u0000"), "stripMarkdown 要順便清掉控制字元");

// 寫進資料庫前還有最後一道防線，因為 warnings 這類欄位不一定經過文字清理
const server = readFileSync(new URL("../src/lib/auto-pipeline-server.ts", import.meta.url), "utf8");
assert.ok(server.includes("u0000"), "pipelineDb 送出前要再擋一次 NUL");

// 失敗的任務要有真正的出路，不能只剩「我已處理」
const attention = readFileSync(new URL("../src/lib/needs-attention.ts", import.meta.url), "utf8");
assert.ok(attention.includes('canRetry: kind === "failed"'), "失敗的任務要能重新生成");
assert.ok(attention.includes('canDismiss: kind === "failed" && !job.queue_id'), "沒有排程列的失敗任務要能放棄");

const api = readFileSync(new URL("../src/app/api/needs-attention/route.ts", import.meta.url), "utf8");
assert.ok(api.includes('action === "retry" && source === "job"'), "API 要收流水線任務的重新生成");
assert.ok(api.includes('action === "dismiss" && source === "job"'), "API 要收流水線任務的放棄");
// 重新生成只能動失敗的那些，不可以波及其他狀態
assert.ok(api.includes("auto_pipeline_jobs?id=eq.${id}&status=eq.failed"), "只處理 failed 狀態");
// 放棄只處理沒有 FB 排程列的，否則會留下孤兒排程
assert.ok(api.includes("status=eq.failed&queue_id=is.null"), "有排程列的不可以直接改狀態放棄");

console.log("failed-job-recovery 測試通過");
