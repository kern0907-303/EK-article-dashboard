import {
  getCitationName,
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
const KNOWLEDGE_V2_CONTENT_MAX_CHARS = Math.max(24_000, KNOWLEDGE_CONTENT_MAX_CHARS);
const KNOWLEDGE_V2_MAINLINE_MAX_CHARS = 8_000;
const INDEX_HEADING = /^(?:全書索引|整體索引|全書知識索引|knowledge index|book index)(?:\s|[（(：:]|$)/iu;
const UNIT_HEADING = /^#{1,6}\s+\[U\d{4}\](?:\s|$)/u;
const V2_UNIT_HEADING = /^\[U(\d{4})\]\s*(.*)$/u;

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

function sectionForHeading(content: string, heading: ReturnType<typeof markdownHeadings>[number], headings = markdownHeadings(content)): string {
  const next = headings.find((candidate) => candidate.index > heading.index && candidate.level <= heading.level);
  return content.slice(heading.index, next?.index ?? content.length).trim();
}

function splitV2Units(content: string) {
  const headings = markdownHeadings(content);
  const units = headings.filter((heading) => heading.level === 3 && V2_UNIT_HEADING.test(heading.title));
  return units.map((heading, index) => {
    const next = headings.find((candidate) => candidate.index > heading.index && candidate.level <= 3);
    const match = heading.title.match(V2_UNIT_HEADING);
    return {
      id: match?.[1] || "",
      title: match?.[2]?.trim() || "",
      index,
      text: content.slice(heading.index, next?.index ?? content.length).trim(),
    };
  }).filter((unit) => unit.text);
}

function v2UnitSections(unit: string) {
  const headings = markdownHeadings(unit);
  return headings.filter((heading) => heading.level === 4).map((heading) => ({
    title: heading.title,
    heading,
    text: sectionForHeading(unit, heading, headings),
  }));
}

type V2CardKind = "故事卡" | "例子卡" | "圖示卡";
type V2Card = { kind: V2CardKind; title: string; text: string; score: number; index: number };

function collectV2Cards(unit: string, topic: string): V2Card[] {
  const headings = markdownHeadings(unit);
  const cards: V2Card[] = [];
  let activeKind: V2CardKind | null = null;
  let cardIndex = 0;
  for (let i = 0; i < headings.length; i += 1) {
    const heading = headings[i];
    if (heading.level === 4) {
      activeKind = (["故事卡", "例子卡", "圖示卡"] as const).find((kind) => heading.title.includes(kind)) || null;
      continue;
    }
    if (heading.level !== 5) continue;
    const kind = (["故事卡", "例子卡", "圖示卡"] as const).find((candidate) => heading.title.includes(candidate)) || activeKind;
    if (!kind) continue;
    const next = headings.find((candidate) => candidate.index > heading.index && candidate.level <= 5);
    const text = unit.slice(heading.index, next?.index ?? unit.length).trim();
    const title = heading.title.trim();
    const readerPainPoint = text.match(/^讀者卡點\s*[：:]\s*(.+)$/mu)?.[1] || "";
    const scoreText = kind === "故事卡" ? `${title}\n${readerPainPoint}` : title;
    cards.push({ kind, title, text, score: v2TopicScore(scoreText, topic), index: cardIndex++ });
  }
  return cards;
}

function v2TopicTerms(topic: string): string[][] {
  const phrases = topic.toLowerCase().split(/\s*(?:與|和|及|或|、|，|,|；|;|\band\b|&)\s*/iu).map((part) => part.trim()).filter(Boolean);
  return phrases.map((phrase) => {
    if (!/^[\u3400-\u9fff]+$/u.test(phrase) || phrase.length <= 2) return [phrase];
    const tokens = [phrase];
    for (let i = 0; i + 1 < phrase.length; i += 1) {
      const token = phrase.slice(i, i + 2);
      if (!["人生", "生活", "如何", "方式", "以及", "本身"].includes(token)) tokens.push(token);
    }
    return [...new Set(tokens)];
  });
}

function v2TopicScore(text: string, topic: string): number {
  const normalized = text.toLowerCase();
  return v2TopicTerms(topic).reduce((score, phraseTerms) => {
    const phrase = phraseTerms[0];
    if (phrase && phrase.length >= 3 && normalized.includes(phrase)) return score + 4;
    if (phrase && phrase.length <= 2 && normalized.includes(phrase)) return score + 3;
    const matched = phraseTerms.slice(1).filter((term) => normalized.includes(term)).length;
    return score + (matched >= 2 ? matched : 0);
  }, 0);
}

function takeAtReadableBoundary(text: string, maxChars: number): string {
  if (countChars(text) <= maxChars) return text;
  if (maxChars <= 0) return "";
  const prefix = [...text].slice(0, maxChars).join("");
  const lastLine = prefix.lastIndexOf("\n");
  const lastSentence = Math.max(prefix.lastIndexOf("。"), prefix.lastIndexOf("！"), prefix.lastIndexOf("？"), prefix.lastIndexOf("."));
  const boundary = Math.max(lastLine, lastSentence >= 0 ? lastSentence + 1 : -1);
  return (boundary > 0 ? prefix.slice(0, boundary) : prefix).trimEnd();
}

function truncateV2Mainline(section: string): string {
  if (countChars(section) <= KNOWLEDGE_V2_MAINLINE_MAX_CHARS) return section;
  const labels = [...section.matchAll(/^(一句話核心主張|主線敘述|章節邏輯鏈|關鍵概念)\s*[：:]\s*(.*)$/gmu)];
  if (!labels.length) return takeAtReadableBoundary(section, KNOWLEDGE_V2_MAINLINE_MAX_CHARS);

  const prefix = section.slice(0, labels[0].index).trimEnd();
  const blocks = labels.map((match, index) => ({
    label: match[1],
    body: [match[2], section.slice((match.index ?? 0) + match[0].length, labels[index + 1]?.index ?? section.length)]
      .filter(Boolean).join("\n").trim(),
  }));
  const claim = blocks.find((block) => block.label === "一句話核心主張");
  const narrative = blocks.find((block) => block.label === "主線敘述");
  const chain = blocks.find((block) => block.label === "章節邏輯鏈");
  const concepts = blocks.find((block) => block.label === "關鍵概念");
  const render = (block: typeof blocks[number], body = block.body) => `${block.label}：${body}`.trimEnd();
  const join = (...parts: string[]) => parts.filter(Boolean).join("\n\n");

  // 主張與章節鏈先保留；若其餘核心敘述超出上限，只縮短主線敘述，概念清單最後才補入。
  const fixed = join(prefix, claim ? render(claim) : "", chain ? render(chain) : "");
  const narrativeHeader = narrative ? `${narrative.label}：` : "";
  const narrativeRoom = Math.max(0, KNOWLEDGE_V2_MAINLINE_MAX_CHARS - countChars(fixed) - (narrativeHeader ? countChars(narrativeHeader) + 2 : 0));
  const narrativeBody = narrative ? (countChars(narrative.body) <= narrativeRoom ? narrative.body : takeAtReadableBoundary(narrative.body, narrativeRoom)) : "";
  let result = join(prefix, claim ? render(claim) : "", narrative ? render(narrative, narrativeBody) : "", chain ? render(chain) : "");

  if (countChars(result) > KNOWLEDGE_V2_MAINLINE_MAX_CHARS) {
    // 極端情況下主張、敘述與章節鏈本身已超限：保留主張與兩個區塊標題，
    // 把剩餘空間分給敘述和章節鏈，兩者都在可讀邊界截短。
    const claimText = claim ? render(claim) : "";
    const narrativeHead = narrative ? `${narrative.label}：` : "";
    const chainHead = chain ? `${chain.label}：` : "";
    const headers = join(prefix, claimText, narrativeHead, chainHead);
    const available = Math.max(0, KNOWLEDGE_V2_MAINLINE_MAX_CHARS - countChars(headers));
    const narrativeBudget = narrative && chain ? Math.floor(available / 2) : narrative ? available : 0;
    const chainBudget = chain ? available - narrativeBudget : 0;
    result = join(
      prefix,
      claimText,
      narrative ? render(narrative, takeAtReadableBoundary(narrative.body, narrativeBudget)) : "",
      chain ? render(chain, takeAtReadableBoundary(chain.body, chainBudget)) : "",
    );
  }

  const remaining = KNOWLEDGE_V2_MAINLINE_MAX_CHARS - countChars(result) - (concepts ? 2 : 0);
  if (concepts && remaining > countChars(`${concepts.label}：`)) {
    const conceptHeader = `${concepts.label}：`;
    const bodyBudget = remaining - countChars(conceptHeader);
    const body = countChars(concepts.body) <= bodyBudget ? concepts.body : takeAtReadableBoundary(concepts.body, bodyBudget);
    result = join(result, render(concepts, body));
  }
  return countChars(result) <= KNOWLEDGE_V2_MAINLINE_MAX_CHARS
    ? result
    : takeAtReadableBoundary(result, KNOWLEDGE_V2_MAINLINE_MAX_CHARS);
}

function v2ChapterBase(unit: { id: string; title: string; index: number; text: string }, topic: string) {
  const sections = v2UnitSections(unit.text);
  const thesis = sections.find((section) => section.title.includes("章旨與承接"));
  if (!thesis) return null;
  const cards = collectV2Cards(unit.text, topic);
  const selectedCards = (["故事卡", "例子卡", "圖示卡"] as const).flatMap((kind) => {
    const ranked = cards.filter((card) => card.kind === kind).sort((a, b) => b.score - a.score || a.index - b.index);
    return ranked.length ? [ranked[0]] : [];
  });
  const header = `### [U${unit.id}] ${unit.title}`;
  const parts = [header, thesis.text, ...selectedCards.flatMap((card) => [`#### ${card.kind}`, card.text])];
  const metadata = `${unit.title}\n${thesis.text}\n${selectedCards.map((card) => `${card.title}\n${card.kind === "故事卡" ? (card.text.match(/^讀者卡點\s*[：:]\s*(.+)$/mu)?.[1] || "") : ""}`).join("\n")}`;
  return { text: parts.join("\n\n"), score: v2TopicScore(metadata, topic), index: unit.index, unit };
}

function v2PointEvidenceSections(unit: string, topic: string) {
  return v2UnitSections(unit).filter(({ title }) => title.includes("論點") || title.includes("佐證"))
    .map((section, index) => ({ ...section, score: v2TopicScore(`${section.title}\n${section.text}`, topic), index }));
}

function selectV2KnowledgeContent(content: string, topic: string): string {
  const headings = markdownHeadings(content);
  const mainlineHeading = headings.find((heading) => heading.level === 2 && heading.title.trim() === "全書主線");
  if (!mainlineHeading) return "";
  const mainline = truncateV2Mainline(sectionForHeading(content, mainlineHeading, headings));
  const chapters = splitV2Units(content)
    .map((unit) => v2ChapterBase(unit, topic))
    .filter((chapter): chapter is NonNullable<typeof chapter> => Boolean(chapter))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const selected: string[] = [];
  let used = countChars(mainline);
  for (const chapter of chapters) {
    if (chapter.score <= 0) continue;
    const candidate = chapter.text;
    const withSeparator = `${mainline}${selected.length ? "\n\n" : "\n\n"}${[...selected, candidate].join("\n\n")}`;
    if (countChars(withSeparator) > KNOWLEDGE_V2_CONTENT_MAX_CHARS) continue;
    selected.push(candidate);
    used = countChars(mainline) + 2 + countChars(selected.join("\n\n"));
  }

  // 論點與佐證只使用完整章卡已納入後剩下的額度。
  const selectedIds = new Set(chapters.filter((chapter) => selected.includes(chapter.text)).map((chapter) => chapter.unit.id));
  const extras = chapters.filter((chapter) => selectedIds.has(chapter.unit.id))
    .flatMap((chapter) => v2PointEvidenceSections(chapter.unit.text, topic).map((section) => ({ ...section, chapter })))
    .sort((a, b) => b.score - a.score || a.chapter.index - b.chapter.index || a.index - b.index);
  const result = [mainline, ...selected];
  for (const extra of extras) {
    const separator = 2;
    const remaining = KNOWLEDGE_V2_CONTENT_MAX_CHARS - used - separator;
    if (remaining <= 0) break;
    const text = countChars(extra.text) <= remaining ? extra.text : truncateUnitSection(extra.text, remaining);
    if (!text || countChars(text) > remaining) continue;
    result.push(text);
    used += countChars(text) + separator;
  }
  return result.join("\n\n").trim();
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
  if (/^##\s+全書主線(?:\s|$)/mu.test(normalized)) return selectV2KnowledgeContent(normalized, topic);
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
  note: (Pick<KnowledgeNoteRecord, "title_zh" | "author_zh" | "zh_status"> & { title?: string | null; author?: string | null }) | null,
  required: boolean
): { content: string; valid: boolean; citationTitle: string | null; citationAuthor: string | null; reminder: string | null } {
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
      reminder: null,
    };
  }

  const name = getCitationName(note);
  const titleZh = name?.title ?? null;
  const authorZh = name?.author ?? null;
  const eligible = name !== null;
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
  const source = valid ? `出處：文中引用的觀點，出自${authorZh}所著《${titleZh}》。故事情境與其他內容為艾瑞克的整理與詮釋。` : "";
  const canonical = stripDashes(stripMarkdown(source));
  return {
    content: [body, canonical].filter(Boolean).join("\n\n"),
    valid,
    citationTitle: valid ? titleZh : null,
    citationAuthor: valid ? authorZh : null,
    // 出處驗證失敗時，文章裡不留任何標記，也不放出處行；提醒另外顯示在文章外面
    reminder: valid ? null : "引用來源未通過驗證，本篇沒有出處行也沒有引用書籍。若要引用，請先選一筆已確認的引用筆記再重新生成。",
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
