// 品牌錯置檢查：在你「目前品牌」底下，指令、主張、素材或原文卻明顯在講另一個品牌時，生成前先提醒。
// 純函式，前端（ChatBox / WorkspaceBoard）與後端（/api/chat）共用。
// 只認「很專屬」的品牌識別詞，不用泛用詞（例如「決策」「關係」），避免誤報。

export type GuardBrandKey = "erick" | "nas" | "abl" | "i8";

export const GUARD_BRAND_LABEL: Record<GuardBrandKey, string> = {
  erick: "Erick 個人品牌",
  nas: "NAS 平衡空間",
  abl: "ABL 量子調頻",
  i8: "I8 企業決策校準",
};

const SIGNALS: Record<GuardBrandKey, RegExp[]> = {
  i8: [/\bI8\b/i, /Initial\s*8/i, /初八/, /企業醫生/, /企業決策校準/],
  nas: [/\bNAS\b/, /平衡空間/, /noage/i, /生命數字/, /生命靈數/],
  abl: [/\bABL\b/, /abliene/i, /艾伯林/, /量子調頻/, /狀態調和/, /信息場分析/],
  erick: [/Erick\s*個人品牌/i, /Erick\s*關鍵因素諮詢/i, /個人方向校準/],
};

const KEYS = Object.keys(SIGNALS) as GuardBrandKey[];

export interface BrandMismatch {
  /** 目前品牌 */
  expected: GuardBrandKey;
  /** 文字裡實際在講的品牌 */
  found: GuardBrandKey;
  /** 命中的識別詞 */
  hits: string[];
  /** 哪一段文字（給使用者看的來源名稱） */
  source: string;
}

/** 回傳每個品牌在文字裡命中的識別詞（去重） */
export function detectBrandSignals(text: string): Record<GuardBrandKey, string[]> {
  const out = { erick: [], nas: [], abl: [], i8: [] } as Record<GuardBrandKey, string[]>;
  const s = text || "";
  for (const k of KEYS) {
    const hits = new Set<string>();
    for (const re of SIGNALS[k]) {
      const m = s.match(re);
      if (m) hits.add(m[0]);
    }
    out[k] = Array.from(hits);
  }
  return out;
}

/**
 * 文字只提到別的品牌、完全沒提目前品牌 → 判定錯置。
 * 兩個品牌都有提到（例如比較、導流）視為正常，不攔。
 */
export function findTextMismatch(text: string, current: GuardBrandKey, source: string): BrandMismatch | null {
  if (!text || !text.trim()) return null;
  const sig = detectBrandSignals(text);
  if (sig[current].length > 0) return null;
  let best: GuardBrandKey | null = null;
  for (const k of KEYS) {
    if (k === current || sig[k].length === 0) continue;
    if (!best || sig[k].length > sig[best].length) best = k;
  }
  if (!best) return null;
  return { expected: current, found: best, hits: sig[best], source };
}

export function isGuardBrandKey(v: unknown): v is GuardBrandKey {
  return v === "erick" || v === "nas" || v === "abl" || v === "i8";
}

/** 給使用者看的提醒文字 */
export function describeMismatch(m: BrandMismatch): string {
  return `「${m.source}」提到了「${m.hits.join("、")}」，看起來是 ${GUARD_BRAND_LABEL[m.found]} 的內容，但你現在在 ${GUARD_BRAND_LABEL[m.expected]}。`;
}

/** 伺服器端：掃描 /api/chat 的請求內容，找出第一個錯置 */
export function scanChatPayload(
  p: {
    history?: Array<{ role?: string; content?: string }>;
    subPrompts?: { maya?: string } | null;
    genre?: { settings?: { claim?: string; material?: string } } | null;
    prevData?: { social_copy?: string } | null;
    brandGuidelines?: string;
  },
  current: GuardBrandKey
): BrandMismatch | null {
  const lastUser = [...(p.history || [])].reverse().find((m) => m && m.role === "user");
  const checks: Array<[string | undefined, string]> = [
    [lastUser?.content, "你的指令"],
    [typeof p.subPrompts?.maya === "string" ? p.subPrompts.maya : undefined, "派給 Maya 的任務"],
    [p.genre?.settings?.claim, "主張"],
    [p.genre?.settings?.material, "素材"],
    [p.prevData?.social_copy, "要改寫的原文"],
    // 品牌規範只看開頭：開頭是在說「這是哪個品牌」，後面可能合理提到其他品牌
    [typeof p.brandGuidelines === "string" ? p.brandGuidelines.slice(0, 600) : undefined, "品牌規範"],
  ];
  for (const [text, source] of checks) {
    if (!text) continue;
    const m = findTextMismatch(text, current, source);
    if (m) return m;
  }
  return null;
}
