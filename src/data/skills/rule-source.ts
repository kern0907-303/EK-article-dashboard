// 規則出處：每一條寫進系統的規則都要說得出是哪本書的哪一章來的。
// 為什麼需要：規則是一條一條累積的，沒有出處就沒辦法回頭查「這條哪來的、要不要改」，
// 也沒辦法判斷新讀的書跟現有規則衝突時該聽誰的。
// 純資料，不連資料庫、不呼叫網路。

export interface RuleSource {
  /** 書名或來源名稱 */
  book: string;
  author: string;
  /** 章節或節名，能指到越細越好 */
  chapter?: string;
  /** 書裡有附實際測試數據（例如分版測試的勝負），這類規則優先度較高 */
  tested?: boolean;
}

/** 已經被讀進規則的來源。新增一本書時在這裡登記，覆蓋地圖見 docs/rules/coverage.md。 */
export const BOOKS = {
  makingAdsPay: { book: "Making Ads Pay", author: "John Caples" },
  advertisingMakeMoney: { book: "How to Make Your Advertising Make Money", author: "John Caples" },
  breakthrough: { book: "Breakthrough Advertising", author: "Eugene Schwartz" },
  adweekHandbook: { book: "文案訓練手冊（The Adweek Copywriting Handbook）", author: "Joseph Sugarman" },
  erickGenres: { book: "文案文體提示詞骨架｜四種", author: "艾瑞克" },
  nngroup: { book: "層蛋糕掃描模式研究", author: "Nielsen Norman Group" },
  aeo: { book: "AEO 問句小標規則", author: "業界實務整理" },
  inHouse: { book: "儀表板內部規則", author: "艾瑞克與 Claude" },
} as const satisfies Record<string, { book: string; author: string }>;

export type BookKey = keyof typeof BOOKS;

/** 組一個出處。章節寫得出來就寫，寫不出來就留空。 */
export function src(key: BookKey, chapter?: string, tested = false): RuleSource {
  return { ...BOOKS[key], ...(chapter ? { chapter } : {}), ...(tested ? { tested: true } : {}) };
}

/** 給畫面與日誌用的一行字 */
export function formatSource(source: RuleSource): string {
  const parts = [`${source.author}《${source.book}》`];
  if (source.chapter) parts.push(source.chapter);
  if (source.tested) parts.push("書中附測試數據");
  return parts.join("，");
}
