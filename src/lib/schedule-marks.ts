// 排程月曆的「已有預約」標記：把佇列資料整理成「每天有哪些品牌、各幾篇」。
// 純函式，沒有網路與 React 相依，方便測試。

export type MarkBrand = "i8" | "abl" | "nas" | "erick";

/** 固定顯示順序，點不會因為先後而跳動 */
export const MARK_BRAND_ORDER: MarkBrand[] = ["i8", "abl", "nas", "erick"];

/** 品牌系統色（與 ai-provider 的 getBrandColorsForPrompt 一致） */
export const MARK_BRAND_COLOR: Record<MarkBrand, string> = {
  i8: "#1e3a8a",
  abl: "#0abab5",
  nas: "#7c3aed",
  erick: "#d4af37",
};

export const MARK_BRAND_LABEL: Record<MarkBrand, string> = {
  i8: "I8",
  abl: "ABL",
  nas: "NAS",
  erick: "Erick",
};

export interface MarkSource {
  id?: string;
  brand_id: string;
  scheduled_at: string;
  status: string;
}

export interface DayMark {
  brands: { brand: MarkBrand; count: number }[];
  /** 這天所有待發項目，依時間排序 */
  entries: { brand: MarkBrand; at: Date }[];
  /** 四個品牌都有 */
  full: boolean;
}

const p2 = (n: number) => String(n).padStart(2, "0");
export const dayKey = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

const normBrand = (id: string): MarkBrand | null => {
  const s = String(id || "").toLowerCase();
  if (s.includes("i8")) return "i8";
  if (s.includes("abl")) return "abl";
  if (s.includes("nas")) return "nas";
  if (s.includes("erick") || s.includes("personal")) return "erick";
  return null;
};

/** 只標示「待發」與「發送中」；已發出、失敗、取消都不標 */
export const isActiveStatus = (s: string) => s === "pending" || s === "sending";

export function buildDayMarks(items: MarkSource[]): Map<string, DayMark> {
  const byDay = new Map<string, { brand: MarkBrand; at: Date }[]>();
  for (const it of items || []) {
    if (!isActiveStatus(it.status)) continue;
    const brand = normBrand(it.brand_id);
    const at = new Date(it.scheduled_at);
    if (!brand || Number.isNaN(at.getTime())) continue;
    const key = dayKey(at);
    const list = byDay.get(key) || [];
    list.push({ brand, at });
    byDay.set(key, list);
  }
  const out = new Map<string, DayMark>();
  for (const [key, list] of byDay) {
    list.sort((a, b) => a.at.getTime() - b.at.getTime());
    const brands = MARK_BRAND_ORDER.map((brand) => ({
      brand,
      count: list.filter((e) => e.brand === brand).length,
    })).filter((b) => b.count > 0);
    out.set(key, { brands, entries: list, full: brands.length === MARK_BRAND_ORDER.length });
  }
  return out;
}

/** 滑過或點選某天時顯示的清單文字，例如「09:00 ABL、12:00 NAS」 */
export function describeDay(mark: DayMark | undefined): string {
  if (!mark) return "";
  return mark.entries
    .map((e) => `${p2(e.at.getHours())}:${p2(e.at.getMinutes())} ${MARK_BRAND_LABEL[e.brand]}`)
    .join("、");
}

/** 選到的時間若同一天同一小時已有別的排程，回傳提醒文字（只提醒，不阻擋） */
export function sameSlotHint(mark: DayMark | undefined, selected: Date | null): string {
  if (!mark || !selected) return "";
  const hits = mark.entries.filter((e) => e.at.getHours() === selected.getHours());
  if (hits.length === 0) return "";
  const names = Array.from(new Set(hits.map((h) => MARK_BRAND_LABEL[h.brand]))).join("、");
  return `這個時段已有 ${names} 的排程（可以同時發，系統會依序處理）`;
}
