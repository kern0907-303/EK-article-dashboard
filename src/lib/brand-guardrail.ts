// 品牌紅線檢查（BrandGuardrail）
//
// 移植自 src/orchestrator/guardrail.py。原本這套規則只存在於 Python 側，
// 而 Python 與 Next.js 儀表板零互通，導致 Maya 產出的文案可以完全繞過
// 檢查直接發布——包含 ABL 的「療效／根治／治癒」這類在台灣可能觸法的用詞。
//
// 這個檔案讓紅線檢查在發布路徑上實際生效。Python 版保留不動，
// 兩邊規則若要修改請同步更新。

import {
  evaluateGuardrails,
  resolveGuardrailBrandContext,
  type BrandContext,
  type FunnelLayer,
  type GuardrailHit,
} from "@/lib/guardrail-core";
export type { BrandContext } from "@/lib/guardrail-core";

/** 禁用詞的安全替代說法 */
const REPLACEMENTS: Record<string, string> = {
  能量磁場: "狀態",
  信息場: "內在狀態",
  能量場: "內在狀態",
  頻率: "狀態",
  調頻: "調整狀態",
  高票價: "高價值",
  無痛成交: "精準定位",
  顯化: "具體呈現",
  療癒: "支持與舒緩",
  靈性: "內在意識",
  療效: "改善與支持",
  治癒: "舒緩與安定",
  // Python 版缺這三個，會 fallback 成「狀態」而產生不通順的句子
  // （例：「這個療程可以*狀態*你的失眠問題」），故補上動詞性的替代。
  根治: "改善",
  包治: "支持",
  療效承諾: "改善與支持",
};

/** 已知的高風險主題，整句改寫（優先於逐詞替換） */
const TOPIC_MAPPINGS: Array<[RegExp, string]> = [
  [/如何透過.*能量磁場.*無痛成交.*高票價.*/, "中年女性為什麼明明很努力，卻還是覺得狀態接不住？"],
  [/如何透過.*能量磁場.*無痛成交.*/, "不是妳不夠努力，而是妳的狀態已經長期過載。"],
  [/能量磁場與價值階梯/, "內在狀態與價值承接力"],
  [/成交高票價的核心祕訣/, "高價值定位與狀態穩定的核心祕訣"],
  [/無痛成交高階諮詢/, "精準定位並建立高價值諮詢"],
  [/顯化財富與靈性頻率調整/, "提升自我價值與狀態穩定"],
  [/能量場與顯化/, "內在狀態與具體呈現"],
  [/療癒與靈性/, "支持與內在意識"],
];

/** 前端品牌 ID（brand_a_i8 等）對應到紅線情境 */
export function resolveBrandContext(brandId: string): BrandContext {
  return resolveGuardrailBrandContext(brandId);
}

export interface GuardrailResult {
  passed: boolean;
  violatedWords: string[];
  context: BrandContext;
  hits: GuardrailHit[];
  blockingHits: GuardrailHit[];
  warningHits: GuardrailHit[];
  warnings: string[];
  canForce: boolean;
}

/** 掃描文字是否違反該品牌情境的紅線 */
export function checkText(text: string, context: BrandContext = "first_tier", funnel?: FunnelLayer): GuardrailResult {
  const result = evaluateGuardrails(text, context, funnel);
  return {
    passed: result.passed,
    violatedWords: result.violatedWords,
    context: result.context,
    hits: result.hits,
    blockingHits: result.blockingHits,
    warningHits: result.warningHits,
    warnings: result.warnings,
    canForce: result.canForce,
  };
}

/** 自動改寫成合規版本。先比對整句主題映射，再逐詞替換。 */
export function rewriteText(text: string, context: BrandContext = "first_tier"): string {
  // 1. 整句主題映射優先，命中即回傳
  for (const [pattern, replacement] of TOPIC_MAPPINGS) {
    if (pattern.test(text)) {
      return text.replace(pattern, replacement);
    }
  }

  // 2. 逐詞替換
  let rewritten = text;
  const forbidden = [...new Set(evaluateGuardrails(rewritten, context).blockingHits.map((hit) => hit.word))]
    .sort((a, b) => b.length - a.length);
  for (const word of forbidden) {
    if (rewritten.includes(word)) {
      rewritten = rewritten.split(word).join(REPLACEMENTS[word] || "狀態");
    }
  }

  // 3. ABL 額外收斂「能量」一詞
  if (context === "ABL" && rewritten.includes("能量")) {
    rewritten = rewritten.split("能量").join("狀態");
  }

  return rewritten;
}

/**
 * 發布前的統一檢查入口。
 * 回傳是否放行、違規詞、以及建議的合規版本。
 */
export function inspectForPublish(text: string, brandId: string, funnel?: FunnelLayer) {
  const context = resolveBrandContext(brandId);
  const result = checkText(text, context, funnel);
  return {
    ...result,
    suggestion: result.passed ? null : rewriteText(text, context),
  };
}
