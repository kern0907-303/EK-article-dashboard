// 文章配圖的純函式：取圖卡標題、把配圖放進文章內文。不依賴伺服器環境，方便單獨測試。

const MD_IMAGE = /!\[[^\]]*\]\((https:\/\/[^)\s]+)\)/;

/** 圖卡上的主標：取文章第一個非空行（通常是標題），去掉 Markdown 符號，過長就截短。 */
export function cardHeadline(content = "", maxChars = 36) {
  const lines = String(content).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const first = (lines.find((line) => !MD_IMAGE.test(line)) || "").replace(/^#+\s*/, "").replace(/[*_`>|]/g, "").trim();
  const chars = [...first];
  return chars.length > maxChars ? `${chars.slice(0, maxChars).join("")}…` : first;
}

/** 內文裡已經有的第一張 https 圖片網址，沒有則回傳空字串。 */
export function firstImageUrl(content = "") {
  const match = String(content).match(MD_IMAGE);
  return match ? match[1] : "";
}

/**
 * 官網用：把配圖放在標題（第一個非空行）正下方，官網會把第一張圖當封面與分享圖。
 * 內文已經有同一張圖就不重複加。
 */
export function withCoverImage(content = "", imageUrl = "", alt = "配圖") {
  const text = String(content);
  if (!imageUrl || text.includes(imageUrl)) return text;
  const lines = text.split(/\r?\n/);
  const at = lines.findIndex((line) => line.trim().length > 0);
  if (at < 0) return text;
  const image = `![${alt}](${imageUrl})`;
  return [...lines.slice(0, at + 1), "", image, ...lines.slice(at + 1)].join("\n").replace(/\n{3,}/g, "\n\n");
}

/** Facebook 用：n8n 會取內文第一張 Markdown 圖當貼文圖片，並把圖片語法從文字拿掉，所以放最前面。 */
export function withLeadingImage(content = "", imageUrl = "", alt = "配圖") {
  const text = String(content);
  if (!imageUrl || text.includes(imageUrl)) return text;
  return `![${alt}](${imageUrl})\n\n${text}`;
}
