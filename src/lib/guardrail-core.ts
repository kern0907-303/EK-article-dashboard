export type BrandContext = "first_tier" | "ABL" | "NAS" | "I8" | "erick";
export type FunnelLayer = "cold" | "warm" | "hot";
export type GuardrailLevel = "block" | "warn";
export type GuardrailCategory =
  | "medical-claim"
  | "hard-redline"
  | "commitment-exaggeration"
  | "brand-language"
  | "funnel-warning"
  | "required-material";

export interface GuardrailHit {
  word: string;
  sentence: string;
  category: GuardrailCategory;
  level: GuardrailLevel;
  forceable: boolean;
  negated: boolean;
}

export interface GuardrailEvaluation {
  context: BrandContext;
  hits: GuardrailHit[];
  blockingHits: GuardrailHit[];
  warningHits: GuardrailHit[];
  passed: boolean;
  canForce: boolean;
  violatedWords: string[];
  warnings: string[];
}

type Rule = {
  word: string;
  category: GuardrailCategory;
  level: GuardrailLevel;
  forceable: boolean;
  applies: (context: BrandContext) => boolean;
  legacyGenreBlock?: boolean;
};

const MEDICAL_TERMS = ["療效承諾", "保證改善", "療效", "根治", "包治", "治癒", "治療"];
const HARD_TERMS: Record<BrandContext, string[]> = {
  first_tier: ["高票價", "無痛成交", "能量磁場"],
  erick: ["高票價", "無痛成交", "能量磁場"],
  ABL: ["高票價", "無痛成交", "能量磁場"],
  NAS: ["能量磁場"],
  I8: ["高票價", "無痛成交", "能量磁場"],
};
const I8_EXISTING_BLOCKS = [
  "靈性", "頻率", "能量場", "顯化", "命運", "療癒", "調頻", "改命",
  "保證", "絕對有效", "科學化診斷", "客觀評估模型",
];
const COMMITMENT_WARN_TERMS = [
  "保證", "改命", "開運", "消業障", "立刻翻轉", "百分百有效", "絕對準", "能量清理", "淨化", "療癒一切",
];
const BRAND_LANGUAGE_WARN_TERMS = ["信息場", "頻率", "調頻"];
const LEGACY_GENRE_BLOCK_TERMS = [
  "治療", "療效", "保證改善", "治癒", "改命", "開運", "消業障", "立刻翻轉",
  "百分百有效", "絕對準", "能量清理", "淨化", "療癒一切",
];
const NEGATION_TERMS = [
  "不會", "不能", "不是", "並非", "無法", "不代表", "不保證", "不等於", "沒有", "不可能", "不要", "別",
];
const COLD_TERMS = ["TimeWaver", "調頻", "信息場"];
const WARM_TERMS = ["TimeWaver"];

const rules: Rule[] = [
  ...MEDICAL_TERMS.map((word): Rule => ({
    word,
    category: "medical-claim",
    level: "block",
    forceable: false,
    applies: () => true,
    legacyGenreBlock: ["治療", "療效", "保證改善", "治癒"].includes(word),
  })),
  ...Object.entries(HARD_TERMS).flatMap(([context, words]) => words.map((word): Rule => ({
    word,
    category: "hard-redline",
    level: "block",
    forceable: context !== "I8",
    applies: (brand) => brand === context,
  }))),
  ...COMMITMENT_WARN_TERMS.map((word): Rule => ({
    word,
    category: "commitment-exaggeration",
    level: "warn",
    forceable: true,
    applies: (context) => context !== "I8",
    legacyGenreBlock: LEGACY_GENRE_BLOCK_TERMS.includes(word),
  })),
  ...BRAND_LANGUAGE_WARN_TERMS.map((word): Rule => ({
    word,
    category: "brand-language",
    level: "warn",
    forceable: true,
    applies: (context) => context === "first_tier" || context === "erick" || context === "NAS",
  })),
  ...I8_EXISTING_BLOCKS.map((word): Rule => ({
    word,
    category: "hard-redline",
    level: "block",
    forceable: false,
    applies: (context) => context === "I8",
  })),
];

export function resolveGuardrailBrandContext(brandId: string): BrandContext {
  const id = (brandId || "").toLowerCase();
  if (id.includes("abl")) return "ABL";
  if (id.includes("nas")) return "NAS";
  if (id.includes("i8")) return "I8";
  if (id.includes("erick") || id.includes("personal")) return "erick";
  return "first_tier";
}

function splitSentences(text: string): string[] {
  return text.split(/(?<=[。！？!?；])|\n/).map((sentence) => sentence.trim()).filter(Boolean);
}

function isNegated(sentence: string, start: number, length: number): boolean {
  const before = Array.from(sentence.slice(0, start)).slice(-8).join("");
  const window = before + sentence.slice(start, start + length);
  return NEGATION_TERMS.some((term) => window.includes(term));
}

function isInsideExcludedBrandName(sentence: string, start: number, length: number): boolean {
  const excludedName = "艾伯林量子調頻";
  let nameStart = sentence.indexOf(excludedName);
  while (nameStart >= 0) {
    const nameEnd = nameStart + excludedName.length;
    if (start >= nameStart && start + length <= nameEnd) return true;
    nameStart = sentence.indexOf(excludedName, nameStart + excludedName.length);
  }
  return false;
}

function toWarningMessage(hit: GuardrailHit): string {
  const category = {
    "medical-claim": "醫療宣稱",
    "hard-redline": "品牌硬紅線",
    "commitment-exaggeration": "承諾與誇大",
    "brand-language": "品牌語言層",
    "funnel-warning": "流量層警告",
    "required-material": "待補素材標記",
  }[hit.category];
  return `「${hit.sentence}」命中「${hit.word}」，屬於${category}提醒，可忽略。`;
}

function toBlockMessage(hit: GuardrailHit): string {
  const category = {
    "medical-claim": "醫療宣稱",
    "hard-redline": "品牌硬紅線",
    "commitment-exaggeration": "承諾與誇大",
    "brand-language": "品牌語言層",
    "funnel-warning": "流量層警告",
    "required-material": "待補素材標記",
  }[hit.category];
  return `「${hit.sentence}」命中「${hit.word}」，屬於${category}，必須先修改。`;
}

/** Pure shared matcher for browser previews and server enforcement. */
export function evaluateGuardrails(
  text: string,
  brand: BrandContext | string = "first_tier",
  funnel?: FunnelLayer,
): GuardrailEvaluation {
  const context = (["first_tier", "ABL", "NAS", "I8", "erick"] as string[]).includes(brand)
    ? brand as BrandContext
    : resolveGuardrailBrandContext(brand);
  const hits: GuardrailHit[] = [];
  const sentences = splitSentences(text || "");

  for (const sentence of sentences) {
    for (const rule of rules) {
      if (!rule.applies(context)) continue;
      let from = 0;
      while (from <= sentence.length - rule.word.length) {
        const start = sentence.toLocaleLowerCase().indexOf(rule.word.toLocaleLowerCase(), from);
        if (start < 0) break;
        if (rule.category === "brand-language" && isInsideExcludedBrandName(sentence, start, rule.word.length)) {
          from = start + Math.max(1, rule.word.length);
          continue;
        }
        const negated = isNegated(sentence, start, rule.word.length);
        hits.push({
          word: rule.word,
          sentence,
          category: rule.category,
          level: rule.level,
          forceable: rule.forceable,
          negated,
        });
        from = start + Math.max(1, rule.word.length);
      }
    }

    const markerPattern = /【需補[^】]*(?:】|$)/g;
    for (const match of sentence.matchAll(markerPattern)) {
      hits.push({
        word: match[0],
        sentence,
        category: "required-material",
        level: "block",
        forceable: false,
        negated: false,
      });
    }

    if (funnel) {
      const funnelTerms = funnel === "cold" ? COLD_TERMS : funnel === "warm" ? WARM_TERMS : [];
      for (const word of funnelTerms) {
        let from = 0;
        while (from <= sentence.length - word.length) {
          const start = sentence.toLocaleLowerCase().indexOf(word.toLocaleLowerCase(), from);
          if (start < 0) break;
          hits.push({
            word,
            sentence,
            category: "funnel-warning",
            level: "warn",
            forceable: true,
            negated: isNegated(sentence, start, word.length),
          });
          from = start + Math.max(1, word.length);
        }
      }
    }
  }

  // A word can be both a brand-language and a funnel warning. Keep one row per
  // occurrence, preferring the more specific brand category for a clean UI.
  const hitMap = new Map<string, GuardrailHit>();
  for (const hit of hits) {
    const key = `${hit.word}\u0000${hit.sentence}\u0000${hit.level}\u0000${hit.negated}`;
    const existing = hitMap.get(key);
    if (!existing || (existing.category === "brand-language" && hit.category === "funnel-warning")) hitMap.set(key, hit);
  }
  const uniqueHits = [...hitMap.values()];
  const activeHits = uniqueHits.filter((hit) => !hit.negated);
  const blockingHits = activeHits.filter((hit) => hit.level === "block");
  const warningHits = activeHits.filter((hit) => hit.level === "warn");
  const canForce = blockingHits.length > 0 && blockingHits.every((hit) => hit.forceable);

  return {
    context,
    hits: uniqueHits,
    blockingHits,
    warningHits,
    passed: blockingHits.length === 0,
    canForce,
    violatedWords: [...new Set(blockingHits.map((hit) => hit.word))],
    warnings: [...new Set(warningHits.map(toWarningMessage))],
  };
}

/** Compatibility list consumed by derivatives-genre; its prior blocking behavior stays unchanged. */
export function getGenreForbiddenWords(): string[] {
  return [...new Set(rules.filter((rule) => rule.legacyGenreBlock).map((rule) => rule.word))];
}

export function formatGuardrailBlock(hit: GuardrailHit): string {
  return toBlockMessage(hit);
}

export function formatGuardrailWarning(hit: GuardrailHit): string {
  return toWarningMessage(hit);
}
