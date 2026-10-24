import { pipelineDb } from "@/lib/auto-pipeline-server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 舊的衍生結果可能記了 articleId，卻因 FB 已送出而留下 ok=false。 */
export function websiteArticleId(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const id = (result as { articleId?: unknown }).articleId;
  return typeof id === "string" && UUID_RE.test(id) ? id : null;
}

/** 只有資料庫確認已上線的文章，才可用來消除過時的失敗狀態。 */
export async function publishedWebsiteBrands(ids: string[]): Promise<Map<string, string>> {
  const valid = [...new Set(ids.filter((id) => UUID_RE.test(id)))];
  if (!valid.length) return new Map();
  try {
    const rows = await pipelineDb<Array<{ id: string; brand_id: string }>>(
      "insights_articles",
      `id=in.(${valid.join(",")})&status=eq.published&select=id,brand_id`,
    );
    return new Map(rows.map((row) => [row.id, row.brand_id]));
  } catch {
    // 無法查證時保留警示，不把未知狀態當成成功。
    return new Map();
  }
}
