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

/**
 * 拿掉 AI 常自己加上的「故事為示意、情境為虛構」這類聲明。
 * 例：「（故事情境為示意）」「（以上情境純屬虛構）」「本文案例為示意」整行或括號都拿掉。
 * 非紀實靠寫法（「想像一個場景」「有一種人」），不靠文章裡的聲明。
 */
const DISCLAIMER_WORDS = "(?:為示意|僅為示意|僅供示意|屬示意|示意用|純屬虛構|屬虛構|為虛構|虛構情境|非真實|非紀實|改編而成|匿名改寫|僅供參考)";
const DISCLAIMER_TOPIC = "(?:故事|情境|情節|案例|人物|場景|對話|內容|文中|本文|以上|上述)";
export function stripDisclaimers(input: string): string {
  if (!input) return input;
  const wrapped = new RegExp(`^[ \\t　]*[（(【\\[][^）)】\\]\\n]{0,40}${DISCLAIMER_WORDS}[^）)】\\]\\n]{0,40}[）)】\\]][ \\t　]*$`, "gm");
  const plainLine = new RegExp(`^[ \\t　]*[^。！？，,、（）()\\n]{0,20}${DISCLAIMER_TOPIC}[^。！？，,、（）()\\n]{0,16}${DISCLAIMER_WORDS}[^。！？，,、（）()\\n]{0,10}[。.]?[ \\t　]*$`, "gm");
  const inline = new RegExp(`[（(][^）)\\n]{0,30}${DISCLAIMER_TOPIC}[^）)\\n]{0,20}${DISCLAIMER_WORDS}[^）)\\n]{0,20}[）)]`, "g");
  return input.replace(wrapped, "").replace(plainLine, "").replace(inline, "").replace(/\n{3,}/g, "\n\n").trim();
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
/** 對外品牌名稱統一：平衡空間、艾伯林量子調頻、初八企業顧問。把縮寫與舊稱換成全名。 */
export function normalizeBrandNames(input: string): string {
  if (!input) return input;
  return input
    .replace(/NOAGE\s*SPACE\s*平衡空間/gi, "平衡空間")
    .replace(/NAS\s*[（(]?\s*平衡空間[^）)\n]{0,12}[）)]?(?:\s*生命數字)?/g, "平衡空間")
    .replace(/NAS\s*生命數字/g, "平衡空間")
    .replace(/\bNAS\b/g, "平衡空間")
    .replace(/ABLIENE\s*艾伯林量子調頻/gi, "艾伯林量子調頻")
    .replace(/ABL\s*[（(]?\s*(?:艾伯林量子調頻|量子調頻)[）)]?/g, "艾伯林量子調頻")
    .replace(/ABL\s*艾伯林調頻官網/g, "艾伯林量子調頻官網")
    .replace(/ABL\s*(?:信息場調和|（信息場調頻）)/g, "艾伯林量子調頻")
    .replace(/\bABL\b/g, "艾伯林量子調頻")
    .replace(/INITIAL8\s*CO\.?\s*初八(?:信息|企業)顧問/gi, "初八企業顧問")
    .replace(/初八信息顧問\s*[（(]?\s*I8\s*[）)]?/g, "初八企業顧問")
    .replace(/I8\s*[（(]\s*Initial\s*8\s*CO\.?\s*[）)]/gi, "初八企業顧問")
    .replace(/I8\s*(?:企業顧問|企業醫生)/g, "初八企業顧問")
    .replace(/初八信息顧問/g, "初八企業顧問")
    .replace(/\bI8\b/g, "初八企業顧問");
}

export function stripDashes(input: string): string {
  if (!input) return input;
  input = normalizeBrandNames(stripDisclaimers(input));
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

const DIAGRAM_START = /^\s*(?:%%\s*\{\s*init\b|flowchart(?:\s+(?:TD|LR|BT|RL|TB)\b|$)|graph(?:\s+(?:TD|LR|BT|RL|TB)\b|$))/i;
const DIAGRAM_LINE = /^\s*(?:(?:subgraph|end|classDef|style|click|linkStyle)\b|[\w\p{L}\p{N}_]+(?:\[[^\]]*\]|\([^)]*\)|\{[^}]*\})?\s*(?:-->|---|-\.->|==>|<--|--|-\.))/u;

/**
 * 社群貼文發出去之前，拿掉 Mermaid 流程圖：```mermaid 區塊、單獨一行的「---mermaid---」標記，
 * 以及沒包程式碼框的 %%{init}%% 與 flowchart / graph 圖表語法。
 * 流程圖是給官網文章用的，社群平台不會把它畫成圖，貼出去只會是一堆程式碼。
 */
export function stripDiagramBlocks(input: string): string {
  if (!input) return input;
  const lines = input.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; ) {
    const line = lines[i];
    if (/^\s*```/.test(line)) {
      let end = i + 1;
      while (end < lines.length && !/^\s*```\s*$/.test(lines[end])) end += 1;
      const closed = end < lines.length;
      const body = lines.slice(i + 1, closed ? end : lines.length);
      const isDiagram = /^\s*```\s*mermaid\b/i.test(line) || body.some((l) => DIAGRAM_START.test(l));
      if (!isDiagram) out.push(...lines.slice(i, closed ? end + 1 : lines.length));
      i = closed ? end + 1 : lines.length;
      continue;
    }
    if (/^\s*[-=_—─\s]*mermaid[-=_—─\s]*$/i.test(line)) { i += 1; continue; }
    if (/^\s*%%\s*\{\s*init\b/i.test(line)) {
      if (!/\}\s*%%/.test(line)) {
        i += 1;
        while (i < lines.length && !/\}\s*%%/.test(lines[i])) i += 1;
      }
      i += 1;
      continue;
    }
    if (DIAGRAM_START.test(line)) {
      i += 1;
      while (i < lines.length && lines[i].trim() && DIAGRAM_LINE.test(lines[i])) i += 1;
      continue;
    }
    out.push(line);
    i += 1;
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
