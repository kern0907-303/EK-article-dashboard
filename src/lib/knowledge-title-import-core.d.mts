export interface KnowledgeTitleCsvRow {
  source_file: string;
  domain: string;
  title_en: string;
  author_en: string;
  title_zh: string;
  title_zh_subtitle: string;
  author_zh: string;
  translator_zh: string;
  publisher_zh: string;
  zh_source_url: string;
  zh_status: "confirmed" | "unverified" | "no_zh_edition";
  note: string;
}

export const KNOWLEDGE_TITLE_HEADERS: string[];
export const KNOWLEDGE_TITLE_STATUSES: Array<KnowledgeTitleCsvRow["zh_status"]>;
export function parseKnowledgeTitlesCsv(input: string): KnowledgeTitleCsvRow[];
export function toKnowledgeTitlePatch(record: KnowledgeTitleCsvRow): Record<string, string | null>;
export function buildKnowledgeTitleImportPlan(csvRows: KnowledgeTitleCsvRow[], existingRows: Array<{ source_file: string; domain?: string }>): {
  matched: KnowledgeTitleCsvRow[];
  missingSourceFiles: string[];
  domainMismatches: Array<{ source_file: string; csv_domain: string; database_domain: string }>;
  statusCounts: Record<KnowledgeTitleCsvRow["zh_status"], number>;
};
export function getKnowledgeTitleUpdateColumns(): string[];
