// 話題雷達的「關鍵字宇宙」
//
// 為什麼需要這個檔案：
// 台灣的 Google Trends 即時熱搜實測結果是股票代號與藝人八卦
// （7795、南亞科、00881配息、許常德…），品牌相關度趨近於零。
// 所以雷達不能是「熱榜驅動」，必須是「關鍵字宇宙驅動」——
// 主動拿這些詞去搜，才會撈到跟品牌有關的討論。
//
// 四層的用途不同：
//   core     核心專業詞：確認自己領域的動態，但搜尋量小，容易困在同溫層
//   problem  客戶問題詞：受眾實際會打進搜尋框的字，這層命中率最高
//   context  情境詞：問題發生的具體場景，最容易寫出「這就是在說我」的文案
//   bridge   趨勢連接詞：當週外部事件，用於借勢型內容
//
// 熱門題目通常不是從「信息場」找到，而是從「中年突然失去方向」
// 「明明很努力卻一直空轉」這類生活問題找到。

export type KeywordLayer = "core" | "problem" | "context" | "bridge";

export interface KeywordEntry {
  term: string;
  layer: KeywordLayer;
  /** 主要對應的品牌，用於後續計算品牌連結度 */
  brands: Array<"nas" | "abl" | "i8" | "erick">;
}

export const KEYWORD_UNIVERSE: KeywordEntry[] = [
  // ---------- 核心專業詞（同溫層，低搜尋量但高精準） ----------
  { term: "生命數字", layer: "core", brands: ["nas"] },
  { term: "人類圖", layer: "core", brands: ["nas"] },
  { term: "自我探索 測驗", layer: "core", brands: ["nas"] },
  { term: "情緒調節", layer: "core", brands: ["abl"] },
  { term: "身心壓力", layer: "core", brands: ["abl"] },
  { term: "企業顧問", layer: "core", brands: ["i8"] },
  { term: "組織管理 中小企業", layer: "core", brands: ["i8"] },

  // ---------- 客戶問題詞（命中率最高的一層） ----------
  { term: "很努力卻沒有成果", layer: "problem", brands: ["erick", "nas"] },
  { term: "睡不好 淺眠", layer: "problem", brands: ["abl"] },
  { term: "情緒耗竭", layer: "problem", brands: ["abl", "erick"] },
  { term: "職業倦怠", layer: "problem", brands: ["abl", "i8"] },
  { term: "找不到人生方向", layer: "problem", brands: ["erick", "nas"] },
  { term: "知道該做卻做不到", layer: "problem", brands: ["abl", "erick"] },
  { term: "自我價值感低落", layer: "problem", brands: ["nas", "abl"] },
  { term: "關係消耗", layer: "problem", brands: ["nas", "abl"] },
  { term: "決策疲勞", layer: "problem", brands: ["i8", "erick"] },
  { term: "收入不穩定 焦慮", layer: "problem", brands: ["i8", "erick"] },

  // ---------- 情境詞（最容易寫出共鳴文案） ----------
  { term: "中年轉職", layer: "context", brands: ["erick", "i8"] },
  { term: "中年危機 女性", layer: "context", brands: ["erick", "nas"] },
  { term: "空巢期", layer: "context", brands: ["nas", "abl"] },
  { term: "婚姻倦怠", layer: "context", brands: ["nas", "abl"] },
  { term: "創業 定價 不敢漲價", layer: "context", brands: ["i8"] },
  { term: "接班 二代", layer: "context", brands: ["i8"] },
  { term: "照顧者 壓力", layer: "context", brands: ["abl"] },
  { term: "斜槓 副業 疲勞", layer: "context", brands: ["erick", "i8"] },

  // ---------- 趨勢連接詞（借勢用，當週外部事件） ----------
  { term: "AI 取代 工作", layer: "bridge", brands: ["i8", "erick"] },
  { term: "遠距工作 心理健康", layer: "bridge", brands: ["abl", "i8"] },
  { term: "少子化 職場", layer: "bridge", brands: ["i8"] },
  { term: "退休金 焦慮", layer: "bridge", brands: ["erick", "i8"] },
];

/** 供 n8n 取用的精簡格式 */
export function getRadarKeywords() {
  return KEYWORD_UNIVERSE.map((k) => ({
    term: k.term,
    layer: k.layer,
    brands: k.brands,
  }));
}

/**
 * 品牌連結度：一則內容命中愈多品牌相關詞，分數愈高。
 * core/problem 權重高於 bridge，因為 bridge 本來就偏外部事件。
 */
export const LAYER_WEIGHT: Record<KeywordLayer, number> = {
  core: 1.0,
  problem: 1.0,
  context: 0.85,
  bridge: 0.5,
};
