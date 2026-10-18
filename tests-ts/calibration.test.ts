// 第三層校正：對照日、基準線、停滯、對照組比較、下一個可測組合、警示。
import assert from "node:assert/strict";
import {
  CONTROL_EVERY_DAYS, LIFT_THRESHOLD, MIN_POSTS_PER_SIDE, MIN_POSTS_PER_WINDOW, brandTrendStatus, buildAlerts, controlVsTreated, isControlDay, nextCandidate, trendFor,
  type FinishedExperiment, type RewardPost,
} from "../src/lib/calibration";

const DAY = 86400000;
const now = new Date("2026-11-20T00:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * DAY).toISOString();

// 對照日：每個品牌 7 天剛好一天，三個品牌錯開
for (const brand of ["nas", "abl", "i8"] as const) {
  let count = 0;
  for (let i = 0; i < 70; i += 1) if (isControlDay(brand, new Date(Date.parse("2026-10-19T00:00:00Z") + i * DAY).toISOString().slice(0, 10))) count += 1;
  assert.equal(count, 70 / CONTROL_EVERY_DAYS, `${brand} 每 7 天一天`);
}
for (let i = 0; i < 70; i += 1) {
  const date = new Date(Date.parse("2026-10-19T00:00:00Z") + i * DAY).toISOString().slice(0, 10);
  const all = (["nas", "abl", "i8"] as const).every((b) => isControlDay(b, date));
  assert.equal(all, false, "同一天不會三個品牌都是對照日");
}

// 趨勢：造出三個窗口，每個 8 篇
const mk = (window: number, reward: number, n = 8, extra: Partial<RewardPost> = {}): RewardPost[] =>
  Array.from({ length: n }, (_, i) => ({ brand: "nas", platform: "threads", publishedAt: daysAgo(window * 14 + 1 + i), reward, relative: 1, treated: true, ...extra }));
const rising = trendFor([...mk(0, 130), ...mk(1, 100), ...mk(2, 90)], now);
assert.equal(rising.status, "up");
assert.equal(rising.stagnant, false);
assert.equal(rising.liftRecent, 0.3);

const flat = trendFor([...mk(0, 104), ...mk(1, 100), ...mk(2, 101)], now);
assert.equal(flat.status, "flat");
assert.equal(flat.stagnant, true, "連續兩窗口都沒到 10%");

const falling = trendFor([...mk(0, 70), ...mk(1, 100), ...mk(2, 100)], now);
assert.equal(falling.status, "down");
assert.equal(falling.stagnant, true);

// 其中一個窗口提升達標就不算停滯
const mixed = trendFor([...mk(0, 104), ...mk(1, 100), ...mk(2, 80)], now);
assert.equal(mixed.stagnant, false);

// 樣本不足
const thin = trendFor([...mk(0, 100, MIN_POSTS_PER_WINDOW - 1), ...mk(1, 100), ...mk(2, 100)], now);
assert.equal(thin.status, "insufficient");
assert.equal(thin.stagnant, false);
assert.equal(trendFor([], now).status, "insufficient");

// 品牌層級
assert.equal(brandTrendStatus([flat, trendFor([], now)]), "stagnant", "有足夠資料的平台全停滯");
assert.equal(brandTrendStatus([flat, rising]), "ok");
assert.equal(brandTrendStatus([trendFor([], now)]), "insufficient");

// 對照組 vs 實驗組
const epoch = Date.parse(daysAgo(40));
const side = (window: number, relative: number, treated: boolean, n = MIN_POSTS_PER_SIDE): RewardPost[] => mk(window, 100, n, { relative, treated });
const losing = controlVsTreated([...side(0, 1.3, false), ...side(0, 1.0, true), ...side(1, 1.3, false), ...side(1, 1.0, true)], now, epoch);
assert.equal(losing.controlBeatsTreated, true);
const oneWindow = controlVsTreated([...side(0, 1.3, false), ...side(0, 1.0, true), ...side(1, 1.0, false), ...side(1, 1.0, true)], now, epoch);
assert.equal(oneWindow.controlBeatsTreated, false, "必須連續兩個窗口");
const fewControl = controlVsTreated([...side(0, 1.3, false, 5), ...side(0, 1.0, true), ...side(1, 1.3, false, 5), ...side(1, 1.0, true)], now, epoch);
assert.equal(fewControl.controlBeatsTreated, false, "對照組篇數不足");
const beforeEpoch = controlVsTreated([...side(0, 1.3, false), ...side(0, 1.0, true)], now, now.getTime());
assert.equal(beforeEpoch.windows[0].control.n, 0, "實驗開始前的貼文不算對照組");
assert.equal(controlVsTreated([], now, null).controlBeatsTreated, false);
assert.ok(LIFT_THRESHOLD > 0);

// 下一個可測的組合
const arms = { structure: ["story_open", "question_open", "claim_open"], genre: ["breakdown", "stance"] };
const exp = (e: Partial<FinishedExperiment>): FinishedExperiment => ({ brand: "nas", variable: "structure", arm_a: "story_open", arm_b: "question_open", status: "concluded", winner: null, concluded_at: "2026-10-20T00:00:00Z", ...e });
assert.deepEqual(nextCandidate("nas", [], arms), { variable: "structure", armA: "story_open", armB: "question_open" });
assert.equal(nextCandidate("nas", [exp({ status: "running" })], arms), null, "有進行中的就不給");
// 第一輪結構有勝者 question_open：挑戰者是還沒出現過的 claim_open
assert.deepEqual(nextCandidate("nas", [exp({ winner: "question_open" })], arms), { variable: "structure", armA: "question_open", armB: "claim_open" });
// 第一輪沒勝者：用預設臂對上沒出現過的 claim_open
assert.deepEqual(nextCandidate("nas", [exp({ status: "inconclusive" })], arms), { variable: "structure", armA: "story_open", armB: "claim_open" });
// 兩輪結構都完成：換文體，arm_a 是預設的 breakdown
const twoRounds = [exp({ winner: "story_open" }), exp({ arm_b: "claim_open", winner: "story_open", concluded_at: "2026-10-28T00:00:00Z" })];
assert.deepEqual(nextCandidate("nas", twoRounds, arms), { variable: "genre", armA: "breakdown", armB: "stance" });
// 文體也測完：用完
const allDone = [...twoRounds, exp({ variable: "genre", arm_a: "breakdown", arm_b: "stance", winner: "stance", concluded_at: "2026-11-08T00:00:00Z" })];
assert.equal(nextCandidate("nas", allDone, arms), null);
assert.equal(nextCandidate("abl", allDone, arms)?.variable, "structure", "別的品牌不受影響");

// 警示
const idle = { nas: false, abl: false, i8: false };
const none = { nas: { variable: "structure", armA: "story_open", armB: "question_open" }, abl: { variable: "structure", armA: "story_open", armB: "question_open" }, i8: { variable: "structure", armA: "story_open", armB: "question_open" } };
assert.deepEqual(buildAlerts({ brandStatus: { nas: "ok", abl: "insufficient", i8: "ok" }, controlBeatsTreated: false, candidates: none, hasRunning: idle }), []);
const alerts = buildAlerts({ brandStatus: { nas: "stagnant", abl: "ok", i8: "ok" }, controlBeatsTreated: true, candidates: { ...none, i8: null }, hasRunning: idle });
assert.deepEqual(alerts.map((a) => `${a.code}:${a.brand}`).sort(), ["control_beats_treated:all", "no_untested_pairs:i8", "stagnant:nas"].sort());
assert.ok(alerts.every((a) => !/[—–─*#]/.test(a.message)), "警示文字不含破折號或 Markdown 符號");
const runningNoAlert = buildAlerts({ brandStatus: { nas: "ok", abl: "ok", i8: "ok" }, controlBeatsTreated: false, candidates: { ...none, i8: null }, hasRunning: { ...idle, i8: true } });
assert.equal(runningNoAlert.length, 0, "進行中的品牌不因沒有下一個組合而警示");

console.log("calibration tests passed");
