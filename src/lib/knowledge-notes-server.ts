import { getSupabaseEnv, supabaseHeaders } from "@/lib/publish-queue";
import { toKnowledgeNoteDirectoryEntry, type KnowledgeNoteDirectoryEntry, type KnowledgeNoteRecord } from "@/lib/knowledge-note-utils";

async function fetchKnowledgeRows<T>(query: string): Promise<T[]> {
  const env = getSupabaseEnv();
  if (!env) throw new Error("未設定伺服器端 Supabase 連線資訊。");
  const response = await fetch(`${env.url}/rest/v1/knowledge_notes?${query}`, {
    headers: supabaseHeaders(env.key), cache: "no-store",
  });
  if (!response.ok) throw new Error(`讀取知識筆記失敗，HTTP ${response.status}。`);
  return response.json() as Promise<T[]>;
}

/** 僅回傳目錄欄位，不將全文或檔案路徑送到瀏覽器。 */
export async function getKnowledgeNoteDirectory(): Promise<KnowledgeNoteDirectoryEntry[]> {
  const rows = await fetchKnowledgeRows<KnowledgeNoteRecord>("select=id,domain,title,author,subdomain&order=domain.asc,title.asc");
  return rows.map(toKnowledgeNoteDirectoryEntry);
}

export async function getKnowledgeNoteById(id: string): Promise<KnowledgeNoteRecord | null> {
  const rows = await fetchKnowledgeRows<KnowledgeNoteRecord>(`select=id,domain,title,author,domain_tags,subdomain,source_file,content,chars,content_md5,imported_at&id=eq.${encodeURIComponent(id)}&limit=1`);
  return rows[0] || null;
}

export async function getKnowledgeNoteByCitation(citation: Pick<KnowledgeNoteDirectoryEntry, "title" | "author" | "domain" | "subdomain">): Promise<KnowledgeNoteRecord | null> {
  const rows = await fetchKnowledgeRows<KnowledgeNoteRecord>(
    `select=id,domain,title,author,domain_tags,subdomain,source_file,content,chars,content_md5,imported_at&title=eq.${encodeURIComponent(citation.title)}&author=eq.${encodeURIComponent(citation.author)}&domain=eq.${encodeURIComponent(citation.domain)}&subdomain=eq.${encodeURIComponent(citation.subdomain)}&limit=2`
  );
  return rows.length === 1 ? rows[0] : null;
}
