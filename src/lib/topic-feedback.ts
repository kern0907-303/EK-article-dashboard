// 題材成效回流的純邏輯（不連資料庫、不呼叫網路），方便單元測試。
// 題材分類沿用話題雷達的關鍵字宇宙：每篇成熟貼文由分析員歸到「該品牌的某個關鍵字」或「其他」，
// 再算每個題材的成效標籤，回給每週品牌調研當選題參考。這裡只決定「寫什麼」，不碰「怎麼寫」（那是結構實驗）。

import { KEYWORD_UNIVERSE } from "@/data/radar/keywords";

export type TopicBrand = "nas" | "abl" | "i8";
export const TOPIC_BRANDS: TopicBrand[] = ["nas", "abl", "i8"];
export const OTHER_TOPIC = "其他";

/** 標籤門檻：少於這麼多篇成熟貼文一律視為 untested，不下結論 */
export const MIN_POSTS_FOR_LABEL = 3;
/** 收縮權重：把平均成效往 1.0（品牌平台中位數）拉，避免 3 篇就極端判斷。等同加上 3 篇「剛好中位數」的假貼文 */
export const SHRINK_PRIOR_POSTS = 3;
export const HOT_THRESHOLD = 1.15;
export const COLD_THRESHOLD = 0.85;

export type TopicLabel = "hot" | "neutral" | "cold" | "untested";

/** 某品牌可用的題材清單：關鍵字宇宙中屬於該品牌的詞，加上「其他」。bridge 層是借勢詞，不當固定題材。 */
export function allowedTopicsFor(brand: TopicBrand): string[] {
  const terms = KEYWORD_UNIVERSE.filter((k) => k.layer !== "bridge" && k.brands.includes(brand)).map((k) => k.term);
  return [...new Set(terms), OTHER_TOPIC];
}

export interface TopicTagInput { queueId: string; topic: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 只做格式檢查；題材是否屬於該貼文的品牌，由伺服器依資料庫判定。 */
export function parseTopicTags(raw: unknown): { ok: true; value: TopicTagInput[] } | { ok: false; errors: string[] } {
  if (raw === undefined || raw === null) return { ok: true, value: [] };
  if (!Array.isArray(raw)) return { ok: false, errors: ["topic_tags 必須是陣列"] };
  if (raw.length > 60) return { ok: false, errors: ["topic_tags 一次最多 60 筆"] };
  const errors: string[] = [];
  const seen = new Set<string>();
  const value: TopicTagInput[] = [];
  for (const item of raw) {
    const row = item as Record<string, unknown>;
    if (!row || typeof row.queue_id !== "string" || !UUID_RE.test(row.queue_id)) { errors.push("topic_tags.queue_id 必須是 UUID"); continue; }
    if (typeof row.topic !== "string" || !row.topic.trim()) { errors.push("topic_tags.topic 必填"); continue; }
    if (seen.has(row.queue_id)) { errors.push(`topic_tags 重複標記同一篇：${row.queue_id}`); continue; }
    seen.add(row.queue_id);
    value.push({ queueId: row.queue_id, topic: row.topic.trim() });
  }
  return errors.length ? { ok: false, errors } : { ok: true, value };
}

export interface TopicObservation { brand: TopicBrand; topic: string; relative: number }
export interface TopicScore { brand: TopicBrand; topic: string; posts: number; meanRelative: number | null; shrunk: number | null; label: TopicLabel }

export function labelFor(posts: number, shrunk: number | null): TopicLabel {
  if (posts < MIN_POSTS_FOR_LABEL || shrunk === null) return "untested";
  if (shrunk >= HOT_THRESHOLD) return "hot";
  if (shrunk <= COLD_THRESHOLD) return "cold";
  return "neutral";
}

/** 依題材彙整成效。「其他」不輸出，因為它不是可選的選題方向。 */
export function scoreTopics(observations: TopicObservation[]): TopicScore[] {
  const groups = new Map<string, TopicObservation[]>();
  for (const o of observations) {
    if (o.topic === OTHER_TOPIC || !Number.isFinite(o.relative)) continue;
    const key = `${o.brand}\u0000${o.topic}`;
    groups.set(key, [...(groups.get(key) || []), o]);
  }
  const scores: TopicScore[] = [];
  for (const [key, list] of groups) {
    const [brand, topic] = key.split("\u0000") as [TopicBrand, string];
    const sum = list.reduce((s, o) => s + o.relative, 0);
    const mean = sum / list.length;
    const shrunk = (sum + SHRINK_PRIOR_POSTS * 1) / (list.length + SHRINK_PRIOR_POSTS);
    scores.push({
      brand, topic, posts: list.length,
      meanRelative: Math.round(mean * 100) / 100, shrunk: Math.round(shrunk * 100) / 100,
      label: labelFor(list.length, shrunk),
    });
  }
  return scores.sort((a, b) => (b.shrunk ?? 0) - (a.shrunk ?? 0));
}
