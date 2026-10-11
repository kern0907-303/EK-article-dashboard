import test from "node:test";
import assert from "node:assert/strict";
import { cleanSlideText, sanitizeSlides, parseSlidesJson, splitArticleToSlides, carouselLimit } from "../src/lib/carousel-slides.mjs";

test("cleanSlideText 去破折號、Markdown、前綴並截短", () => {
  assert.equal(cleanSlideText("第 2 張：累不是因為你不夠努力"), "累不是因為你不夠努力");
  assert.equal(cleanSlideText("**重點**——先停下來"), "重點，先停下來");
  assert.equal([...cleanSlideText("字".repeat(100))].length, 60);
  assert.doesNotMatch(cleanSlideText("A—B─C"), /[—─]/);
});

test("sanitizeSlides 去空白、去重複、限制張數", () => {
  assert.deepEqual(sanitizeSlides(["a", "", "a", " b ", 3], 10), ["a", "b"]);
  assert.equal(sanitizeSlides(Array.from({ length: 20 }, (_, i) => `第${i}句話`), 10).length, 10);
  assert.deepEqual(sanitizeSlides(null), []);
});

test("parseSlidesJson 容忍多餘文字與程式碼框", () => {
  assert.deepEqual(parseSlidesJson('```json\n{"slides":["一","二"]}\n```'), ["一", "二"]);
  assert.deepEqual(parseSlidesJson("沒有 JSON"), []);
  assert.deepEqual(parseSlidesJson('{"slides":"x"}'), []);
});

test("splitArticleToSlides 標題加各段第一句，略過圖片與小標", () => {
  const article = "# 為什麼你總是累\n\n![配圖](https://x/a.jpg)\n\n## 小標\n\n你已經很努力了。可是還是覺得卡住。\n\n問題不在意志力，而是方向沒有對準。";
  const slides = splitArticleToSlides(article, 7);
  assert.equal(slides[0], "為什麼你總是累");
  assert.deepEqual(slides.slice(1), ["你已經很努力了。", "問題不在意志力，而是方向沒有對準。"]);
  assert.deepEqual(splitArticleToSlides(""), []);
});

test("各平台張數上限", () => {
  assert.equal(carouselLimit("instagram"), 10);
  assert.equal(carouselLimit("threads"), 20);
});

import { validateCarouselUrls } from "../src/lib/carousel-slides.mjs";
const P = "https://x.supabase.co/storage/v1/object/public/social-images/";

test("validateCarouselUrls 檢查張數與網址來源", () => {
  assert.deepEqual(validateCarouselUrls("instagram", undefined, P), { ok: true, urls: [] });
  assert.deepEqual(validateCarouselUrls("instagram", [], P), { ok: true, urls: [] });
  assert.equal(validateCarouselUrls("instagram", [`${P}a`], P).ok, false);
  assert.equal(validateCarouselUrls("instagram", Array.from({ length: 11 }, (_, i) => `${P}${i}`), P).ok, false);
  assert.equal(validateCarouselUrls("threads", Array.from({ length: 11 }, (_, i) => `${P}${i}`), P).ok, true);
  assert.equal(validateCarouselUrls("instagram", [`${P}a`, "https://evil.com/b"], P).ok, false);
  assert.equal(validateCarouselUrls("instagram", [`${P}a`, `${P}b`], null).ok, false);
  assert.equal(validateCarouselUrls("instagram", "x", P).ok, false);
});
