// 小標規則：依通路分成兩套，因為讀者不一樣。
//
// Facebook 長文：讀者是被標題和第一句鉤進來，一路往下滑的人。小標的主要功能是視覺節奏，
//   把文字切塊，讓它看起來沒那麼難讀。
//   來源：Sugarman《文案訓練手冊》第 4 章與第 18 章「Paragraph Headings」。他做過測試，
//   在廣告裡放了和內文無關的段落小標，沒有讀者發現或提問，但內文錯一個字馬上有人反應。
//
// 官網文章：讀者在掃讀與搜尋，很可能永遠不讀內文，而且 AI 搜尋是以小標加第一句為單位擷取。
//   小標必須精確描述底下的內容，而且要有問句小標。
//   來源：Nielsen Norman Group 的層蛋糕掃描研究，以及 AEO 的問句小標規則。
//
// 問題背景：自動產文對小標沒有任何內容規則，只有排版格式規則，而且那條還寫在流水線用不到的
// 提示詞裡。10/20 之後 53 篇裡 26% 一個小標都沒有，問句小標 0 篇。
// 純資料與純函式。

export type SubheadChannel = "facebook" | "website";

export interface SubheadRule {
  channel: SubheadChannel;
  /** 建議的小標數量區間 */
  count: [number, number];
  /** 每個小標的字數區間 */
  length: [number, number];
  /** 寫進提示詞的完整規則 */
  rule: string;
  source: string;
}

export const SUBHEAD_RULES: Record<SubheadChannel, SubheadRule> = {
  facebook: {
    channel: "facebook",
    count: [3, 5],
    length: [8, 16],
    rule: [
      "小標在這裡的功能是視覺節奏，把長文切成讀起來不吃力的塊，不是目錄。",
      "每 200 到 300 字放一個，全文 3 到 5 個，每個 8 到 16 字。",
      "小標寫成單獨一行的純文字，前後各空一行，行首不加任何符號，不用數字編號。",
      "小標可以是半句話、一個畫面或一句口語，不必把整段的結論講完，留一點讓人想往下看。",
      "不可以連續兩個小標用同一個句型，也不可以每個小標都是問句。",
      "整篇是一個連續故事時（文體是案例文而且開場型是說故事），可以只放 0 到 2 個小標，不要硬切。",
    ].join("\n"),
    source: "Sugarman《文案訓練手冊》段落小標",
  },
  website: {
    channel: "website",
    count: [4, 7],
    length: [6, 20],
    rule: [
      "小標在這裡是導航，也是 AI 搜尋擷取的單位，讀者可能只看小標就離開。",
      "每個小標要剛好涵蓋它底下那一段的內容，不可以比底下的內容更廣，也不可以更窄。",
      "重要的字放最前面，一眼能懂，不賣弄。",
      "各小標之間不重疊，也不遺漏讀者會關心的大面向；同一段內容不要重複出現在兩個小標底下。",
      "全文至少 2 個問句小標，用什麼、為什麼、怎麼、該不該開頭，6 到 14 字，一個小標只問一個問題。",
      "問句小標底下的第一到第二句必須直接回答那個問題，答案 15 到 25 字，不要用轉折句或「這一段要談」開場，回答完再補條件與細節。",
      "檢查法：把小標和它底下第一句單獨抽出來看，如果不能回答那個小標，就重寫。",
      "小標寫成單獨一行的純文字，行首不加任何符號。",
    ].join("\n"),
    source: "Nielsen Norman Group 層蛋糕掃描研究＋AEO 問句小標規則",
  },
};

/** 附在提示詞後面的指令 */
export function buildSubheadDirective(channel: SubheadChannel): string {
  const spec = SUBHEAD_RULES[channel];
  return [
    `【本篇小標規則：${channel === "facebook" ? "社群長文" : "官網文章"}】`,
    spec.rule,
  ].join("\n");
}

/**
 * 從文章裡抓出小標候選：單獨一行、長度在區間內、結尾沒有句讀、不是主題標籤。
 * 只用來做提醒，判不準寧可少抓。
 */
export function extractSubheads(text: string, _channel: SubheadChannel = "facebook"): string[] {
  // 偵測用的寬度比規則建議的寬度寬，實際寫出來的小標常常只有 6 個字（例如「狀態先於方法」）
  const lines = String(text || "").split("\n").map((line) => line.trim()).filter(Boolean);
  return lines.slice(1).filter((line) =>
    line.length >= 4 && line.length <= 24
    && !/[。！？，、：；]$/.test(line)
    && !line.startsWith("#")
    && !/^[0-9]/.test(line));
}

/** 小標數量與問句數是否符合該通路的規則。符合就回傳空字串。 */
export function subheadWarning(text: string, channel: SubheadChannel = "facebook"): string {
  const spec = SUBHEAD_RULES[channel];
  const subheads = extractSubheads(text, channel);
  const notes: string[] = [];
  if (subheads.length < spec.count[0]) notes.push(`只有 ${subheads.length} 個小標，建議 ${spec.count[0]} 到 ${spec.count[1]} 個`);
  else if (subheads.length > spec.count[1] + 2) notes.push(`有 ${subheads.length} 個小標，偏多`);
  if (channel === "website" && subheads.filter((line) => /[？?]/.test(line)).length < 2) {
    notes.push("問句小標少於 2 個，AI 搜尋比較不容易引用");
  }
  if (channel === "facebook" && subheads.length >= 3 && subheads.every((line) => /[？?]/.test(line))) {
    notes.push("每個小標都是問句，讀起來會單調");
  }
  return notes.length ? `小標：${notes.join("；")}。` : "";
}
