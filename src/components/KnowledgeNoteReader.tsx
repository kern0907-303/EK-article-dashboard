import { createElement } from "react";

export type KnowledgeNoteBlock =
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "code"; text: string };

export function parseKnowledgeNoteBlocks(content: string): KnowledgeNoteBlock[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: KnowledgeNoteBlock[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }

    if (/^```/.test(line.trim())) {
      index += 1;
      const code: string[] = [];
      while (index < lines.length && !/^```/.test(lines[index].trim())) code.push(lines[index++]);
      if (index < lines.length) index += 1;
      blocks.push({ kind: "code", text: code.join("\n") });
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/u);
    if (heading) {
      blocks.push({ kind: "heading", level: heading[1].length, text: heading[2].trim() });
      index += 1;
      continue;
    }

    const unordered = line.match(/^\s*[-*+]\s+(.+)$/u);
    const ordered = line.match(/^\s*\d+[.)、]\s+(.+)$/u);
    if (unordered || ordered) {
      const orderedList = Boolean(ordered);
      const items: string[] = [];
      while (index < lines.length) {
        const match = orderedList
          ? lines[index].match(/^\s*\d+[.)、]\s+(.+)$/u)
          : lines[index].match(/^\s*[-*+]\s+(.+)$/u);
        if (!match) break;
        items.push(match[1]);
        index += 1;
      }
      blocks.push({ kind: "list", ordered: orderedList, items });
      continue;
    }

    const paragraph = [line];
    index += 1;
    while (index < lines.length && lines[index].trim() &&
      !/^#{1,6}\s+/u.test(lines[index]) && !/^```/u.test(lines[index].trim()) &&
      !/^\s*[-*+]\s+/u.test(lines[index]) && !/^\s*\d+[.)、]\s+/u.test(lines[index])) {
      paragraph.push(lines[index++]);
    }
    blocks.push({ kind: "paragraph", text: paragraph.join("\n") });
  }
  return blocks;
}

const HEADING_STYLES: Record<number, string> = {
  1: "text-xl font-bold text-slate-100",
  2: "text-lg font-bold text-slate-100",
  3: "text-base font-semibold text-slate-100",
  4: "text-sm font-semibold text-slate-200",
  5: "text-xs font-semibold text-slate-200",
  6: "text-xs font-medium text-slate-300",
};

/** Render Markdown headings semantically so v1 and v2 note hierarchy stays readable. */
export default function KnowledgeNoteReader({ content }: { content: string }) {
  return <article className="space-y-3 break-words text-sm leading-relaxed text-slate-300">
    {parseKnowledgeNoteBlocks(content).map((block, index) => {
      if (block.kind === "heading") {
        const tag = `h${block.level}`;
        return createElement(tag, { key: index, className: HEADING_STYLES[block.level] || HEADING_STYLES[6] }, block.text);
      }
      if (block.kind === "paragraph") return <p key={index} className="whitespace-pre-wrap">{block.text}</p>;
      if (block.kind === "code") return <pre key={index} className="overflow-auto rounded-lg bg-slate-950 p-3 text-xs whitespace-pre-wrap">{block.text}</pre>;
      const Tag = block.ordered ? "ol" : "ul";
      return <Tag key={index} className={block.ordered ? "list-decimal space-y-1 pl-6" : "list-disc space-y-1 pl-6"}>
        {block.items.map((item, itemIndex) => <li key={itemIndex} className="whitespace-pre-wrap">{item}</li>)}
      </Tag>;
    })}
  </article>;
}
