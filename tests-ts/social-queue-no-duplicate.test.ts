// 同一個任務、同一個平台不可以產生兩筆待發的排程。
//
// 2026-10-22 到 2026-11-25 之間發生 21 組，其中 19 組真的在 IG 或 Threads
// 連發了兩篇幾乎一樣的貼文。來源是「先查有沒有、再寫入」中間隔了 30 到 90 秒的
// AI 改寫與圖卡生成，兩條路徑各自查到「還沒有」然後各寫一筆。
import assert from "node:assert/strict";
import { planRedo, fbStillUsable } from "../src/lib/auto-redo";

// planRedo：已經有活著的列就不重做
{
  const rows = [
    { platform: "instagram", status: "cancelled", error: "編輯 AI 退稿" },
    { platform: "instagram", status: "pending", error: null },
  ];
  assert.deepEqual(planRedo(rows, []), [], "已經有待發的 IG 就不可以再重做");
}

// planRedo：只有被編輯 AI 取消的列，才重做
{
  const rows = [{ platform: "threads", status: "cancelled", error: "編輯 AI 退稿：語氣" }];
  assert.deepEqual(planRedo(rows, []), ["threads"]);
  assert.deepEqual(planRedo(rows, ["threads"]), [], "每個平台只自動重做一次");
}

// planRedo：不是編輯 AI 取消的不碰
{
  const rows = [{ platform: "threads", status: "cancelled", error: "手動取消" }];
  assert.deepEqual(planRedo(rows, []), []);
}

// planRedo：失敗的列也算活著，不重做（避免跟排程執行器打架）
{
  const rows = [
    { platform: "instagram", status: "cancelled", error: "編輯 AI 退稿" },
    { platform: "instagram", status: "failed", error: "Meta 超時" },
  ];
  assert.deepEqual(planRedo(rows, []), []);
}

// 寫入前的最後一道檢查：把 planRedo 的結果再跟當下的佇列比對一次
function stillNeeded(planned: string[], liveRows: Array<{ platform: string }>): string[] {
  const taken = new Set(liveRows.map((r) => String(r.platform).toLowerCase()));
  return planned.filter((p) => !taken.has(p));
}
assert.deepEqual(stillNeeded(["instagram", "threads"], [{ platform: "instagram" }]), ["threads"],
  "中間被別條路徑補上的平台要剔除");
assert.deepEqual(stillNeeded(["instagram", "threads"], [{ platform: "instagram" }, { platform: "threads" }]), [],
  "兩個都被補上就整篇不做");
assert.deepEqual(stillNeeded(["threads"], []), ["threads"]);

// FB 母稿還來得及才補
assert.equal(fbStillUsable("pending", new Date(Date.now() + 60 * 60 * 1000).toISOString()), true);
assert.equal(fbStillUsable("pending", new Date(Date.now() + 10 * 60 * 1000).toISOString()), false, "不到 35 分鐘就來不及");
assert.equal(fbStillUsable("sent", new Date(Date.now() + 60 * 60 * 1000).toISOString()), false);

console.log("social queue duplicate guard tests passed");
