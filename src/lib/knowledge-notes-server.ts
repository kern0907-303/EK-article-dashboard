import "server-only";
import { getSupabaseEnv, supabaseHeaders } from "@/lib/publish-queue";
import {
  extractKnowledgeNoteHighlight,
  toKnowledgeNoteDirectoryEntry,
  type KnowledgeNoteDirectoryEntry,
  type KnowledgeNoteRecord,
} from "@/lib/knowledge-note-utils";
import { isStoryArgumentCitationEligible, KNOWLEDGE_DOMAIN_LABELS } from "@/data/skills/story-argument";
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

/** 中文欄位 migration 尚未套用時，退回舊書目查詢，避免影響使用 title/author 的既有衍生功能。 */
async function fetchKnowledgeRowsWithLegacyFallback<T>(query: string, legacyQuery: string): Promise<T[]> {
  try {
    return await fetchKnowledgeRows<T>(query);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("HTTP 400")) throw error;
    const legacyRows = await fetchKnowledgeRows<Record<string, unknown>>(legacyQuery);
    return legacyRows.map((row) => ({
      ...row,
      title_zh: null,
      title_zh_subtitle: null,
      author_zh: null,
      translator_zh: null,
      publisher_zh: null,
      zh_source_url: null,
      zh_status: null,
    }) as unknown as T);
  }
}

/** 僅回傳目錄欄位，不將全文或檔案路徑送到瀏覽器。 */
export async function getKnowledgeNoteDirectory(): Promise<KnowledgeNoteDirectoryEntry[]> {
  const rows = await fetchKnowledgeRowsWithLegacyFallback<KnowledgeNoteRecord>(
    "select=id,domain,title,author,title_zh,author_zh,zh_status,subdomain&order=domain.asc,title_zh.asc",
    "select=id,domain,title,author,subdomain&order=domain.asc,title.asc",
  );
  return rows.map(toKnowledgeNoteDirectoryEntry);
}

/** 僅供伺服器自動選書使用，source_file 不會由目錄 API 回傳瀏覽器。 */
export async function getKnowledgeNoteSelectionDirectory(): Promise<Array<KnowledgeNoteDirectoryEntry & { source_file: string }>> {
  return fetchKnowledgeRowsWithLegacyFallback<KnowledgeNoteRecord>(
    "select=id,domain,title,author,title_zh,author_zh,zh_status,subdomain,source_file&order=domain.asc,title_zh.asc",
    "select=id,domain,title,author,subdomain,source_file&order=domain.asc,title.asc",
  );
}

export async function getKnowledgeNoteById(id: string): Promise<KnowledgeNoteRecord | null> {
  const rows = await fetchKnowledgeRowsWithLegacyFallback<KnowledgeNoteRecord>(
    `select=id,domain,title,author,title_zh,title_zh_subtitle,author_zh,zh_status,domain_tags,subdomain,source_file,content,chars,content_md5,imported_at&id=eq.${encodeURIComponent(id)}&limit=1`,
    `select=id,domain,title,author,domain_tags,subdomain,source_file,content,chars,content_md5,imported_at&id=eq.${encodeURIComponent(id)}&limit=1`,
  );
  return rows[0] || null;
}

/** 候選只回傳一行由伺服器從筆記原文擷取的摘句，不回傳全文或檔案路徑。 */
export async function getStoryArgumentKnowledgeCandidates(idea: string, limit = 5) {
  const directory = await getKnowledgeNoteDirectory();
  const eligible = directory.filter(isStoryArgumentCitationEligible);
  const selected = rankStoryArgumentNoteDirectory(eligible, idea, limit);
  const candidates = await Promise.all(selected.map(async (entry) => {
    const note = await getKnowledgeNoteById(entry.id);
    if (!note || !isStoryArgumentCitationEligible(note)) return null;
    return {
      id: entry.id,
      domain: KNOWLEDGE_DOMAIN_LABELS[entry.domain] || entry.domain,
      subdomain: entry.subdomain,
      title_zh: entry.title_zh,
      author_zh: entry.author_zh,
      zh_status: entry.zh_status,
      selectable: true,
      highlight: extractKnowledgeNoteHighlight(note.content),
    };
  }));
  const selectable = candidates.filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null);
  const pending = directory.filter((entry) => !isStoryArgumentCitationEligible(entry)).map((entry) => ({
    id: entry.id,
    domain: KNOWLEDGE_DOMAIN_LABELS[entry.domain] || entry.domain,
    subdomain: entry.subdomain,
    title_zh: entry.title_zh,
    author_zh: entry.author_zh,
    zh_status: entry.zh_status,
    selectable: false,
    highlight: "",
  }));
  return [...selectable, ...pending];
}
