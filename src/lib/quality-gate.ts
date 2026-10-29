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
const PLACEHOLDER = /【[^】]{0,30}(?:需補|待補|待確認|請補|補上|填入|範例|示例|XX)[^】]{0,30}】|\{\{[^}]*\}\}|\bTODO\b|\blorem ipsum\b|\bundefined\b|\bnull\b|\[待補\]|XXX/i;
const DASHES = /[—–─―]|--/;
const MARKDOWN = /^\s{0,3}#{1,6}\s|\*\*[^*]+\*\*|^\s*[-*]\s+\S|`{3}/m;
const TRAILING_BAD = /[，、：；,:;（(「『“]\s*$/;

// 免責聲明類句子：品牌規則「文章裡不放故事情境為示意這類聲明」。含這些字樣的整句會被移除。
const DISCLAIMER = /(故事)?情境(僅)?為示意|以上(故事|內容|情境)?(皆|均)?為虛構|純屬虛構|僅為示意|虛構情境|情境為虛構/;
// 對外品牌名稱一律用全名，不寫縮寫。前面是英數字或 # 的不處理（例如主題標籤）。
const BRAND_ABBREV = /(?<![A-Za-z0-9#])(ABL|NAS|I8)(?![A-Za-z0-9])/g;
const BRAND_FULL: Record<string, string> = { ABL: "艾伯林量子調頻", NAS: "平衡空間", I8: "初八企業顧問" };
export const BRAND_NAMES: readonly string[] = ["平衡空間", "艾伯林量子調頻", "初八企業顧問"];

/**
 * 書籍引用的查證。
 *
 * 艾瑞克的寫作規則：引經據典只能用他自己的知識庫，先確認書與作者、讀過全文再引用，不憑記憶。
 * 2026-10-27 發現自動流水線完全沒有實作這條，15 篇已排程的 ABL 文章引了 15 本書，
 * 其中 12 本根本不在知識庫裡，等於模型憑記憶寫的。
 *
 * 這裡只負責「抓出文章引了哪些書」與「比對是不是允許的那一本」，
 * 挑書與查證由 chooseKnowledgeSource 負責。
 */
const BOOK_TITLE = /《([^》]{1,60})》/g;

/** 文章裡出現的所有書名，去重 */
export function citedBookTitles(text: string): string[] {
  const body = String(text || "");
  const found = new Set<string>();
  BOOK_TITLE.lastIndex = 0;
  let hit: RegExpExecArray | null;
  while ((hit = BOOK_TITLE.exec(body)) !== null) {
    const title = hit[1].trim();
    if (title) found.add(title);
  }
  BOOK_TITLE.lastIndex = 0;
  return [...found];
}

/**
 * 未經查證的引用。allowed 傳 null 代表這篇沒有拿到任何經過查證的出處，
 * 此時文章裡任何一本書都是違規。
 */
export function unverifiedCitations(text: string, allowed: { title: string } | null): string[] {
  const titles = citedBookTitles(text);
  if (!allowed?.title) return titles;
  return titles.filter((title) => title !== allowed.title);
}

/** 沒有指名出處的研究宣稱。不擋稿，只提醒，因為有時是在轉述常識。 */
const VAGUE_RESEARCH = /(研究(顯示|指出|發現|證實)|根據研究|科學家(發現|指出)|專家(表示|指出)|有(一項)?研究)/;

export function vagueResearchClaim(text: string): string {
  const hit = String(text || "").match(VAGUE_RESEARCH);
  return hit ? hit[0] : "";
}

/**
 * 品牌名稱當主詞發言的偵測。
 *
 * 舊版列出「認為、相信、陪你…」這些動詞當黑名單，中文動詞列不完，實際漏掉非常多
 * （「平衡空間想在這裡停一下」「平衡空間邀請你」「初八企業顧問談現金流」都沒擋到）。
 * 所以反過來寫：預設全部算違規，只放行兩種合法用法。
 *
 *   地點      前面緊接 在/到/來/去/找/是/進    「我在平衡空間帶過一個案子」
 *   服務名稱  後面緊接 的                      「平衡空間的生命數字」
 *
 * 另外放行主題標籤（#平衡空間）與行尾、引號收尾，這些不是在發言。
 * 合法用法本身也有上限：全文最多出現一次（主題標籤不計）。
 */
const BRAND_OK_BEFORE = /[在到來去找是進]$/;
const BRAND_OK_AFTER = /^(的|」|』|）|\)|\n|$)/;

export interface BrandSubjectHit {
  /** 違規片段，用來顯示與回饋給 AI */
  snippet: string;
  /** subject 品牌當主詞發言；repeat 合法但出現太多次 */
  reason: "subject" | "repeat";
}

/** 指定品牌就只檢查該品牌，沒指定就檢查三個品牌 */
const namesFor = (brandId?: string): string[] => {
  const key = String(brandId || "").toUpperCase();
  return BRAND_FULL[key] ? [BRAND_FULL[key]] : [...BRAND_NAMES];
};

/** 找出文字裡品牌當主詞發言的地方。回傳空陣列代表這段文字的說話者沒問題。 */
export function brandSubjectHits(text: string, brandId?: string): BrandSubjectHit[] {
  const body = String(text || "");
  const hits: BrandSubjectHit[] = [];
  for (const name of namesFor(brandId)) {
    let countable = 0;
    for (let at = body.indexOf(name); at >= 0; at = body.indexOf(name, at + name.length)) {
      const before = body.slice(Math.max(0, at - 1), at);
      const after = body.slice(at + name.length, at + name.length + 1);
      if (before === "#" || before === "＃") continue; // 主題標籤不是在發言
      countable += 1;
      if (BRAND_OK_BEFORE.test(before)) continue; // 當地點
      if (BRAND_OK_AFTER.test(after)) continue; // 當服務名稱或句尾
      hits.push({ reason: "subject", snippet: body.slice(at, at + name.length + 8).replace(/\s+/g, " ") });
    }
    if (countable > 1) hits.push({ reason: "repeat", snippet: `${name}（全文出現 ${countable} 次，規則是最多一次）` });
  }
  return hits;
}

/** 把違規的整句挑出來，帶給 AI 當重寫依據 */
export function brandSubjectSentences(text: string, brandId?: string): string[] {
  const body = String(text || "");
  const bad = body
    .split(/(?<=[。！？\n])/)
    .map((line) => line.trim())
    .filter((line) => line && brandSubjectHits(line, brandId).some((hit) => hit.reason === "subject"))
    .slice(0, 4)
    .map((line) => line.slice(0, 60));
  const repeat = brandSubjectHits(body, brandId).filter((hit) => hit.reason === "repeat").map((hit) => hit.snippet);
  return [...bad, ...repeat];
}

/**
 * 機械式修正品牌當主詞：只處理「句首品牌名 + 動詞」這種文法上一定可以直接換成「我」的位置，
 * 不碰句中的其他用法，避免改出不通的句子。AI 重寫失敗時當最後一道保險。
 */
export function rewriteBrandSubject(text: string, brandId?: string): { text: string; fixes: string[] } {
  let out = String(text || "");
  const fixes: string[] = [];
  for (const name of namesFor(brandId)) {
    const re = new RegExp(`(^|[\\n。！？，；：「『【（])${name}(?=[^的」』）\\n#＃])`, "g");
    out = out.replace(re, (_match, lead: string) => {
      if (!fixes.length) fixes.push(`「${name}」當主詞，已改成艾瑞克的第一人稱「我」`);
      return `${lead}我`;
    });
  }
  return { text: out, fixes };
}

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
    if (seen.has(line)) { add("warn", "duplicate_line", "同一段文字重複出現，確認不是生成重複"); break; }
    seen.add(line);
  }
  const simplified = new Set(body.split("").filter((ch) => SIMPLIFIED_SET.has(ch)));
  if (simplified.size >= 3) add("block", "simplified_chars", `混入簡體字：${[...simplified].slice(0, 6).join("")}`);
  else if (simplified.size > 0) add("warn", "simplified_chars", `可能有簡體字：${[...simplified].join("")}`);
  const trimmed = body.trim();
  // 貼文結尾通常是主題標籤行（例如「生命數字 #自我探索 #人生節奏」），那不是正文。
  // 判斷文章完不完整之前要先把它拿掉，否則每一篇都會被誤報「結尾沒有標點」。
  const isTagLine = (line: string) => /[#＃]/.test(line) && !/[。！？，；：]/.test(line);
  const kept = trimmed.split("\n");
  while (kept.length && (!kept[kept.length - 1].trim() || isTagLine(kept[kept.length - 1]))) kept.pop();
  const ending = kept.join("\n").trim() || trimmed;
  if (ending.length > 120 && TRAILING_BAD.test(ending)) add("block", "truncated", "結尾停在逗號或冒號，文章可能被截斷");
  else if (ending.length > 120 && /[一-鿿]$/.test(ending)) add("warn", "no_end_punctuation", "結尾沒有標點，請確認文章是否完整");
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
  const voice = brandSubjectHits(body);
  if (voice.length) issues.push({ level: "warn", code: "brand_voice", message: `品牌名稱不可當主詞發言（例如「${voice[0].snippet}」），請改成艾瑞克的第一人稱或客觀陳述` });
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
  if (invented.length) issues.push({ level: "warn", code: "new_numbers", message: `出現母稿沒有的數字：${invented.slice(0, 5).join("、")}，可能是編造` });
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
/**
 * 標題好不好讀。只提醒不擋稿。
 *
 * 2026-10-29 實例：「簽下離婚協議那天，她把客廳十九年份的日曆一張張撕下來，沒有勇氣不是
 * 留下來的原因」。兩個否定詞疊在一起，加上三個短句黏成一長串，要讀三遍才知道在說什麼。
 * 標題是讀者唯一一定會看到的那一行，所以單獨檢查它。
 */
const TITLE_NEGATIONS = /不是|不會|不能|不用|沒有|不必|並非|未必/g;

export function hardToReadTitle(text: string): string {
  const title = String(text || "").split("\n").map((line) => line.trim()).find(Boolean) || "";
  if (!title) return "";
  TITLE_NEGATIONS.lastIndex = 0;
  const negations = title.match(TITLE_NEGATIONS) || [];
  const clauses = title.split(/[，,、]/).map((part) => part.trim()).filter(Boolean);
  if (negations.length >= 2) return `標題有兩個否定詞（${[...new Set(negations)].join("、")}），讀者要讀兩遍才懂，建議正面說`;
  if (clauses.length >= 3) return `標題有 ${clauses.length} 個短句黏成一串，建議收到兩句以內`;
  if (title.length > 42) return `標題 ${title.length} 字偏長，建議收到 40 字以內`;
  return "";
}

export function runQualityGate(text: string, options: GateOptions): GateIssue[] {
  const issues = [...checkGarbled(text), ...checkFormat(text, options.platform)];
  // 標題只在 FB 主稿與官網文章有意義，社群短稿與圖卡沒有獨立標題
  if (options.platform === "facebook" || options.platform === "website") {
    const titleIssue = hardToReadTitle(text);
    if (titleIssue) issues.push({ level: "warn", code: "title_readability", message: titleIssue });
  }
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
export function enforceCopyRules(text: string, platform: GatePlatform, master?: string): { text: string; fixes: string[]; blockers: GateIssue[]; warnings: GateIssue[]; voice: VoiceReport } {
  const fixed = applyMechanicalFixes(String(text || ""));
  const issues = runQualityGate(fixed.text, { platform, master });
  return { text: fixed.text, fixes: fixed.fixes, blockers: gateBlockers(issues), warnings: gateWarnings(issues), voice: voiceReport(fixed.text) };
}

export interface VoiceReport {
  /** 品牌當主詞的違規片段。空陣列代表說話的人沒問題。 */
  hits: string[];
  /** 機械式修正後的建議版本。沒有違規時等於原文。 */
  suggestion: string;
}

/**
 * 說話的人專用報告，給編輯 AI（Paperclip）與 n8n 用。
 *
 * 發布閘把 brand_voice 列為 warn，是為了不讓既有已排程的舊稿整批發不出去；
 * 但審稿階段這條是必改項，所以另外給一份獨立報告，審稿端只要看 hits 是不是空的。
 */
export function voiceReport(text: string, brandId?: string): VoiceReport {
  const body = String(text || "");
  const hits = brandSubjectHits(body, brandId).map((hit) => hit.snippet);
  return { hits, suggestion: hits.length ? rewriteBrandSubject(body, brandId).text : body };
}
