// 成效回流實驗的伺服器端：快照寫入、報告、分析員決策套用、發文時查詢當天的實驗臂。
// 只給伺服器端 API route 使用。所有規則寫在這裡與 experiment-arms.ts，不靠提示詞或 skill 約束分析員。
import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { pipelineDb } from "@/lib/auto-pipeline-server";
import { getSocialMetrics, type SocialPost } from "@/lib/social-metrics-server";
import {
  OTHER_TOPIC, allowedTopicsFor, scoreTopics, type TopicBrand, type TopicLabel, type TopicObservation,
} from "@/lib/topic-feedback";
import {
  EXPERIMENT_BRANDS, MATURE_HOURS, MAX_AHEAD_DAYS, MAX_DAYS, MIN_DAYS, MIN_MATURE_POSTS_PER_ARM, WIN_PROBABILITY,
  addDays, armDirective, judgeExperiment, latestSyncTime, median, parseDecision, relativeReward, rewardOf, taipeiDate,
  type ExperimentBrand, type ExperimentVerdict, type ParsedDecision, type Platform,
} from "@/lib/experiment-arms";

export function isExperimentEnabled(): boolean {
  return process.env.EXPERIMENT_ENABLED === "true";
}

function bearerMatches(req: NextRequest, secretName: "EXPERIMENT_CRON_SECRET" | "EXPERIMENT_ANALYST_SECRET"): boolean {
  const secret = process.env[secretName] || "";
  const received = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  return !!secret && received.length === secret.length && timingSafeEqual(Buffer.from(received), Buffer.from(secret));
}
export const isCronAuthorized = (req: NextRequest) => bearerMatches(req, "EXPERIMENT_CRON_SECRET");
export const isAnalystAuthorized = (req: NextRequest) => bearerMatches(req, "EXPERIMENT_ANALYST_SECRET");

// ───────────── 型別 ─────────────

interface ExperimentRow {
  id: string; brand: ExperimentBrand; variable: string; arm_a: string; arm_b: string;
  status: "running" | "concluded" | "inconclusive" | "cancelled";
  started_at: string; winner: string | null; decision_note: string | null; concluded_at: string | null;
}
interface QueueRow {
  id: string; platform: Platform; brand: ExperimentBrand; content: string | null; result: { postId?: string } | null;
  post_url: string | null; sent_at: string | null; experiment_json: { experiment_id?: string; arm?: string; variable?: string } | null;
}
interface SnapshotRow {
  queue_id: string | null; platform: Platform; post_id: string; brand: ExperimentBrand; published_at: string; source_synced_at: string;
  views: number | null; reach: number | null; likes: number | null; comments: number | null; shares: number | null; saves: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const safeMessage = (error: unknown) => (error instanceof Error ? error.message : String(error)).replace(/Bearer\s+\S+/gi, "Bearer [已遮蔽]").slice(0, 280);

// ───────────── 發文時查詢：這個品牌這一天該用哪個臂 ─────────────

export interface ExperimentAssignment {
  experimentId: string; variable: string; arm: string; directive: string;
}

/** 依預定發文時間（台北日期）查 strategy_params。沒有設定、實驗已結束或任何錯誤都回 null，等於不加指令照原流程跑。 */
export async function resolveExperimentArm(brand: string, scheduledAtIso: string): Promise<ExperimentAssignment | null> {
  if (!isExperimentEnabled() || !(EXPERIMENT_BRANDS as string[]).includes(brand)) return null;
  try {
    const date = taipeiDate(scheduledAtIso);
    const params = await pipelineDb<{ experiment_id: string; arm: string }[]>(
      "strategy_params", `brand=eq.${brand}&valid_date=eq.${date}&select=experiment_id,arm&limit=1`,
    );
    const row = params[0];
    if (!row) return null;
    const exps = await pipelineDb<ExperimentRow[]>("experiments", `id=eq.${encodeURIComponent(row.experiment_id)}&status=eq.running&select=id,variable,arm_a,arm_b`);
    const exp = exps[0];
    if (!exp || (row.arm !== exp.arm_a && row.arm !== exp.arm_b)) return null;
    const directive = armDirective(exp.variable, row.arm);
    return directive ? { experimentId: exp.id, variable: exp.variable, arm: row.arm, directive } : null;
  } catch (error) {
    console.error("[experiment] resolveExperimentArm failed:", safeMessage(error));
    return null;
  }
}

// ───────────── 快照：每天一次，把 n8n 已同步的成效對回我們發出的貼文 ─────────────

export interface SnapshotSummary {
  queueRowsChecked: number; matched: number; unmatched: number; noSyncTime: number; inserted: number; note: string;
}

export async function ingestSnapshots(now = new Date()): Promise<SnapshotSummary> {
  const metrics = await getSocialMetrics(false);
  if (!metrics.ok) throw new Error(`讀取成效資料失敗：${metrics.error}`);
  const since = new Date(now.getTime() - 30 * DAY_MS).toISOString();
  const queue = await pipelineDb<QueueRow[]>(
    "social_publish_queue",
    `status=eq.sent&sent_at=gte.${encodeURIComponent(since)}&select=id,platform,brand,result,post_url,sent_at,experiment_json&limit=1000`,
  );
  const posts = metrics.data.posts.filter((p) => p.platform === "threads" || p.platform === "instagram");
  const byId = new Map<string, SocialPost>();
  const byUrl = new Map<string, SocialPost>();
  for (const p of posts) {
    if (p.post_id) byId.set(`${p.platform}:${p.post_id}`, p);
    if (p.url) byUrl.set(`${p.platform}:${p.url}`, p);
  }

  const rows: Record<string, unknown>[] = [];
  let matched = 0; let unmatched = 0; let noSyncTime = 0;
  for (const q of queue) {
    const postId = q.result?.postId ? String(q.result.postId) : "";
    const post = (postId && byId.get(`${q.platform}:${postId}`)) || (q.post_url ? byUrl.get(`${q.platform}:${q.post_url}`) : undefined);
    if (!post || !post.post_id || !post.published_at) { unmatched += 1; continue; }
    matched += 1;
    const syncedAt = latestSyncTime(metrics.data.sync_log, post.platform, post.account_label, post.account_id);
    if (!syncedAt) { noSyncTime += 1; continue; }
    rows.push({
      queue_id: q.id, platform: q.platform, post_id: post.post_id, brand: q.brand, published_at: new Date(post.published_at).toISOString(),
      source_synced_at: new Date(syncedAt).toISOString(), observed_at: now.toISOString(),
      views: post.views, reach: post.reach, likes: post.likes, comments: post.comments, shares: post.shares, saves: post.saves,
    });
  }
  let inserted = 0;
  if (rows.length) {
    const result = await pipelineDb<unknown[]>("post_snapshots", "on_conflict=platform,post_id,source_synced_at", {
      method: "POST", body: JSON.stringify(rows), headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
    });
    inserted = Array.isArray(result) ? result.length : 0;
  }
  return { queueRowsChecked: queue.length, matched, unmatched, noSyncTime, inserted, note: "同一份同步資料重複讀取不會重複寫入（以貼文加同步時間去重）" };
}

// ───────────── 報告 ─────────────

interface MaturePost {
  queueId: string; brand: ExperimentBrand; platform: Platform; experimentId: string | null; arm: string | null;
  title: string; snippet: string; topic: string | null; publishedAt: string; ageHoursAtRead: number; reward: number; relative: number;
}

async function loadState(now: Date) {
  const since = new Date(now.getTime() - 30 * DAY_MS).toISOString();
  const [experiments, queue, snaps, topicRows] = await Promise.all([
    pipelineDb<ExperimentRow[]>("experiments", "order=started_at.desc&limit=30&select=*"),
    pipelineDb<QueueRow[]>("social_publish_queue", `status=eq.sent&sent_at=gte.${encodeURIComponent(since)}&select=id,platform,brand,content,sent_at,experiment_json&limit=1000`),
    pipelineDb<SnapshotRow[]>("post_snapshots", `published_at=gte.${encodeURIComponent(since)}&order=source_synced_at.desc&select=*&limit=5000`),
    // 題材標記表還沒建（尚未執行新版 SQL）時視為沒有標記，不影響實驗本身
    pipelineDb<{ queue_id: string; topic: string }[]>("post_topics", "select=queue_id,topic&limit=5000").catch(() => [] as { queue_id: string; topic: string }[]),
  ]);
  const topicByQueue = new Map(topicRows.map((t) => [t.queue_id, t.topic]));
  const queueById = new Map(queue.map((q) => [q.id, q]));
  // 每篇取「發文後至少 MATURE_HOURS 小時才讀到」的最新一筆；沒有就是還沒成熟
  const matureByQueue = new Map<string, SnapshotRow>();
  const lastReadByQueue = new Map<string, SnapshotRow>();
  for (const s of snaps) {
    if (!s.queue_id) continue;
    if (!lastReadByQueue.has(s.queue_id)) lastReadByQueue.set(s.queue_id, s);
    const ageMs = Date.parse(s.source_synced_at) - Date.parse(s.published_at);
    if (ageMs >= MATURE_HOURS * 3600 * 1000 && !matureByQueue.has(s.queue_id)) matureByQueue.set(s.queue_id, s);
  }
  const base = new Map<string, number[]>();
  const raw: { snap: SnapshotRow; q: QueueRow; reward: number }[] = [];
  for (const [queueId, snap] of matureByQueue) {
    const q = queueById.get(queueId);
    if (!q) continue;
    const reward = rewardOf(snap.platform, snap);
    raw.push({ snap, q, reward });
    const key = `${snap.brand}:${snap.platform}`;
    base.set(key, [...(base.get(key) || []), reward]);
  }
  const mature: MaturePost[] = raw.map(({ snap, q, reward }) => ({
    queueId: q.id, brand: snap.brand, platform: snap.platform, experimentId: q.experiment_json?.experiment_id || null, arm: q.experiment_json?.arm || null,
    title: String(q.content || "").split("\n")[0].replace(/^【|】$/g, "").slice(0, 40),
    snippet: String(q.content || "").replace(/\s+/g, " ").trim().slice(0, 160), topic: topicByQueue.get(q.id) || null, publishedAt: snap.published_at,
    ageHoursAtRead: Math.round((Date.parse(snap.source_synced_at) - Date.parse(snap.published_at)) / 3600000),
    reward: Math.round(reward), relative: relativeReward(reward, median(base.get(`${snap.brand}:${snap.platform}`) || [])),
  }));
  const taggedSent = queue.filter((q) => q.experiment_json?.experiment_id);
  const immature = taggedSent.filter((q) => !matureByQueue.has(q.id)).length;
  return { experiments, queue, mature, topicByQueue, immature, unreadQueue: queue.filter((q) => !lastReadByQueue.has(q.id)).length };
}

function verdictFor(exp: ExperimentRow, mature: MaturePost[], now: Date): { verdict: ExperimentVerdict; a: MaturePost[]; b: MaturePost[] } {
  const a = mature.filter((m) => m.experimentId === exp.id && m.arm === exp.arm_a);
  const b = mature.filter((m) => m.experimentId === exp.id && m.arm === exp.arm_b);
  const verdict = judgeExperiment({
    now, startedAt: new Date(exp.started_at), armA: exp.arm_a, armB: exp.arm_b,
    rewardsA: a.map((m) => m.relative), rewardsB: b.map((m) => m.relative),
  });
  return { verdict, a, b };
}

export async function buildReport(now = new Date()) {
  const state = await loadState(now);
  const running = state.experiments.filter((e) => e.status === "running");
  const today = taipeiDate(now);
  const params = await pipelineDb<{ brand: string; valid_date: string; experiment_id: string; arm: string }[]>(
    "strategy_params", `valid_date=gte.${today}&order=valid_date.asc&select=brand,valid_date,experiment_id,arm&limit=60`,
  );
  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 100) / 100 : null);
  const experiments = running.map((exp) => {
    const { verdict, a, b } = verdictFor(exp, state.mature, now);
    const days = Math.round(((now.getTime() - Date.parse(exp.started_at)) / DAY_MS) * 10) / 10;
    return {
      experiment_id: exp.id, brand: exp.brand, variable: exp.variable, running_days: days,
      arms: [
        { arm: exp.arm_a, mature_posts: a.length, mean_relative_reward: avg(a.map((m) => m.relative)) },
        { arm: exp.arm_b, mature_posts: b.length, mean_relative_reward: avg(b.map((m) => m.relative)) },
      ],
      verdict: { recommendation: verdict.recommendation, leader: verdict.leader, prob_leader_better: Math.round(verdict.probLeaderBetter * 100) / 100, reason: verdict.reason },
    };
  });
  return {
    generated_at: now.toISOString(), today_taipei: today,
    rules: { min_days: MIN_DAYS, max_days: MAX_DAYS, min_mature_posts_per_arm: MIN_MATURE_POSTS_PER_ARM, mature_hours: MATURE_HOURS, win_probability: WIN_PROBABILITY, max_ahead_days: MAX_AHEAD_DAYS },
    available_structure_arms: ["story_open", "question_open", "claim_open"],
    running_experiments: experiments,
    recent_finished: state.experiments.filter((e) => e.status !== "running").slice(0, 5).map((e) => ({ experiment_id: e.id, brand: e.brand, arm_a: e.arm_a, arm_b: e.arm_b, status: e.status, winner: e.winner, note: e.decision_note })),
    brands_without_running_experiment: EXPERIMENT_BRANDS.filter((brand) => !running.some((e) => e.brand === brand)),
    scheduled_params: params,
    allowed_topics: Object.fromEntries((["nas", "abl", "i8"] as TopicBrand[]).map((b) => [b, allowedTopicsFor(b)])),
    posts_needing_topic: state.mature.filter((m) => !m.topic).sort((x, y) => Date.parse(y.publishedAt) - Date.parse(x.publishedAt)).slice(0, 40)
      .map((m) => ({ queue_id: m.queueId, brand: m.brand, platform: m.platform, title: m.title, text_start: m.snippet })),
    topic_scores: scoreTopics(state.mature.filter((m): m is MaturePost & { topic: string } => !!m.topic).map((m) => ({ brand: m.brand as TopicBrand, topic: m.topic, relative: m.relative }))),
    data_quality: { sent_posts_30d: state.queue.length, never_read_by_sync: state.unreadQueue, tagged_posts_not_yet_mature: state.immature, mature_posts: state.mature.length },
    recent_mature_posts: state.mature.sort((x, y) => Date.parse(y.publishedAt) - Date.parse(x.publishedAt)).slice(0, 40).map((m) => ({ brand: m.brand, platform: m.platform, arm: m.arm, topic: m.topic, title: m.title, published_at: m.publishedAt, age_hours_at_read: m.ageHoursAtRead, reward: m.reward, relative_reward: Math.round(m.relative * 100) / 100 })),
  };
}

// ───────────── 套用分析員決策 ─────────────

export type DecisionResult = { ok: true; applied: string[] } | { ok: false; status: number; errors: string[] };

export async function applyDecision(raw: unknown, now = new Date()): Promise<DecisionResult> {
  const parsed = parseDecision(raw);
  if (!parsed.ok) { await logRun("rejected", raw, { errors: parsed.errors }); return { ok: false, status: 422, errors: parsed.errors }; }
  const d: ParsedDecision = parsed.value;
  const errors: string[] = [];
  const state = await loadState(now);
  const byId = new Map(state.experiments.map((e) => [e.id, e]));
  const concludedNow = new Set<string>();
  const plannedConclusions: { exp: ExperimentRow; status: "concluded" | "inconclusive"; winner: string | null; note: string }[] = [];

  for (const c of d.conclude) {
    const exp = byId.get(c.experimentId);
    if (!exp) { errors.push(`找不到實驗 ${c.experimentId}`); continue; }
    if (exp.status !== "running") { errors.push(`實驗 ${c.experimentId} 已不是進行中`); continue; }
    const { verdict } = verdictFor(exp, state.mature, now);
    if (verdict.recommendation === "continue") { errors.push(`實驗 ${c.experimentId} 現在不能結案：${verdict.reason}`); continue; }
    if (verdict.recommendation === "conclude") {
      if (c.winner !== verdict.leader) { errors.push(`實驗 ${c.experimentId} 的勝者必須是 ${verdict.leader}（伺服器判定），你送的是 ${c.winner ?? "null"}`); continue; }
      plannedConclusions.push({ exp, status: "concluded", winner: verdict.leader, note: c.note || verdict.reason });
    } else {
      if (c.winner !== null) { errors.push(`實驗 ${c.experimentId} 到期但證據不足，winner 必須是 null`); continue; }
      plannedConclusions.push({ exp, status: "inconclusive", winner: null, note: c.note || verdict.reason });
    }
    concludedNow.add(exp.id);
  }

  const stillRunning = state.experiments.filter((e) => e.status === "running" && !concludedNow.has(e.id));
  if (d.start) {
    const s = d.start;
    if (stillRunning.some((e) => e.brand === s.brand)) errors.push(`${s.brand} 已有進行中的實驗，同一品牌同時只能跑一個`);
    const previous = state.experiments.find((e) => e.brand === s.brand && e.variable === s.variable && e.status === "concluded" && e.winner);
    const pendingWinner = plannedConclusions.find((p) => p.exp.brand === s.brand && p.exp.variable === s.variable && p.winner);
    const champion = pendingWinner?.winner ?? previous?.winner ?? null;
    if (champion && s.armA !== champion) errors.push(`${s.brand} 上一輪勝者是 ${champion}，新實驗的 arm_a 必須沿用它（冠軍對挑戰者）`);
  }

  const today = taipeiDate(now);
  const earliest = addDays(today, 1);
  const latest = addDays(today, MAX_AHEAD_DAYS);
  for (const n of d.nextDays) {
    if (n.date < earliest || n.date > latest) { errors.push(`next_days 日期 ${n.date} 必須在 ${earliest} 到 ${latest} 之間（台北時間）`); continue; }
    if (n.experimentId === "new") {
      if (!d.start || d.start.brand !== n.brand) { errors.push(`next_days 用了 new，但這次沒有為 ${n.brand} 開新實驗`); continue; }
      if (n.arm !== d.start.armA && n.arm !== d.start.armB) errors.push(`next_days 的臂 ${n.arm} 不屬於新實驗`);
      continue;
    }
    const exp = state.experiments.find((e) => e.id === n.experimentId);
    if (!exp || exp.status !== "running" || concludedNow.has(exp.id)) { errors.push(`next_days 引用的實驗 ${n.experimentId} 不是進行中`); continue; }
    if (exp.brand !== n.brand) { errors.push(`next_days 的品牌 ${n.brand} 與實驗 ${n.experimentId} 不符`); continue; }
    if (n.arm !== exp.arm_a && n.arm !== exp.arm_b) errors.push(`next_days 的臂 ${n.arm} 不屬於實驗 ${n.experimentId}`);
  }
  const queueById = new Map(state.queue.map((q) => [q.id, q]));
  const newTopicRows: { queue_id: string; brand: string; topic: string }[] = [];
  for (const t of d.topicTags) {
    const q = queueById.get(t.queueId);
    if (!q) { errors.push(`topic_tags 找不到最近 30 天已發出的貼文 ${t.queueId}`); continue; }
    if (!(EXPERIMENT_BRANDS as string[]).includes(q.brand)) { errors.push(`topic_tags 的貼文 ${t.queueId} 品牌 ${q.brand} 不在題材回流範圍`); continue; }
    if (!allowedTopicsFor(q.brand as TopicBrand).includes(t.topic)) { errors.push(`topic_tags 的題材「${t.topic}」不在 ${q.brand} 的允許清單內（必須是 report 的 allowed_topics，或「${OTHER_TOPIC}」）`); continue; }
    const existing = state.topicByQueue.get(t.queueId);
    if (existing) { if (existing !== t.topic) errors.push(`貼文 ${t.queueId} 已標記為「${existing}」，不可改標為「${t.topic}」`); continue; }
    newTopicRows.push({ queue_id: t.queueId, brand: q.brand, topic: t.topic });
  }
  if (errors.length) { await logRun("rejected", raw, { errors }); return { ok: false, status: 422, errors }; }

  const applied: string[] = [];
  try {
    for (const p of plannedConclusions) {
      await pipelineDb("experiments", `id=eq.${encodeURIComponent(p.exp.id)}&status=eq.running`, {
        method: "PATCH", body: JSON.stringify({ status: p.status, winner: p.winner, decision_note: p.note.slice(0, 400), concluded_at: now.toISOString() }),
      });
      applied.push(`結案 ${p.exp.brand} ${p.exp.arm_a} 對 ${p.exp.arm_b}：${p.status}${p.winner ? `，勝者 ${p.winner}` : ""}`);
    }
    let startedId: string | null = null;
    if (d.start) {
      const rows = await pipelineDb<ExperimentRow[]>("experiments", "", {
        method: "POST", body: JSON.stringify({ brand: d.start.brand, variable: d.start.variable, arm_a: d.start.armA, arm_b: d.start.armB, status: "running", started_at: now.toISOString() }),
      });
      startedId = rows[0]?.id || null;
      applied.push(`開始新實驗 ${d.start.brand} ${d.start.armA} 對 ${d.start.armB}${startedId ? `（${startedId}）` : ""}`);
    }
    const runId = await logRun("accepted", raw, { applied });
    if (d.nextDays.some((n) => n.experimentId === "new") && !startedId) throw new Error("新實驗沒有取得編號，無法寫入參數");
    const paramRows = d.nextDays.map((n) => ({ brand: n.brand, valid_date: n.date, experiment_id: n.experimentId === "new" ? startedId : n.experimentId, arm: n.arm, run_id: runId }));
    if (paramRows.length) {
      await pipelineDb("strategy_params", "on_conflict=brand,valid_date", { method: "POST", body: JSON.stringify(paramRows), headers: { Prefer: "resolution=merge-duplicates,return=representation" } });
      applied.push(`寫入 ${paramRows.length} 筆未來幾天的參數`);
    }
    if (newTopicRows.length) {
      await pipelineDb("post_topics", "on_conflict=queue_id", { method: "POST", body: JSON.stringify(newTopicRows.map((r) => ({ ...r, run_id: runId, tagged_by: "analyst" }))), headers: { Prefer: "resolution=ignore-duplicates,return=representation" } });
      applied.push(`標記 ${newTopicRows.length} 篇貼文的題材`);
    }
    return { ok: true, applied };
  } catch (error) {
    const message = safeMessage(error);
    await logRun("rejected", raw, { errors: [`寫入中途失敗：${message}`], applied });
    return { ok: false, status: 500, errors: [`寫入中途失敗：${message}`, ...applied.map((a) => `已完成：${a}`)] };
  }
}

async function logRun(status: "accepted" | "rejected", request: unknown, result: unknown): Promise<string | null> {
  try {
    const summary = request && typeof request === "object" && typeof (request as { summary?: unknown }).summary === "string" ? String((request as { summary: string }).summary).slice(0, 800) : null;
    const rows = await pipelineDb<{ id: string }[]>("analyst_runs", "", { method: "POST", body: JSON.stringify({ status, summary, request_json: request ?? null, result_json: result }) });
    return rows[0]?.id || null;
  } catch (error) {
    console.error("[experiment] analyst_runs log failed:", safeMessage(error));
    return null;
  }
}


// ───────────── 題材成效標籤：給話題雷達的關鍵字 API 使用 ─────────────

export interface TopicLabelEntry { label: TopicLabel; posts: number }

/** 回傳 { 關鍵字: { nas?: {label, posts}, abl?, i8? } }。功能未啟用、資料表不存在或任何錯誤都回空物件，雷達照原樣運作。只含標籤與篇數，不含原始數字。 */
export async function getTopicLabels(now = new Date()): Promise<Record<string, Partial<Record<TopicBrand, TopicLabelEntry>>>> {
  if (!isExperimentEnabled()) return {};
  try {
    const state = await loadState(now);
    const observations: TopicObservation[] = state.mature.filter((m) => !!m.topic).map((m) => ({ brand: m.brand as TopicBrand, topic: m.topic as string, relative: m.relative }));
    const out: Record<string, Partial<Record<TopicBrand, TopicLabelEntry>>> = {};
    for (const score of scoreTopics(observations)) {
      (out[score.topic] = out[score.topic] || {})[score.brand] = { label: score.label, posts: score.posts };
    }
    return out;
  } catch (error) {
    console.error("[experiment] getTopicLabels failed:", safeMessage(error));
    return {};
  }
}
