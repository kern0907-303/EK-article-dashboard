// 成效回流實驗的純邏輯（不連資料庫、不呼叫網路），方便單元測試。
// 一次只改一個變數：目前只開放「structure（開頭結構）」，每個品牌同時只跑一個實驗，兩個臂（arm）對打。

export const EXPERIMENT_VARIABLES = ["structure"] as const;
export type ExperimentVariable = (typeof EXPERIMENT_VARIABLES)[number];

export type ExperimentBrand = "nas" | "abl" | "i8";
export const EXPERIMENT_BRANDS: ExperimentBrand[] = ["nas", "abl", "i8"];

/** 每個臂附加在提示詞後面的指令。只調整開頭與段落順序，不得改動品牌規範、紅線與事實邊界。 */
export const STRUCTURE_ARMS: Record<string, { label: string; directive: string }> = {
  story_open: {
    label: "場景開頭",
    directive:
      "【本篇結構實驗指令】開頭用一個具體的生活場景或一句真實會聽到的對話切入，讓讀者先看見畫面，第三段之前再點出主張。標題、品牌規範、紅線與事實邊界一律照原本規則，只調整開頭與段落順序。",
  },
  question_open: {
    label: "提問開頭",
    directive:
      "【本篇結構實驗指令】正文第一句用一個讀者此刻心裡正在問的問題開頭，下一段直接給出回答，再展開理由與例子。標題、品牌規範、紅線與事實邊界一律照原本規則，只調整開頭與段落順序。",
  },
  claim_open: {
    label: "結論開頭",
    directive:
      "【本篇結構實驗指令】正文第一句直接說出結論或主張，後面再用情境與理由支撐，最後收在一個可以帶走的做法。標題、品牌規範、紅線與事實邊界一律照原本規則，只調整開頭與段落順序。",
  },
};

export function isKnownArm(variable: string, arm: string): boolean {
  return variable === "structure" && Object.prototype.hasOwnProperty.call(STRUCTURE_ARMS, arm);
}

export function armDirective(variable: string, arm: string): string | null {
  return isKnownArm(variable, arm) ? STRUCTURE_ARMS[arm].directive : null;
}

// ───────────── 規則常數（改這裡就能調整，不用動資料庫）─────────────

/** 最少觀察天數（含）：開始後滿這麼久才能下結論，給話題發酵的時間 */
export const MIN_DAYS = 3;
/** 最長觀察天數：到了就必須收斂，樣本不足就標記為 inconclusive，不亂切 */
export const MAX_DAYS = 5;
/** 每個臂至少要有幾篇「已成熟」的貼文才能判定勝負 */
export const MIN_MATURE_POSTS_PER_ARM = 4;
/** 發文後至少幾小時才算成熟（成效讀數要在發文 72 小時之後才採用） */
export const MATURE_HOURS = 72;
/** 勝出機率門檻：領先臂真的比較好的機率需達此值才宣告勝出，否則 inconclusive */
export const WIN_PROBABILITY = 0.8;
/** 排程參數最多往後排幾天 */
export const MAX_AHEAD_DAYS = 3;

export type Platform = "threads" | "instagram";

export interface PostMetrics {
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
}

/**
 * 單篇獎勵分數。權重是預設值，之後只改這個函式。
 * Threads：瀏覽為底，回覆權重最高（對話才是 Threads 的訊號）。
 * Instagram：瀏覽或觸及為底，收藏與分享權重最高（值得留下與轉傳）。
 */
export function rewardOf(platform: Platform, m: PostMetrics): number {
  const n = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const base = n(m.views) || n(m.reach);
  if (platform === "threads") return base + 20 * n(m.comments) + 10 * n(m.shares) + 2 * n(m.likes);
  return base + 20 * n(m.saves) + 20 * n(m.shares) + 10 * n(m.comments) + 2 * n(m.likes);
}

export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** 平台之間的量級不同，所以把獎勵除以該平台的中位數（至少 1），變成「相對基準的倍數」再合併比較 */
export function relativeReward(reward: number, platformMedian: number): number {
  return reward / Math.max(1, platformMedian);
}

export function mean(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

/** 可重現的亂數（mulberry32），測試與報告都用固定種子，同樣資料同樣結果 */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 自助重抽法：B 臂平均高於 A 臂的機率。任一邊沒有樣本回傳 0.5（無法判斷）。 */
export function probBBeatsA(a: number[], b: number[], rounds = 4000, seed = 20261017): number {
  if (!a.length || !b.length) return 0.5;
  const rand = seededRandom(seed);
  let wins = 0;
  let ties = 0;
  for (let i = 0; i < rounds; i += 1) {
    let sa = 0;
    let sb = 0;
    for (let j = 0; j < a.length; j += 1) sa += a[Math.floor(rand() * a.length)];
    for (let j = 0; j < b.length; j += 1) sb += b[Math.floor(rand() * b.length)];
    const ma = sa / a.length;
    const mb = sb / b.length;
    if (mb > ma) wins += 1;
    else if (mb === ma) ties += 1;
  }
  return (wins + ties / 2) / rounds;
}

export interface ArmStats {
  arm: string;
  matureN: number;
  meanRelativeReward: number;
}

export interface ExperimentVerdict {
  status: "not_ready" | "ready";
  /** continue 繼續觀察；conclude 可結案；inconclusive 到期但樣本或差距不足，不切換 */
  recommendation: "continue" | "conclude" | "inconclusive";
  leader: string | null;
  probLeaderBetter: number;
  reason: string;
}

export interface VerdictInput {
  now: Date;
  startedAt: Date;
  armA: string;
  armB: string;
  rewardsA: number[];
  rewardsB: number[];
}

/** 伺服器端的結案判定。分析員只能在這個判定允許時結案，並且不能宣告與判定相反的勝者。 */
export function judgeExperiment(input: VerdictInput): ExperimentVerdict {
  const dayMs = 24 * 60 * 60 * 1000;
  const days = (input.now.getTime() - input.startedAt.getTime()) / dayMs;
  const pB = probBBeatsA(input.rewardsA, input.rewardsB);
  const leader = pB === 0.5 ? null : pB > 0.5 ? input.armB : input.armA;
  const pLeader = pB > 0.5 ? pB : 1 - pB;
  const enough = input.rewardsA.length >= MIN_MATURE_POSTS_PER_ARM && input.rewardsB.length >= MIN_MATURE_POSTS_PER_ARM;

  if (days < MIN_DAYS) {
    return { status: "not_ready", recommendation: "continue", leader, probLeaderBetter: pLeader, reason: `未滿 ${MIN_DAYS} 天（已 ${days.toFixed(1)} 天），話題還在發酵，不下結論` };
  }
  if (enough && pLeader >= WIN_PROBABILITY && leader) {
    return { status: "ready", recommendation: "conclude", leader, probLeaderBetter: pLeader, reason: `兩臂各有至少 ${MIN_MATURE_POSTS_PER_ARM} 篇成熟貼文，${leader} 領先的機率 ${(pLeader * 100).toFixed(0)}%` };
  }
  if (days >= MAX_DAYS) {
    const why = !enough ? `到期仍有臂的成熟貼文不足 ${MIN_MATURE_POSTS_PER_ARM} 篇（A ${input.rewardsA.length}、B ${input.rewardsB.length}）` : `差距不夠明顯（領先機率 ${(pLeader * 100).toFixed(0)}%，門檻 ${(WIN_PROBABILITY * 100).toFixed(0)}%）`;
    return { status: "ready", recommendation: "inconclusive", leader, probLeaderBetter: pLeader, reason: `${why}，結案但不宣告勝者，維持現有方向` };
  }
  return { status: "not_ready", recommendation: "continue", leader, probLeaderBetter: pLeader, reason: enough ? `差距還不夠明顯（領先機率 ${(pLeader * 100).toFixed(0)}%），繼續觀察到第 ${MAX_DAYS} 天` : `成熟貼文還不足（A ${input.rewardsA.length}、B ${input.rewardsB.length}，各需 ${MIN_MATURE_POSTS_PER_ARM}），繼續觀察` };
}

// ───────────── 分析員輸出（POST /api/experiment/decision）驗證 ─────────────

export interface ParsedDecision {
  summary: string;
  conclude: { experimentId: string; winner: string | null; note: string }[];
  start: { brand: ExperimentBrand; variable: ExperimentVariable; armA: string; armB: string } | null;
  /** experimentId 可以是既有實驗的 UUID，或 "new"（指這次 start 同時開的新實驗） */
  nextDays: { brand: ExperimentBrand; date: string; experimentId: string; arm: string }[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 只做格式與白名單檢查；時間與樣本規則由伺服器端依資料庫狀態判定。回傳錯誤清單，空陣列代表格式合格。 */
export function parseDecision(raw: unknown): { ok: true; value: ParsedDecision } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!raw || typeof raw !== "object") return { ok: false, errors: ["請求內容必須是 JSON 物件"] };
  const body = raw as Record<string, unknown>;
  const allowedKeys = new Set(["summary", "conclude", "start", "next_days", "schema_version"]);
  for (const key of Object.keys(body)) if (!allowedKeys.has(key)) errors.push(`不允許的欄位：${key}`);

  const summary = typeof body.summary === "string" ? body.summary.trim() : "";
  if (!summary) errors.push("summary 必填（繁體中文，說明這次的結論）");
  if (summary.length > 800) errors.push("summary 不可超過 800 字");

  const conclude: ParsedDecision["conclude"] = [];
  if (body.conclude !== undefined) {
    if (!Array.isArray(body.conclude) || body.conclude.length > 3) errors.push("conclude 必須是最多 3 筆的陣列");
    else for (const item of body.conclude) {
      const row = item as Record<string, unknown>;
      if (!row || typeof row.experiment_id !== "string" || !UUID_RE.test(row.experiment_id)) { errors.push("conclude 的 experiment_id 格式不正確"); continue; }
      const winner = row.winner === null || row.winner === undefined ? null : String(row.winner);
      conclude.push({ experimentId: row.experiment_id, winner, note: typeof row.note === "string" ? row.note.slice(0, 400) : "" });
    }
  }

  let start: ParsedDecision["start"] = null;
  if (body.start !== undefined && body.start !== null) {
    const row = body.start as Record<string, unknown>;
    if (!EXPERIMENT_BRANDS.includes(row.brand as ExperimentBrand)) errors.push("start.brand 必須是 nas、abl 或 i8");
    else if (!EXPERIMENT_VARIABLES.includes(row.variable as ExperimentVariable)) errors.push("start.variable 目前只開放 structure");
    else if (typeof row.arm_a !== "string" || typeof row.arm_b !== "string" || !isKnownArm(String(row.variable), row.arm_a) || !isKnownArm(String(row.variable), row.arm_b)) errors.push("start 的 arm_a、arm_b 必須是已定義的結構");
    else if (row.arm_a === row.arm_b) errors.push("start 的兩個臂不可相同");
    else start = { brand: row.brand as ExperimentBrand, variable: row.variable as ExperimentVariable, armA: row.arm_a as string, armB: row.arm_b as string };
  }

  const nextDays: ParsedDecision["nextDays"] = [];
  if (body.next_days !== undefined) {
    if (!Array.isArray(body.next_days) || body.next_days.length > 12) errors.push("next_days 必須是最多 12 筆的陣列");
    else for (const item of body.next_days) {
      const row = item as Record<string, unknown>;
      if (!row || !EXPERIMENT_BRANDS.includes(row.brand as ExperimentBrand)) { errors.push("next_days.brand 必須是 nas、abl 或 i8"); continue; }
      if (typeof row.date !== "string" || !DATE_RE.test(row.date)) { errors.push("next_days.date 格式必須是 YYYY-MM-DD"); continue; }
      if (typeof row.experiment_id !== "string" || (row.experiment_id !== "new" && !UUID_RE.test(row.experiment_id))) { errors.push("next_days.experiment_id 必須是實驗 UUID 或 new"); continue; }
      if (typeof row.arm !== "string") { errors.push("next_days.arm 必填"); continue; }
      nextDays.push({ brand: row.brand as ExperimentBrand, date: row.date, experimentId: row.experiment_id, arm: row.arm });
    }
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { summary, conclude, start, nextDays } };
}

/** 台北時間的 YYYY-MM-DD */
export function taipeiDate(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Date(d.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** 台北日期加減天數 */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
