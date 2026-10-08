import {
  getStoryArgumentChineseAuthor,
  getStoryArgumentChineseBookTitle,
  isStoryArgumentCitationEligible,
  normalizeStoryArgumentCopy,
} from "@/data/skills/story-argument";
import { stripDashes, stripMarkdown } from "@/lib/plain-text";
export { buildKnowledgeImportPlan, contentMd5, normalizeKnowledgeRecord, normalizeKnowledgeTags } from "./knowledge-note-core.mjs";

export interface KnowledgeNoteDirectoryEntry {
  id: string;
  domain: string;
  title: string;
  author: string;
  title_zh: string | null;
  author_zh: string | null;
  zh_status: string | null;
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
  return { id: note.id, domain: note.domain, title: note.title, author: note.author, title_zh: note.title_zh, author_zh: note.author_zh, zh_status: note.zh_status, subdomain: note.subdomain };
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
  note: Pick<KnowledgeNoteRecord, "title_zh" | "author_zh" | "zh_status"> | null,
  required: boolean
): { content: string; valid: boolean; citationTitle: string | null; citationAuthor: string | null } {
  const lines = normalizeStoryArgumentCopy(input).split("\n");
  const isSourceLine = (line: string) => /^\s*出處\s*[：:]/u.test(line);
  const isCitationLine = (line: string) => line.includes("《") || line.includes("需補");
  const bodyLines = lines.filter((line) => !isSourceLine(line));
  if (!required) {
    return {
      content: bodyLines.filter((line) => !line.includes("需補")).join("\n").trim(),
      valid: true,
      citationTitle: null,
      citationAuthor: null,
    };
  }

  const titleZh = note ? getStoryArgumentChineseBookTitle(note.title_zh) : null;
  const authorZh = note ? getStoryArgumentChineseAuthor(note.author_zh) : null;
  const eligible = isStoryArgumentCitationEligible(note);
  const citationLines = bodyLines.filter(isCitationLine);
  const expectedPhrase = titleZh && authorZh ? `${authorZh}在《${titleZh}》提出` : "";
  const citedTitles = citationLines.flatMap((line) => [...line.matchAll(/《([^》]+)》/gu)].map((match) => match[1].trim()));
  const citationHasOnlyChinese = Boolean(titleZh && authorZh) && !/[A-Za-z]/u.test(`${titleZh}${authorZh}`);
  const metadataMatches = Boolean(eligible && citedTitle === titleZh && citedAuthor === authorZh);
  const bodyMatches = Boolean(expectedPhrase && citationLines.length > 0 && citedTitles.length > 0 &&
    citedTitles.every((title) => title === titleZh) && citationLines.every((line) => line.includes(expectedPhrase)));
  const noPartialMarkers = !bodyLines.some((line) => /【需補：(?:中文書名|中文作者名)/u.test(line));
  const valid = Boolean(eligible && citationHasOnlyChinese && metadataMatches && bodyMatches && noPartialMarkers);
  const bodyWithoutCitation = bodyLines.filter((line) => !isCitationLine(line)).join("\n").trim();
  const body = valid ? bodyLines.join("\n").trim() : bodyWithoutCitation;
  const source = valid ? `出處：${authorZh}，《${titleZh}》` : "【需補：引用來源】";
  const canonical = stripDashes(stripMarkdown(source));
  return {
    content: [body, canonical].filter(Boolean).join("\n\n"),
    valid,
    citationTitle: valid ? titleZh : null,
    citationAuthor: valid ? authorZh : null,
  };
}

/** 取筆記正文第一句原文作候選摘句，不交由模型生成摘要。 */
export function extractKnowledgeNoteHighlight(content: string, maxChars = 100): string {
  const candidate = content
    .replace(/^---[\s\S]*?---\s*/u, "")
    .split(/\r?\n/)
    .map((line) => ({ line: line.replace(/^#{1,6}\s*/u, "").trim(), heading: /^\s*#{1,6}\s+/u.test(line) }))
    .find(({ line, heading }) => line && !heading && !/^[-*+\d.\s]+$/u.test(line))?.line;
  if (!candidate) return "筆記內容目前沒有可顯示的文字摘句。";
  const sentence = candidate.match(/^.*?[。！？!?；;]/u)?.[0]?.trim() || candidate;
  const clipped = [...sentence].slice(0, maxChars).join("");
  return clipped.length < [...sentence].length ? `${clipped}…` : clipped;
}
