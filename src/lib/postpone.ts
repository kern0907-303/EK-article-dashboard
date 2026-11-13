// 整批往後延發佈：純函式，不連資料庫，測試可以直接載入。
//
// 2026-11-13：艾瑞克在推 2027 黃金時刻，已排好的品牌文章要讓路，往後延幾天再發。
// 延後只改時間，不動文章內容；FB、IG、Threads 一起延，彼此的間隔維持不變。

export const POSTPONE_MAX_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 還沒發出去、可以延後的任務狀態 */
export const POSTPONABLE_JOB_STATUSES = ["pending", "generating", "optimizing", "scheduled", "manual"] as const;

export function shiftIso(iso: string | null | undefined, days: number): string | null {
  if (!iso) return null;
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return null;
  return new Date(time + days * DAY_MS).toISOString();
}

export function normalizePostponeDays(value: unknown): number | null {
  const days = Number(value);
  if (!Number.isInteger(days) || days < 1 || days > POSTPONE_MAX_DAYS) return null;
  return days;
}

/** 「從哪一天開始」是台北時間的日期（YYYY-MM-DD），換成那天 00:00 的 ISO 時間 */
export function taipeiDayStartIso(day: unknown): string | null {
  const text = String(day || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const time = new Date(`${text}T00:00:00+08:00`).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

export interface PostponeJob { id: string; brand_id: string; status: string; scheduled_at: string | null; queue_id: string | null; published?: boolean }

/** 挑出要延後的任務：品牌相符、還沒發、預定時間在起始日之後 */
export function selectPostponeJobs<T extends PostponeJob>(jobs: T[], options: { brandId?: string; fromIso: string; nowIso: string }): T[] {
  const from = Math.max(new Date(options.fromIso).getTime(), new Date(options.nowIso).getTime());
  return jobs.filter((job) => {
    if (job.published) return false;
    if (!(POSTPONABLE_JOB_STATUSES as readonly string[]).includes(job.status)) return false;
    if (options.brandId && job.brand_id !== options.brandId) return false;
    const at = job.scheduled_at ? new Date(job.scheduled_at).getTime() : NaN;
    return Number.isFinite(at) && at >= from;
  });
}

const taipeiText = (iso: string | null): string => iso
  ? new Date(iso).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false })
  : "未指定";

export function describeShift(fromIso: string | null, days: number): { before: string; after: string } {
  return { before: taipeiText(fromIso), after: taipeiText(shiftIso(fromIso, days)) };
}
