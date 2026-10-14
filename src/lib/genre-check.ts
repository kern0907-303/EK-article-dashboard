// 文體文章的自動檢查。
// 擋住發佈（block）：禁用詞、【需補】。
// 只提醒（warn）：Markdown 符號、冷／溫流量的謹慎詞、段落過長、字數不在建議區間。

import { GENRES, type GenreMeta } from "@/data/skills/genres";
import {
  evaluateGuardrails,
  formatGuardrailBlock,
  formatGuardrailWarning,
  getGenreForbiddenWords,
  type BrandContext,
  type GuardrailHit,
} from "@/lib/guardrail-core";

export interface GenreIssue {
  level: "block" | "warn";
  code: string;
  message: string;
  word?: string;
  sentence?: string;
  category?: string;
  forceable?: boolean;
  negated?: boolean;
}

export type GenreIssues = GenreIssue[] & { guardrailHits: GuardrailHit[] };

// 舊有衍生稿檢查器仍讀取此相容匯出；實際文體檢查改由共用核心判定。
export const FORBIDDEN_WORDS = getGenreForbiddenWords();

/** 不含空白的字元數 */
export function countChars(text: string): number {
  return text.replace(/\s+/g, "").length;
}

/** 估算段落在畫面上會佔幾行（一行約 28 字，換行符號也算一行） */
function estimateLines(paragraph: string): number {
  return paragraph
    .split("\n")
    .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.trim().length / 28)), 0);
}

/**
 * platform：目前檢視的平台。字數區間與長段落只針對 Facebook 長文檢查（Threads、IG 是改寫後的短版）。
 * Threads、IG 另有各自的平台規則（字數上限、網址、標籤數），只在明確指定該平台時才檢查；沒指定平台時行為與以前相同。
 */
export function checkGenreText(
  text: string,
  meta: GenreMeta,
  platform?: string,
  brand: BrandContext | string = "first_tier",
): GenreIssues {
  const issues = [] as unknown as GenreIssues;
  Object.defineProperty(issues, "guardrailHits", { value: [], enumerable: false, configurable: true });
  const body = (text || "").trim();
  if (!body) return issues;
  // 生成中／失敗的提示字樣不檢查
  if (/^(⏳|❌|⚠️)/.test(body)) return issues;

  // 1. 品牌、文體與流量層詞彙統一由共用核心判定；否定命中保留於 guardrailHits，畫面不顯示。
  const guardrails = evaluateGuardrails(body, brand, meta.funnel);
  Object.defineProperty(issues, "guardrailHits", { value: guardrails.hits, enumerable: false, configurable: true });
  for (const hit of guardrails.hits.filter((item) => !item.negated)) {
    const isNeedFill = hit.category === "required-material";
    issues.push({
      level: hit.level,
      code: isNeedFill ? "need-fill" : hit.category === "funnel-warning" ? "funnel-terms" : "forbidden",
      message: isNeedFill ? `${formatGuardrailBlock(hit)}【需補】內容必須補上或移除後才能發佈。` :
        hit.level === "block" ? formatGuardrailBlock(hit) : formatGuardrailWarning(hit),
      word: hit.word,
      sentence: hit.sentence,
      category: hit.category,
      forceable: hit.forceable,
      negated: hit.negated,
    });
  }

  // 3. Markdown 符號（提醒）
  if (/\*\*|^\s{0,3}#{1,6}\s/m.test(body)) {
    issues.push({
      level: "warn",
      code: "markdown",
      message: "內文含有 ** 或 ## 這類 Markdown 符號，貼到社群平台會變亂碼，請刪除。",
    });
  }

  // 4. 最長段落（提醒）
  const paragraphs = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  let worst = { lines: 0, head: "" };
  for (const p of paragraphs) {
    const n = estimateLines(p);
    if (n > worst.lines) worst = { lines: n, head: p.slice(0, 14) };
  }
  if (worst.lines > 3 && (!platform || platform === "facebook")) {
    issues.push({
      level: "warn",
      code: "long-paragraph",
      message: `有段落約 ${worst.lines} 行（超過 3 行），開頭是「${worst.head}…」，建議拆短。`,
    });
  }

  // 5. 字數區間（提醒）
  const def = GENRES[meta.genre];
  if (def && (!platform || platform === "facebook")) {
    const n = countChars(body);
    const [lo, hi] = def.lengthRange;
    if (n < lo || n > hi) {
      issues.push({
        level: "warn",
        code: "length",
        message: `${def.name}建議 ${lo}–${hi} 字，目前約 ${n} 字。`,
      });
    }
  }

  // 6. Threads、IG 的平台規則（提醒；沒指定平台時不檢查，Facebook 規則不受影響）
  if (platform === "threads" || platform === "instagram") {
    issues.push(...checkShortPlatformRules(body, platform));
  }

  return issues;
}

const THREADS_LIMIT = 500;
const INSTAGRAM_LIMIT = 2200;
const URL_PATTERN = /https?:\/\/[^\s]+/g;

function checkShortPlatformRules(body: string, platform: "threads" | "instagram"): GenreIssue[] {
  const issues: GenreIssue[] = [];
  // 字數用 body.length，與輸入框的計數一致
  const limit = platform === "threads" ? THREADS_LIMIT : INSTAGRAM_LIMIT;
  const label = platform === "threads" ? "Threads" : "Instagram";
  if (body.length > limit) {
    issues.push({
      level: "warn",
      code: "platform-limit",
      message: `${label} 上限 ${limit} 字，目前 ${body.length} 字，超過 ${body.length - limit} 字。`,
    });
  }

  const hasUrl = (body.match(URL_PATTERN) || []).length > 0;
  if (platform === "threads" && hasUrl) {
    issues.push({
      level: "warn",
      code: "threads-url",
      message: "Threads 正文放外部網址會被降低觸及，建議改成「連結放在留言區第一則」。",
    });
  }

  if (platform === "instagram") {
    const tags = (body.replace(URL_PATTERN, "").match(/#[^\s#]+/g) || []).length;
    if (tags < 5 || tags > 15) {
      issues.push({
        level: "warn",
        code: "instagram-hashtags",
        message: `Instagram 建議結尾放 5 到 15 個標籤，目前有 ${tags} 個。`,
      });
    }
  }
  return issues;
}

export function blockingIssues(issues: GenreIssue[]): GenreIssue[] {
  return issues.filter((i) => i.level === "block" && !i.negated);
}
