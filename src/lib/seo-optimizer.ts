import { textHash } from "@/lib/web-article";
// 文章優化器（SEO / AEO / GEO）共用型別與純函式。
// 不含任何網路呼叫，前後端都能引用。

export type SeoArea = "seo" | "aeo" | "geo";

export interface SeoCheck {
  area: SeoArea;
  item: string;
  status: "ok" | "warn";
  note: string;
}

export interface SeoChange {
  what: string;
  why: string;
}

export interface SeoFaqItem {
  q: string;
  a: string;
}

export interface SeoOptimization {
  scores: { seo: number; aeo: number; geo: number };
  checks: SeoCheck[];
  title: string;
  meta_description: string;
  optimized_content: string;
  changes: SeoChange[];
  faq: SeoFaqItem[];
  geo_notes: string[];
  /** 優化後內容命中的品牌紅線詞（server 端檢查後填入） */
  guardrail_violations: string[];
  /** true 代表這是本地規則檢查（非 AI 大腦），結果較粗略 */
  is_local_check: boolean;
  /** 原文用同一套程式規則算出的分數（和 scores 的「優化後」對照） */
  scores_before?: { seo: number; aeo: number; geo: number };
}

/** FAQ 轉純文字：「Q：問題」「A：回答」成對，題與題之間空一行（格式需與官網 build-static-pages.js 的解析規則一致） */
export function faqToPlainText(faq: SeoFaqItem[]): string {
  return faq.map((f) => `Q：${f.q.trim()}\nA：${f.a.trim()}`).join("\n\n");
}

/**
 * 由結構化 FAQ 直接組出 JSON-LD（FAQPage），用程式組而不是讓 AI 寫，
 * 確保語法一定合法、內容一定與問答集一字不差。
 */
export function buildFaqJsonLd(faq: SeoFaqItem[], title?: string, description?: string): string {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    ...(title ? { name: title } : {}),
    ...(description ? { description } : {}),
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.q.trim(),
      acceptedAnswer: { "@type": "Answer", text: f.a.trim() },
    })),
  };
  return `<script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n</script>`;
}

/** 自動健檢（只評分、不改寫）的結果；for_hash 是被評分文章的雜湊，用來判斷是否已過期 */
export interface SeoScore {
  scores: { seo: number; aeo: number; geo: number };
  checks: SeoCheck[];
  /** 最該先處理的問題（最多 3 條） */
  top_issues: string[];
  for_hash: number;
  at: number;
  is_local_check: boolean;
  /** 評分引擎版本：rules-v1 = 程式規則（不用 AI，每次結果一致） */
  engine?: string;
}

/** 健檢的內容指紋：官網文章＋問答集＋結構化資料任一改變，分數就視為過期 */
export function healthHash(webArticle: string, faq?: string, schema?: string): number {
  return textHash(`${webArticle || ""}\u0001${faq || ""}\u0001${schema || ""}`);
}

/** 評分結果是否已過期（文章內容被改過）；沒有評分結果時回傳 true */
export function isScoreStale(score: { for_hash?: number } | undefined | null, currentHash: number): boolean {
  if (!score || score.for_hash === undefined) return true;
  return score.for_hash !== currentHash;
}

/**
 * 自動健檢要不要跑：開關開著、文章是真的內容、沒有同一份內容正在跑或剛失敗過。
 * 純函式，方便測試。
 */
export function shouldAutoCheck(opts: {
  enabled: boolean;
  isMock: boolean;
  hasContent: boolean;
  currentHash: number;
  savedHash?: number;
  attemptedHash?: number;
  inFlight: boolean;
}): boolean {
  if (!opts.enabled || opts.isMock || !opts.hasContent || opts.inFlight) return false;
  if (opts.savedHash === opts.currentHash) return false;
  if (opts.attemptedHash === opts.currentHash) return false;
  return true;
}
