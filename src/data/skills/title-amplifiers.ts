// 標題強化手法：標題型決定骨架，這裡決定力道。
//
// 來源：Eugene Schwartz《Breakthrough Advertising》第 4 章
// 「38 Ways to Strengthen Your Headline Once You Have Your Basic Idea」。
// 原書 38 條是寫給商品廣告的，其中多條在講產品機制、報價與競品替換，不適用於內容文章。
// 這裡挑出 14 條能直接用在艾瑞克三個品牌文章上的，並且避開與八個標題型重複的手法
// （例如原書第 12 條「把主張寫成問句」已經是標題型之一，不重複收）。
// 括號裡的編號是原書條號，方便回頭查。
//
// 用法：標題型選定之後，再選一個強化手法加上去。一次只用一個，疊太多會變成口號。
// 純資料與純函式。

import { src, type RuleSource } from "./rule-source";

export type AmplifierId =
  | "measure" | "compare" | "metaphor" | "sensory" | "dramatize" | "paradox"
  | "beforeAfter" | "nameIt" | "warn" | "difference" | "excluded"
  | "howHard" | "tooGood" | "breakBelief";

export interface TitleAmplifier {
  id: AmplifierId;
  name: string;
  /** 什麼時候適合加這個 */
  when: string;
  rule: string;
  examples: string[];
  source: RuleSource;
}

const S = (n: number) => src("breakthrough", `第 4 章第 ${n} 條`);

export const TITLE_AMPLIFIERS: Record<AmplifierId, TitleAmplifier> = {
  measure: {
    id: "measure", name: "量化主張", when: "主張裡有可以數的東西時。",
    rule: "把模糊的程度換成具體的量。只能用素材裡真的有的數字，沒有就不要用這個手法。",
    examples: ["撐了三年的那種累，不是睡一晚能補回來的"], source: S(1),
  },
  compare: {
    id: "compare", name: "比較", when: "讀者心裡有一個現成的參照物時。",
    rule: "把主張放在一個讀者熟悉的東西旁邊對照，讓他用已知去量未知。",
    examples: ["管十個人比管十件事難，難在哪裡"], source: S(3),
  },
  metaphor: {
    id: "metaphor", name: "比喻", when: "主張太抽象，講不清楚時。",
    rule: "用一個日常生活的東西代替抽象說法。比喻要是讀者摸得到的，不要用另一個抽象詞。",
    examples: ["狀態像收音機的頻道，不是壞了，是沒對準"], source: S(4),
  },
  sensory: {
    id: "sensory", name: "感官化", when: "要讓讀者先有身體感受時。",
    rule: "把主張換成看得見、聽得到、摸得到的描述，不要停在情緒形容詞。",
    examples: ["肩膀一直是抬著的，她自己不知道抬了多久"], source: S(5),
  },
  dramatize: {
    id: "dramatize", name: "戲劇化結果", when: "結果本身夠有畫面時。",
    rule: "不說「會變好」，直接把變好之後的那一個畫面寫出來。",
    examples: ["那天她第一次把手機放在客廳充電"], source: S(7),
  },
  paradox: {
    id: "paradox", name: "悖論", when: "主張本身就違反常識時。",
    rule: "把主張寫成一句自相矛盾的話，矛盾要是真的，不是玩文字。",
    examples: ["越想管好，越管不動"], source: S(8),
  },
  beforeAfter: {
    id: "beforeAfter", name: "前後對比", when: "有一個清楚的轉折點時。",
    rule: "一句話裡放兩個時間點的狀態。兩邊都要具體，不可以一邊具體一邊空泛。",
    examples: ["以前她是最不容易被激怒的人，現在排隊多等兩分鐘就煩"], source: S(15),
  },
  nameIt: {
    id: "nameIt", name: "幫問題取名字", when: "讀者感覺得到但說不出那是什麼時。",
    rule: "給那個現象一個短的、好記的名字，讓讀者可以指著它講話。名字要是白話，不是術語。",
    examples: ["遠端備戰狀態", "狀態先於方法"], source: S(27),
  },
  warn: {
    id: "warn", name: "先警告", when: "不處理的代價是具體的時。",
    rule: "點出不處理會踩到什麼，只講會發生的事，不恐嚇、不加時限、不說來不及。",
    examples: ["沒設計過的帳期，最後都是老闆自己墊"], source: S(28),
  },
  difference: {
    id: "difference", name: "點出差別", when: "讀者把兩件事混在一起時。",
    rule: "直接把兩個被混為一談的東西拆開，講出差在哪裡。",
    examples: ["性格和狀態是兩件事，用同一把尺量會量錯"], source: S(31),
  },
  excluded: {
    id: "excluded", name: "對不適用的人說話", when: "想讓對的人自己對號入座時。",
    rule: "先講這篇對誰沒有用。語氣是平的，不貶低被排除的人。",
    examples: ["已經有人幫你擋掉雜事的老闆，這篇用不到"], source: S(33),
  },
  howHard: {
    id: "howHard", name: "講出有多難", when: "讀者覺得這件事應該很簡單時。",
    rule: "把達成這件事的實際困難寫出來，讓讀者知道他做不到不是他的問題。",
    examples: ["要分清楚哪些情緒不是自己的，比想像中難很多"], source: S(35),
  },
  tooGood: {
    id: "tooGood", name: "先承認好得過分", when: "主張聽起來太順、讀者會起疑時。",
    rule: "自己先把讀者心裡那句「哪有這麼好」說出來，再接著講為什麼成立。",
    examples: ["只要問兩個問題就好，聽起來太簡單了對吧"], source: S(36),
  },
  breakBelief: {
    id: "breakBelief", name: "打斷既有信念", when: "讀者有一個擋住他的預設時。",
    rule: "指名那個預設並說它不成立。拆掉舊解釋時必須同時指出新方向，否則讀者會用更糟的猜測填補。",
    examples: ["努力不夠不是原因，那個說法擋住了真正該看的地方"], source: S(37),
  },
};

export const AMPLIFIER_IDS = Object.keys(TITLE_AMPLIFIERS) as AmplifierId[];

/** 跟標題型重複的手法：標題型已經在做同一件事時，不要再疊這個強化手法 */
const COLLIDES: Record<string, AmplifierId[]> = {
  contrast: ["difference", "breakBelief"],
  number: ["measure"],
  target: ["excluded"],
  counter: ["paradox", "breakBelief"],
};

export function amplifierFromText(value: string): AmplifierId | null {
  const text = String(value || "").trim();
  if (!text) return null;
  const byId = AMPLIFIER_IDS.find((id) => id === text.toLowerCase());
  if (byId) return byId;
  return AMPLIFIER_IDS.find((id) => text.includes(TITLE_AMPLIFIERS[id].name)) || null;
}

/** 從提示詞讀出題目階段指定的強化手法（【本篇標題強化】幫問題取名字） */
export function readAmplifierFromPrompt(prompt: string): AmplifierId | null {
  const match = String(prompt || "").match(/【本篇標題強化】\s*([^\n，。]{1,20})/);
  return match ? amplifierFromText(match[1]) : null;
}

/** 避開最近用過的，也避開與這次標題型重複的，再用 seed 決定 */
export function pickAmplifier(recent: Array<AmplifierId | null>, seed: string, titleStyleId?: string): AmplifierId {
  const avoid = new Set<AmplifierId>([
    ...(recent.slice(0, 3).filter(Boolean) as AmplifierId[]),
    ...(titleStyleId ? COLLIDES[titleStyleId] || [] : []),
  ]);
  const pool = AMPLIFIER_IDS.filter((id) => !avoid.has(id));
  const usable = pool.length ? pool : AMPLIFIER_IDS;
  let hash = 0;
  for (const ch of String(seed || "x")) hash = (hash * 31 + ch.charCodeAt(0)) % 100000;
  return usable[hash % usable.length];
}

/** 附在標題指令裡的一段，只加強標題，不改句型 */
export function buildAmplifierLine(id: AmplifierId): string {
  const item = TITLE_AMPLIFIERS[id];
  return `標題在維持上面那個句型的前提下，再用一次「${item.name}」：${item.rule}（語感參考：${item.examples.join("｜")}）`;
}
