import test from "node:test";
import assert from "node:assert/strict";
import { cardHeadline, firstImageUrl, withCoverImage, withLeadingImage } from "../src/lib/article-image.mjs";

const URL1 = "https://x.supabase.co/storage/v1/object/public/social-images/cards/nas/a.jpg";

test("cardHeadline 取標題、去 Markdown、過長截短", () => {
  assert.equal(cardHeadline("# 為什麼你總是累\n\n內文"), "為什麼你總是累");
  assert.equal(cardHeadline(`![配圖](${URL1})\n**標題**`), "標題");
  assert.equal([...cardHeadline("字".repeat(60), 36)].length, 37);
});

test("withCoverImage 放在標題下方且不重複", () => {
  const out = withCoverImage("# 標題\n\n第一段", URL1);
  assert.equal(out, `# 標題\n\n![配圖](${URL1})\n\n第一段`);
  assert.equal(withCoverImage(out, URL1), out);
  assert.equal(withCoverImage("# 標題", ""), "# 標題");
  assert.equal(firstImageUrl(out), URL1);
  assert.equal(firstImageUrl("無圖"), "");
});

test("withLeadingImage 放在最前面且不重複", () => {
  const out = withLeadingImage("貼文內容", URL1);
  assert.equal(out, `![配圖](${URL1})\n\n貼文內容`);
  assert.equal(withLeadingImage(out, URL1), out);
});
