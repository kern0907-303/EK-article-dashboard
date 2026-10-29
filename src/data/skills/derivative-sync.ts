// 衍生稿待同步狀態。
//
// 為什麼需要這個檔：FB 主稿換了之後，官網、IG、Threads 還是舊內容。原本沒有任何地方記住
// 「這幾個平台還沒跟上」，重新整理頁面就看不出來了，結果主稿改好、衍生稿一直是舊的。
// 這裡把它寫成 social_results.stale_platforms，主稿一換就寫進去，某個平台同步完就移掉它。
//
// 純資料與純函式，不連資料庫、不呼叫網路。

export const DERIVATIVE_PLATFORMS = ["website", "instagram", "threads"] as const;
export type DerivativePlatform = (typeof DERIVATIVE_PLATFORMS)[number];

export const DERIVATIVE_LABEL: Record<DerivativePlatform, string> = {
  website: "官網文章", instagram: "IG 輪播", threads: "Threads",
};

const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/** 這個任務目前有哪些衍生稿已經產生出來了。官網看的是排程列的 article_id，不是 social_results。 */
export function existingDerivatives(socialResults: unknown, hasWebsiteArticle: boolean): DerivativePlatform[] {
  const social = asObject(socialResults);
  const ok = (key: string): boolean => {
    const entry = asObject(social[key]);
    // ok===false 代表那次失敗了，沒有稿可以同步
    return key in social && entry.ok !== false;
  };
  const out: DerivativePlatform[] = [];
  if (hasWebsiteArticle) out.push("website");
  if (ok("instagram")) out.push("instagram");
  if (ok("threads")) out.push("threads");
  return out;
}

/** 讀出待同步清單，只回傳合法平台。 */
export function readStalePlatforms(socialResults: unknown): DerivativePlatform[] {
  const raw = asObject(socialResults).stale_platforms;
  if (!Array.isArray(raw)) return [];
  return DERIVATIVE_PLATFORMS.filter((platform) => raw.includes(platform));
}

/**
 * 主稿換了：把現有的衍生稿全部標成待同步。
 * 一併清掉 rules_version，讓重新優化頁的試算也會把它們列出來。
 * 回傳新的 social_results，不改原物件。
 */
export function markDerivativesStale(socialResults: unknown, hasWebsiteArticle: boolean): Record<string, unknown> {
  const next = { ...asObject(socialResults) };
  delete next.rules_version;
  const stale = existingDerivatives(socialResults, hasWebsiteArticle);
  if (stale.length) next.stale_platforms = stale;
  else delete next.stale_platforms;
  return next;
}

/** 某個平台同步完了：從待同步清單移掉它，其他平台不動。 */
export function clearStalePlatform(socialResults: unknown, platform: string): Record<string, unknown> {
  const next = { ...asObject(socialResults) };
  const left = readStalePlatforms(socialResults).filter((item) => item !== platform);
  if (left.length) next.stale_platforms = left;
  else delete next.stale_platforms;
  return next;
}
