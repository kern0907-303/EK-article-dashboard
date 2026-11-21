export const KNOWLEDGE_IMPORT_MAX_FILE_BYTES = 700 * 1024;
export const KNOWLEDGE_IMPORT_MAX_REQUEST_BODY_BYTES = 40 * 1024 * 1024;

export function knowledgeImportFileSizeError(file: Pick<File, "name" | "size">): string | null {
  if (file.size <= KNOWLEDGE_IMPORT_MAX_FILE_BYTES) return null;
  return `《${file.name}》超過單檔 700 KB 上限。`;
}

export function knowledgeImportRequestBodyError(contentLength: string | null): string | null {
  if (contentLength === null) return null;
  const bytes = Number(contentLength);
  if (!Number.isSafeInteger(bytes) || bytes < 0) return "上傳資料大小無法確認，請重新選擇檔案。";
  if (bytes <= KNOWLEDGE_IMPORT_MAX_REQUEST_BODY_BYTES) return null;
  return "單次上傳總大小不可超過 40 MB，請減少檔案數或分批處理。";
}
