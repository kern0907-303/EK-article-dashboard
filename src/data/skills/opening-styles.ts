// 開場型：決定文章第一句話怎麼寫。
// 來源：John Caples《Making Ads Pay》第 11 章「Ten Ways to Write the First Paragraph」，
// 去掉只適用於商品廣告的「給產品規格」，其餘九種改寫成艾瑞克三個品牌的內容文章可用的版本。
// 問題背景：自動產文對第一句話沒有任何規則，10/20 之後 53 篇裡 58% 用「很多人…」開場，
// 因為提示詞有兩個地方叫它「沒有素材時用很多人這類泛稱」，模型把它當成了開場公式。
// 純資料與純函式，不連資料庫、不呼叫網路。

export type OpeningStyleId =
  | "continue" | "authority" | "challenge" | "firstperson"
  | "freeinfo" | "witness" | "editorial" | "you" | "story";

export interface OpeningStyle {
  id: OpeningStyleId;
  name: string;
  /** 什麼時候適合用這一型 */
  when: string;
  /** 寫進提示詞的規則 */
  rule: string;
  examples: string[];
  /** 需要真實素材才能用，沒有素材時不可以被自動挑中（避免編造） */
  requiresMaterial?: boolean;
  /** 出處，方便日後回查 */
  source: string;
}

const CAPLES = "Caples《Making Ads Pay》開場十法";

export const OPENING_STYLES: Record<OpeningStyleId, OpeningStyle> = {
  continue: {
    id: "continue",
    name: "延續標題",
    when: "標題已經丟出一個夠強的概念，第一段直接把它放大。",
    rule: "第一段把標題講的那件事再往下推一層，不要換主題，也不要先交代背景。標題說了什麼，第一句就接著說什麼。",
    examples: ["（標題講授權失敗）第一句：失敗的點幾乎都不在那個被授權的人身上。"],
    source: `${CAPLES}之一`,
  },
  authority: {
    id: "authority",
    name: "引用權威",
    when: "手上有一句具名的話或一本書的觀點，而且確實查得到。",
    rule: "第一句就是那句引用，寫出是誰說的或出自哪本書。沒有真實出處就不可以用這一型，不可以寫成「有專家說」。",
    examples: ["心理學家丹尼爾．卡尼曼在《快思慢想》裡說過一句話，很多人聽了會不舒服。"],
    requiresMaterial: true,
    source: `${CAPLES}之二`,
  },
  challenge: {
    id: "challenge",
    name: "挑戰讀者",
    when: "想先篩掉不對的人，讓對的人覺得被點名。I8 特別適合。",
    rule: "第一句反過來說這篇不是寫給誰看的，或先設一個門檻。語氣是平的，不是挑釁，也不可以貶低任何人。",
    examples: ["已經把問題想清楚的人，這一篇可以跳過。", "這篇不適合還在找一個標準答案的人。"],
    source: `${CAPLES}之三`,
  },
  firstperson: {
    id: "firstperson",
    name: "第一人稱直說",
    when: "想用艾瑞克自己的觀察或立場開場。",
    rule: "第一句用我開頭，說自己看到什麼、做過什麼、怎麼想。只能寫真的發生過的事，不編造經歷與數字。",
    examples: ["我看了二十年，最常被弄錯的就是這一件事。"],
    source: `${CAPLES}之四`,
  },
  freeinfo: {
    id: "freeinfo",
    name: "開頭就給東西",
    when: "這篇有一個具體可做的方法或判準。",
    rule: "第一段就把一個有用的東西直接給出去，不鋪陳、不預告。給完再談為什麼。",
    examples: ["判斷自己是不是真的累了，只要看一件事：醒來的第一個念頭是誰的事。"],
    source: `${CAPLES}之五`,
  },
  witness: {
    id: "witness",
    name: "客戶原話",
    when: "口述素材裡有一句去識別化的真實原話。",
    rule: "第一句就是那句原話，用「」包住，後面接一句你的反應。素材裡沒有原話就不可以用這一型，不可以自己編一句話再說是客戶說的。",
    examples: ["「我只是想休息一下。」她說完這句，停了幾秒。"],
    requiresMaterial: true,
    source: `${CAPLES}之六`,
  },
  editorial: {
    id: "editorial",
    name: "社論式",
    when: "主題夠大，可以從一個普世的觀察切入。",
    rule: "第一句寫一個大多數人都會同意的觀察，不提你、不提我、不提品牌。第二段才落到讀者身上。",
    examples: ["每一個要負責的位置，都有一段沒有人教的空白期。"],
    source: `${CAPLES}之八`,
  },
  you: {
    id: "you",
    name: "你開場",
    when: "讀者的處境本身就夠具體。",
    rule: "第一句直接描述讀者此刻的處境，用你。描述狀態或動作，不要用你有沒有、你是不是這種讀者能一秒回答的問句。",
    examples: ["你已經把能調的都調過一遍了，行程、睡眠、工作量，然後還是這樣。"],
    source: `${CAPLES}之九`,
  },
  story: {
    id: "story",
    name: "說故事",
    when: "有一個具體場景可以把讀者帶進去。",
    rule: "第一句就進場景，有時間、有人、有動作。人物可以虛構並取名，但不可以說成真實客戶，也不可以編造數字與成效。前三句內要讓讀者知道這跟他有關。",
    examples: ["那天她把看護送到門口，回頭看了一眼客廳，沒有人抬頭。"],
    source: `${CAPLES}之十`,
  },
};

export const OPENING_STYLE_IDS = Object.keys(OPENING_STYLES) as OpeningStyleId[];
export const OPENING_STYLE_NAMES = OPENING_STYLE_IDS.map((id) => OPENING_STYLES[id].name);

/**
 * 不可以當第一句的開頭。
 * 「很多人」本來是用來避免編造個案的泛稱，不是開場公式；「你有沒有」這種讀者一秒就能回答的問句
 * 挖不出任何缺口。兩者在文章後段仍然可以用。
 */
export const BANNED_FIRST_SENTENCE = /^[\s「【（(]*(很多人|許多人|不少人|有些人|你有沒有|你是不是也|你是否|有沒有過)/;

export function openingStyleFromText(value: string): OpeningStyleId | null {
  const text = String(value || "").trim();
  if (!text) return null;
  const byId = OPENING_STYLE_IDS.find((id) => id === text.toLowerCase());
  if (byId) return byId;
  return OPENING_STYLE_IDS.find((id) => text.includes(OPENING_STYLES[id].name)) || null;
}

/** 從提示詞裡讀出 n8n 指定的開場型（【本篇開場型】說故事） */
export function readOpeningStyleFromPrompt(prompt: string): OpeningStyleId | null {
  const match = String(prompt || "").match(/【本篇開場型】\s*([^\n，。]{1,20})/);
  return match ? openingStyleFromText(match[1]) : null;
}

/** 標題型與開場型用同一個手法會變成重複，這裡列出會撞的組合 */
const COLLIDES: Record<string, OpeningStyleId[]> = {
  quote: ["witness", "authority"],
  scene: ["story"],
  question: ["you"],
  target: ["challenge"],
};

/** 附在提示詞後面的指令。只管第一段，不動標題、內文結構與品牌規範。 */
export function buildOpeningDirective(id: OpeningStyleId, titleStyleId?: string): string {
  const style = OPENING_STYLES[id];
  const collide = titleStyleId && (COLLIDES[titleStyleId] || []).includes(id);
  return [
    `【本篇開場型：${style.name}】`,
    "這一篇的第一段必須用這一型寫，優先於提示詞裡其他關於開頭的說法。只決定開場，標題型、內文結構、品牌規範、紅線與事實邊界一律照原本規則。",
    `寫法：${style.rule}`,
    `語感參考（不要照抄，也不要套用它們的主題）：${style.examples.join("｜")}`,
    "第一句絕對不可以用「很多人」「許多人」「不少人」「你有沒有」「你是不是也」開頭。沒有真實個案時仍然用泛稱情境，但不要把泛稱放在第一句。",
    "第一句不超過 30 字，前三句內要讓讀者知道這篇跟他有什麼關係。",
    collide ? "標題已經用了同一個手法，開場要換一個角度進入，不要把標題的句子再講一次。" : "",
  ].filter(Boolean).join("\n");
}

/** 判斷第一段屬於哪一型。判不出來回傳 null，只用來做重複提醒，不擋稿。 */
export function detectOpeningStyle(firstParagraph: string): OpeningStyleId | null {
  const text = String(firstParagraph || "").trim();
  if (!text) return null;
  if (/^[「『"]/.test(text)) return "witness";
  if (/^[^。！？]{0,30}(在《[^》]{1,30}》|所著《)/.test(text)) return "authority";
  if (/^(已經|如果你已經)[^。]{0,20}(可以跳過|不必往下)|^(這篇|這一篇)[^。]{0,12}(不是寫給|不適合)/.test(text)) return "challenge";
  if (/^我[^們]/.test(text)) return "firstperson";
  if (/^(那天|有一次|幾個月前|前幾天|昨天|早上|清晨|深夜|晚上|下午)/.test(text)) return "story";
  if (/^你/.test(text)) return "you";
  return null;
}

/** 沒有指定時的挑選：避開最近用過的，需要素材的型在沒有素材時排除，再用 seed 決定。 */
export function pickOpeningStyle(recent: Array<OpeningStyleId | null>, seed: string, hasMaterial = false): OpeningStyleId {
  const avoid = new Set(recent.slice(0, 3).filter(Boolean) as OpeningStyleId[]);
  const allowed = OPENING_STYLE_IDS.filter((id) => hasMaterial || !OPENING_STYLES[id].requiresMaterial);
  const pool = allowed.filter((id) => !avoid.has(id));
  const usable = pool.length ? pool : allowed;
  let hash = 0;
  for (const ch of String(seed || "x")) hash = (hash * 31 + ch.charCodeAt(0)) % 100000;
  return usable[hash % usable.length];
}

/** 最近幾篇是不是一直同一型。重複才回傳提醒文字。 */
export function repeatedOpeningWarning(current: OpeningStyleId | null, recent: Array<OpeningStyleId | null>): string {
  if (!current) return "";
  const lastTwo = recent.slice(0, 2);
  if (lastTwo.length < 2 || !lastTwo.every((id) => id === current)) return "";
  return `這個品牌最近連續 3 篇都用「${OPENING_STYLES[current].name}」開場，建議換一型。`;
}

/** 第一句踩到禁用開頭時的提醒文字，沒踩到回傳空字串。 */
export function bannedOpeningWarning(firstParagraph: string): string {
  const text = String(firstParagraph || "").trim();
  const hit = text.match(BANNED_FIRST_SENTENCE);
  return hit ? `第一句用「${hit[1]}」開頭，這類開場最近用得太多，建議換一個切入點。` : "";
}
