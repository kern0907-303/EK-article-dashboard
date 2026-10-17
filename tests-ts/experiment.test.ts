import assert from "node:assert/strict";
import {
  MATURE_HOURS, MAX_DAYS, MIN_DAYS, STRUCTURE_ARMS, addDays, armDirective, judgeExperiment, mean, parseDecision,
  probBBeatsA, relativeReward, rewardOf, seededRandom, taipeiDate,
} from "../src/lib/experiment-arms";

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

console.log("experiment tests passed");
