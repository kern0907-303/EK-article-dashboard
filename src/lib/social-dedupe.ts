// 同一篇母文章，在同一個 Threads 帳號或同一個 Instagram 帳號，最多只排程並發出一則。
//
// 2026-11-27 盤點：10/22 到 11/24 之間的重複貼文，全部是「同一個流水線任務、同一個平台」
// 在佇列裡被寫了兩筆，兩筆排在同一分鐘，n8n 照排程各發一次。最後一組寫於 11/22，
// 11/25 加上的資料庫唯一索引（只看 pending、sending）之後沒有再出現。
// 這裡補兩個缺口：
// 一、清理：還沒發出的重複列取消掉，只留和母文章綁定的那一版（article_id 等於 FB 排程列的 article_id）。
//     同平台已經發出或正在發的，待發的那筆一律取消。已發出的列絕對不碰。
// 二、寫入前檢查：同一任務或同一篇官網文章（article_id）在同平台已有活著的列，就不再寫。
// 純函式，不碰網路，方便測。

export interface SocialRowLite {
  id: string;
  platform: string;
  status: string;
  /** 品牌就是帳號（每個品牌一個 Threads、一個 IG） */
  brand?: string | null;
  job_id?: string | null;
  article_id?: string | null;
  created_at?: string | null;
}

/** 這些狀態代表帳號上已經有、或馬上會有這一則 */
const DELIVERED = new Set(["sending", "sent"]);
/** 活著的列：待發、發送中、已發、發送失敗（失敗的會由排程執行器重試）都算 */
export const isLiveStatus = (status: unknown): boolean => String(status ?? "") !== "cancelled";

const norm = (value: unknown): string => String(value ?? "").trim().toLowerCase();
const time = (value: unknown): number => {
  const t = new Date(String(value ?? "")).getTime();
  return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER;
};

/**
 * 一組「同一篇母文章、同一平台」的列，回傳要取消的 id。
 * fbArticleId：母文章（FB 排程列）綁定的官網文章編號，用來決定留哪一版。
 */
export function pickCancelsInGroup(rows: SocialRowLite[], fbArticleId?: string | null): string[] {
  const pending = rows.filter((row) => norm(row.status) === "pending");
  if (!pending.length) return [];
  // 帳號上已經有這一則（或正在發），待發的全部不要
  if (rows.some((row) => DELIVERED.has(norm(row.status)))) return pending.map((row) => row.id);
  if (pending.length < 2) return [];
  const bound = fbArticleId ? pending.filter((row) => row.article_id && String(row.article_id) === String(fbArticleId)) : [];
  const withArticle = pending.filter((row) => row.article_id);
  const candidates = bound.length ? bound : withArticle.length ? withArticle : pending;
  const keep = [...candidates].sort((a, b) => time(a.created_at) - time(b.created_at))[0];
  return pending.filter((row) => row.id !== keep.id).map((row) => row.id);
}

/**
 * 全部列一起看：先依「任務 + 平台」分組，再依「官網文章 + 平台」分組（不同任務共用同一篇母文章時）。
 * fbArticleByJob：每個任務的 FB 排程列綁定的 article_id。
 */
export function duplicatesToCancel(rows: SocialRowLite[], fbArticleByJob: Record<string, string | null | undefined> = {}): string[] {
  const live = rows.filter((row) => isLiveStatus(row.status));
  const cancel = new Set<string>();
  const group = (keyOf: (row: SocialRowLite) => string | null, articleOf: (key: string, members: SocialRowLite[]) => string | null | undefined) => {
    const groups = new Map<string, SocialRowLite[]>();
    for (const row of live) {
      if (cancel.has(row.id)) continue;
      const key = keyOf(row);
      if (!key) continue;
      groups.set(key, [...(groups.get(key) || []), row]);
    }
    for (const [key, members] of groups) {
      for (const id of pickCancelsInGroup(members, articleOf(key, members))) cancel.add(id);
    }
  };
  group(
    (row) => (row.job_id ? `${norm(row.brand)}|${norm(row.platform)}|job|${row.job_id}` : null),
    (_key, members) => fbArticleByJob[String(members[0].job_id)] || null,
  );
  group(
    (row) => (row.article_id ? `${norm(row.brand)}|${norm(row.platform)}|article|${row.article_id}` : null),
    (_key, members) => String(members[0].article_id),
  );
  return [...cancel];
}

/** 寫入前：同平台、同任務或同一篇官網文章，已經有活著的列了嗎 */
export function hasLiveDuplicate(existing: SocialRowLite[], next: { platform: string; brand?: string | null; job_id?: string | null; article_id?: string | null }): boolean {
  return existing.some((row) => isLiveStatus(row.status)
    && norm(row.platform) === norm(next.platform)
    && (!next.brand || !row.brand || norm(row.brand) === norm(next.brand))
    && ((next.job_id && row.job_id && String(row.job_id) === String(next.job_id))
      || (next.article_id && row.article_id && String(row.article_id) === String(next.article_id))));
}

export const DUPLICATE_CANCEL_REASON = "重複排程：同一篇母文章在同一個帳號只發一則，已保留和母文章綁定的那一版";
