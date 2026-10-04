// 官網文章與社群貼文分開存放的共用小工具（純函式，方便測試）。

/** 簡單字串雜湊，用來判斷「官網文章產生之後，社群貼文有沒有被改過」 */
export function textHash(s: string): number {
  let h = 5381;
  const str = s || "";
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return h >>> 0;
}

export interface WebArticleMeta {
  generated_at?: number;
  edited_at?: number;
  /** 產生官網文章時，社群貼文內容的雜湊 */
  from_hash?: number;
  /** 產生官網文章時使用的是哪個平台分頁的貼文（threads / facebook / instagram） */
  from_platform?: string;
}

/** 拿掉只有 hashtag 的行（社群貼文結尾的標籤，官網文章不需要） */
export function dropHashtagLines(input: string): string {
  return (input || "")
    .split("\n")
    .filter((l) => !/^\s*(#[^\s#]+[\s　]*)+$/.test(l))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const isRealText = (s?: string) =>
  !!s && s.trim().length >= 30 && !s.startsWith("⏳") && !s.startsWith("❌") && !s.startsWith("⚠️");

export const hasWebArticle = (webArticle?: string) => isRealText(webArticle);
export const hasSocialCopy = (socialCopy?: string) => isRealText(socialCopy);

/**
 * 發布到官網要送哪一份：有官網文章就送官網文章；
 * 舊草稿沒有官網文章時退回社群文案（usedFallback = true，呼叫端應先讓使用者確認）。
 */
export function resolveWebContent(
  webArticle: string | undefined,
  socialCopy: string
): { content: string; usedFallback: boolean } {
  if (hasWebArticle(webArticle)) return { content: webArticle as string, usedFallback: false };
  return { content: socialCopy, usedFallback: true };
}

/** 社群貼文在官網文章產生之後又被改過 → 官網文章可能不是最新 */
export function isArticleStale(meta: WebArticleMeta | undefined, socialCopy: string): boolean {
  if (!meta || meta.from_hash === undefined) return false;
  return meta.from_hash !== textHash(socialCopy);
}

/** 以不含空白的字數估算 */
export const countChars = (s: string) => (s || "").replace(/\s/g, "").length;
