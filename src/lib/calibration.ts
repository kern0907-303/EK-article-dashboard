// 第三層校正：實驗之外的「整體有沒有變好」檢查。純邏輯，不連資料庫、不呼叫網路，方便單元測試。
// 一、對照日：每個品牌每 7 天固定一天不套用任何實驗指令，用來量「有指令」是否真的比「沒指令」好。
// 二、基準線：每個品牌每個平台，最近 14 天成熟貼文的成效中位數，對比前一個 14 天。
// 三、停滯：連續兩個 14 天窗口，成效提升都不到門檻。
// 四、下一個可測的組合：結構最多兩輪、文體一輪，全部測完就通知人。

import { EXPERIMENT_BRANDS, mean, median, type ExperimentBrand } from "@/lib/experiment-arms";

export const WINDOW_DAYS = 14;
export const MIN_POSTS_PER_WINDOW = 6;
/** 成效提升低於這個比例視為沒有進步 */
export const LIFT_THRESHOLD = 0.1;
export const CONTROL_EVERY_DAYS = 7;
/** 對照組與實驗組各要有這麼多篇成熟貼文，才比較 */
export const MIN_POSTS_PER_SIDE = 12;
/** 對照組比實驗組高出這個比例，視為「實驗指令沒有幫助」 */
export const CONTROL_ADVANTAGE = 0.1;
const DAY_MS = 24 * 60 * 60 * 1000;

// ───────────── 對照日 ─────────────

/** 這個品牌在這個台北日期是不是對照日。三個品牌錯開，同一天不會全部是對照日。 */
export function isControlDay(brand: ExperimentBrand, date: string): boolean {
  const index = EXPERIMENT_BRANDS.indexOf(brand);
  const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
  if (index < 0 || !Number.isFinite(day)) return false;
  return (((day + index * 2) % CONTROL_EVERY_DAYS) + CONTROL_EVERY_DAYS) % CONTROL_EVERY_DAYS === 0;
}

// ───────────── 基準線與停滯 ─────────────

export interface RewardPost { brand: ExperimentBrand; platform: string; publishedAt: string; reward: number; relative: number; treated: boolean }
export interface WindowStat { n: number; median: number | null }
export type TrendStatus = "insufficient" | "up" | "flat" | "down";
export interface TrendResult { windows: [WindowStat, WindowStat, WindowStat]; liftRecent: number | null; liftPrior: number | null; status: TrendStatus; stagnant: boolean }

function windowOf(posts: RewardPost[], now: Date, index: number): WindowStat {
  const end = now.getTime() - index * WINDOW_DAYS * DAY_MS;
  const start = end - WINDOW_DAYS * DAY_MS;
  const rewards = posts.filter((p) => { const t = Date.parse(p.publishedAt); return t > start && t <= end; }).map((p) => p.reward);
  return { n: rewards.length, median: rewards.length ? median(rewards) : null };
}

const lift = (recent: WindowStat, prior: WindowStat): number | null =>
  recent.median !== null && prior.median !== null && prior.median > 0 && recent.n >= MIN_POSTS_PER_WINDOW && prior.n >= MIN_POSTS_PER_WINDOW ? recent.median / prior.median - 1 : null;

/** 單一品牌單一平台的趨勢。窗口 0 是最近 14 天，1 是再前 14 天，2 是再前一個。 */
export function trendFor(posts: RewardPost[], now: Date): TrendResult {
  const windows: [WindowStat, WindowStat, WindowStat] = [windowOf(posts, now, 0), windowOf(posts, now, 1), windowOf(posts, now, 2)];
  const liftRecent = lift(windows[0], windows[1]);
  const liftPrior = lift(windows[1], windows[2]);
  const status: TrendStatus = liftRecent === null ? "insufficient" : liftRecent >= LIFT_THRESHOLD ? "up" : liftRecent <= -LIFT_THRESHOLD ? "down" : "flat";
  const stagnant = liftRecent !== null && liftPrior !== null && liftRecent < LIFT_THRESHOLD && liftPrior < LIFT_THRESHOLD;
  return { windows, liftRecent: liftRecent === null ? null : Math.round(liftRecent * 100) / 100, liftPrior: liftPrior === null ? null : Math.round(liftPrior * 100) / 100, status, stagnant };
}

export type BrandTrendStatus = "insufficient" | "ok" | "stagnant";

/** 品牌層級：有足夠資料的平台全部都停滯，才算停滯；沒有任何平台資料足夠就是資料不足。 */
export function brandTrendStatus(trends: TrendResult[]): BrandTrendStatus {
  const usable = trends.filter((t) => t.liftRecent !== null && t.liftPrior !== null);
  if (!usable.length) return "insufficient";
  return usable.every((t) => t.stagnant) ? "stagnant" : "ok";
}

// ───────────── 對照組 vs 實驗組 ─────────────

export interface SideStat { n: number; mean: number | null }
export interface ControlWindow { control: SideStat; treated: SideStat; enough: boolean; controlAdvantage: number | null }

function side(posts: RewardPost[]): SideStat {
  return { n: posts.length, mean: posts.length ? Math.round(mean(posts.map((p) => p.relative)) * 100) / 100 : null };
}

/** 以「相對成效」（已除以品牌平台中位數）比較。epochMs 之前的貼文不算對照組，因為那時還沒有實驗。 */
export function controlVsTreated(posts: RewardPost[], now: Date, epochMs: number | null): { windows: [ControlWindow, ControlWindow]; controlBeatsTreated: boolean } {
  const build = (index: number): ControlWindow => {
    const end = now.getTime() - index * WINDOW_DAYS * DAY_MS;
    const start = end - WINDOW_DAYS * DAY_MS;
    const inWindow = posts.filter((p) => { const t = Date.parse(p.publishedAt); return t > start && t <= end && (epochMs === null || t >= epochMs); });
    const control = side(inWindow.filter((p) => !p.treated));
    const treated = side(inWindow.filter((p) => p.treated));
    const enough = epochMs !== null && control.n >= MIN_POSTS_PER_SIDE && treated.n >= MIN_POSTS_PER_SIDE && (treated.mean ?? 0) > 0;
    const controlAdvantage = enough && control.mean !== null && treated.mean ? Math.round((control.mean / treated.mean - 1) * 100) / 100 : null;
    return { control, treated, enough, controlAdvantage };
  };
  const windows: [ControlWindow, ControlWindow] = [build(0), build(1)];
  const controlBeatsTreated = windows.every((w) => w.enough && w.controlAdvantage !== null && w.controlAdvantage >= CONTROL_ADVANTAGE);
  return { windows, controlBeatsTreated };
}

// ───────────── 下一個可測的組合 ─────────────

export interface FinishedExperiment { brand: string; variable: string; arm_a: string; arm_b: string; status: string; winner: string | null; concluded_at?: string | null; started_at?: string }
export interface Candidate { variable: string; armA: string; armB: string }

export const VARIABLE_ORDER = ["structure", "genre"] as const;
/** 對照（預設）臂：沒有勝者時，新實驗用它當 arm_a */
export const DEFAULT_ARM: Record<string, string> = { structure: "story_open", genre: "breakdown" };

/**
 * 沒有進行中實驗的品牌，下一個該測什麼。
 * 規則：變數依序測；同一變數裡，還沒參加過任何已完成實驗的臂才是挑戰者；每次挑戰者對上目前的冠軍（沒有就用預設臂）。
 * 全部變數都沒有未測的臂時回傳 null，代表可測的組合已經用完。
 */
export function nextCandidate(brand: string, experiments: FinishedExperiment[], arms: Record<string, string[]>): Candidate | null {
  const mine = experiments.filter((e) => e.brand === brand);
  if (mine.some((e) => e.status === "running")) return null;
  for (const variable of VARIABLE_ORDER) {
    const finished = mine.filter((e) => e.variable === variable && (e.status === "concluded" || e.status === "inconclusive"));
    // 文體要等至少一輪結構完成才能開
    if (variable === "genre" && !mine.some((e) => e.variable === "structure" && (e.status === "concluded" || e.status === "inconclusive"))) continue;
    const seen = new Set(finished.flatMap((e) => [e.arm_a, e.arm_b]));
    const champion = [...finished].filter((e) => e.status === "concluded" && e.winner).sort((a, b) => Date.parse(b.concluded_at || "") - Date.parse(a.concluded_at || ""))[0]?.winner || DEFAULT_ARM[variable];
    const challenger = (arms[variable] || []).find((arm) => arm !== champion && !seen.has(arm));
    if (challenger) return { variable, armA: champion, armB: challenger };
  }
  return null;
}

// ───────────── 警示 ─────────────

export interface CalibrationAlert { code: "stagnant" | "control_beats_treated" | "no_untested_pairs"; brand: ExperimentBrand | "all"; message: string }

const BRAND_NAME: Record<ExperimentBrand, string> = { nas: "平衡空間", abl: "艾伯林量子調頻", i8: "初八企業顧問" };
export const brandName = (brand: ExperimentBrand) => BRAND_NAME[brand];

export function buildAlerts(input: {
  brandStatus: Record<ExperimentBrand, BrandTrendStatus>;
  controlBeatsTreated: boolean;
  candidates: Record<ExperimentBrand, Candidate | null>;
  hasRunning: Record<ExperimentBrand, boolean>;
}): CalibrationAlert[] {
  const alerts: CalibrationAlert[] = [];
  for (const brand of EXPERIMENT_BRANDS) {
    if (input.brandStatus[brand] === "stagnant") {
      alerts.push({ code: "stagnant", brand, message: `${BRAND_NAME[brand]}連續兩個 14 天窗口，成效提升都不到 10%。實驗只能調整寫法，改不了有沒有人看到。建議你選一個方向：一、換題材（看題材成效標籤與海巡素材）；二、檢查發文時間與圖卡；三、暫停實驗，回到原本流程。` });
    }
    if (!input.hasRunning[brand] && input.candidates[brand] === null) {
      alerts.push({ code: "no_untested_pairs", brand, message: `${BRAND_NAME[brand]}目前可測的臂組合都測完了，沒有新的實驗可以自動開。需要你決定要新增什麼測試變數（例如長度、行動呼籲、圖卡風格）。` });
    }
  }
  if (input.controlBeatsTreated) {
    alerts.push({ code: "control_beats_treated", brand: "all", message: "連續兩個 14 天窗口，沒有套用實驗指令的對照貼文，成效都比有套用的高出 10% 以上。實驗指令可能沒有幫助，建議你考慮暫停所有實驗指令，回到原本流程。" });
  }
  return alerts;
}
