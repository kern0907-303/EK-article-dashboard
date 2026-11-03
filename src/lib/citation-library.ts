// 可以引用的書，以知識庫為準。
//
// 2026-11-03：查到待發與未上線的內容裡，有 3 篇 FB、16 篇 IG／Threads、15 篇官網草稿
// 引用了知識庫沒有的書，例如《為什麼要睡覺》出現十次，還有英文原名 Being Mortal。
// 另外有一整類是模型把庫裡的書名記成別的樣子：《第五項修煉》對《第五項修練》、
// 《自我疼惜》對《自我慈悲》、《全然接受這樣的我》對《全然接受這樣的自己》。
//
// 原因是衍生稿的查證標準是「母稿引了哪一本」，從頭到尾沒有再回頭問知識庫，
// 所以母稿一旦寫出一本庫外的書，官網、IG、Threads 就一起跟著引。
// 這支負責把知識庫裡已確認的中文書名拿出來，讓查證有一個真正的標準。

import { getSupabaseEnv, supabaseHeaders } from "@/lib/publish-queue";

const TTL_MS = 10 * 60 * 1000;
let cache: { at: number; titles: string[] } | null = null;

/**
 * 知識庫裡已確認、可以引用的中文書名。
 *
 * 查不到就回空陣列，呼叫端看到空的要跳過這層檢查。
 * 這是刻意的：資料庫暫時不通時，寧可少擋一次，也不要把每一篇都判成違規，
 * 那會讓整批文章同時被拿掉引用。
 */
export async function loadApprovedCitationTitles(): Promise<string[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.titles;
  const env = getSupabaseEnv();
  if (!env) return cache?.titles ?? [];
  try {
    const response = await fetch(
      `${env.url}/rest/v1/knowledge_notes?select=title_zh&zh_status=eq.confirmed&limit=10000`,
      { headers: supabaseHeaders(env.key), cache: "no-store" },
    );
    if (!response.ok) throw new Error(`知識庫查詢失敗（${response.status}）`);
    const rows = await response.json();
    const titles = [...new Set(
      (Array.isArray(rows) ? rows : [])
        .map((row: any) => String(row?.title_zh ?? "").trim())
        .filter((title: string) => title.length > 0),
    )];
    // 回空的通常是查詢出問題，不是真的一本書都沒有，所以保留上一次的結果
    if (!titles.length) return cache?.titles ?? [];
    cache = { at: Date.now(), titles };
    return titles;
  } catch {
    return cache?.titles ?? [];
  }
}

/** 測試與重新匯入知識庫之後用，讓下一次呼叫重新讀 */
export function clearApprovedCitationCache(): void {
  cache = null;
}
