// 文章內搜尋與紅線詞整理。純函式，方便測試。

/** 找出關鍵字在文章中每一次出現的起點（不分大小寫，不重疊）。 */
export function findAll(text: string, query: string): number[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const hay = text.toLowerCase();
  const found: number[] = [];
  let from = 0;
  for (;;) {
    const at = hay.indexOf(needle, from);
    if (at < 0) break;
    found.push(at);
    from = at + needle.length;
  }
  return found;
}

/** 從系統回報的阻擋說明中抽出被點名的詞，例如「…」命中「靈性」，屬於… → 靈性 */
export function extractRedlineWords(messages: string[]): string[] {
  const words: string[] = [];
  for (const message of messages) {
    for (const match of message.matchAll(/命中「([^」]{1,20})」/g)) words.push(match[1]);
    for (const match of message.matchAll(/未補的標記\s*([^，。；]+)/g)) for (const part of match[1].split("、")) if (part.trim()) words.push(part.trim());
    for (const match of message.matchAll(/未通過品牌紅線：([^；]+)/g)) for (const part of match[1].split("、")) if (part.trim()) words.push(part.trim());
    for (const match of message.matchAll(/（例如「([^」]{1,20})」）/g)) words.push(match[1]);
  }
  return [...new Set(words)];
}

/** 每個詞在文章中出現幾次，沒出現的排後面。 */
export function countWords(text: string, words: string[]): Array<{ word: string; count: number }> {
  return words.map((word) => ({ word, count: findAll(text, word).length })).sort((a, b) => Number(b.count > 0) - Number(a.count > 0));
}
