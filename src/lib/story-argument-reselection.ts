import { normalizeStoryArgumentCopy } from "@/data/skills/story-argument";

export interface StoryArgumentNoteIdentity {
  id: string;
  source_file: string;
}

/** 自動選書排除已用 source_file；明確指定的候選不套用排除規則。 */
export function chooseStoryArgumentNote<T extends StoryArgumentNoteIdentity>(
  notes: T[],
  excludedSourceFiles: Iterable<string>,
  selectedNoteId?: string
): T | null {
  if (selectedNoteId) return notes.find((note) => note.id === selectedNoteId) || null;
  const excluded = new Set(excludedSourceFiles);
  return notes.find((note) => !excluded.has(note.source_file)) || null;
}

function isCitationFooter(block: string): boolean {
  return /^\s*(?:出處\s*[：:]|【需補：(?:引用來源|中文書名|中文作者名)】)/u.test(block);
}

function isHashtagBlock(block: string): boolean {
  const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
  return lines.length > 0 && lines.every((line) => /^#[\p{L}\p{N}_]+(?:\s+#[\p{L}\p{N}_]+)*$/u.test(line));
}

/**
 * 未勾選全文重寫時，依故事論點固定四段骨架替換第三段。
 * 其他段落逐字保留；書目 footer 與標籤原樣保留位置順序。
 */
export function replaceStoryArgumentSupportParagraph(
  original: string,
  replacementWithCitation: string,
  rewriteFull: boolean,
  thesis = ""
): string {
  if (rewriteFull) return normalizeStoryArgumentCopy(replacementWithCitation, thesis);

  const originalBlocks = original.trim().split(/\n\s*\n/u).filter(Boolean);
  const tags = originalBlocks.filter(isHashtagBlock);
  const paragraphs = originalBlocks.filter((block) => !isCitationFooter(block) && !isHashtagBlock(block));
  if (paragraphs.length < 3) throw new Error("無法辨識故事論點的第三段，未替換原文。");

  const replacementBlocks = replacementWithCitation.trim().split(/\n\s*\n/u).filter(Boolean);
  const replacementFooter = replacementBlocks.filter((block) => /^\s*出處\s*[：:]/u.test(block));
  const replacementParagraph = replacementBlocks
    .filter((block) => !/^\s*出處\s*[：:]/u.test(block))
    .join("\n\n");
  paragraphs[2] = replacementParagraph || "【需補：引用來源】";

  return [...paragraphs, ...replacementFooter, ...tags].join("\n\n").trim();
}

/** 只以書目欄位做字面排序，候選摘句會另由伺服器從筆記原文擷取。 */
export function rankStoryArgumentNoteDirectory<T extends { title: string; author: string; domain: string; subdomain: string }>(
  notes: T[],
  idea: string,
  limit = 5
): T[] {
  const terms = idea.toLocaleLowerCase().match(/[a-z0-9]{2,}|[\p{Script=Han}]{2,}/gu) || [];
  const scored = notes.map((note, index) => {
    const haystack = `${note.title} ${note.author} ${note.domain} ${note.subdomain}`.toLocaleLowerCase();
    const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
    return { note, index, score };
  });
  return scored.sort((a, b) => b.score - a.score || a.index - b.index).slice(0, Math.max(1, limit)).map(({ note }) => note);
}
