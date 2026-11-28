// 自然流量測試第一輪（2026-11-28）的兩個新文體，與三個新配方共用的規矩。
//
// 一、身體入口：艾伯林量子調頻專用。從一個身體部位的日常不舒服進場，寫這個部位和內在的對應。
// 二、貫徹：初八企業顧問專用。從公司裡看得到的場面進場，站在老闆這一邊寫「貫徹有多難」。
// 三、共用規矩：數字對照、身體入口、貫徹三個新配方都套用（純文字、不用破折號、少用卡住撐扛、
//     不放示意聲明、不寫跨篇預告、漏斗層一律冷流量）。
// 另外：每篇任務的提示詞開頭帶【本篇結構型】與【本篇組別】，成效回流時分得出新配方與對照組。
//
// 純資料與純函式，前後端都可以用（主工作區選單、自動流水線、測試都讀這裡）。

export const BODY_ENTRY_GENRE_ID = "bodyEntry" as const;
export const BODY_ENTRY_GENRE_NAME = "身體入口";
export const FOLLOW_THROUGH_GENRE_ID = "followThrough" as const;
export const FOLLOW_THROUGH_GENRE_NAME = "貫徹";

/** 身體入口只在這三型之間輪替 */
export const BODY_ENTRY_STRUCTURES = ["J2", "J4", "C7"] as const;
/** 貫徹只在這兩型之間輪替 */
export const FOLLOW_THROUGH_STRUCTURES = ["D6", "J6"] as const;

// ───────────── 配方標籤（第一段） ─────────────

export const RECIPE_GROUP_NEW = "新配方";
export const RECIPE_GROUP_CONTROL = "對照組";
export type RecipeGroup = typeof RECIPE_GROUP_NEW | typeof RECIPE_GROUP_CONTROL;
export const STRUCTURE_UNSPECIFIED = "未指定";

/** 新配方的三個文體（GenreId） */
export const NEW_RECIPE_GENRES = ["numerology", BODY_ENTRY_GENRE_ID, FOLLOW_THROUGH_GENRE_ID] as const;

const STRUCTURE_TAG = /【本篇結構型】\s*([^\n]{1,12})/;
const GROUP_TAG = /【本篇組別】\s*(新配方|對照組)/;

/** 讀【本篇結構型】：有寫代號就回代號，寫「未指定」或沒寫回 null */
export function readStructureTag(prompt: string): string | null {
  const match = String(prompt || "").match(STRUCTURE_TAG);
  if (!match) return null;
  const code = match[1].trim().match(/^([JDCjdc])\s*([1-8])\b/);
  return code ? `${code[1].toUpperCase()}${code[2]}` : null;
}

/** 讀【本篇組別】：沒寫的一律當對照組（既有已排程的任務不回頭補，視為對照組） */
export function readRecipeGroup(prompt: string): RecipeGroup {
  const match = String(prompt || "").match(GROUP_TAG);
  return match ? (match[1] as RecipeGroup) : RECIPE_GROUP_CONTROL;
}

export function hasRecipeTags(prompt: string): boolean {
  return STRUCTURE_TAG.test(String(prompt || "")) && GROUP_TAG.test(String(prompt || ""));
}

/**
 * 在提示詞開頭補上【本篇結構型】與【本篇組別】兩行。已經有的那一行不重複加。
 * structure 沒指定時填「未指定」；group 沒給時依文體判斷（三個新文體是新配方，其他是對照組）。
 */
export function withRecipeTags(prompt: string, input: { structure?: string | null; group?: RecipeGroup | null; genre?: string | null }): string {
  const text = String(prompt || "");
  const structureLine = text.match(/【本篇結構型】[^\n]*/)?.[0] || `【本篇結構型】${input.structure || STRUCTURE_UNSPECIFIED}`;
  const group = input.group || ((NEW_RECIPE_GENRES as readonly string[]).includes(String(input.genre || "")) ? RECIPE_GROUP_NEW : RECIPE_GROUP_CONTROL);
  const groupLine = text.match(/【本篇組別】(?:新配方|對照組)/)?.[0] || `【本篇組別】${group}`;
  // 已經寫在中間或後面的標籤移到開頭，不重複
  const rest = text.replace(/^[ \t]*【本篇結構型】[^\n]*\n?/m, "").replace(/^[ \t]*【本篇組別】[^\n]*\n?/m, "");
  return `${structureLine}\n${groupLine}\n${rest}`;
}

// ───────────── 共用規矩（第四段） ─────────────

export const RECIPE_COMMON_RULES = [
  "純文字，不用任何 Markdown 符號（# * ** 、清單符號、程式碼區塊都不行）。",
  "不用破折號（——、—、─、–、--），停頓用逗號或句號。",
  "少用「卡住」「撐」「扛」，三個詞合計全文最多一次，最好不用。",
  "不放「故事情境為示意」「以上為虛構」這類聲明。",
  "不寫跨篇預告（下一篇、下次再聊、下集、明天再說）。",
  "漏斗層一律冷流量：讀者是第一次看到這個品牌的人，不預設他認識作者或服務，不放價格、不放連結、不放加 LINE。",
];

export interface RecipeIssue { level: "block" | "warn"; message: string }

const HEAVY_WORDS = ["卡住", "撐", "扛"];

export function heavyWordCount(text: string): Record<string, number> {
  const body = String(text || "");
  return Object.fromEntries(HEAVY_WORDS.map((word) => [word, body.split(word).length - 1]));
}

/** 三個新配方共用的檢查。既有的品牌紅線、品管關卡、文體檢查另外照常套用，這裡只補新規矩。 */
export function checkRecipeCommon(text: string): RecipeIssue[] {
  const body = String(text || "");
  const issues: RecipeIssue[] = [];
  const markdown = body.match(/(^|\n)\s*(#{1,6}\s|[*-]\s|\d+\.\s(?=\S))|\*\*[^*]+\*\*|```/);
  if (markdown) issues.push({ level: "block", message: `不可用 Markdown 符號：「${markdown[0].trim().slice(0, 12)}」` });
  const dash = body.match(/——|—|─|–|--/);
  if (dash) issues.push({ level: "block", message: `不可用破折號：「${dash[0]}」` });
  const counts = heavyWordCount(body);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const used = Object.entries(counts).filter(([, n]) => n > 0).map(([w, n]) => `${w} ${n} 次`).join("、");
  if (total >= 2) issues.push({ level: "block", message: `「卡住」「撐」「扛」合計出現 ${total} 次（${used}），新配方要少用，全文最多一次` });
  else if (total === 1) issues.push({ level: "warn", message: `用了一次「${used.split(" ")[0]}」，能換掉更好` });
  const disclaimer = body.match(/故事情境為示意|以上為虛構|本文案例為示意|情境為虛構|人物為虛構/);
  if (disclaimer) issues.push({ level: "block", message: `不可放示意聲明：「${disclaimer[0]}」` });
  const teaser = body.match(/下一篇|下次再聊|下集|明天再說|待續|下回分曉|之後再跟你說/);
  if (teaser) issues.push({ level: "block", message: `不可寫跨篇預告：「${teaser[0]}」` });
  const cold = body.match(/https?:\/\/|加\s*LINE|加賴|@line|line\.me|NT\$|\d+\s*元/i);
  if (cold) issues.push({ level: "block", message: `冷流量文章不放連結、LINE 或價格：「${cold[0]}」` });
  return issues;
}

/** 行動呼籲：身體入口與社群改寫都用到 */
export const CTA_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /私訊/, label: "私訊" },
  { pattern: /link\s*in\s*bio/i, label: "Link in Bio" },
  { pattern: /首頁連結|主頁連結|個人(?:檔案|簡介|頁面)(?:的)?連結|點(?:擊|進)?(?:個人)?(?:檔案|簡介|主頁|首頁)/, label: "個人頁連結" },
  { pattern: /加\s*LINE|加賴|官方帳號/i, label: "加 LINE" },
  { pattern: /留言區第一則|連結(?:我)?放在留言|留言[「「]?[^\s]{0,6}[」」]?(?:我)?(?:私訊|傳)給你/, label: "留言區連結" },
  { pattern: /預約|報名|立即了解|了解更多|點擊(?:連結|下方)/, label: "預約或報名" },
  { pattern: /歡迎(?:來|找|詢問|聯繫|聯絡|預約|私訊)/, label: "歡迎來找" },
  { pattern: /可以先從[^。\n]{0,30}(?:分析|服務|課程|諮詢|體驗)開始/, label: "導向服務" },
];

export function findCtas(text: string): string[] {
  const body = String(text || "");
  return CTA_PATTERNS.filter((item) => item.pattern.test(body)).map((item) => item.label);
}

// ───────────── 身體入口（第二段，艾伯林量子調頻） ─────────────

/** 七層：每篇只站在其中一層寫，提示詞指定是哪一層 */
export const BODY_ENTRY_LAYERS = ["事實", "感受", "看法", "應該", "期待", "來源", "課題"] as const;
export type BodyEntryLayer = typeof BODY_ENTRY_LAYERS[number];

export const BODY_ENTRY_LAYER_HINT: Record<BodyEntryLayer, string> = {
  事實: "只寫發生了什麼、身體實際的感覺，把看得到的動作與時間寫清楚，不加評價。",
  感受: "寫那個當下心裡的感受，例如煩、委屈、慌、悶，一次只寫一兩種。",
  看法: "寫當事人怎麼解讀這件事，他心裡那句「一定是因為……」。",
  應該: "寫他心裡那句「我應該……」「我不應該……」，那條規則從哪一刻開始管他。",
  期待: "寫他期待別人或自己怎樣，期待落空時身體出現什麼。",
  來源: "寫這個習慣可能從哪裡學來，例如家裡、某一段經驗，一次列兩到三種可能。",
  課題: "寫這件事反覆出現，可能在提醒他練習的那一件事。",
};

export interface BodyEntrySeed { id: string; part: string; scenes: string[] }

/** 題目種子：十個部位，各配日常場面。一篇只用一個部位、一個場面 */
export const BODY_ENTRY_SEEDS: BodyEntrySeed[] = [
  { id: "shoulder", part: "肩膀", scenes: ["週一早上開完會，回到座位才發現肩膀一直聳著沒放下來", "晚上洗澡時熱水沖到肩膀，才發覺那裡硬了一整天"] },
  { id: "teeth", part: "牙齒", scenes: ["早上醒來牙根痠，發現自己整晚咬著牙睡", "跟家人講電話講到一半，發現下巴咬得很緊"] },
  { id: "stomach", part: "胃", scenes: ["午餐吃到一半接到主管訊息，胃一下縮起來，剩下的飯吃不下", "晚上十點才吃第一頓正餐，吃完胃脹到坐不直"] },
  { id: "waist", part: "腰", scenes: ["抱起孩子的那一下，腰一陣痠，只好先蹲著不敢動", "連續開車兩個小時下車，腰直不起來，扶著車門站了一會兒"] },
  { id: "throat", part: "喉嚨", scenes: ["開會時想說的話到了喉嚨又吞回去，散會後喉嚨一直緊緊的", "跟另一半吵完架，喉嚨像卡了東西，整晚說不太出話"] },
  { id: "head", part: "頭", scenes: ["下午三點盯著報表，太陽穴一跳一跳", "假日一早醒來還沒起床，就先想到週一要交的東西，頭開始脹"] },
  { id: "knee", part: "膝蓋", scenes: ["爬捷運站樓梯爬到一半，膝蓋發出聲音，旁邊的人回頭看", "蹲下來幫孩子綁鞋帶，站起來時膝蓋一軟"] },
  { id: "eyes", part: "眼睛", scenes: ["睡前滑手機滑到眼睛酸澀，關燈後還是睜著", "連續看螢幕一整天，下班走到路上，眼睛被夕陽照得一直流淚"] },
  { id: "chest", part: "胸口", scenes: ["收到一則訊息還沒點開，胸口先悶了一下", "半夜醒來，胸口像壓著東西，起身坐了好一陣子"] },
  { id: "wrist", part: "手腕", scenes: ["回完最後一封信，手腕轉一下就發出聲音", "幫家人提了一整天的東西，晚上手腕痠到拿不穩杯子"] },
];

export const BODY_ENTRY_RULES = [
  "從一個身體部位的日常不舒服進場，第一句就是場面：有時間、有人、有動作。",
  "寫這個部位和內在的對應，一次列兩到三種可能，讓讀者自己對照，不可寫成「原因就是」「一定是因為」。",
  "每篇只站在七層裡的一層寫（事實、感受、看法、應該、期待、來源、課題），本篇是哪一層看【本篇層次】。",
  "不寫病名，不寫疾病與情緒的對應，不寫頻率或任何效果，不出現治療、療效、改善、保證、治好、痊癒、根治、緩解這類字。",
  "露易絲．賀的內容只能寫成「她提出的看法」，不可寫成事實或定論；不是每篇都要引用她。",
  "結尾留一件讀者回到生活可以留意的事（例如「這幾天留意一下……」），不放行動呼籲：不叫人私訊、預約、報名、點連結、了解服務。",
  "人物可以是不指名的「有個朋友」「一位上班族」或讀者「你」。用「我」寫時，只能寫一般人都會有的日常身體感覺，不可編造艾瑞克看醫生、拔牙、檢查、診斷這類親身經歷；提示詞附了他的口述才可以寫他的真實經歷。",
];

/** 範例：系統裡已上架的官網文章 43266ff8（牙齒那篇，J2）。只供對齊語感與結構，不可照抄。 */
export const BODY_ENTRY_EXAMPLE = {
  articleId: "43266ff8-c8d9-4ff0-82a5-ef46a631ab41",
  structure: "J2",
  note: "原文最後一段的服務介紹已拿掉（新配方不放行動呼籲）；範例裡「撐」「扛」的用法與「心理防衛機制」這類專有名詞不要學。",
  text: `牙齒痛了很久，我才發現它早就說過了

牙齒開始痛的時候，我沒有停下來。一開始是隱隱的，小到你根本不會把它當一回事的那種。我照常吃飯，照常工作，它偶爾提醒我一下，我偶爾想一下，然後就忘了。

後來它提醒得越來越大聲，直到有一天，我發現我沒辦法好好吃東西了。

我去看了牙醫。醫生看完，給我的建議是拔掉。除此之外，沒有別的。

我當場愣住。這從來不在我的選項裡。

回家的路上我一直在想，這顆牙不是今天才出問題的。它很早就說了，只是說得很小聲。而我一直沒把它當一回事。

很多時候不是沒有提醒，是我們沒把它當一回事。

就像車子儀表板上亮了一個小燈。車還能開，所以我們繼續開。等到車停在路邊，才想起那個燈亮了多久。

那天回到家，我做的第一件事，是跟這顆牙說對不起。

對不起，讓你承擔了這麼久，我現在才聽見。

一個禮拜過去了，變化很小，小到要很仔細才感覺得到。我這才明白，它是慢慢變成這樣的，所以也急不來。

睡不好，告訴自己最近比較忙，過一陣子就好了。肩頸很緊，告訴自己坐久了就這樣。胃口變了，告訴自己最近壓力大，正常的。

這幾天，我想邀請你留意一下。

你身上有沒有哪個地方，一直小小聲地在提醒你，而你還沒理它。

因為等你真的聽懂它在說什麼的時候，它可能已經等你很久了。`,
};

/** 範例裡的招牌句，生成稿出現就要求重寫（不可照抄） */
export const BODY_ENTRY_FINGERPRINTS = ["儀表板上亮了一個小燈", "讓你承擔了這麼久", "沖牙機", "這從來不在我的選項裡", "它早就說過了"];

/** 病名：常見的列出來擋，沒列到的由品牌紅線與醫療宣稱檢查補 */
const DISEASE_NAMES = /癌|腫瘤|糖尿病|高血壓|憂鬱症|焦慮症|恐慌症|失眠症|躁鬱|胃潰瘍|胃炎|胃食道逆流|腸躁|牙周病|椎間盤|骨刺|關節炎|五十肩|甲狀腺|偏頭痛|自律神經失調|乾眼症|青光眼|氣喘|心臟病|狹心症|肌腱炎|腕隧道|顳顎關節|紅斑性狼瘡|過敏性鼻炎/;
const EFFECT_WORDS = /治療|療效|改善|保證|治好|痊癒|根治|緩解|有效|見效|頻率|能量場|調頻後|疏通/;
const DISEASE_EMOTION = /(?:是|代表|就是|來自|因為)[^。\n]{0,12}(?:壓抑|憤怒|恐懼|悲傷|焦慮|委屈|怨)[^。\n]{0,6}(?:造成|引起|導致|的結果)|(?:壓抑|憤怒|恐懼|悲傷|焦慮|委屈|怨恨?)[^。\n]{0,8}(?:會|就會)?(?:造成|引起|導致)[^。\n]{0,10}(?:痛|病|發炎)/;

export function checkBodyEntryText(text: string): RecipeIssue[] {
  const body = String(text || "");
  const issues: RecipeIssue[] = [...checkRecipeCommon(body)];
  const disease = body.match(DISEASE_NAMES);
  if (disease) issues.push({ level: "block", message: `身體入口不可寫病名：「${disease[0]}」` });
  const effect = body.match(EFFECT_WORDS);
  if (effect) issues.push({ level: "block", message: `身體入口不可寫效果或頻率：「${effect[0]}」` });
  const map = body.match(DISEASE_EMOTION);
  if (map) issues.push({ level: "block", message: `不可寫疾病與情緒的對應：「${map[0]}」` });
  const cause = body.match(/原因就是|一定是因為|就是因為你|根本原因是/);
  if (cause) issues.push({ level: "block", message: `部位和內在的對應要列兩到三種可能讓讀者對照，不可寫成定論：「${cause[0]}」` });
  if (/露易絲|Louise\s*Hay/i.test(body) && !/(?:露易絲|Louise\s*Hay)[^。\n]{0,40}(?:提出|認為|的看法|這樣看|的觀點|曾說|看法是)/i.test(body)) {
    issues.push({ level: "block", message: "露易絲．賀的內容要寫成「她提出的看法」，不可寫成事實" });
  }
  const ctas = findCtas(body);
  if (ctas.length) issues.push({ level: "block", message: `身體入口結尾不放行動呼籲：${ctas.join("、")}` });
  const copied = BODY_ENTRY_FINGERPRINTS.filter((phrase) => body.includes(phrase));
  if (copied.length) issues.push({ level: "block", message: `照抄了範例的句子：${copied.map((p) => `「${p}」`).join("、")}，請換成自己的場面與比喻` });
  if (!/這幾天|這週|明天|下次(?:你|當)|回家後|睡前|留意/.test(body)) issues.push({ level: "warn", message: "結尾少了一件讀者回到生活可以留意的事" });
  return issues;
}

export function findBodyEntrySeed(value: string): BodyEntrySeed | null {
  const text = String(value || "").trim();
  if (!text) return null;
  return BODY_ENTRY_SEEDS.find((seed) => seed.id === text || text.includes(seed.part)) || null;
}

function hashSeed(seed: string): number {
  let h = 0;
  for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

/** 依序輪替：第 n 篇用 list[n % length]，給十二月換配方這種一次排好幾篇的情況用 */
export function rotate<T>(list: readonly T[], index: number): T {
  return list[((index % list.length) + list.length) % list.length];
}

/** 挑部位：避開最近用過的，同 seed 結果固定 */
export function pickBodyEntrySeed(recent: Array<string | null>, seed: string): BodyEntrySeed {
  const used = new Set(recent.filter(Boolean) as string[]);
  const pool = BODY_ENTRY_SEEDS.filter((item) => !used.has(item.id));
  const list = pool.length ? pool : BODY_ENTRY_SEEDS;
  return list[hashSeed(seed) % list.length];
}

export function pickRecipeStructure(allowed: readonly string[], recent: Array<string | null>, seed: string): string {
  const used = new Set((recent.filter(Boolean) as string[]).slice(0, Math.max(1, allowed.length - 1)));
  const pool = allowed.filter((id) => !used.has(id));
  const list = pool.length ? pool : [...allowed];
  return list[hashSeed(`${seed}-structure`) % list.length];
}

export function buildBodyEntrySkeleton(): string {
  return [
    "【本篇文體：身體入口】",
    "目的：讀者從一個熟悉的身體小不舒服，看見自己內在可能在發生的事，自己對照，不被下定論。",
    "",
    "【寫作規則】",
    ...BODY_ENTRY_RULES.map((rule, i) => `${i + 1}. ${rule}`),
    "",
    "【七層】事實、感受、看法、應該、期待、來源、課題。每篇只站在一層寫：",
    ...BODY_ENTRY_LAYERS.map((layer) => `- ${layer}：${BODY_ENTRY_LAYER_HINT[layer]}`),
    "",
    "【新配方共用規矩】",
    ...RECIPE_COMMON_RULES.map((rule, i) => `${i + 1}. ${rule}`),
    "",
    `【範例】只供對齊語感與結構（${BODY_ENTRY_EXAMPLE.structure}）。${BODY_ENTRY_EXAMPLE.note}不可照抄範例的句子、比喻與場面。`,
    BODY_ENTRY_EXAMPLE.text,
    "",
    "長度：450 到 1100 字。一段一到兩句，段與段空一行。",
  ].join("\n");
}

export function buildBodyEntryItemDirective(seed: BodyEntrySeed, layer: BodyEntryLayer, sceneIndex = 0): string {
  const scene = rotate(seed.scenes, sceneIndex);
  return [
    `【本篇部位】${seed.part}`,
    `【本篇場面】${scene}（可以照這個場面寫，也可以換成同一個部位的其他日常場面，第一句就要是場面）`,
    `【本篇層次】${layer}：${BODY_ENTRY_LAYER_HINT[layer]}`,
    "其他六層不要展開，只站在這一層寫。",
  ].join("\n");
}

export function buildBodyEntryJobPrompt(seed: BodyEntrySeed, layer: BodyEntryLayer, structure: string, sceneIndex = 0): string {
  return [
    `【本篇結構型】${structure}`,
    `【本篇組別】${RECIPE_GROUP_NEW}`,
    `【本篇文體】${BODY_ENTRY_GENRE_NAME}`,
    `【本篇流量結構】${structure}`,
    "品牌：艾伯林量子調頻",
    "漏斗層：冷流量，讀者是第一次看到這個品牌的人。",
    `題目：從「${seed.part}」的日常不舒服進場，寫這個部位和內在可能的對應，讓讀者自己對照。`,
    buildBodyEntryItemDirective(seed, layer, sceneIndex),
  ].join("\n");
}

// ───────────── 貫徹（第三段，初八企業顧問） ─────────────

/** 入口句：逐字照用，可放在文中任一處，不必每篇都放 */
export const FOLLOW_THROUGH_ENTRY = "每個公司最難的，是一個命令或規定要貫徹。只要不貫徹，小到日常規範，大到公司目標，都會被打折。";

export const FOLLOW_THROUGH_SCENES: Array<{ id: string; scene: string }> = [
  { id: "meeting", scene: "會議決定一週後沒動" },
  { id: "notice", scene: "規定公告了沒人照做" },
  { id: "process", scene: "新流程兩週後回到舊做法" },
  { id: "goal", scene: "年初的目標三月沒人再提" },
  { id: "almost", scene: "交代的事每次都差一點" },
  { id: "interpret", scene: "同一條規定各主管解讀不同" },
  { id: "exception", scene: "例外開了一次變成慣例" },
];

export const FOLLOW_THROUGH_RULES = [
  "從公司裡看得到的場面進場，第一段就是場面，例如會議決定一週後沒動、規定公告了沒人照做、新流程兩週後回到舊做法。",
  "站在老闆這一邊寫，寫「這件事有多難」，不可寫成老闆有問題、老闆沒做好、都是老闆的錯。",
  "不出現靈性、頻率、能量、療癒、調頻這類字。",
  "不編造客戶案例與數字（百分比、倍數、幾成、幾家公司都不行）；不是每篇都要引用書。",
  `入口句（要用就逐字照用，可放在文中任一處，不必每篇都放）：${FOLLOW_THROUGH_ENTRY}`,
];

export function checkFollowThroughText(text: string): RecipeIssue[] {
  const body = String(text || "");
  const issues: RecipeIssue[] = [...checkRecipeCommon(body)];
  const spiritual = body.match(/靈性|頻率|能量|療癒|調頻|宇宙|信息場/);
  if (spiritual) issues.push({ level: "block", message: `貫徹不可出現「${spiritual[0]}」這類字` });
  const blame = body.match(/老闆(?:有問題|沒做好|的錯|自己的問題|做錯了|不夠好|才是問題)|都是老闆|問題(?:出)?在老闆(?:身上)?|怪老闆/);
  if (blame) issues.push({ level: "block", message: `要站在老闆這一邊寫，不可寫成老闆有問題：「${blame[0]}」` });
  const numbers = body.match(/\d+(?:\.\d+)?\s*[%％]|百分之[一二三四五六七八九十百\d]+|\d+\s*倍|[一二三四五六七八九\d]\s*成的(?:公司|企業|老闆|主管|員工)|\d+\s*(?:家|間)(?:公司|企業)/);
  if (numbers) issues.push({ level: "block", message: `不可編造數字：「${numbers[0]}」` });
  // 入口句要嘛不用、要嘛逐字照用
  const startsEntry = /每個公司最難的/.test(body) || /都會被打折/.test(body);
  if (startsEntry && !body.includes(FOLLOW_THROUGH_ENTRY)) issues.push({ level: "block", message: `入口句要逐字照用：${FOLLOW_THROUGH_ENTRY}` });
  return issues;
}

export function buildFollowThroughSkeleton(): string {
  return [
    "【本篇文體：貫徹】",
    "目的：老闆讀完覺得「對，就是這件事最難」，被理解，而不是被指責。",
    "",
    "【寫作規則】",
    ...FOLLOW_THROUGH_RULES.map((rule, i) => `${i + 1}. ${rule}`),
    "",
    "【公司裡看得到的場面】",
    ...FOLLOW_THROUGH_SCENES.map((item) => `- ${item.scene}`),
    "",
    "【新配方共用規矩】",
    ...RECIPE_COMMON_RULES.map((rule, i) => `${i + 1}. ${rule}`),
    "",
    "長度：600 到 1300 字。一段一到兩句，段與段空一行。",
  ].join("\n");
}

export function buildFollowThroughJobPrompt(scene: { id: string; scene: string }, structure: string, useEntry: boolean): string {
  return [
    `【本篇結構型】${structure}`,
    `【本篇組別】${RECIPE_GROUP_NEW}`,
    `【本篇文體】${FOLLOW_THROUGH_GENRE_NAME}`,
    `【本篇流量結構】${structure}`,
    "【不引用】",
    "品牌：初八企業顧問",
    "漏斗層：冷流量，讀者是第一次看到這個品牌的老闆或主管。",
    `題目：從「${scene.scene}」這個公司裡看得到的場面進場，站在老闆這一邊寫貫徹這件事有多難。`,
    `【本篇場面】${scene.scene}`,
    useEntry ? `這篇要用入口句，逐字照用：${FOLLOW_THROUGH_ENTRY}` : "這篇不用入口句。",
  ].join("\n");
}

/** 新配方文體的額外檢查，依文體分派。數字對照另外加上共用規矩。 */
export function recipeChecksFor(genre: string | null | undefined): ((text: string) => RecipeIssue[]) | null {
  if (genre === BODY_ENTRY_GENRE_ID) return checkBodyEntryText;
  if (genre === FOLLOW_THROUGH_GENRE_ID) return checkFollowThroughText;
  if (genre === "numerology") return checkRecipeCommon;
  return null;
}
