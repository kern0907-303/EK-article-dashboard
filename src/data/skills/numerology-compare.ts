// 文體「數字對照」：平衡空間專用。讀者看完能當場用生日對照自己或身邊的人。
//
// 來源：艾瑞克 2026-11-27 提供的事實表、寫作規則與三篇範例。
// 生成時只能用事實表裡的內容；表內沒有的數字解釋一律不寫。
// 範例只供對齊語感，生成時不可照抄範例的句子、人名與場面。
//
// 純資料與純函式，前後端都可以用（主工作區選單、自動流水線、測試都讀這裡）。

import { RECIPE_COMMON_RULES, RECIPE_GROUP_NEW } from "./recipe-genres";

/** 文體代號（與 genres.ts 的 GenreId 相同） */
export const NUMEROLOGY_GENRE_ID = "numerology" as const;
export const NUMEROLOGY_GENRE_NAME = "數字對照";

/**
 * 自動流水線的比例設定。
 * every：平衡空間每幾篇排一篇「數字對照」（3 代表每三篇一篇）。
 * until：這個比例到 2026-12-31（台北時間，含當天）為止；之後流水線不再自動排，
 *        主工作區的選單仍可手動選。要延長或改比例，只改這兩個值。
 */
export const NUMEROLOGY_SCHEDULE = { every: 3, until: "2026-12-31" } as const;

/** 只在這幾型流量結構之間輪替，避開最近 3 篇用過的型 */
export const NUMEROLOGY_STRUCTURES = ["J3", "J4", "J5", "D1", "D5", "C5", "C7"] as const;
export const NUMEROLOGY_AVOID_STRUCTURES = 3;
/** 事實表項目避開最近幾篇用過的 */
export const NUMEROLOGY_AVOID_ITEMS = 9;

/** 主命數算法：每一篇都附上，用到主命數時要給算例 */
export const NUMEROLOGY_METHOD =
  "主命數算法：西元生日的年、月、日共八個數字逐位相加（月、日是個位數時前面補 0），得到的數字再逐位相加，直到剩一位數。例：1986 年 10 月 4 日，加起來是 29，2 加 9 是 11，1 加 1 是 2。主命數不會是 0。";

export interface NumerologyFactItem {
  id: string;
  label: string;
  text: string;
  /** 這一項會用到主命數（要附算例） */
  usesLifeNumber: boolean;
}

/** 事實表：一篇只用一項當骨子 */
export const NUMEROLOGY_FACTS: NumerologyFactItem[] = [
  {
    id: "two-sets", label: "國曆與農曆兩組數字", usesLifeNumber: true,
    text: "兩組數字：國曆生日算一組，農曆生日算一組，算法相同。國曆那一組是面對外面世界、思考與工作的樣子；農曆那一組是感情、家人、人際裡真正的樣子。比喻：國曆那組像螢幕保護程式，真正的樣子在農曆那組。",
  },
  {
    id: "ones", label: "生日八個數字裡 1 的個數", usesLifeNumber: false,
    text: "生日八個數字裡 1 的個數：一個 1，心裡有想法但多半不說也不太去做，對自己說出口的話不夠有把握；兩個 1，會表達也尊重別人；三個 1，話一出口就像已經決定，自己不覺得在下命令；四個 1，不說出來但希望對方知道。其他數字的出現次數目前沒有資料，不可以寫。",
  },
  { id: "life-1", label: "主命數 1 的感情表達", usesLifeNumber: true, text: "主命數 1 的感情表達：習慣帶頭，喜歡教對方，專一，重大原則勝過小細節。" },
  { id: "life-2", label: "主命數 2 的感情表達", usesLifeNumber: true, text: "主命數 2 的感情表達：用眼神說話，喜歡牽手，要一個真心的伴侶。" },
  { id: "life-3", label: "主命數 3 的感情表達", usesLifeNumber: true, text: "主命數 3 的感情表達：很會說話，喜歡新鮮，需要對未來有願景才安定。" },
  { id: "life-4", label: "主命數 4 的感情表達", usesLifeNumber: true, text: "主命數 4 的感情表達：不太會說好聽話，慢熱像炭火，越久越暖；認真起來想的是成家，重視家人的看法。" },
  { id: "life-5", label: "主命數 5 的感情表達", usesLifeNumber: true, text: "主命數 5 的感情表達：熱得很快，需要一點距離，最怕被定型。" },
  { id: "life-6", label: "主命數 6 的感情表達", usesLifeNumber: true, text: "主命數 6 的感情表達：習慣照顧人，需要被認同，連對方的外表都想幫忙打理；口頭禪是「我都是為你好」。" },
  { id: "life-7", label: "主命數 7 的感情表達", usesLifeNumber: true, text: "主命數 7 的感情表達：習慣先懷疑，情緒來得快，愛恨分明，小別勝新婚。" },
  { id: "life-8", label: "主命數 8 的感情表達", usesLifeNumber: true, text: "主命數 8 的感情表達：話中有話，會用送禮表達，戀情傾向低調。" },
  { id: "life-9", label: "主命數 9 的感情表達", usesLifeNumber: true, text: "主命數 9 的感情表達：說話浪漫像童話，容易單戀與迷戀。" },
  {
    id: "six-two-step", label: "主命數 6 的二段式溝通", usesLifeNumber: true,
    text: "主命數 6 的二段式溝通：第一段先問「我能為你做什麼？」；第二段，對方要的和自己想給的有落差時，坐下來談到兩個人都同意。",
  },
];

export const NUMEROLOGY_RULES = [
  "一篇只講一個論點，骨子是事實表裡的一個項目。",
  "文章前三分之一必須出現一句讓讀者自己數得出來或算得出來的指示；用到主命數時要附一個算例。",
  "場面寫讀者和身邊一個人（伴侶、家人、主管、同事）之間的具體互動，不寫讀者一個人的內心獨白。",
  "結尾前要有一句「這幾天留意……」的小事，讓讀者可以回生活對照。",
  "文章內不放連結、不放加 LINE、不放價格、不預告下一篇。",
  "不寫疾病與身體症狀；不寫幾歲會怎樣；不用命定、注定、改命、開運、絕對準、破解命運；不說哪個數字不好；不寫外遇、劈腿這類標籤；不要用「卡住」「撐」「扛」當主要詞彙。",
  "不用破折號，不用 Markdown 符號，不出現「故事情境為示意」這類聲明。人物可以虛構，不可說成真實客戶，不編數字、成效、見證。",
  "排版照流量結構庫：標題用【】，關鍵句用 ➤ ❝ ❞，一段一到兩句，段與段空一行。",
];

/** 三篇範例：只供對齊語感，不可照抄句子、人名與場面 */
export const NUMEROLOGY_EXAMPLES: Array<{ structure: string; skeleton: string; text: string }> = [
  {
    structure: "J3", skeleton: "1 的個數",
    text: `【說「都可以」的人，其實最有意見】
說都可以的人，不是沒意見。
他的意見多到不知道該不該說。
我們通常這樣想。一個人說都可以，就是隨和、好相處、沒有想法。
其實不一定。同一句都可以，從不同的人嘴裡說出來，是完全不一樣的意思。
差別藏在他的生日裡。把西元生日寫下來，年月日一共八個數字，數數看有幾個 1。
小芳的先生是 1978 年 3 月 6 日生，八個數字裡只有一個 1。問他晚餐吃什麼，他說都可以。小芳訂了火鍋，他整頓飯沒什麼話。
他不是故意的。只有一個 1 的人，心裡有想法，多半不說，也不太去做。對自己說出口的話，還不夠有把握。
兩個 1 的人，會說出來，也聽得進別人的。
三個 1 的人，話一出口就像已經決定了。他自己不覺得在下命令。
最極端的是四個 1。他不說，但他很希望你知道。
➤ ❝ 同一句都可以，有人是真的都可以，有人是在等你再問一次。 ❞
所以下次聽到都可以，先別急著決定。多問一句：「如果只能選一個呢？」
這幾天留意一下身邊那個人，數數他有幾個 1。
說都可以的人，不是沒意見。他只是還沒找到說出口的把握。`,
  },
  {
    structure: "J4", skeleton: "國曆與農曆兩組數字",
    text: `【他在外面對誰都好，回到家卻不說話】
「他在外面對誰都好，回到家卻不太說話，是不是不在乎我？」
答案：不是。
你看到的是兩個他，而且兩個都是真的。
在我教的生命數字裡，每個人有兩組數字。一組用國曆生日算，一組用農曆生日算。
算法一樣。把年月日八個數字全部加起來，加到剩一位數。例如 1986 年 10 月 4 日，加起來是 29，2 加 9 是 11，1 加 1 是 2。
國曆那一組，是他面對外面世界的樣子。農曆那一組，是他回到家、面對感情時真正的樣子。
國曆那組像電腦的螢幕保護程式。人人都看得到，但那不是電腦裡面裝的東西。
所以想知道他怎麼愛人，要看農曆那一組。
農曆是 4 的人，不太會說好聽話。他慢熱，像炭火，越久越暖。一旦認真，心裡想的是一個家。
農曆是 5 的人，熱得很快。但他需要一點距離，最怕被定型。
農曆是 6 的人，用照顧來表達。他會把你的事打點好，只希望你認同他的付出。
➤ ❝ 他不是回到家變了一個人，是回到家才是他本來的樣子。 ❞
這幾天試一件事。先不聽他說了什麼，看他做了什麼。
他不是不在乎。
他不是不在乎。
他只是用農曆那一組在愛你。`,
  },
  {
    structure: "C5", skeleton: "主命數 6",
    text: `【越照顧越累的人，都在同一個圈裡】
我發現兩件事很像。
媽媽幫孩子整理房間，孩子生氣。主管幫同事改好簡報，同事悶悶的。
兩邊都是好意，結果都不開心。
主命數是 6 的人，特別容易走進這個圈。（主命數的算法：西元生日八個數字加起來，加到剩一位數。）
看到對方有需要
⇨ 手先動了
⇨ 對方沒有說謝謝
⇨ 心裡委屈，說出「我都是為你好」
⇨ 為了被看見，做得更多
怎麼停下來？少做一點沒有用。要改的是順序。
➤ ❝ 先問，再做。 ❞
第一段，先問一句：「我能為你做什麼？」
第二段，他要的和你想給的不一樣，就坐下來，談到兩個人都同意。
在家裡，問孩子要你幫忙整理，還是他想自己來。
在公司，問同事要你改，還是只要你看。
在感情裡，問他今天想被照顧，還是想一個人靜一下。
餐廳的服務生不會沒問就上菜。他先問你要什麼，你才吃得開心。
6 要的不多，就是一句「有你真好」。先問的人，比較容易聽到這句話。
這幾天留意一下，家裡誰最常說「我都是為你好」。`,
  },
];

/** 範例裡的人名與招牌場面，生成稿出現就要求重寫（不可照抄） */
export const NUMEROLOGY_EXAMPLE_FINGERPRINTS = [
  "小芳", "1978 年 3 月 6 日", "整頓飯沒什麼話", "說都可以的人，不是沒意見", "螢幕保護程式。人人都看得到",
  "他只是用農曆那一組在愛你", "越照顧越累的人", "餐廳的服務生不會沒問就上菜", "如果只能選一個呢",
];

/** 數字對照專屬的擋稿詞（事實表與寫作規則第 5、6 條），其他禁用詞照既有檢查 */
const NUMEROLOGY_BANNED: Array<{ pattern: RegExp; label: string; level?: "warn" }> = [
  { pattern: /命定|注定|改命|開運|絕對準|破解命運/, label: "命定類用語" },
  { pattern: /外遇|劈腿|小三/, label: "外遇劈腿標籤" },
  { pattern: /https?:\/\/|加\s*LINE|加賴|@line|line\.me/i, label: "連結或加 LINE" },
  { pattern: /NT\$|\d+\s*元|價格|優惠價|定價/, label: "價格" },
  { pattern: /下一篇|下次再聊|下集/, label: "預告下一篇" },
  { pattern: /\d+\s*歲(?:以後|之後|那年|會|就)/, label: "幾歲會怎樣" },
  { pattern: /(?:[0-9０-９]|數字)\s*(?:不好|不吉|很糟|最差|比較差)/, label: "說哪個數字不好", level: "warn" },
  { pattern: /故事情境為示意|以上為虛構|本文案例為示意/, label: "示意聲明" },
];

const MAIN_WORDS = ["卡住", "撐", "扛"];

export interface NumerologyIssue { level: "block" | "warn"; message: string }

/** 數字對照的額外檢查。既有的品牌紅線、禁用詞、破折號、Markdown、需補標記另外照常套用。 */
export function checkNumerologyText(text: string): NumerologyIssue[] {
  const body = String(text || "");
  const issues: NumerologyIssue[] = [];
  for (const rule of NUMEROLOGY_BANNED) {
    const hit = body.match(rule.pattern);
    if (hit) issues.push({ level: rule.level || "block", message: `數字對照不可出現${rule.label}：「${hit[0]}」` });
  }
  const copied = NUMEROLOGY_EXAMPLE_FINGERPRINTS.filter((phrase) => body.includes(phrase));
  if (copied.length) issues.push({ level: "block", message: `照抄了範例的句子或人名：${copied.map((p) => `「${p}」`).join("、")}，請換成自己的人物與場面` });
  for (const word of MAIN_WORDS) {
    const count = body.split(word).length - 1;
    if (count >= 3) issues.push({ level: "block", message: `「${word}」出現 ${count} 次，不要當主要詞彙` });
  }
  if (!/這幾天(?:留意|試|觀察|看看|注意)/.test(body)) issues.push({ level: "warn", message: "結尾前少了一句「這幾天留意……」的小事" });
  return issues;
}

function hashSeed(seed: string): number {
  let h = 0;
  for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

export function findFactItem(value: string): NumerologyFactItem | null {
  const text = String(value || "").trim();
  if (!text) return null;
  return NUMEROLOGY_FACTS.find((item) => item.id === text || text.includes(item.label) || item.label.includes(text)) || null;
}

/** 挑事實表項目：避開最近 9 篇用過的，同 seed 結果固定 */
export function pickFactItem(recentItems: Array<string | null>, seed: string): NumerologyFactItem {
  const used = new Set(recentItems.filter(Boolean).slice(0, NUMEROLOGY_AVOID_ITEMS) as string[]);
  const pool = NUMEROLOGY_FACTS.filter((item) => !used.has(item.id));
  const list = pool.length ? pool : NUMEROLOGY_FACTS;
  return list[hashSeed(seed) % list.length];
}

/** 挑流量結構：只在 J3、J4、J5、D1、D5、C5、C7 之間，避開最近 3 篇用過的型 */
export function pickNumerologyStructure(recentStructures: Array<string | null>, seed: string): string {
  const used = new Set(recentStructures.filter(Boolean).slice(0, NUMEROLOGY_AVOID_STRUCTURES) as string[]);
  const pool = NUMEROLOGY_STRUCTURES.filter((id) => !used.has(id));
  const list = pool.length ? pool : [...NUMEROLOGY_STRUCTURES];
  return list[hashSeed(`${seed}-structure`) % list.length];
}

/** 台北日期 YYYY-MM-DD */
function taipeiDay(value: string | Date): string {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "";
  return new Date(time + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function numerologyScheduleActive(scheduledAt: string | Date | null | undefined, now = new Date()): boolean {
  const day = taipeiDay(scheduledAt || now);
  return Boolean(day) && day <= NUMEROLOGY_SCHEDULE.until;
}

export interface NumerologyDecisionInput {
  brandId: string;
  prompt: string;
  projectId?: string | null;
  scheduledAt?: string | null;
  /** 同品牌這一篇之前最近幾篇是不是數字對照，由近到遠 */
  recentFlags: boolean[];
}

/** 提示詞明確指定了數字對照 */
export const explicitNumerology = (prompt: string): boolean => /【本篇文體[】：:]\s*數字對照/.test(String(prompt || ""));

/**
 * 自動流水線：這一篇要不要排成數字對照。
 * 只有平衡空間；題目明確指定了別的文體、屬於階段專案、或帶了真實素材的題目不換；
 * 前面最近 (every - 1) 篇都不是數字對照，這一篇才排，所以大約每三篇一篇。
 */
export function shouldUseNumerology(input: NumerologyDecisionInput): boolean {
  if (input.brandId !== "nas") return false;
  const prompt = String(input.prompt || "");
  if (explicitNumerology(prompt)) return true;
  if (!numerologyScheduleActive(input.scheduledAt || null)) return false;
  if (input.projectId) return false;
  if (/【本篇文體/.test(prompt)) return false;
  if (/(?<!(沒有|未|不|無|缺))(逐字稿|口述|原話|客戶說|學員說)/.test(prompt)) return false;
  const window = input.recentFlags.slice(0, NUMEROLOGY_SCHEDULE.every - 1);
  return !window.some(Boolean);
}

/** 寫進流水線任務 warnings 的記號：之後輪替與成效追蹤都靠它 */
export const NUMEROLOGY_NOTE_PREFIX = "數字對照骨子：";
export const numerologyNote = (item: NumerologyFactItem): string => `${NUMEROLOGY_NOTE_PREFIX}${item.id} ${item.label}`;
export function readNumerologyNote(warnings: unknown): string | null {
  const list = Array.isArray(warnings) ? warnings : [];
  const hit = list.find((item) => typeof item === "string" && item.startsWith(NUMEROLOGY_NOTE_PREFIX));
  if (typeof hit !== "string") return null;
  const id = hit.slice(NUMEROLOGY_NOTE_PREFIX.length).split(" ")[0];
  return NUMEROLOGY_FACTS.some((item) => item.id === id) ? id : null;
}

/** 文體骨架：事實表、寫作規則、範例。主工作區與流水線共用 */
export function buildNumerologySkeleton(): string {
  return [
    "【本篇文體：數字對照】",
    "目的：讀者看完能當場用生日對照自己或身邊的人。",
    "",
    "【事實表】生成時只能用表內的內容，表內沒有的數字解釋一律不寫。",
    `- ${NUMEROLOGY_METHOD}`,
    ...NUMEROLOGY_FACTS.map((item) => `- ${item.text}`),
    "",
    "【寫作規則】",
    ...NUMEROLOGY_RULES.map((rule, i) => `${i + 1}. ${rule}`),
    "",
    "【範例】只供對齊語感。不可照抄範例的句子、人名與場面，人物、生日、互動場景都要自己換。",
    "【新配方共用規矩】",
    ...RECIPE_COMMON_RULES.map((rule, i) => `${i + 1}. ${rule}`),
    "",
    ...NUMEROLOGY_EXAMPLES.flatMap((ex, i) => [`範例${"一二三"[i]}（${ex.structure}，骨子是${ex.skeleton}）：`, ex.text, ""]),
    "長度：450 到 1100 字。一段一到兩句，段與段空一行。",
  ].join("\n");
}

/** 這一篇指定的骨子（事實表的一項） */
export function buildNumerologyItemDirective(item: NumerologyFactItem): string {
  return [
    `【本篇骨子】只用事實表的這一項當論點：${item.text}`,
    item.usesLifeNumber ? `用到主命數，前三分之一要附一個算例（算法：${NUMEROLOGY_METHOD}）。算例的生日自己換一個，不要用範例裡的生日，加總要算對。` : "前三分之一要有一句讓讀者自己數得出來的指示。",
    "事實表其他項目不要拿來補充，表裡沒有的數字解釋不要寫。",
  ].join("\n");
}

/**
 * 自動流水線的題目：不吃每週調研的選題，由系統從事實表輪替挑一項。
 * 帶【本篇文體】【本篇流量結構】【不引用】記號，讓既有的 planStyles 讀得到。
 */
export function buildNumerologyJobPrompt(item: NumerologyFactItem, structure: string): string {
  return [
    `【本篇結構型】${structure}`,
    `【本篇組別】${RECIPE_GROUP_NEW}`,
    "【本篇文體】數字對照",
    `【本篇流量結構】${structure}`,
    "【不引用】",
    "品牌：平衡空間",
    "漏斗層：冷流量，讀者是第一次看到這個品牌的人。",
    `題目：從事實表「${item.label}」這一項出發，寫一篇讓讀者能當場用生日對照自己或身邊一個人的文章。`,
    buildNumerologyItemDirective(item),
  ].join("\n");
}
