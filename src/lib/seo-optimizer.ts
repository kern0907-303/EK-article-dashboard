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
}

/** FAQ 轉純文字：Q1：問題 / A1：回答，題與題之間空一行 */
export function faqToPlainText(faq: SeoFaqItem[]): string {
  return faq.map((f, i) => `Q${i + 1}：${f.q.trim()}\nA${i + 1}：${f.a.trim()}`).join("\n\n");
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
