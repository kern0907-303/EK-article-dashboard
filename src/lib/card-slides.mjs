// IG 圖卡用的純函式：從衍生稿文字取出每張輪播的文字，並決定字級。
// 不依賴任何伺服器環境，方便單獨測試。

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350; // 4:5
export const CARD_MAX_SLIDES = 10; // IG 輪播上限

const SLIDE_LINE = /^第\s*(\d+)\s*張\s*[：:]\s*(.*)$/;
const STOP_LINE = /^(?:說明文字|標籤|單則版|串文第|【需補)/;

/** 取出「第 N 張：文字」每一張的文字，保留順序；多行的內容會合併成同一張。 */
export function parseCarouselSlides(content = "") {
  const slides = [];
  let current = null;
  for (const rawLine of String(content).split(/\r?\n/)) {
    const line = rawLine.trim();
    const match = line.match(SLIDE_LINE);
    if (match) {
      current = { index: Number(match[1]), text: match[2].trim() };
      slides.push(current);
      continue;
    }
    if (!current) continue;
    if (!line) continue;
    if (STOP_LINE.test(line)) { current = null; continue; }
    current.text = `${current.text}\n${line}`.trim();
  }
  return slides.filter((slide) => slide.text).slice(0, CARD_MAX_SLIDES).map((slide, i) => ({ index: i + 1, text: slide.text }));
}

/** 依字數決定字級，字多就縮小，避免超出畫面。 */
export function cardFontSize(text = "", isCover = false) {
  const length = [...String(text).replace(/\s+/g, "")].length;
  const steps = isCover ? [[14, 118], [26, 100], [44, 84], [70, 68]] : [[16, 96], [30, 80], [52, 66], [80, 54]];
  for (const [limit, size] of steps) if (length <= limit) return size;
  return 44;
}

/** 卡片文字不得有破折號與 Markdown 符號。 */
export function cleanCardText(text = "") {
  return String(text)
    .replace(/[-‐-―−﹘﹣－]/gu, "，")
    .replace(/[#*`>|_]/g, "")
    .replace(/，{2,}/g, "，")
    .replace(/\s+\n/g, "\n")
    .trim();
}
