// 發佈到官網時避免同一篇文章被重複新增：同品牌、同標題已存在就改為更新那一筆。
// 官網的文章網址由資料庫裡的標題與分類算出，更新舊的一筆等於網址不變，不會多出重複頁面。

const TABLE = "insights_articles";

/** 查詢同品牌、同標題最早的一筆（最舊的保留原網址）。 */
export function existingArticleQuery(supabaseUrl: string, brandId: string, title: string): string {
  return `${supabaseUrl}/rest/v1/${TABLE}?brand_id=eq.${encodeURIComponent(brandId)}&title=eq.${encodeURIComponent(title)}&select=id&order=created_at.asc&limit=1`;
}

export function articleUpdateUrl(supabaseUrl: string, id: string): string {
  return `${supabaseUrl}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}`;
}

/** 從 PostgREST 回傳的陣列取出既有文章 id；格式不對一律當作不存在。 */
export function pickExistingId(rows: unknown): string | null {
  if (!Array.isArray(rows) || !rows.length) return null;
  const id = (rows[0] as { id?: unknown } | null)?.id;
  return typeof id === "string" || typeof id === "number" ? String(id) : null;
}
