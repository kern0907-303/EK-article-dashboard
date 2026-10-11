// 圖卡版面的純函式：尺寸預設、品牌樣式、斷行規則。
// 不依賴伺服器環境，方便單獨測試；實際畫圖在 card-render-server.tsx。

/**
 * 尺寸預設。寬一律 1080。
 * official：true 表示該數字取自平台官方說明頁（2026-10-11 實際讀取）；false 表示是保守留白，不是官方像素。
 * 出處：
 * - Instagram 貼文：help.instagram.com/1631821640426723（寬最大 1080，長寬比 1.91:1 到 3:4，高 566 到 1440）
 * - Instagram 限動：Meta 企業商家說明 2222978001316177（建議 1080x1920，最小 600x1067，JPG 或 PNG，30MB 以下）
 * - Facebook 動態：Meta 企業商家說明 103816146375741（單張圖建議 4:5，1:1 與 4:5 皆支援）
 * - Threads：官方 API 文件（JPEG 或 PNG，8MB 以下，長寬比上限 10:1，寬 320 到 1440）
 * - Meta 安全區域說明（980593475366490）只給原則（9:16 避開上下左右邊緣），沒有像素數字，
 *   所以限動的上 250、下 340 是本專案的保守留白，official 標 false。
 */
export const CARD_SIZES = {
  ig_feed: { label: "Instagram 貼文 4:5", width: 1080, height: 1350, insetTop: 0, insetBottom: 0, official: true },
  ig_grid34: { label: "Instagram 貼文 3:4（官方上限）", width: 1080, height: 1440, insetTop: 0, insetBottom: 0, official: true },
  ig_square: { label: "Instagram 貼文 1:1", width: 1080, height: 1080, insetTop: 0, insetBottom: 0, official: true },
  ig_story: { label: "Instagram 限動與 Reels 9:16", width: 1080, height: 1920, insetTop: 250, insetBottom: 340, official: false },
  fb_feed: { label: "Facebook 動態 4:5", width: 1080, height: 1350, insetTop: 0, insetBottom: 0, official: true },
  threads: { label: "Threads 4:5", width: 1080, height: 1350, insetTop: 0, insetBottom: 0, official: true },
};
export const DEFAULT_CARD_SIZE = "ig_feed";

export function resolveCardSize(key) {
  return CARD_SIZES[key] ? { key, ...CARD_SIZES[key] } : { key: DEFAULT_CARD_SIZE, ...CARD_SIZES[DEFAULT_CARD_SIZE] };
}

/**
 * 品牌樣式，顏色與位置取自 2026-10-11 使用者提供的四張 1080x1350 參考圖。
 * zone：文字區，高度的比例（0 到 1），放在漸層較淺的位置，讓字更清楚。
 * 文字色依漸層算過 WCAG 對比：ABL 最低約 10.7，Erick 約 6.9，I8 與 NAS（上白下深）用近黑字配上移的文字區，約 7.7 到 8.0。
 */
export const CARD_BRANDS = {
  brand_c_abl: {
    key: "abl", label: "ABLIENE 艾伯林量子調頻", logo: "abl-logo.png",
    from: "#ffffff", to: "#11e7de", text: "#0a2a33", footer: "#2f3b40",
    zone: [0.28, 0.74], logoBox: { x: 108, y: 118, h: 140 },
  },
  personal_brand: {
    key: "erick", label: "ERICK FIRM", logo: "erick-logo.png",
    from: "#368085", to: "#0d1e4d", text: "#ffffff", footer: "#ffffff",
    zone: [0.3, 0.76], logoBox: { x: 108, y: 108, w: 160, h: 160 },
  },
  brand_a_i8: {
    key: "i8", label: "INITIAL8 CO.初八信息顧問", logo: "i8-logo.png",
    from: "#ffffff", to: "#0555bf", text: "#000000", footer: "#ffffff",
    zone: [0.26, 0.56], logoBox: { x: 109, y: 126, w: 108, h: 108 },
  },
  brand_b_nas: {
    key: "nas", label: "NOAGE SPACE 平衡空間", logo: "nas-logo.png",
    from: "#ffffff", to: "#8c2c87", text: "#000000", footer: "#fff1e6",
    zone: [0.26, 0.56], logoBox: { x: 84, y: 83, w: 150, h: 150 },
  },
};
export const DEFAULT_CARD_BRAND = "personal_brand";

export function cardBrandFor(brandId) {
  return CARD_BRANDS[brandId] || CARD_BRANDS[DEFAULT_CARD_BRAND];
}

export const CARD_MARGIN_X = 108;
export const CARD_FONT_SIZES = [96, 88, 80, 72, 64, 58, 52, 46];
export const CARD_LINE_HEIGHT = 1.5;

const NO_LINE_START = new Set("，。、；：！？）」』》〉】〕…‧,.;:!?)]}%".split(""));
const NO_LINE_END = new Set("（「『《〈【〔([{".split(""));

/** 估算單字寬度（單位：字級的倍數）。全形字 1，英數約 0.58，空白約 0.3。 */
export function charWidth(ch) {
  if (/\s/.test(ch)) return 0.3;
  if (/[\u0000-ÿ]/.test(ch)) return 0.58;
  return 1;
}

export function textWidth(text, fontSize, letterSpacing = 0) {
  let w = 0;
  for (const ch of text) w += charWidth(ch) * fontSize + letterSpacing;
  return w;
}

/** 把文字切成斷行單位：連續的英數（例如 2026、ABC）不拆開，其餘一字一單位。 */
function tokenize(text) {
  const tokens = [];
  const re = /[A-Za-z0-9]+(?:[.,][0-9]+)*|[\s\S]/gu;
  let m;
  while ((m = re.exec(text)) !== null) tokens.push(m[0]);
  return tokens;
}

function greedy(text, fontSize, width, letterSpacing) {
  const lines = [];
  let cur = "";
  for (const tok of tokenize(text)) {
    if (tok === "\n") { lines.push(cur.trimEnd()); cur = ""; continue; }
    if (!cur && /^\s$/.test(tok)) continue; // 行首不留空白
    const trial = cur + tok;
    if (!cur || textWidth(trial, fontSize, letterSpacing) <= width) { cur = trial; continue; }
    const chars = [...cur];
    if (NO_LINE_START.has(tok[0]) && chars.length > 1) {
      // 標點不能在行首：把上一個字一起帶到下一行
      lines.push(chars.slice(0, -1).join("").trimEnd());
      cur = chars[chars.length - 1] + tok;
    } else if (NO_LINE_END.has(chars[chars.length - 1]) && chars.length > 1) {
      // 開括號不能在行尾
      lines.push(chars.slice(0, -1).join("").trimEnd());
      cur = chars[chars.length - 1] + tok;
    } else {
      lines.push(cur.trimEnd());
      cur = /^\s$/.test(tok) ? "" : tok;
    }
  }
  if (cur.trim()) lines.push(cur.trimEnd());
  return lines;
}

/** 斷行：行數不變下盡量縮窄寬度，讓各行長度平均；最後一行至少 3 個字，避免孤字。 */
export function wrapLines(text, fontSize, width, letterSpacing = 0) {
  const base = greedy(text, fontSize, width, letterSpacing);
  if (base.length <= 1) return base;
  let lo = width * 0.5;
  let hi = width;
  let best = base;
  for (let i = 0; i < 18; i += 1) {
    const mid = (lo + hi) / 2;
    const candidate = greedy(text, fontSize, mid, letterSpacing);
    if (candidate.length <= base.length) { best = candidate; hi = mid; } else { lo = mid; }
  }
  const last = best[best.length - 1] || "";
  if ([...last].length < 3) {
    const retry = greedy(text, fontSize, width * 0.82, letterSpacing);
    if (retry.length === base.length && [...(retry[retry.length - 1] || "")].length >= 3) return retry;
  }
  return best;
}

/** 在文字區內挑最大的字級，回傳 { fontSize, lines, lineHeight }。 */
export function fitText(text, boxWidth, boxHeight, sizes = CARD_FONT_SIZES, letterSpacing = 1) {
  for (const size of sizes) {
    const lines = wrapLines(text, size, boxWidth, letterSpacing);
    const lineHeight = Math.round(size * CARD_LINE_HEIGHT);
    if (lines.length * lineHeight <= boxHeight) return { fontSize: size, lines, lineHeight };
  }
  const size = sizes[sizes.length - 1];
  return { fontSize: size, lines: wrapLines(text, size, boxWidth, letterSpacing), lineHeight: Math.round(size * CARD_LINE_HEIGHT) };
}

/** 算出版面：logo、文字區、頁尾的位置，回傳 renderer 直接使用的數字。 */
export function computeLayout(sizeKey, brandId, text) {
  const size = resolveCardSize(sizeKey);
  const brand = cardBrandFor(brandId);
  const { width: W, height: H, insetTop, insetBottom } = size;
  const usableTop = insetTop;
  const usableH = H - insetTop - insetBottom;
  const boxWidth = W - CARD_MARGIN_X * 2;
  const zoneTop = usableTop + Math.round(usableH * brand.zone[0]);
  const zoneBottom = usableTop + Math.round(usableH * brand.zone[1]);
  const fit = fitText(text, boxWidth, zoneBottom - zoneTop);
  const blockHeight = fit.lines.length * fit.lineHeight;
  const blockTop = Math.round(zoneTop + (zoneBottom - zoneTop - blockHeight) / 2);
  const footerY = H - insetBottom - 173;
  const logoBox = { ...brand.logoBox, y: brand.logoBox.y + insetTop };
  return { size, brand, ...fit, boxWidth, blockTop, blockHeight, footerY, logoBox, marginX: CARD_MARGIN_X };
}
