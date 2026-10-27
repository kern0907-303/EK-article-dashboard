// 自動產文的共用核心：挑標題型與開場型、組提示詞、呼叫 AI、清理、檢查。
// 自動流水線（tick）與重新優化（reoptimize）共用同一份，避免兩條路規則走鐘。
// 只給伺服器端使用。這裡不碰資料庫寫入，由呼叫端決定要不要存。

import { callErickCOO, callSeoOptimizer } from "@/lib/ai-provider";
import { stripDashes, stripDiagramBlocks, stripMarkdown } from "@/lib/plain-text";
import { splitPostReminders } from "@/lib/post-reminders";
import { blockingIssues, checkGenreText } from "@/lib/genre-check";
import { PROMPT_VERSION, buildGenreDirective, readGenreFromPrompt } from "@/data/skills/genres";
import {
  buildTitleDirective, detectTitleStyle, pickTitleStyle, readTitleStyleFromPrompt,
  repeatedStyleWarning, TITLE_STYLES, type TitleStyleId,
} from "@/data/skills/title-styles";
import {
  bannedOpeningWarning, buildOpeningDirective, detectOpeningStyle, OPENING_STYLES,
  pickOpeningStyle, readOpeningStyleFromPrompt, repeatedOpeningWarning, type OpeningStyleId,
} from "@/data/skills/opening-styles";
import { buildSubheadDirective, subheadWarning } from "@/data/skills/subhead-rules";
import { amplifierFromText, pickAmplifier, readAmplifierFromPrompt, TITLE_AMPLIFIERS, type AmplifierId } from "@/data/skills/title-amplifiers";
import { applyMechanicalFixes, brandSubjectHits, gateBlockers, gateWarnings, rewriteBrandSubject, runQualityGate, unverifiedCitations, vagueResearchClaim } from "@/lib/quality-gate";
import { chooseKnowledgeSource } from "@/lib/derivatives-ai";
import { buildCitationDirective, type VerifiedCitation } from "@/data/skills/citation-rules";
import { brandVoiceSentences } from "@/lib/auto-multiplatform";
import { pipelineDb } from "@/lib/auto-pipeline-server";
import { cardHeadline } from "@/lib/article-image.mjs";
import { AUTO_PIPELINE_CARD_SIZE } from "@/lib/card-layout.mjs";
import { renderCardJpeg } from "@/lib/card-render-server";
import { uploadPublicJpeg } from "@/lib/social-image-server";

/**
 * 規則版本。改了標題型、開場型、小標規則或說話的人規則時要調高。
 * 會寫進任務的 warnings，用來分辨哪些已排程的文章還是用舊規則寫的。
 */
export const RULES_VERSION = "rules-2026-10-27d";
export const RULES_VERSION_PREFIX = "規則版本：";
export const rulesVersionNote = (version = RULES_VERSION): string => `${RULES_VERSION_PREFIX}${version}`;

/** 這篇稿子是不是用目前這版規則寫的 */
export function isCurrentRules(warnings: unknown): boolean {
  const list = Array.isArray(warnings) ? warnings : [];
  return list.some((item) => typeof item === "string" && item === rulesVersionNote());
}

export const VOICE_DIRECTIVE = [
  "【說話的人】這是整篇最重要的規則，違反就整篇作廢。",
  "文章是艾瑞克這個人在說話，不是品牌在說話。全文只能用兩種人稱：艾瑞克的第一人稱（我），或不指名的客觀陳述。",
  "品牌名稱只有兩種合法用法：當地點（「我在平衡空間帶過一個案子」），或當服務名稱（「平衡空間的生命數字」）。",
  "品牌名稱後面不可以接任何動詞，不管是哪個動詞都不行。也不可以用「我們」替品牌發言。標題裡不要出現品牌名稱。",
  "品牌名稱全文最多出現一次。",
  "錯誤寫法與正確寫法對照：",
  "「平衡空間想在這裡停一下，問一個問題」要寫成「我想在這裡停一下，問一個問題」",
  "「平衡空間邀請你問自己一個問題」要寫成「你可以問自己一個問題」",
  "「初八企業顧問談現金流分層管理」要寫成「現金流要分層管理」",
  "「艾伯林量子調頻提醒你」要寫成「這裡要提醒你」",
  "「平衡空間的生命數字，做的就是這件事」要寫成「生命數字做的就是這件事」",
  "只輸出社群貼文純文字，不要附流程圖、圖表或任何程式碼區塊。",
].join("\n");

export const BRAND_NAMES = { nas: "平衡空間", abl: "艾伯林量子調頻", i8: "初八企業顧問", erick: "Erick 個人品牌" } as const;
/** 取查證過的出處。知識庫暫時不可用時回 null，該篇就不准引用，不會因此失敗。 */
export async function loadCitationSource(topic: string): Promise<{ citation: VerifiedCitation | null; content: string }> {
  try {
    const source = await chooseKnowledgeSource(topic, process.env.AI_PROVIDER);
    return { citation: source.citation, content: source.content };
  } catch {
    return { citation: null, content: "" };
  }
}

export const brandNameOf = (brandId: string): string =>
  BRAND_NAMES[brandId as keyof typeof BRAND_NAMES] || "Erick 個人品牌";

export const firstLine = (text: unknown): string =>
  String(text || "").split("\n").map((line) => line.trim()).filter(Boolean)[0] || "";

/** 標題後面第一個有內容的段落，跳過單獨一行的小標 */
export const firstParagraph = (text: unknown): string => {
  const lines = String(text || "").split("\n").map((line) => line.trim()).filter(Boolean).slice(1);
  return lines.find((line) => line.length > 24 || /[。！？]/.test(line)) || lines[0] || "";
};

const CARD_BRAND_IDS: Record<string, string> = { nas: "brand_b_nas", abl: "brand_c_abl", i8: "brand_a_i8", erick: "personal_brand" };

/** 用文案第一行做 FB 橫式品牌圖卡。失敗只回傳 null，不影響排程。 */
export async function makeCardUrl(brandId: string, content: string): Promise<{ url: string | null; error?: string }> {
  try {
    const headline = cardHeadline(content);
    if (!headline) return { url: null, error: "找不到可放在圖卡上的標題" };
    const jpeg = await renderCardJpeg({ brandId: CARD_BRAND_IDS[brandId] || "personal_brand", text: headline, index: 1, total: 1, sceneDataUri: null, size: AUTO_PIPELINE_CARD_SIZE });
    return { url: await uploadPublicJpeg(jpeg, brandId) };
  } catch (error) {
    return { url: null, error: error instanceof Error ? error.message.slice(0, 120) : "圖卡失敗" };
  }
}

export const AMPLIFIER_PREFIX = "標題強化：";
export const amplifierNote = (id: AmplifierId): string => `${AMPLIFIER_PREFIX}${TITLE_AMPLIFIERS[id].name}`;
/** 從任務的 warnings 讀回上一次用了哪個強化手法 */
export function readAmplifierNote(warnings: unknown): AmplifierId | null {
  const list = Array.isArray(warnings) ? warnings : [];
  const hit = list.find((item) => typeof item === "string" && item.startsWith(AMPLIFIER_PREFIX));
  return typeof hit === "string" ? amplifierFromText(hit.slice(AMPLIFIER_PREFIX.length)) : null;
}

export interface StyleHistory {
  titles: Array<TitleStyleId | null>;
  openings: Array<OpeningStyleId | null>;
  amplifiers: Array<AmplifierId | null>;
}

/** 同品牌最近幾篇的標題與開場句型，由近到遠。讀不到就當作沒有，不影響生成。 */
export async function recentStyleHistory(brandId: string, excludeJobId?: string): Promise<StyleHistory> {
  try {
    const exclude = excludeJobId ? `&id=neq.${encodeURIComponent(excludeJobId)}` : "";
    const rows = await pipelineDb<any[]>("auto_pipeline_jobs", `brand_id=eq.${encodeURIComponent(brandId)}&draft_content=not.is.null&status=neq.cancelled${exclude}&order=scheduled_at.desc&limit=6&select=draft_content,warnings`);
    return {
      titles: rows.map((row) => detectTitleStyle(firstLine(row.draft_content))),
      openings: rows.map((row) => detectOpeningStyle(firstParagraph(row.draft_content))),
      amplifiers: rows.map((row) => readAmplifierNote(row.warnings)),
    };
  } catch { return { titles: [], openings: [], amplifiers: [] }; }
}

export interface StylePlan { titleStyle: TitleStyleId; openingStyle: OpeningStyleId; amplifier: AmplifierId; directive: string }

/** 決定這一篇用哪個標題型與開場型，並組出附加指令。題目階段指定的優先。 */
export function planStyles(prompt: string, seed: string, history: StyleHistory): StylePlan {
  const titleStyle = readTitleStyleFromPrompt(prompt) || pickTitleStyle(history.titles, seed);
  // 需要真實素材的開場型（引用權威、客戶原話）只有在提示詞帶了素材時才可能被挑中。
  // 「素材」兩個字太泛（「沒有附素材」也會中），只認明確的字樣，而且前面不能是否定詞。
  const hasMaterial = /(?<!(沒有|未|不|無|缺))(逐字稿|口述|原話|客戶說|學員說)/.test(String(prompt || ""));
  const openingStyle = readOpeningStyleFromPrompt(prompt) || pickOpeningStyle(history.openings, seed, hasMaterial);
  // 標題強化手法：Schwartz 的 38 種挑出 14 種，疊在標題型上面加力道，一次只用一個
  const amplifier = readAmplifierFromPrompt(prompt) || pickAmplifier(history.amplifiers, seed, titleStyle);
  const genre = readGenreFromPrompt(prompt);
  return {
    titleStyle, openingStyle, amplifier,
    directive: [
      buildTitleDirective(titleStyle, amplifier),
      buildOpeningDirective(openingStyle, titleStyle),
      buildSubheadDirective("facebook"),
      genre ? buildGenreDirective(genre) : "",
    ].filter(Boolean).join("\n\n"),
  };
}

export interface GenerateInput {
  brandId: string;
  prompt: string;
  seed: string;
  history: StyleHistory;
  /** 成效回流實驗的附加指令，沒有就不帶 */
  experimentDirective?: string;
  /** 生成完第一版、還沒做 SEO 優化時呼叫，讓流水線可以先把草稿存起來。回傳 false 代表中止。 */
  onFirstDraft?: (draft: string) => Promise<boolean>;
  retry: <T>(run: () => Promise<T>) => Promise<T>;
}

export interface GenerateResult {
  draft: string;
  postReminders: string[];
  styleNotes: string[];
  fixes: string[];
  warnNotes: string[];
  /** 不是空字串就代表擋下來了 */
  blockedReason: string;
  titleStyle: TitleStyleId;
  openingStyle: OpeningStyleId;
  amplifier: AmplifierId;
  guardrailHits: ReturnType<typeof checkGenreText>["guardrailHits"];
  cancelled?: true;
}

/**
 * 產出一篇 Facebook 主稿：
 * Maya 生成 → SEO 優化（社群模式）→ 機械式修正 → 品牌當主詞與禁用詞重寫（最多兩次）→ 文體與品管檢查。
 */
export async function generateFacebookDraft(input: GenerateInput): Promise<GenerateResult> {
  const { brandId, prompt, seed, history, experimentDirective, onFirstDraft, retry } = input;
  const brandName = brandNameOf(brandId);
  const plan = planStyles(prompt, seed, history);
  const base = experimentDirective ? `${prompt}\n\n${experimentDirective}` : prompt;
  const irisPrompt = `依據以下社群文案主題整理關鍵字，不得增加未提供事實：${prompt}`;
  // 引經據典只能用知識庫。拿不到出處就整篇禁止引用，不讓模型憑記憶補一本書上去。
  const source = await loadCitationSource(prompt);
  const citationDirective = buildCitationDirective(source.citation, source.content);

  const generated = await retry(async () => {
    const result = await callErickCOO([], brandName, process.env.AI_PROVIDER, "expert", "maya_iris", {
      maya: `${base}\n\n${plan.directive}\n\n${VOICE_DIRECTIVE}\n\n${citationDirective}`,
      iris: irisPrompt,
    }, undefined, undefined, "facebook");
    const text = result.dispatchData?.social_copy;
    if (typeof text !== "string" || !text.trim()) throw new Error("Maya 沒有回傳社群文案");
    const split = splitPostReminders(stripDashes(stripMarkdown(text)), result.dispatchData?.post_reminders);
    return { text: split.body, reminders: split.reminders };
  });
  let draft = generated.text;
  const postReminders = generated.reminders.map((item) => `發文前提醒（不在文章裡）：${item}`);

  if (onFirstDraft && !await onFirstDraft(draft)) {
    return {
      draft, postReminders, styleNotes: [], fixes: [], warnNotes: [], blockedReason: "",
      titleStyle: plan.titleStyle, openingStyle: plan.openingStyle, amplifier: plan.amplifier,
      guardrailHits: checkGenreText("", { genre: "breakdown", funnel: "warm", prompt_version: PROMPT_VERSION }).guardrailHits,
      cancelled: true,
    };
  }

  draft = await retry(async () => {
    const result = await callSeoOptimizer(draft, brandName, [], process.env.AI_PROVIDER, "facebook");
    if (!result.optimized_content?.trim()) throw new Error("SEO 優化器沒有回傳文案");
    return stripDashes(stripMarkdown(result.optimized_content));
  });
  let mechanical = applyMechanicalFixes(draft);
  draft = mechanical.text;

  // 品牌名稱當主詞或出現禁用詞：帶著問題句子重寫，最多再試三次，仍不過才做機械式修正
  for (let attempt = 0; attempt < 3; attempt++) {
    const offending = brandVoiceSentences(draft, brandId);
    const badCites = unverifiedCitations(draft, source.citation);
    const hardHits = blockingIssues(checkGenreText(draft, { genre: "breakdown", funnel: "warm", prompt_version: PROMPT_VERSION }, "facebook", brandId)).map((issue) => issue.message.slice(0, 80));
    if (!offending.length && !hardHits.length && !badCites.length) break;
    const revised = await retry(async () => {
      const result = await callErickCOO([], brandName, process.env.AI_PROVIDER, "expert", "maya_iris", {
        maya: `${base}\n\n${plan.directive}\n\n${VOICE_DIRECTIVE}\n\n【修改要求，不是原文】${offending.length ? `上一版出現品牌名稱當主詞的句子：${offending.join("｜")}。請全文重寫，這些句子改成艾瑞克的第一人稱或不指名的客觀陳述，品牌名稱全文最多出現一次且只當地點或服務名稱，標題也不要讓品牌名稱當主詞。` : ""}${hardHits.length ? `上一版有這些問題必須改掉：${hardHits.join("｜")}。請全文重寫，完全不要出現被指出的禁用詞，改用其他說法。` : ""}${badCites.length ? `上一版引用了不可以引用的書：${badCites.map((t) => `《${t}》`).join("、")}。這些書沒有經過查證，請全文重寫，完全拿掉這些引用與相關的文末出處。${source.citation ? `需要引用時只能引用《${source.citation.title}》。` : "這一篇不可以引用任何書籍。"}` : ""}`,
        iris: irisPrompt,
      }, undefined, undefined, "facebook");
      const text = result.dispatchData?.social_copy;
      if (typeof text !== "string" || !text.trim()) throw new Error("Maya 沒有回傳社群文案");
      return splitPostReminders(stripDashes(stripMarkdown(stripDiagramBlocks(text))), result.dispatchData?.post_reminders).body;
    });
    mechanical = applyMechanicalFixes(revised);
    draft = mechanical.text;
  }

  // 最後一道保險：AI 三次都沒改掉的話，句首品牌名直接換成第一人稱。
  // 只動文法上一定可以換的位置，所以不會改出不通的句子，也保證排出去的稿不是品牌在說話。
  if (brandSubjectHits(draft, brandId).length) {
    const voiceFix = rewriteBrandSubject(draft, brandId);
    draft = voiceFix.text;
    mechanical = { text: draft, fixes: [...mechanical.fixes, ...voiceFix.fixes] };
  }

  const meta = { genre: "breakdown" as const, funnel: "warm" as const, prompt_version: PROMPT_VERSION };
  const issues = checkGenreText(draft, meta, "facebook", brandId);
  const blocks = blockingIssues(issues);
  const gateIssues = runQualityGate(draft, { platform: "facebook" });
  const gateBlocks = gateBlockers(gateIssues);

  const finalTitle = detectTitleStyle(firstLine(draft));
  const finalOpening = detectOpeningStyle(firstParagraph(draft));
  const styleNotes = [
    finalTitle && finalTitle !== plan.titleStyle ? `本篇指定標題型「${TITLE_STYLES[plan.titleStyle].name}」，實際寫出來比較像「${TITLE_STYLES[finalTitle].name}」。` : "",
    repeatedStyleWarning(finalTitle, history.titles),
    finalOpening && finalOpening !== plan.openingStyle ? `本篇指定開場型「${OPENING_STYLES[plan.openingStyle].name}」，實際寫出來比較像「${OPENING_STYLES[finalOpening].name}」。` : "",
    repeatedOpeningWarning(finalOpening, history.openings),
    bannedOpeningWarning(firstParagraph(draft)),
    subheadWarning(draft, "facebook"),
    vagueResearchClaim(draft) ? `出現沒有指名出處的說法「${vagueResearchClaim(draft)}」，確認是不是要改成具體來源或拿掉。` : "",
    source.citation ? `本篇可引用的出處：《${source.citation.title}》，${source.citation.author}` : "本篇沒有取到知識庫出處，已禁止引用",
  ].filter(Boolean);

  const leftover = draft.match(/【需補[^】]*】/g);
  // 引用沒查證過就不發。這是硬規則：寧可這一篇不出去，也不要掛一本沒讀過的書。
  const uncited = unverifiedCitations(draft, source.citation);
  const blockedReason = leftover?.length
    ? `文案含未補的標記 ${[...new Set(leftover)].join("、")}，請補上依據或刪除後再發`
    : uncited.length
    ? `引用了未經查證的來源：${uncited.map((title) => `《${title}》`).join("、")}。引經據典只能用知識庫裡的書，請重新生成`
    : [...blocks.map((issue) => issue.message), ...gateBlocks.map((issue) => `品管：${issue.message}`)].join("；");

  return {
    draft, postReminders, styleNotes,
    fixes: mechanical.fixes,
    warnNotes: [...issues.filter((issue) => issue.level === "warn").map((issue) => issue.message), ...gateWarnings(gateIssues).map((issue) => issue.message)],
    blockedReason, titleStyle: plan.titleStyle, openingStyle: plan.openingStyle, amplifier: plan.amplifier,
    guardrailHits: issues.guardrailHits,
  };
}
