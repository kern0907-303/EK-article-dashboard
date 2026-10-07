export interface KnowledgeImportRecord {
  domain: string;
  title: string;
  author: string;
  domain_tags: string[];
  subdomain: string;
  source_file: string;
  content: string;
  chars: number;
  content_md5: string;
  imported_at: string;
}

export interface KnowledgeImportPlan<T extends { source_file: string; content_md5: string }> {
  inserts: T[];
  updates: T[];
  skipped: number;
}

export function contentMd5(content: string): string;
export function normalizeKnowledgeTags(value: unknown): string[];
export function normalizeKnowledgeRecord(row: Record<string, unknown>, importedAt?: string): KnowledgeImportRecord;
export function buildKnowledgeImportPlan<T extends { source_file: string; content_md5: string }>(
  incoming: T[],
  existingRows: Array<{ source_file: string; content_md5: string }>
): KnowledgeImportPlan<T>;
