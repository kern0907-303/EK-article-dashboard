// 輪播圖卡文字的純函式：整理 AI 回傳的張數與文字、AI 失敗時的自動切段、各平台張數上限。
// 不依賴伺服器環境，方便單獨測試。

export const CAROUSEL_LIMITS = { instagram: 10, threads: 20 };
export const CAROUSEL_MIN = 2;
export const CAROUSEL_TARGET_MAX = 7; // AI 與自動切段的預設上限，使用者可手動加到 10
export const SLIDE_MAX_CHARS = 60;

/** 單張文字：去破折號與 Markdown 符號、壓掉多餘空白、過長就截短。 */
export function cleanSlideText(text = "", maxChars = SLIDE_MAX_CHARS) {
  const cleaned = String(text)
    .replace(/^第\s*\d+\s*張\s*[：:]\s*/, "")
    .replace(/[-‐-―−﹘﹣－─━]/gu, "，")
    .replace(/[#*`>|_]/g, "")
    .replace(/，{2,}/g, "，")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
  const chars = [...cleaned];
  return chars.length > maxChars ? chars.slice(0, maxChars).join("") : cleaned;
}

/** 整理成可出圖的文字陣列：清理、去空白、去重複、限制張數。 */
export function sanitizeSlides(list, max = CAROUSEL_LIMITS.instagram) {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const text = cleanSlideText(typeof raw === "string" ? raw : "");
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
    if (out.length >= max) break;
  }
  return out;
}

/** 從模型回傳的文字取出 {"slides":[...]}，容忍前後多餘文字或 ``` 包裝。 */
export function parseSlidesJson(text = "") {
  const raw = String(text);
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return [];
  try {
    const data = JSON.parse(raw.slice(start, end + 1));
    return Array.isArray(data?.slides) ? data.slides.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

/**
 * AI 失敗或不想花額度時的自動切段：第 1 張放標題，之後依序取各段落的第一句，直到湊滿 maxSlides。
 * 只做機械式切分，品質不如 AI 濃縮，使用者可以再逐張修改。
 */
export function splitArticleToSlides(content = "", maxSlides = CAROUSEL_TARGET_MAX) {
  const lines = String(content).split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !/^!\[/.test(l));
  if (!lines.length) return [];
  const title = lines[0].replace(/^#+\s*/, "");
  const slides = [title];
  for (const line of lines.slice(1)) {
    if (/^#{1,6}\s/.test(line)) continue;
    const sentence = (line.replace(/^[*\-•·\d.、)\s]+/, "").match(/^[^。！？!?]+[。！？!?]?/u) || [""])[0].trim();
    if ([...sentence].length < 6) continue;
    slides.push(sentence);
    if (slides.length >= maxSlides) break;
  }
  return sanitizeSlides(slides, maxSlides);
}

/** 該平台一則輪播可以放幾張。 */
export function carouselLimit(platform) {
  return platform === "threads" ? CAROUSEL_LIMITS.threads : CAROUSEL_LIMITS.instagram;
}

/**
 * 檢查要發佈的輪播圖片網址：必須是陣列、張數在平台範圍內、每張都以我們自己的儲存桶網址開頭。
 * 沒有傳（undefined 或空陣列）代表不是輪播，回傳 { ok: true, urls: [] }。
 */
export function validateCarouselUrls(platform, imageUrls, prefix) {
  if (imageUrls === undefined || imageUrls === null || (Array.isArray(imageUrls) && imageUrls.length === 0)) return { ok: true, urls: [] };
  if (!Array.isArray(imageUrls)) return { ok: false, urls: [], error: "輪播圖片格式不正確" };
  const max = carouselLimit(platform);
  if (imageUrls.length < CAROUSEL_MIN) return { ok: false, urls: [], error: `輪播至少要 ${CAROUSEL_MIN} 張圖` };
  if (imageUrls.length > max) return { ok: false, urls: [], error: `${platform === "threads" ? "Threads" : "Instagram"} 輪播最多 ${max} 張，目前 ${imageUrls.length} 張` };
  if (!prefix || imageUrls.some((u) => typeof u !== "string" || !u.startsWith(prefix))) return { ok: false, urls: [], error: "輪播圖片必須是儀表板生成的圖片，請重新生成圖卡" };
  return { ok: true, urls: imageUrls };
}
