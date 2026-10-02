// 文體文章的自動檢查。
// 擋住發佈（block）：禁用詞、【需補】。
// 只提醒（warn）：Markdown 符號、冷／溫流量的謹慎詞、段落過長、字數不在建議區間。

import { GENRES, FUNNEL_LABEL, type GenreMeta } from "@/data/skills/genres";

export interface GenreIssue {
  level: "block" | "warn";
  code: string;
  message: string;
}

export const FORBIDDEN_WORDS = [
  "治療", "療效", "保證改善", "治癒", "改命", "開運", "消業障", "立刻翻轉",
  "百分百有效", "絕對準", "能量清理", "淨化", "療癒一切",
];

const COLD_TERMS = ["TimeWaver", "調頻", "信息場"];
const WARM_TERMS = ["TimeWaver"];

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

/** platform：目前檢視的平台。字數區間與長段落只針對 Facebook 長文檢查（Threads、IG 是改寫後的短版） */
export function checkGenreText(text: string, meta: GenreMeta, platform?: string): GenreIssue[] {
  const issues: GenreIssue[] = [];
  const body = (text || "").trim();
  if (!body) return issues;
  // 生成中／失敗的提示字樣不檢查
  if (/^(⏳|❌|⚠️)/.test(body)) return issues;

  // 1. 禁用詞（擋住）
  const hitWords = FORBIDDEN_WORDS.filter((w) => body.includes(w));
  if (hitWords.length > 0) {
    issues.push({
      level: "block",
      code: "forbidden",
      message: `出現禁用詞：${hitWords.join("、")}。請改寫後才能發佈。`,
    });
  }

  // 2. 【需補】（擋住）
  const needCount = (body.match(/【需補/g) || []).length;
  if (needCount > 0) {
    issues.push({
      level: "block",
      code: "need-fill",
      message: `還有 ${needCount} 處【需補】沒有補上素材。補完並刪掉標記後才能發佈。`,
    });
  }

  // 3. Markdown 符號（提醒）
  if (/\*\*|^\s{0,3}#{1,6}\s/m.test(body)) {
    issues.push({
      level: "warn",
      code: "markdown",
      message: "內文含有 ** 或 ## 這類 Markdown 符號，貼到 Facebook 會變亂碼，請刪除。",
    });
  }

  // 4. 冷／溫流量的謹慎詞（提醒）
  const terms = meta.funnel === "cold" ? COLD_TERMS : meta.funnel === "warm" ? WARM_TERMS : [];
  const hitTerms = terms.filter((t) => body.toLowerCase().includes(t.toLowerCase()));
  if (hitTerms.length > 0) {
    issues.push({
      level: "warn",
      code: "funnel-terms",
      message: `${FUNNEL_LABEL[meta.funnel]}流量文章不該出現：${hitTerms.join("、")}。`,
    });
  }

  // 5. 最長段落（提醒）
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

  // 6. 字數區間（提醒）
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

  return issues;
}

export function blockingIssues(issues: GenreIssue[]): GenreIssue[] {
  return issues.filter((i) => i.level === "block");
}
