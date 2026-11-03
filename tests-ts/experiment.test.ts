import assert from "node:assert/strict";
import {
  EXPERIMENT_BRANDS, MATURE_HOURS, MAX_DAYS, MIN_DAYS, MIN_MATURE_POSTS_PER_ARM, STRUCTURE_ARMS, addDays, armDirective,
  judgeExperiment, latestSyncTime, mean, parseDecision, probBBeatsA, relativeReward, rewardOf, seededRandom, taipeiDate,
} from "../src/lib/experiment-arms";
import { brandName, groupAlertsForNotice } from "../src/lib/calibration";

const DAY = 24 * 60 * 60 * 1000;
const start = new Date("2026-10-17T00:00:00Z");
const at = (days: number) => new Date(start.getTime() + days * DAY);

// 指令文字不得含破折號與 Markdown 符號（品牌規則）
for (const [id, arm] of Object.entries(STRUCTURE_ARMS)) {
  assert.ok(!/[—─–\-*#]/.test(arm.directive), `${id} 指令含破折號或 Markdown 符號`);
  assert.equal(armDirective("structure", id), arm.directive);
}
assert.equal(armDirective("structure", "nope"), null);
assert.equal(armDirective("genre", "story_open"), null);

// 獎勵：缺值當 0；Threads 與 IG 權重不同
assert.equal(rewardOf("threads", { views: 100, reach: null, likes: 5, comments: 2, shares: 1, saves: null }), 100 + 40 + 10 + 10);
assert.equal(rewardOf("instagram", { views: null, reach: 80, likes: 0, comments: 0, shares: 1, saves: 2 }), 80 + 40 + 20);
assert.equal(relativeReward(50, 0), 50);
assert.equal(relativeReward(50, 25), 2);

// 亂數與自助重抽可重現
assert.equal(seededRandom(7)(), seededRandom(7)());
assert.equal(probBBeatsA([1, 1, 1, 1], [2, 2, 2, 2]), 1);
assert.equal(probBBeatsA([2, 2], [1, 1]), 0);
assert.equal(probBBeatsA([], [1]), 0.5);
assert.equal(probBBeatsA([1, 2, 3, 4], [1, 2, 3, 4]) > 0.3 && probBBeatsA([1, 2, 3, 4], [1, 2, 3, 4]) < 0.7, true);

// 判定：未滿最短天數一律繼續，就算差距很大
const strongA = [1, 1, 1, 1];
const strongB = [3, 3, 3, 3];
let v = judgeExperiment({ now: at(MIN_DAYS - 0.5), startedAt: start, armA: "a", armB: "b", rewardsA: strongA, rewardsB: strongB });
assert.equal(v.recommendation, "continue");
assert.ok(v.reason.includes("不下結論"));

// 滿天數、樣本夠、差距明顯：結案，勝者是 B
v = judgeExperiment({ now: at(MIN_DAYS), startedAt: start, armA: "a", armB: "b", rewardsA: strongA, rewardsB: strongB });
assert.equal(v.recommendation, "conclude");
assert.equal(v.leader, "b");

// 滿天數但樣本不足且還沒到期：繼續
v = judgeExperiment({ now: at(MIN_DAYS + 0.2), startedAt: start, armA: "a", armB: "b", rewardsA: [1, 1], rewardsB: [3, 3] });
assert.equal(v.recommendation, "continue");

// 到期仍樣本不足：inconclusive，不宣告勝者
v = judgeExperiment({ now: at(MAX_DAYS), startedAt: start, armA: "a", armB: "b", rewardsA: [1, 1], rewardsB: [3, 3] });
assert.equal(v.recommendation, "inconclusive");

// 到期、樣本夠但差距不明顯：inconclusive
v = judgeExperiment({ now: at(MAX_DAYS), startedAt: start, armA: "a", armB: "b", rewardsA: [1, 3, 1, 3], rewardsB: [3, 1, 3, 1] });
assert.equal(v.recommendation, "inconclusive");
assert.ok(MATURE_HOURS === 72);

// 日期工具（台北時間）
assert.equal(taipeiDate(new Date("2026-10-17T17:00:00Z")), "2026-10-18");
assert.equal(taipeiDate("2026-10-17T15:59:00Z"), "2026-10-17");
assert.equal(addDays("2026-10-30", 3), "2026-11-02");
assert.equal(mean([1, 2, 3]), 2);

// 決策格式檢查
const id = "11111111-1111-4111-8111-111111111111";
const good = parseDecision({ summary: "繼續觀察", conclude: [], next_days: [{ brand: "abl", date: "2026-10-18", experiment_id: id, arm: "story_open" }] });
assert.equal(good.ok, true);
const withNew = parseDecision({ summary: "開新", start: { brand: "nas", variable: "structure", arm_a: "story_open", arm_b: "claim_open" }, next_days: [{ brand: "nas", date: "2026-10-18", experiment_id: "new", arm: "claim_open" }] });
assert.equal(withNew.ok, true);
for (const bad of [
  null,
  { summary: "" },
  { summary: "x", extra: 1 },
  { summary: "x", start: { brand: "erick", variable: "structure", arm_a: "story_open", arm_b: "claim_open" } },
  { summary: "x", start: { brand: "abl", variable: "genre", arm_a: "story_open", arm_b: "claim_open" } },
  { summary: "x", start: { brand: "abl", variable: "structure", arm_a: "story_open", arm_b: "story_open" } },
  { summary: "x", start: { brand: "abl", variable: "structure", arm_a: "story_open", arm_b: "made_up" } },
  { summary: "x", next_days: [{ brand: "abl", date: "10/18", experiment_id: id, arm: "story_open" }] },
  { summary: "x", conclude: [{ experiment_id: "abc", winner: null }] },
]) {
  assert.equal(parseDecision(bad).ok, false, JSON.stringify(bad));
}

// 同步時間：n8n 日誌的 account_id 是名稱（對應貼文的 account_label），不是數字 ID（用 2026-10-17 線上實際格式）
const logs = [
  { platform: "threads", account_id: "Threads I8 / initial8.erick", status: "ok", run_at: "2026-10-12T03:00:04.817+08:00" },
  { platform: "threads", account_id: "Threads I8 / initial8.erick", status: "ok", run_at: "2026-10-15T03:00:05.203+08:00" },
  { platform: "threads", account_id: "Threads I8 / initial8.erick", status: "error", run_at: "2026-10-16T03:00:05.203+08:00" },
  { platform: "threads", account_id: "Threads NAS / noagespace", status: "ok", run_at: "2026-10-15T03:00:05.230+08:00" },
  { platform: "instagram", account_id: "Instagram I8 / initial8.erick", status: "ok", run_at: "2026-10-15T03:20:33.132+08:00" },
];
assert.equal(latestSyncTime(logs, "threads", "Threads I8 / initial8.erick", "28572242392446141"), "2026-10-15T03:00:05.203+08:00");
assert.equal(latestSyncTime(logs, "instagram", "Threads I8 / initial8.erick", "28572242392446141"), null);
assert.equal(latestSyncTime(logs, "threads", "別的帳號", "28572242392446141"), null);
assert.equal(latestSyncTime([{ platform: "threads", account_id: "28572242392446141", status: "partial", run_at: "2026-10-15T03:00:00+08:00" }], "threads", "x", "28572242392446141"), "2026-10-15T03:00:00+08:00");
// 貼文發佈時間格式（無冒號的時區）也要能解析
assert.equal(Number.isNaN(Date.parse("2026-10-14T02:30:46+0000")), false);

console.log("experiment tests passed");

// ───────────── 警示合併（2026-11-04）─────────────
// 三個品牌的實驗同時開、同時到期，同一種警示幾乎永遠三個一起觸發。
// 分三則推播等於同樣的字看三次，所以同一種警示要併成一則。
{
  const three = EXPERIMENT_BRANDS.map((brand) => ({
    code: "no_untested_pairs" as const,
    brand,
    shared: "目前可測的臂組合都測完了。",
    message: `${brandName(brand)}目前可測的臂組合都測完了。`,
  }));
  const merged = groupAlertsForNotice(three);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].brands.length, 3);
  assert.equal(merged[0].text, "平衡空間、艾伯林量子調頻、初八企業顧問：目前可測的臂組合都測完了。");

  // 只有一個品牌觸發時不要加品牌前綴，照原本的句子推
  const one = groupAlertsForNotice([three[0]]);
  assert.equal(one.length, 1);
  assert.equal(one[0].text, three[0].message);

  // 不同種類的警示不能併在一起
  const mixed = groupAlertsForNotice([
    three[0],
    { code: "control_beats_treated" as const, brand: "all" as const, message: "對照組比較好。" },
  ]);
  assert.equal(mixed.length, 2);
  assert.equal(mixed[1].text, "對照組比較好。");

  // 沒有 shared 文字的不合併，避免把不同內容併掉
  const noShared = groupAlertsForNotice(
    EXPERIMENT_BRANDS.map((brand) => ({ code: "stagnant" as const, brand, message: `${brandName(brand)}停滯了。` }))
  );
  assert.equal(noShared.length, 1);
  assert.equal(noShared[0].text.split("\n\n").length, 3);
}

// 門檻放寬後，5 天內本來湊不到的樣本現在還有時間累積
assert.ok(MAX_DAYS >= 14, "最長觀察天數要夠長，否則每臂永遠湊不到成熟貼文");
assert.ok(MIN_MATURE_POSTS_PER_ARM <= 3);
