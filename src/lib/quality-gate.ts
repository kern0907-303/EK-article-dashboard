// 品管關卡：發佈前對每一份文字做「機械可判斷」的檢查，免費、即時、一定會擋。
// 範圍：亂碼與壞稿、AI 殘留、格式規範、平台長度、與母稿的一致性。
// 品牌紅線與文體規則仍由 brand-guardrail、genre-check 負責，這裡不重複。
// 判斷型問題（編造案例、語氣、跨平台是否說同一件事）交給 Paperclip 的編輯 AI。
// 純函式、不依賴伺服器環境，方便單獨測試。

export type GateLevel = "block" | "warn";
export interface GateIssue { level: GateLevel; code: string; message: string }
export type GatePlatform = "facebook" | "instagram" | "threads" | "website" | "slide";

export const PLATFORM_LIMITS: Record<GatePlatform, number> = { facebook: 63206, instagram: 2200, threads: 500, website: 80000, slide: 60 };

// 只在簡體字出現、繁體不會用的常見字。三個以上才擋，一到兩個只提醒（引用或人名偶爾會有）。
const SIMPLIFIED_ONLY = "这们个来说过还时为学会点对无现发国动实开长门问业经样种么优创错机见当买卖读话该观觉艺总结让认识写与东两关兴书带产亲务习乐处备头题办导爱权级变场师应战报温条极构标检气术汉烟热电画显毕盘离难页预领颜饭馆驾鱼鸟龙";
const SIMPLIFIED_SET = new Set(SIMPLIFIED_ONLY.split(""));

const MOJIBAKE_SET = "\u0080-\u00BF\u0152\u0153\u0160\u0161\u0178\u017D\u017E\u0192\u02C6\u02DC\u2013\u2014\u2018-\u201E\u2020-\u2022\u2026\u2030\u2039\u203A\u20AC\u2122";
const MOJIBAKE = new RegExp(`[ÃÂäåæçèéïâ][${MOJIBAKE_SET}]{2}|Ã[${MOJIBAKE_SET}¡-ÿ]`);
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const AI_PREFIX = /^\s*(以下是|以下為|好的[，,。]\s*(以下|我|這)|當然[，,。]\s*(以下|我|這)|(很)?抱歉[，,]\s*我(無法|不能)(提供|協助|生成|撰寫|完成)|我無法(提供|協助|生成|撰寫|完成)|作為.{0,8}(AI|助理|模型)|Here is|Here's|Sure[,!]|Certainly[,!])/i;
const AI_ANYWHERE = /(as an ai language model|作為一個?(AI|人工智慧)|我是(AI|人工智慧)|以上是(改寫|重寫|整理)|希望(這|以上)(篇|份|個)?(內容|版本)(對你|能幫))/i;
const PLACEHOLDER = /【[^】]{0,30}】|\{\{[^}]*\}\}|\bTODO\b|\blorem ipsum\b|\bundefined\b|\bnull\b|\[待補\]|XXX/i;
const DASHES = /[—–─―]|--/;
const MARKDOWN = /^\s{0,3}#{1,6}\s|\*\*[^*]+\*\*|^\s*[-*]\s+\S|`{3}/m;
const TRAILING_BAD = /[，、：；,:;（(「『“]\s*$/;

// 免責聲明類句子：品牌規則「文章裡不放故事情境為示意這類聲明」。含這些字樣的整句會被移除。
const DISCLAIMER = /(故事)?情境(僅)?為示意|以上(故事|內容|情境)?(皆|均)?為虛構|純屬虛構|僅為示意|虛構情境|情境為虛構/;
// 對外品牌名稱一律用全名，不寫縮寫。前面是英數字或 # 的不處理（例如主題標籤）。
const BRAND_ABBREV = /(?<![A-Za-z0-9#])(ABL|NAS|I8)(?![A-Za-z0-9])/g;
const BRAND_FULL: Record<string, string> = { ABL: "艾伯林量子調頻", NAS: "平衡空間", I8: "初八企業顧問" };

/**
 * 機械式自動修正：不改變原意，只處理有明確規則的問題。回傳修正後文字與修正清單。
 * 1. 移除含免責聲明的整句  2. 品牌縮寫改全名  3. 清掉只剩標點的殘行  4. 壓縮多餘空行
 */
export function applyMechanicalFixes(text: string): { text: string; fixes: string[] } {
  const fixes: string[] = [];
  let out = String(text || "");
  const lines = out.split("\n");
  const kept: string[] = [];
  let removed = 0;
  for (const line of lines) {
    if (!DISCLAIMER.test(line)) { kept.push(line); continue; }
    const sentences = line.split(/(?<=[。！？])/);
    const rest = sentences.filter((sentence) => !DISCLAIMER.test(sentence)).join("").trim();
    removed += sentences.length - sentences.filter((sentence) => !DISCLAIMER.test(sentence)).length || 1;
    if (rest) kept.push(rest);
  }
  if (removed) { fixes.push(`移除 ${removed} 句免責聲明`); out = kept.join("\n"); }
  let abbrev = 0;
  out = out.replace(BRAND_ABBREV, (_m, code: string) => { abbrev++; return BRAND_FULL[code]; });
  if (abbrev) fixes.push(`品牌縮寫改全名 ${abbrev} 處`);
  const before = out;
  out = out.split("\n").filter((line) => !/^\s*[，、,.。；;：:]+\s*$/.test(line)).join("\n");
  if (out !== before) fixes.push("清掉只剩標點的殘行");
  out = out.replace(/\n{3,}/g, "\n\n").trim();
  return { text: out, fixes };
}

/** 亂碼、壞稿與 AI 殘留 */
export function checkGarbled(text: string): GateIssue[] {
  const issues: GateIssue[] = [];
  const body = String(text || "");
  const add = (level: GateLevel, code: string, message: string) => issues.push({ level, code, message });
  if (!body.trim()) { add("block", "empty", "內容是空的"); return issues; }
  if (body.includes("�")) add("block", "replacement_char", "含有亂碼字元（�），編碼可能壞掉");
  if (MOJIBAKE.test(body)) add("block", "mojibake", "含有編碼錯亂的殘留字串（例如 Ã、â€）");
  if (CONTROL_CHARS.test(body)) add("block", "control_char", "含有不可見的控制字元");
  if (/"(threads|instagram|slides)"\s*:/.test(body) || /^\s*[\[{]\s*"/.test(body)) add("block", "json_leak", "內容像是未處理的程式回傳格式（JSON 殘留）");
  if (AI_PREFIX.test(body) || AI_ANYWHERE.test(body)) add("block", "ai_chatter", "含有 AI 的說明或客套話，不是正文");
  if (PLACEHOLDER.test(body)) add("block", "placeholder", "含有未處理的標記或預留字樣（例如【】、TODO、null）");
  if (/([一-鿿A-Za-z0-9])\1{5,}/.test(body)) add("block", "repeat_run", "同一個字連續重複太多次，可能是生成壞掉");
  const lines = body.split(/\n+/).map((line) => line.trim()).filter((line) => line.length >= 12);
  const seen = new Set<string>();
  for (const line of lines) {
    if (seen.has(line)) { add("block", "duplicate_line", "同一段文字重複出現"); break; }
    seen.add(line);
  }
  const simplified = new Set(body.split("").filter((ch) => SIMPLIFIED_SET.has(ch)));
  if (simplified.size >= 3) add("block", "simplified_chars", `混入簡體字：${[...simplified].slice(0, 6).join("")}`);
  else if (simplified.size > 0) add("warn", "simplified_chars", `可能有簡體字：${[...simplified].join("")}`);
  const trimmed = body.trim();
  if (trimmed.length > 120 && TRAILING_BAD.test(trimmed)) add("block", "truncated", "結尾停在逗號或冒號，文章可能被截斷");
  else if (trimmed.length > 120 && /[一-鿿]$/.test(trimmed)) add("warn", "no_end_punctuation", "結尾沒有標點，請確認文章是否完整");
  return issues;
}

/** 格式規範：破折號、Markdown、長度 */
export function checkFormat(text: string, platform: GatePlatform): GateIssue[] {
  const issues: GateIssue[] = [];
  const body = String(text || "");
  const limit = PLATFORM_LIMITS[platform];
  if (DASHES.test(body)) issues.push({ level: "block", code: "dash", message: "含有破折號，品牌文案一律不可使用" });
  if (DISCLAIMER.test(body)) issues.push({ level: "block", code: "disclaimer", message: "含有免責聲明（例如故事情境為示意），文章裡不放這類聲明" });
  BRAND_ABBREV.lastIndex = 0;
  if (BRAND_ABBREV.test(body)) issues.push({ level: "warn", code: "brand_abbrev", message: "出現品牌縮寫（ABL、NAS、I8），對外請用全名" });
  BRAND_ABBREV.lastIndex = 0;
  if (MARKDOWN.test(body)) issues.push({ level: "block", code: "markdown", message: "含有 Markdown 符號，社群平台不支援" });
  if (body.length > limit) issues.push({ level: "block", code: "too_long", message: `超過 ${platform} 字數上限 ${limit}（目前 ${body.length}）` });
  return issues;
}

const bigrams = (text: string): Set<string> => {
  const chars = text.replace(/[^一-鿿A-Za-z0-9]/g, "");
  const set = new Set<string>();
  for (let i = 0; i < chars.length - 1; i++) set.add(chars.slice(i, i + 2));
  return set;
};

/** 與母稿一致：不新增母稿沒有的數字，主題沒有偏離 */
export function checkConsistency(master: string, derived: string): GateIssue[] {
  const issues: GateIssue[] = [];
  const masterNumbers = new Set(master.match(/\d{2,}/g) || []);
  const invented = [...new Set(derived.match(/\d{2,}/g) || [])].filter((n) => !masterNumbers.has(n));
  if (invented.length) issues.push({ level: "block", code: "new_numbers", message: `出現母稿沒有的數字：${invented.slice(0, 5).join("、")}，可能是編造` });
  const CN_AMOUNT = /[一二兩三四五六七八九十百千萬]+(?:年|歲|個月|倍|成|萬|元|人|次|天|週)/g;
  const masterAmounts = new Set(master.match(CN_AMOUNT) || []);
  const inventedAmounts = [...new Set(derived.match(CN_AMOUNT) || [])].filter((n) => !masterAmounts.has(n));
  if (inventedAmounts.length) issues.push({ level: "warn", code: "new_amounts", message: `出現母稿沒有的數量說法：${inventedAmounts.slice(0, 5).join("、")}，請確認不是編造` });
  const derivedGrams = bigrams(derived);
  if (derivedGrams.size >= 30) {
    const masterGrams = bigrams(master);
    let hit = 0;
    for (const gram of derivedGrams) if (masterGrams.has(gram)) hit++;
    const ratio = hit / derivedGrams.size;
    if (ratio < 0.2) issues.push({ level: "block", code: "topic_drift", message: `與母稿幾乎對不上（重疊 ${Math.round(ratio * 100)}%），主題可能偏離` });
    else if (ratio < 0.4) issues.push({ level: "warn", code: "topic_drift", message: `與母稿重疊偏低（${Math.round(ratio * 100)}%），請確認沒有偏題` });
  }
  return issues;
}

export interface GateOptions { platform: GatePlatform; master?: string }

/** 一次跑完所有機械檢查 */
export function runQualityGate(text: string, options: GateOptions): GateIssue[] {
  const issues = [...checkGarbled(text), ...checkFormat(text, options.platform)];
  if (options.master && options.platform !== "facebook") issues.push(...checkConsistency(options.master, text));
  return issues;
}

export const gateBlockers = (issues: GateIssue[]): GateIssue[] => issues.filter((issue) => issue.level === "block");
export const gateWarnings = (issues: GateIssue[]): GateIssue[] => issues.filter((issue) => issue.level === "warn");
export const gateMessage = (issues: GateIssue[]): string => issues.map((issue) => issue.message).join("；");

/**
 * 單一入口：所有「寫入排程、發布」的路徑都先過這裡。
 * 先機械修正（免責聲明、品牌縮寫、破折號、Markdown），再跑品管關卡；
 * 還有 block 的就拒絕，不再依賴任何一個 AI 記得規範。
 */
export function enforceCopyRules(text: string, platform: GatePlatform, master?: string): { text: string; fixes: string[]; blockers: GateIssue[]; warnings: GateIssue[] } {
  const fixed = applyMechanicalFixes(String(text || ""));
  const issues = runQualityGate(fixed.text, { platform, master });
  return { text: fixed.text, fixes: fixed.fixes, blockers: gateBlockers(issues), warnings: gateWarnings(issues) };
}
