import { normalizeStoryArgumentCopy } from "@/data/skills/story-argument";
import { stripDashes, stripMarkdown } from "@/lib/plain-text";
export { buildKnowledgeImportPlan, contentMd5, normalizeKnowledgeRecord, normalizeKnowledgeTags } from "./knowledge-note-core.mjs";

export interface KnowledgeNoteDirectoryEntry {
  id: string;
  domain: string;
  title: string;
  author: string;
  subdomain: string;
}

export interface KnowledgeNoteRecord extends KnowledgeNoteDirectoryEntry {
  domain_tags: string[];
  source_file: string;
  content: string;
  chars: number;
  content_md5: string;
  imported_at?: string;
}

export type KnowledgeImportPlan<T extends { source_file: string; content_md5: string }> = import("./knowledge-note-core.mjs").KnowledgeImportPlan<T>;

export function toKnowledgeNoteDirectoryEntry(note: KnowledgeNoteRecord): KnowledgeNoteDirectoryEntry {
  return { id: note.id, domain: note.domain, title: note.title, author: note.author, subdomain: note.subdomain };
}

function termsForTopic(topic: string): string[] {
  const words = topic.toLowerCase().match(/[a-z0-9]{2,}|[\u3400-\u9fff]{2,}/g) || [];
  const terms = new Set<string>();
  for (const word of words) {
    terms.add(word);
    if (/^[\u3400-\u9fff]+$/.test(word) && word.length > 2) {
      for (let i = 0; i < word.length - 1; i += 1) terms.add(word.slice(i, i + 2));
    }
  }
  return [...terms].filter((term) => term.length >= 2);
}

/** 以章節為單位做本機相關度排序，完整保留入選章節原文且限制總長度。 */
export function selectRelevantKnowledgeContent(content: string, topic: string, maxChars = 20_000): string {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  if ([...normalized].length <= maxChars) return normalized;
  const sections = normalized.split(/(?=^#{1,6}\s+[^\n]+\n)/gm).filter((part) => part.trim());
  const chunks = sections.length > 1 ? sections : normalized.split(/\n\s*\n/g).filter((part) => part.trim());
  const terms = termsForTopic(topic);
  const ranked = chunks.map((text, index) => ({ text: text.trim(), index, score: terms.reduce((score, term) => score + (text.toLowerCase().includes(term) ? 1 : 0), 0) }));
  ranked.sort((a, b) => b.score - a.score || a.index - b.index);
  const chosen: typeof ranked = [];
  let used = 0;
  for (const section of ranked) {
    if (used >= maxChars) break;
    const remaining = maxChars - used;
    const clipped = [...section.text].slice(0, remaining).join("");
    if (!clipped) continue;
    chosen.push({ ...section, text: clipped });
    used += [...clipped].length + 2;
  }
  return chosen.sort((a, b) => a.index - b.index).map((section) => section.text).join("\n\n").slice(0, maxChars).trim();
}

export function applyValidatedKnowledgeCitation(
  input: string,
  citedTitle: unknown,
  citedAuthor: unknown,
  note: Pick<KnowledgeNoteRecord, "title" | "author"> | null,
  required: boolean
): { content: string; valid: boolean } {
  const sourceLines = input.match(/^\s*出處\s*[：:].*$/gm) || [];
  const referencedTitles = [...input.matchAll(/《([^》]{2,})》/g)].map((match) => match[1].trim());
  const body = normalizeStoryArgumentCopy(input)
    .split("\n")
    .filter((line) => !/^\s*(?:出處\s*[：:]|【需補：引用來源】)/.test(line))
    .join("\n")
    .trim();
  if (!required) return { content: body, valid: true };
  const valid = !!note && !!note.title.trim() && !!note.author.trim() && citedTitle === note.title && citedAuthor === note.author &&
    sourceLines.every((line) => line.trim() === `出處：${note.title}，${note.author}`) &&
    referencedTitles.every((title) => title === note.title);
  const source = valid
    ? stripDashes(stripMarkdown(`出處：${note!.title}，${note!.author}`))
    : "【需補：引用來源】";
  return { content: [body, source].filter(Boolean).join("\n\n"), valid };
}
