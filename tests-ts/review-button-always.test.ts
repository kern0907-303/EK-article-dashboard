import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// 2026-11-02：審稿按鈕又不見。原因是待處理中心只撈「兩天內要發」的未審任務，
// 排在兩天後的文章在清單裡完全不存在，自然也沒有審稿按鈕。
// 他要的規則很簡單：需要審稿就給按鈕，跟多久以後發無關。
const attention = readFileSync(new URL("../src/lib/needs-attention.ts", import.meta.url), "utf8");

const unreviewed = attention
  .split("\n")
  .find((line) => line.includes("status=eq.scheduled&reviewed=eq.false"));
assert.ok(unreviewed, "找不到撈未審任務的查詢");
assert.ok(!/scheduled_at=lt\./.test(unreviewed!), "未審任務不可以設發佈時間上限，審稿跟日期無關");
assert.ok(/scheduled_at=gte\./.test(unreviewed!), "已經過期的排程不用再給審稿按鈕");
assert.ok(!attention.includes("兩天內要發佈，還沒有審稿"), "理由不要再寫兩天內");
assert.ok(attention.includes('reason: "還沒有審稿"'), "理由改成與日期無關的說法");

// 按下去要看得出來有反應：全站按鈕的實體回饋放在 globals.css
const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
assert.ok(/button:not\(:disabled\):active/.test(css), "按住時要有縮放或變暗的回饋");
assert.ok(/transform: scale\(/.test(css), "要有縮放");
assert.ok(/ek-button-busy/.test(css), "正在跑的按鈕要有閃爍提示");
assert.ok(/button\[aria-busy="true"\]/.test(css), "閃爍要吃 aria-busy");

// 共用按鈕 loading 時要掛 aria-busy，否則上面那段 CSS 沒作用
const button = readFileSync(new URL("../src/components/ui/Button.tsx", import.meta.url), "utf8");
assert.ok(/aria-busy=\{loading \|\| undefined\}/.test(button), "共用按鈕 loading 要掛 aria-busy");

// 待處理中心：每一顆動作按鈕要知道是不是自己在跑，不能全部一起變灰
const page = readFileSync(new URL("../src/app/needs-attention/page.tsx", import.meta.url), "utf8");
for (const tag of ["markDone", "retry", "dismiss", "cancel", "save", "saveSchedule", "card"]) {
  assert.ok(page.includes(`pending === "${tag}"`), `${tag} 這顆按鈕要顯示自己在跑`);
}
assert.ok(!page.includes('{busy ? "處理中…" : "儲存並排程發佈"}'), "不要再用全域 busy 當單顆按鈕的狀態");
assert.ok(/finally \{ setBusy\(false\); setPending\(""\); \}/.test(page), "跑完要清掉 pending");

console.log("review-button-always 測試通過");
