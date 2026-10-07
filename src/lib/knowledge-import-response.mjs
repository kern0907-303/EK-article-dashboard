export async function parseKnowledgeImportResponse(response) {
  if (!response.ok) {
    throw new Error(
      `Supabase 知識筆記操作失敗，HTTP ${response.status}。請確認 SQL schema 與伺服器端連線設定。`,
    );
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
