// SEO 優化會把全文交給 AI 改寫，而 AI 被要求「純文字、不可有反引號」，
// 所以原文裡的 Mermaid 圖表區塊（```mermaid ... ```）和 Markdown 圖片會被丟掉。
// 解法：送出前先把這些區塊換成一行佔位標記，AI 改完後再原樣放回去。

const TOKEN_RE = /【保留區塊(\d+)】/g;
const tokenOf = (i: number) => `【保留區塊${i + 1}】`;

export interface ProtectedText {
  text: string;
  blocks: string[];
}

/** 把程式碼區塊與整行的 Markdown 圖片換成單獨一行的佔位標記 */
export function extractProtected(input: string): ProtectedText {
  const blocks: string[] = [];
  const push = (m: string) => {
    blocks.push(m);
    return `\n\n${tokenOf(blocks.length - 1)}\n\n`;
  };
  const text = (input || "")
    .replace(/```[\s\S]*?```/g, push)
    .replace(/^[ \t]*!\[[^\]\n]*\]\([^)\n]+\)[ \t]*$/gm, push)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text, blocks };
}

/**
 * 把佔位標記換回原始區塊。
 * AI 若不小心刪掉某個標記，就依原本在全文中的相對位置補回（不會整個消失）。
 */
export function restoreProtected(output: string, original: ProtectedText): string {
  const { blocks, text: originalText } = original;
  if (blocks.length === 0) return output;

  let result = (output || "").replace(TOKEN_RE, (m, n) => {
    const b = blocks[Number(n) - 1];
    return b !== undefined ? b : m;
  });

  blocks.forEach((block, i) => {
    if (result.includes(block)) return;
    const pos = originalText.indexOf(tokenOf(i));
    const ratio = pos >= 0 && originalText.length > 0 ? pos / originalText.length : 1;
    const paras = result.split(/\n\s*\n/);
    const at = Math.min(paras.length, Math.max(1, Math.round(ratio * paras.length)));
    paras.splice(at, 0, block);
    result = paras.join("\n\n");
  });

  return result;
}

export const hasProtectedToken = (s: string) => /【保留區塊\d+】/.test(s);
