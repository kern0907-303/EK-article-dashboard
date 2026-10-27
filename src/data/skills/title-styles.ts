// 標題型：讓每篇文章的標題句型不一樣。
// 問題背景：自動產文原本只有一條「第一行必須是聳動的主標題」指令，模型每次都抓同一個句型，
// 最近 30 天 54 篇裡 81% 是逗號長句、26% 是「不是A，是B」、0 篇在 12 字以內。
// 做法：題目階段（n8n）依主題挑一型寫進提示詞；儀表板生成時把該型的規則附在提示詞後面；
// 事後再用 detectTitleStyle 比對最近幾篇，句型重複就提醒（只提醒，不擋稿）。
// 純資料與純函式，不連資料庫、不呼叫網路。

import { src, type RuleSource } from "./rule-source";
import { buildAmplifierLine, type AmplifierId } from "./title-amplifiers";

export type TitleStyleId =
  | "contrast" | "blunt" | "question" | "scene"
  | "number" | "counter" | "target" | "quote";

export interface TitleStyle {
  id: TitleStyleId;
  /** 給人看的名稱，n8n 與儀表板都用這個字串 */
  name: string;
  /** 什麼主題適合用這一型 */
  when: string;
  /** 寫進提示詞的規則 */
  rule: string;
  /** 範例標題，給模型照著抓語感 */
  examples: string[];
  /** 這一型哪裡來的 */
  source: RuleSource;
}

export const TITLE_STYLES: Record<TitleStyleId, TitleStyle> = {
  contrast: {
    id: "contrast",
    name: "否定對比",
    when: "讀者把原因歸到錯的地方，要先拆掉那個歸因時用。",
    rule: "用「不是A，是B」的句型。A 是讀者自己會先怪罪的東西，B 是真正的原因。全句不超過 26 字。",
    examples: ["醒來就覺得沉，不是你的問題，是狀態在說話", "授權失敗不是個性問題，是組織少了承接的結構"],
    source: src("inHouse", "艾瑞克常用句型 10.1 對比與揭示"),
  },
  blunt: {
    id: "blunt",
    name: "直球短斷言",
    when: "主張本身夠硬、不需要鋪陳時用。這一型負責把整批標題的長度拉開。",
    rule: "一句話講完立場，14 字以內，全句不可以有逗號，不解釋原因，不加修飾語。",
    examples: ["撐住從來不是辦法", "會議多不等於有在管理", "現金流不會自己長出來"],
    source: src("advertisingMakeMoney", "第 8 章 標題要短而有力", true),
  },
  question: {
    id: "question",
    name: "讀者心裡那句問句",
    when: "讀者心裡已經有一個反覆問自己的問題時用。",
    rule: "整個標題就是讀者會自己問出口的那一句問句，用讀者的口語，不要自問自答，不要在問號後面再補一句結論。20 字以內。",
    examples: ["道理都懂，為什麼還是做不到？", "是我太敏感，還是真的有問題？"],
    source: src("breakthrough", "第 4 章第 12 條 把主張寫成問句"),
  },
  scene: {
    id: "scene",
    name: "場景切片",
    when: "素材本身就有一個具體畫面時用。",
    rule: "只寫一個看得見的畫面或一個動作，不下任何結論，不出現「其實」「真正的」這類評論詞。人物用泛稱，不指名。",
    examples: ["她南北奔波、雇了看護，家人還是在那裡等她", "深夜身體已經在喊累，眼睛卻還是不想閉上"],
    source: src("makingAdsPay", "開場十法之十 說故事"),
  },
  number: {
    id: "number",
    name: "數字清單",
    when: "內容本來就可以拆成兩到四個並列的點時用。",
    rule: "標題帶一個數字，數字必須對應文章裡真的寫出來的那幾點，不可以多也不可以少。18 字以內。",
    examples: ["老闆最常扛的三件不該扛的事", "睡不著的兩種，處理方式完全不同"],
    source: src("advertisingMakeMoney", "第 8 章 106 個賺錢標題裡的數字型", true),
  },
  counter: {
    id: "counter",
    name: "反直覺",
    when: "有一句流傳很廣但不完全對的說法時用。",
    rule: "先寫出那句大家都在講的話，再用一個轉折把它頂回去。只頂說法，不頂人。不用「我認為」開頭。",
    examples: ["作息要穩定，先別急著早起", "想放手的老闆，通常不是不夠信任員工"],
    source: src("breakthrough", "第 4 章第 23 條 用違反直覺的方式嚇讀者一跳"),
  },
  target: {
    id: "target",
    name: "對象點名",
    when: "這篇只想讓某一種處境的人看見時用。",
    rule: "用「給那個…的人」或「習慣…的人」直接點名一種處境，不描述解法。22 字以內。",
    examples: ["給那個永遠最後一個下班的人", "習慣照顧別人的人，你上一次把自己放進清單是什麼時候"],
    source: src("makingAdsPay", "開場十法之三 挑戰讀者"),
  },
  quote: {
    id: "quote",
    name: "原話引用",
    when: "素材裡有一句很有代表性的原話時用。",
    rule: "用「」包住一句口語原話當標題主體，後面最多接一句短評。原話要改寫成泛稱，不指名任何人，不逐字抄別人的貼文。",
    examples: ["「我只是想休息一下」，這句話她說了三年", "「你願意放手嗎」，這個問題問錯了"],
    source: src("advertisingMakeMoney", "第 8 章 見證式標題", true),
  },
};

export const TITLE_STYLE_IDS = Object.keys(TITLE_STYLES) as TitleStyleId[];
export const TITLE_STYLE_NAMES = TITLE_STYLE_IDS.map((id) => TITLE_STYLES[id].name);

/** 名稱或代號都可以轉回代號，n8n 寫中文名、程式寫英文代號都讀得到 */
export function titleStyleFromText(value: string): TitleStyleId | null {
  const text = String(value || "").trim();
  if (!text) return null;
  const byId = TITLE_STYLE_IDS.find((id) => id === text.toLowerCase());
  if (byId) return byId;
  return TITLE_STYLE_IDS.find((id) => text.includes(TITLE_STYLES[id].name)) || null;
}

/** 從提示詞裡讀出 n8n 指定的標題型（【本篇標題型】原話引用） */
export function readTitleStyleFromPrompt(prompt: string): TitleStyleId | null {
  const match = String(prompt || "").match(/【本篇標題型】\s*([^\n，。]{1,20})/);
  return match ? titleStyleFromText(match[1]) : null;
}

/** 附在提示詞後面的指令。只管標題，不動內文結構與品牌規範。 */
export function buildTitleDirective(id: TitleStyleId, amplifier?: AmplifierId): string {
  const style = TITLE_STYLES[id];
  return [
    `【本篇標題型：${style.name}】`,
    `這一篇的標題必須用這一型寫，優先於提示詞裡其他關於標題的說法。只決定標題句型，內文結構、品牌規範、紅線、禁用詞與事實邊界一律照原本規則。`,
    `寫法：${style.rule}`,
    `語感參考（不要照抄，也不要套用它們的主題）：${style.examples.join("｜")}`,
    amplifier ? buildAmplifierLine(amplifier) : "",
    `標題不要固定用「不是A，是B」這個句型，除非本篇指定的就是否定對比。`,
  ].filter(Boolean).join("\n");
}

/**
 * 判斷一個標題屬於哪一型。判不出來回傳 null。
 * 只用在「最近幾篇是不是一直同一型」的提醒，不用來擋稿，所以寧可判不出來也不要硬歸類。
 */
export function detectTitleStyle(title: string): TitleStyleId | null {
  const text = String(title || "").replace(/[【】]/g, "").trim();
  if (!text) return null;
  if (/^[「『"]/.test(text)) return "quote";
  if (/^(給那個|給那些|給每一個|給所有|習慣)/.test(text)) return "target";
  if (/(不是|並非|不在)[^，。]{0,14}[，,][^，。]{0,4}(而是|才是|是)/.test(text)) return "contrast";
  if (/[？?]/.test(text) && !/[，,]\s*[^，,]{10,}$/.test(text)) return "question";
  // 數字清單：數量詞要出現在標題前段，才算是在數項目；「最後一個」「用兩個問題」這類不算
  if (/(?<!最後|第|那|這|某|上|下|前|另|每|同|唯|用|有)[二三四五六七八九十兩\d]+\s*(個|件|種|層|步|招|點|類)/.test(text.slice(0, 12))) return "number";
  if (text.length <= 14 && !/[，,]/.test(text)) return "blunt";
  return null;
}

/**
 * 沒有指定標題型時的挑選：避開最近用過的，再用 seed 決定，讓同一個任務每次跑結果一樣。
 * recent 由近到遠排列。
 */
export function pickTitleStyle(recent: Array<TitleStyleId | null>, seed: string): TitleStyleId {
  const avoid = new Set(recent.slice(0, 3).filter(Boolean) as TitleStyleId[]);
  const pool = TITLE_STYLE_IDS.filter((id) => !avoid.has(id));
  const usable = pool.length ? pool : TITLE_STYLE_IDS;
  let hash = 0;
  for (const ch of String(seed || "x")) hash = (hash * 31 + ch.charCodeAt(0)) % 100000;
  return usable[hash % usable.length];
}

/** 最近幾篇是不是一直同一型。重複才回傳提醒文字，否則回傳空字串。 */
export function repeatedStyleWarning(current: TitleStyleId | null, recent: Array<TitleStyleId | null>): string {
  if (!current) return "";
  const lastTwo = recent.slice(0, 2);
  if (lastTwo.length < 2 || !lastTwo.every((id) => id === current)) return "";
  return `這個品牌最近連續 3 篇標題都是「${TITLE_STYLES[current].name}」，建議換一型再發。`;
}
