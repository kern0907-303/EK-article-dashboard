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

const KNOWLEDGE_CONTENT_MAX_CHARS = 20_000;
const KNOWLEDGE_INDEX_MAX_CHARS = 5_000;
const INDEX_HEADING = /^(?:全書索引|整體索引|全書知識索引|knowledge index|book index)(?:\s|[（(：:]|$)/iu;
const UNIT_HEADING = /^#{1,6}\s+\[U\d{4}\](?:\s|$)/u;

function countChars(text: string): number {
  return [...text].length;
}

function markdownHeadings(text: string) {
  return [...text.matchAll(/^(#{1,6})\s+([^\n]+)(?:\n|$)/gm)].map((match) => ({
    index: match.index ?? 0,
    level: match[1].length,
    title: match[2].trim(),
    text: match[0],
  }));
}

function knowledgeIndexSection(content: string): string {
  const headings = markdownHeadings(content);
  const index = headings.find((heading) => INDEX_HEADING.test(heading.title));
  if (!index) return "";
  const next = headings.find((heading) => heading.index > index.index && heading.level <= index.level);
  return content.slice(index.index, next?.index ?? content.length).trim();
}

function knowledgeUnitSections(content: string): string[] {
  const allHeadings = markdownHeadings(content);
  const headings = allHeadings.filter((heading) => UNIT_HEADING.test(heading.text.trim()));
  return headings.map((heading, index) => {
    const nextUnit = headings[index + 1];
    const nextPeer = allHeadings.find((candidate) =>
      candidate.index > heading.index && candidate.level <= heading.level && candidate.index < (nextUnit?.index ?? content.length)
    );
    const end = Math.min(nextUnit?.index ?? content.length, nextPeer?.index ?? content.length);
    return content.slice(heading.index, end).trim();
  }).filter(Boolean);
}

function truncateIndexSection(section: string, maxChars: number): string {
  if (countChars(section) <= maxChars) return section;
  const marker = "索引已截斷";
  const markerWithBreak = `\n${marker}`;
  const prefixLength = Math.max(0, maxChars - countChars(markerWithBreak));
  return `${[...section].slice(0, prefixLength).join("").trimEnd()}${markerWithBreak}`;
}

/** 截在完整句末；無完整句時只保留標題，避免切斷正文句子。 */
function truncateUnitSection(section: string, maxChars: number): string {
  if (countChars(section) <= maxChars) return section;
  const heading = section.match(/^#{1,6}\s+[^\n]+/u)?.[0] ?? "";
  if (!heading || countChars(heading) > maxChars) return "";
  const chars = [...section];
  const prefix = chars.slice(0, maxChars).join("");
  const endings = [...prefix.matchAll(/[。！？!?；;](?:[」』”’）)]*)/gu)];
  const lastEnding = endings[endings.length - 1];
  if (lastEnding?.index !== undefined) {
    return prefix.slice(0, lastEnding.index + lastEnding[0].length).trimEnd();
  }
  return heading;
}

function minimumUnitSectionChars(section: string): number {
  const heading = section.match(/^#{1,6}\s+[^\n]+/u)?.[0] ?? "";
  const firstSentence = section.match(/[。！？!?；;](?:[」』”’）)]*)/u);
  if (firstSentence?.index !== undefined) return firstSentence.index + firstSentence[0].length;
  return countChars(heading);
}

function selectStructuredKnowledgeContent(content: string, topic: string, maxChars: number): string {
  const index = knowledgeIndexSection(content);
  const units = knowledgeUnitSections(content);
  const indexText = index ? truncateIndexSection(index, Math.min(KNOWLEDGE_INDEX_MAX_CHARS, maxChars)) : "";
  const unitRoom = Math.max(0, maxChars - countChars(indexText) - (indexText ? 2 : 0));
  if (!unitRoom || !units.length) return indexText;

  const terms = termsForTopic(topic);
  const ranked = units.map((text, index) => ({
    text,
    index,
    score: terms.reduce((score, term) => score + (text.toLowerCase().includes(term) ? 1 : 0), 0),
  })).sort((a, b) => b.score - a.score || a.index - b.index);
  const guaranteedCount = Math.min(2, ranked.length);
  const separatorBudget = Math.max(0, (guaranteedCount - 1) * 2);
  const initialPayloadBudget = Math.max(0, unitRoom - separatorBudget);
  const selected: string[] = [];

  if (guaranteedCount === 2) {
    const firstFullLength = countChars(ranked[0].text);
    const secondMinimumLength = minimumUnitSectionChars(ranked[1].text);
    if (firstFullLength + secondMinimumLength + 2 <= unitRoom) {
      selected.push(ranked[0].text);
      const second = truncateUnitSection(ranked[1].text, unitRoom - firstFullLength - 2);
      if (second) selected.push(second);
    } else {
      const firstBudget = Math.ceil(initialPayloadBudget / 2);
      const secondBudget = Math.floor(initialPayloadBudget / 2);
      const first = truncateUnitSection(ranked[0].text, firstBudget);
      const second = truncateUnitSection(ranked[1].text, secondBudget);
      if (first) selected.push(first);
      if (second) selected.push(second);
    }
  } else {
    const first = truncateUnitSection(ranked[0].text, initialPayloadBudget);
    if (first) selected.push(first);
  }

  let remaining = Math.max(0, unitRoom - countChars(selected.join("\n\n")));
  for (const unit of ranked.slice(guaranteedCount)) {
    if (remaining < 1) break;
    const separator = selected.length ? 2 : 0;
    const available = remaining - separator;
    if (available < 1) break;
    const next = truncateUnitSection(unit.text, available);
    if (!next) continue;
    selected.push(next);
    remaining -= countChars(next) + separator;
  }
  const parts = [indexText, ...selected].filter(Boolean);
  return parts.join("\n\n").trim();
}

/** 先保留書籍索引，再依查詢相關度選取單元，限制總長並維持句界。 */
export function selectRelevantKnowledgeContent(content: string, topic: string, maxChars = 20_000): string {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  const limit = Math.max(0, Math.min(Math.floor(maxChars), KNOWLEDGE_CONTENT_MAX_CHARS));
  if (/^#{1,6}\s+\[U\d{4}\]/m.test(normalized)) {
    return selectStructuredKnowledgeContent(normalized, topic, limit);
  }
  if (countChars(normalized) <= limit) return normalized;
  const sections = normalized.split(/(?=^#{1,6}\s+[^\n]+\n)/gm).filter((part) => part.trim());
  const chunks = sections.length > 1 ? sections : normalized.split(/\n\s*\n/g).filter((part) => part.trim());
  const terms = termsForTopic(topic);
  const ranked = chunks.map((text, index) => ({ text: text.trim(), index, score: terms.reduce((score, term) => score + (text.toLowerCase().includes(term) ? 1 : 0), 0) }));
  ranked.sort((a, b) => b.score - a.score || a.index - b.index);
  const chosen: typeof ranked = [];
  let used = 0;
  for (const section of ranked) {
    if (used >= limit) break;
    const remaining = limit - used;
    const clipped = [...section.text].slice(0, remaining).join("");
    if (!clipped) continue;
    chosen.push({ ...section, text: clipped });
    used += [...clipped].length + 2;
  }
  return chosen.sort((a, b) => a.index - b.index).map((section) => section.text).join("\n\n").slice(0, limit).trim();
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
  const metadataMatches = Boolean(eligible && citedTitle === titleZh && citedAuthor === authorZh);
  const bodyMatches = Boolean(expectedPhrase && citationLines.length > 0 && citedTitles.length > 0 &&
    citedTitles.every((title) => title === titleZh) && citationLines.every((line) => line.includes(expectedPhrase)));
  const noPartialMarkers = !bodyLines.some((line) => /【需補：(?:中文書名|中文作者名)/u.test(line));
  const valid = Boolean(eligible && metadataMatches && bodyMatches && noPartialMarkers);
  const bodyWithoutCitation = bodyLines.filter((line) => !isCitationLine(line)).join("\n").trim();
  const body = valid ? bodyLines.join("\n").trim() : bodyWithoutCitation;
  const source = valid ? `出處：文中引用的觀點，出自${authorZh}所著《${titleZh}》。故事情境與其他內容為艾瑞克的整理與詮釋。` : "【需補：引用來源】";
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
