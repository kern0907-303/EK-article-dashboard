import {
  getStoryArgumentChineseAuthor,
  getStoryArgumentChineseBookTitle,
  getStoryArgumentMainBookTitle,
  normalizeStoryArgumentBookTitle,
  normalizeStoryArgumentCopy,
} from "@/data/skills/story-argument";
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
): { content: string; valid: boolean; citationTitle: string | null; citationAuthor: string | null } {
  const sourceLines = input.match(/^\s*出處\s*[：:].*$/gm) || [];
  const body = normalizeStoryArgumentCopy(input)
    .split("\n")
    .filter((line) => !/^\s*(?:出處\s*[：:]|【需補：(?:引用來源|中文書名|中文作者名)】)/u.test(line))
    .join("\n")
    .trim();
  if (!required) return { content: body, valid: true, citationTitle: null, citationAuthor: null };

  const rawReferencedTitles = [...input.matchAll(/《([^》]{2,})》/gu)].map((match) => match[1].trim());
  const chineseTitle = note ? getStoryArgumentChineseBookTitle(note.title) : null;
  const chineseAuthor = note ? getStoryArgumentChineseAuthor(note.author) : null;
  const titleAliases = note ? citationAliases(note.title) : [];
  const authorAliases = note ? citationAuthorAliases(note.author) : [];
  const authorAliasMappings = note ? citationAliasMappings(note.author, chineseAuthor) : [];
  const sourceLinesMatch = !!note && sourceLines.every((line) => {
    const value = line.trim().replace(/^出處\s*[：:]\s*/u, "");
    const canonical = `${chineseAuthor || "【需補：中文作者名】"}，《${chineseTitle || "【需補：中文書名】"}》`;
    const legacy = value.match(/^(.*?)[，,]\s*(.+)$/u);
    const legacyTitleMatches = !!legacy && (
      normalizeStoryArgumentBookTitle(legacy[1]) === normalizeStoryArgumentBookTitle(note.title) ||
      titleAliases.some((alias) => normalizeAlias(legacy[1]) === normalizeAlias(alias))
    );
    const legacyAuthorMatches = !!legacy && (legacy[2].trim() === note.author.trim() || authorAliases.some((alias) => normalizeAlias(legacy[2]) === normalizeAlias(alias)));
    const legacyMatches = legacyTitleMatches && legacyAuthorMatches;
    return normalizeCitationLine(value) === normalizeCitationLine(canonical) || legacyMatches;
  });
  const citedTitleMatches = !!note && typeof citedTitle === "string" &&
    normalizeStoryArgumentBookTitle(citedTitle) === normalizeStoryArgumentBookTitle(note.title);
  const citedAuthorMatches = !!note && citedAuthor === note.author;
  const rawReferencesMatch = !!note && rawReferencedTitles.every((title) =>
    normalizeStoryArgumentBookTitle(title) === normalizeStoryArgumentBookTitle(note.title) ||
    titleAliases.some((alias) => normalizeAlias(title) === normalizeAlias(alias))
  );
  const cleanedBody = note
    ? normalizeCitationIdentifiers(body, note, titleAliases, authorAliasMappings, chineseTitle)
    : normalizeUnmatchedCitationIdentifiers(body);
  const referencedTitles = [...cleanedBody.matchAll(/《([^》]{2,})》/g)].map((match) => match[1].trim());
  const referencesMatch = !!note && referencedTitles.every((title) =>
    !!chineseTitle && normalizeStoryArgumentBookTitle(title) === normalizeStoryArgumentBookTitle(chineseTitle)
  );
  const valid = !!note && !!note.title.trim() && !!note.author.trim() && !!chineseTitle && !!chineseAuthor &&
    citedTitleMatches && citedAuthorMatches && sourceLinesMatch && referencesMatch && !cleanedBody.includes("【需補：中文");
  const source = note
    ? `出處：${chineseAuthor || "【需補：中文作者名】"}，《${chineseTitle || "【需補：中文書名】"}》`
    : "【需補：引用來源】";
  const missingSource = note && (!citedTitleMatches || !citedAuthorMatches || !sourceLinesMatch || !referencesMatch)
    ? (!rawReferencesMatch || !citedTitleMatches || !citedAuthorMatches || !sourceLinesMatch ? ["【需補：引用來源】"] : [])
    : [];
  const normalizedSource = stripDashes(stripMarkdown(source));
  return {
    content: [cleanedBody, normalizedSource, ...missingSource].filter(Boolean).join("\n\n"),
    valid,
    citationTitle: chineseTitle,
    citationAuthor: chineseAuthor,
  };
}

function normalizeCitationLine(value: string): string {
  return value.normalize("NFKC").replace(/[\p{White_Space}《》]/gu, "").toLocaleLowerCase();
}

function citationAliases(value: string): string[] {
  const aliases = new Set<string>();
  for (const match of value.matchAll(/[（(]([^）)]*[A-Za-z][^）)]*)[）)]/gu)) {
    const alias = match[1].trim();
    if (alias) {
      aliases.add(alias);
      const main = alias.split(/[：:]/u)[0].trim();
      if (main) aliases.add(main);
    }
  }
  const withoutChinese = value.replace(/[\p{Script=Han}\p{P}\p{White_Space}]/gu, " ").trim();
  if (/[A-Za-z]/u.test(withoutChinese)) aliases.add(withoutChinese.replace(/\s+/gu, " "));
  return [...aliases].filter((alias) => /[A-Za-z]/u.test(alias)).sort((a, b) => b.length - a.length);
}

function citationAliasMappings(value: string, fallbackChinese: string | null): Array<{ alias: string; chinese: string | null }> {
  const mappings = new Map<string, string | null>();
  for (const part of value.split(/[、,，;；]/u)) {
    const chinese = getStoryArgumentChineseAuthor(part) || fallbackChinese;
    for (const alias of citationAuthorAliases(part)) mappings.set(alias, chinese);
  }
  return [...mappings.entries()].map(([alias, chinese]) => ({ alias, chinese })).sort((a, b) => b.alias.length - a.alias.length);
}

function citationAuthorAliases(value: string): string[] {
  const aliases = new Set(citationAliases(value));
  for (const match of value.matchAll(/[（(]([^）)]*[A-Za-z][^）)]*)[）)]/gu)) {
    const words = match[1].trim().split(/\s+/u);
    if (words.length > 1) aliases.add(words[words.length - 1]);
  }
  return [...aliases].sort((a, b) => b.length - a.length);
}

function replaceLiteralCaseInsensitive(text: string, from: string, to: string): string {
  const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(escaped, "giu"), to);
}

/** 只清理含書名號的引用句；一般正文中的英文或冒號保持原樣。 */
function normalizeCitationIdentifiers(
  input: string,
  note: Pick<KnowledgeNoteRecord, "title" | "author">,
  titleAliases: string[],
  authorAliasMappings: Array<{ alias: string; chinese: string | null }>,
  chineseTitle: string | null
): string {
  return input.split("\n").map((line) => {
    if (!line.includes("《")) return line;
    let output = line;
    const originalBook = output.match(/《([^》]+)》/u)?.[1]?.trim() || "";
    const normalizedBook = normalizeStoryArgumentBookTitle(originalBook);
    const knownBook = normalizedBook === normalizeStoryArgumentBookTitle(note.title) ||
      normalizedBook === normalizeStoryArgumentBookTitle(getStoryArgumentMainBookTitle(note.title)) ||
      titleAliases.some((alias) => normalizeAlias(originalBook) === normalizeAlias(alias));
    if (/[A-Za-z]/u.test(originalBook)) {
      output = output.replace(/《[^》]+》/u, `《${knownBook && chineseTitle ? chineseTitle : "【需補：中文書名】"}》`);
    } else if (knownBook && chineseTitle) {
      output = output.replace(/《[^》]+》/u, `《${chineseTitle}》`);
    } else if (knownBook && !chineseTitle) {
      output = output.replace(/《[^》]+》/u, "《【需補：中文書名】》");
    }

    for (const mapping of authorAliasMappings) output = replaceLiteralCaseInsensitive(output, mapping.alias, mapping.chinese || "【需補：中文作者名】");
    output = output.replace(/\b(?:Dr\.?|Prof\.?)\s*(?=[\p{Script=Han}【])/giu, "");
    const prefix = output.split("《")[0];
    if (/[A-Za-z]/u.test(prefix)) {
      const safePrefix = prefix.replace(/(?:Dr\.?|Prof\.?\s+)?[A-Za-z][A-Za-z.'’-]*(?:\s+[A-Za-z][A-Za-z.'’-]*)*/giu, "【需補：中文作者名】");
      output = safePrefix + output.slice(prefix.length);
    }
    const remainingBook = output.match(/《([^》]+)》/u)?.[1] || "";
    if (/[A-Za-z]/u.test(remainingBook)) output = output.replace(/《[^》]+》/u, "【需補：中文書名】");
    return output;
  }).join("\n");
}

function normalizeAlias(value: string): string {
  return value.normalize("NFKC").replace(/[\p{White_Space}\p{P}]/gu, "").toLocaleLowerCase();
}

/** 沒有讀入筆記時，不讓未驗證的英文人名或書名出現在引用句。 */
function normalizeUnmatchedCitationIdentifiers(input: string): string {
  return input.split("\n").map((line) => {
    if (!line.includes("《")) return line;
    let output = line.replace(/《[^》]*[A-Za-z][^》]*》/gu, "《【需補：中文書名】》");
    const beforeBook = output.split("《")[0];
    if (/[A-Za-z]/u.test(beforeBook)) {
      output = beforeBook.replace(/(?:Dr\.?|Prof\.?\s+)?[A-Za-z][A-Za-z.'’-]*(?:\s+[A-Za-z][A-Za-z.'’-]*)*/giu, "【需補：中文作者名】") + output.slice(beforeBook.length);
    }
    return output;
  }).join("\n");
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
