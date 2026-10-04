/**
 * 去掉 AI 常用來「分隔段落」或「標記小標」的破折號線與符號線。
 * 只處理整行都是符號的線，以及行首的破折號記號；句子中間的標點不動。
 * 例：「———」「──────」「----」單獨一行 → 移除；「── 小標」→「小標」。
 */
export function stripDividers(input: string): string {
  if (!input) return input;
  return input
    .replace(/\r\n/g, "\n")
    .replace(/^[ \t　]*[—―─━═－–]{2,}[ \t　]*$/gm, "")   // 整行都是破折號／橫線
    .replace(/^[ \t　]*[-=_]{3,}[ \t　]*$/gm, "")        // --- === ___ 整行分隔線
    .replace(/^[ \t　]*[—―─━═－–]{2,}[ \t　]*(?=[^\s—―─━═－–])/gm, "") // 行首「── 小標」記號
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const DASH_CHARS = "—―─━═–－";

/**
 * 全面去除破折號（四個品牌通用）：
 * 1. 整行分隔線、行首小標記號先清掉（stripDividers）
 * 2. 數字區間「10–20」改成「10到20」
 * 3. 句中的「——」「—」「–」等一律拿掉：夾在字與字之間換成「，」，
 *    貼著標點、引號、行首行尾的直接刪除
 * 4. 有空格夾住的「 - 」「 -- 」也視為破折號處理
 * ``` 程式碼區塊（Mermaid 圖表等）原樣保留，不動。
 */
export function stripDashes(input: string): string {
  if (!input) return input;
  const blocks: string[] = [];
  const masked = input.replace(/```[\s\S]*?```/g, (m) => {
    blocks.push(m);
    return `\u0000${blocks.length - 1}\u0000`;
  });
  const dashRun = new RegExp(`[ \\t　]*[${DASH_CHARS}]+[ \\t　]*`, "g");
  const closing = /[」』）)】》〉，。！？；：、,.!?;:]/;
  const opening = /[「『（(【《〈]/;
  let out = stripDividers(masked)
    .replace(new RegExp(`(\\d)[ \\t]*[${DASH_CHARS}][ \\t]*(?=\\d)`, "g"), "$1到")
    .replace(dashRun, (m, offset: number, whole: string) => {
      const prev = offset > 0 ? whole[offset - 1] : "\n";
      const next = offset + m.length < whole.length ? whole[offset + m.length] : "\n";
      if (prev === "\n" || next === "\n") return "";
      if (closing.test(next) || closing.test(prev) || opening.test(next) || opening.test(prev)) return "";
      return "，";
    })
    .replace(/(?<=\S)[ \t]+-{1,2}[ \t]+(?=\S)/g, "，")
    .replace(/(?<=[^\s-])--+(?=[^\s->])/g, "，");
  out = out.replace(/\n{3,}/g, "\n\n").trim();
  return out.replace(/\u0000(\d+)\u0000/g, (_m, i) => blocks[Number(i)]);
}

/**
 * 把 AI 常帶出來的 Markdown 符號清成可直接貼上的純文字
 * （Facebook、官網 FAQ 區都不吃 ** ## 這類符號）。
 * 只動格式符號，不改文字內容。
 */
export function stripMarkdown(input: string): string {
  if (!input) return input;
  const cleaned = stripDividers(input)
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
  return stripDashes(cleaned);
}
