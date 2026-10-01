/**
 * 把 AI 常帶出來的 Markdown 符號清成可直接貼上的純文字
 * （Facebook、官網 FAQ 區都不吃 ** ## 這類符號）。
 * 只動格式符號，不改文字內容。
 */
export function stripMarkdown(input: string): string {
  if (!input) return input;
  return input
    .replace(/\r\n/g, "\n")
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")        // # 標題
    .replace(/\*\*\*([\s\S]+?)\*\*\*/g, "$1")      // ***粗斜體***
    .replace(/\*\*([\s\S]+?)\*\*/g, "$1")          // **粗體**
    .replace(/__([\s\S]+?)__/g, "$1")              // __粗體__
    .replace(/(^|[^\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])/g, "$1$2") // *斜體*
    .replace(/`([^`\n]+)`/g, "$1")             // `行內程式碼`
    .replace(/^\s*[-*]{3,}\s*$/gm, "")         // --- 分隔線
    .replace(/^\s*[-*+]\s+/gm, "・")            // 清單符號改成中文頓點
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
