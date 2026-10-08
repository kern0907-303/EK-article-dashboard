import "server-only";
import { getSupabaseEnv, supabaseHeaders } from "@/lib/publish-queue";
import {
  extractKnowledgeNoteHighlight,
  toKnowledgeNoteDirectoryEntry,
  type KnowledgeNoteDirectoryEntry,
  type KnowledgeNoteRecord,
} from "@/lib/knowledge-note-utils";
import { getStoryArgumentChineseAuthor, getStoryArgumentChineseBookTitle, KNOWLEDGE_DOMAIN_LABELS } from "@/data/skills/story-argument";
import { rankStoryArgumentNoteDirectory } from "@/lib/story-argument-reselection";

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

/** 僅供伺服器自動選書使用，source_file 不會由目錄 API 回傳瀏覽器。 */
export async function getKnowledgeNoteSelectionDirectory(): Promise<Array<KnowledgeNoteDirectoryEntry & { source_file: string }>> {
  return fetchKnowledgeRows<KnowledgeNoteRecord>("select=id,domain,title,author,subdomain,source_file&order=domain.asc,title.asc");
}

export async function getKnowledgeNoteById(id: string): Promise<KnowledgeNoteRecord | null> {
  const rows = await fetchKnowledgeRows<KnowledgeNoteRecord>(`select=id,domain,title,author,domain_tags,subdomain,source_file,content,chars,content_md5,imported_at&id=eq.${encodeURIComponent(id)}&limit=1`);
  return rows[0] || null;
}

/** 候選只回傳一行由伺服器從筆記原文擷取的摘句，不回傳全文或檔案路徑。 */
export async function getStoryArgumentKnowledgeCandidates(idea: string, limit = 5) {
  const directory = await getKnowledgeNoteDirectory();
  const selected = rankStoryArgumentNoteDirectory(directory, idea, limit);
  const candidates = await Promise.all(selected.map(async (entry) => {
    const note = await getKnowledgeNoteById(entry.id);
    if (!note) return null;
    return {
      id: entry.id,
      domain: KNOWLEDGE_DOMAIN_LABELS[entry.domain] || entry.domain,
      subdomain: entry.subdomain,
      title: getStoryArgumentChineseBookTitle(entry.title) || "【需補：中文書名】",
      author: getStoryArgumentChineseAuthor(entry.author) || "【需補：中文作者名】",
      highlight: extractKnowledgeNoteHighlight(note.content),
    };
  }));
  return candidates.filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null);
}

export async function getKnowledgeNoteByCitation(citation: Pick<KnowledgeNoteDirectoryEntry, "title" | "author" | "domain" | "subdomain">): Promise<KnowledgeNoteRecord | null> {
  const rows = await fetchKnowledgeRows<KnowledgeNoteRecord>(
    `select=id,domain,title,author,domain_tags,subdomain,source_file,content,chars,content_md5,imported_at&title=eq.${encodeURIComponent(citation.title)}&author=eq.${encodeURIComponent(citation.author)}&domain=eq.${encodeURIComponent(citation.domain)}&subdomain=eq.${encodeURIComponent(citation.subdomain)}&limit=2`
  );
  return rows.length === 1 ? rows[0] : null;
}
