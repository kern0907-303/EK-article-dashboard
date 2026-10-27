// 文案類型：Caples 把空間廣告與直郵用的文案分成 19 種，標出推薦程度。
// 這裡只收他明確推薦的 13 種。慎用的三種（卡片式、俏皮、幽默）與不推薦的三種
// （詩意、矯飾、誇大）刻意不收，因為艾瑞克的品牌文案本來就偏抒情，
// 把那幾種寫成負面清單會把正常的抒情句誤判成錯誤寫法。
// 純資料，不連資料庫、不呼叫網路。

import { src, type RuleSource } from "./rule-source";

export type CopyTypeId =
  | "direct" | "story" | "youandme" | "imaginative" | "factual" | "factualStyle"
  | "honest" | "boastful" | "signed" | "headlineStyle" | "curiosity" | "newsPage" | "competitive";

export interface CopyType {
  id: CopyTypeId;
  name: string;
  /** 這一型是什麼寫法 */
  what: string;
  /** 什麼時候適合用 */
  when: string;
  source: RuleSource;
}

const s = (chapter: string): RuleSource => src("testedAdvertising", chapter, true);

/** Caples 推薦的 13 種文案寫法 */
export const COPY_TYPES: Record<CopyTypeId, CopyType> = {
  direct: {
    id: "direct", name: "直述",
    what: "把事實與主張直接講出來，不繞彎、不鋪陳。",
    when: "主張本身夠強，讀者也已經知道自己要什麼的時候。",
    source: s("第 10 章 文案類型 直述式"),
  },
  story: {
    id: "story", name: "故事",
    what: "用一個有時間、有人、有動作的場景把道理帶出來。",
    when: "道理抽象、直接說會變成說教的時候。",
    source: s("第 10 章 文案類型 故事式"),
  },
  youandme: {
    id: "youandme", name: "你我式",
    what: "用「你」和「我」的口吻寫，像一個人在對另一個人說話。",
    when: "要建立信任、拉近距離的時候。",
    source: s("第 10 章 文案類型 你我式"),
  },
  imaginative: {
    id: "imaginative", name: "想像式",
    what: "請讀者想像一個情境，讓他自己走進去。",
    when: "結果不好直接證明，但讀者可以自己想像出來的時候。",
    source: s("第 10 章 文案類型 想像式"),
  },
  factual: {
    id: "factual", name: "事實式",
    what: "只列事實，不加形容詞。",
    when: "讀者在比較、在評估，不想被說服的時候。",
    source: s("第 10 章 文案類型 事實式"),
  },
  factualStyle: {
    id: "factualStyle", name: "事實加風格",
    what: "事實為骨，再用語氣與節奏把它寫得好讀。",
    when: "既要可信又不能枯燥的時候。這是長文最常用的一型。",
    source: s("第 10 章 文案類型 事實加風格"),
  },
  honest: {
    id: "honest", name: "誠實",
    what: "主動說出自己的限制或不適合的對象。",
    when: "讀者戒心重，或市場上同類說法都在誇大的時候。",
    source: s("第 10 章 文案類型 誠實式"),
  },
  boastful: {
    id: "boastful", name: "自誇",
    what: "直接講自己做到了什麼，但每一句都要有事實撐住。",
    when: "有真實成績可以講，而且讀者需要理由相信的時候。不可以編造數字或成效。",
    source: s("第 10 章 文案類型 自誇式"),
  },
  signed: {
    id: "signed", name: "署名",
    what: "由一個具名的人署名說話，借重他的信用。",
    when: "作者本人的經歷就是說服力來源的時候。",
    source: s("第 10 章 文案類型 署名式"),
  },
  headlineStyle: {
    id: "headlineStyle", name: "標題式",
    what: "整篇由一連串像標題的短句組成，每一句都能單獨成立。",
    when: "要講很多個重點，讀者又只會掃讀的時候。",
    source: s("第 10 章 文案類型 標題式"),
  },
  curiosity: {
    id: "curiosity", name: "懸念",
    what: "只講到足以引起好奇的部分，不揭露結局，讓讀者為了答案採取下一步。",
    when: "下一步本身就是你要的行動（索取、報名、詢問）的時候。",
    source: s("第 10 章 文案類型 懸念式"),
  },
  newsPage: {
    id: "newsPage", name: "新聞頁",
    what: "寫成像新聞報導的樣子。",
    when: "有真的新消息可以宣告的時候。要清楚讓讀者知道這是廣告，而且不宜常用。",
    source: s("第 10 章 文案類型 新聞頁式"),
  },
  competitive: {
    id: "competitive", name: "競爭性",
    what: "直接與另一種做法或說法對照。",
    when: "讀者心裡已經有一個預設做法，要把它頂開的時候。只頂說法，不頂人。",
    source: s("第 10 章 文案類型 競爭性，由慎用改列推薦"),
  },
};

export const COPY_TYPE_IDS = Object.keys(COPY_TYPES) as CopyTypeId[];

/** 寫進提示詞的一段，讓模型知道有哪些被驗證過的寫法可以挑 */
export function buildCopyTypeBlock(): string {
  return [
    "【可用的文案寫法，挑一種當主軸，不要混用三種以上】",
    ...COPY_TYPE_IDS.map((id) => `${COPY_TYPES[id].name}：${COPY_TYPES[id].what} 用在：${COPY_TYPES[id].when}`),
  ].join("\n");
}
