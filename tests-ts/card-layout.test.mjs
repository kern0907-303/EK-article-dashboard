import assert from "node:assert/strict";
import test from "node:test";
import { CARD_BRANDS, CARD_SIZES, computeLayout, resolveCardSize, wrapLines } from "../src/lib/card-layout.mjs";

const NO_START = "，。、；：！？）」』》〉】〕…‧,.;:!?)]}%";
const SAMPLES = [
  "你不是想太多，你只是對感受比較敏銳，需要一點時間把自己整理清楚。",
  "你不是沒有努力，而是你已經用撐住的方式活太久了。",
  "很多人不是沒有方向，而是太習慣回應別人的期待，久了以後，連自己的聲音都聽不見了。",
  "2026 年的功課：把「我應該」換成「我願意」。",
  "企業經營最怕的不是問題出現，而是一直處理錯問題。",
];

test("標點不在行首、開括號不在行尾、最後一行不是孤字", () => {
  for (const text of SAMPLES) {
    for (const size of [64, 80, 96]) {
      const lines = wrapLines(text, size, 864, 1);
      for (const line of lines) {
        assert.ok(!NO_START.includes([...line][0]), `行首是標點：${line}`);
        assert.ok(!"（「『《〈【〔([{".includes([...line].at(-1)), `行尾是開括號：${line}`);
      }
      if (lines.length > 1) assert.ok([...lines.at(-1)].length >= 2, `最後一行太短：${lines.at(-1)}`);
      assert.equal(lines.join("").replace(/\s/g, ""), text.replace(/\s/g, ""), "斷行不可吃字");
    }
  }
});

test("連續數字不會被拆開", () => {
  for (const size of [58, 64, 72, 80]) {
    const lines = wrapLines("2026 年的功課：把「我應該」換成「我願意」。", size, 700, 1);
    assert.ok(lines.some((l) => l.includes("2026")), `2026 被拆開：${JSON.stringify(lines)}`);
  }
});

test("各行長度要平均（最長與最短行的字數比不超過 2.2 倍，不含最後一行）", () => {
  const lines = wrapLines(SAMPLES[2], 72, 864, 1);
  const lens = lines.slice(0, -1).map((l) => [...l].length);
  if (lens.length > 1) assert.ok(Math.max(...lens) / Math.min(...lens) <= 2.2, JSON.stringify(lines));
});

function lum(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
function bgAt(brand, fraction) {
  const f = parseInt(brand.from.slice(1), 16), t = parseInt(brand.to.slice(1), 16);
  const ch = (shift) => Math.round(((f >> shift) & 255) + ((((t >> shift) & 255) - ((f >> shift) & 255)) * fraction));
  return "#" + [16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join("");
}

test("四個品牌：文字區內文字對比至少 6.5、頁尾對比至少 4.5", () => {
  for (const [id, brand] of Object.entries(CARD_BRANDS)) {
    let worst = 99;
    for (let f = brand.zone[0]; f <= brand.zone[1]; f += 0.02) worst = Math.min(worst, ratio(brand.text, bgAt(brand, f)));
    assert.ok(worst >= 6.5, `${id} 文字對比 ${worst.toFixed(1)}`);
    assert.ok(ratio(brand.footer, bgAt(brand, 1177 / 1350)) >= 4.5, `${id} 頁尾對比不足`);
  }
});

test("尺寸預設：寬 1080、Instagram 貼文比例在官方 1.91:1 到 3:4 之內，限動 9:16", () => {
  for (const [key, s] of Object.entries(CARD_SIZES)) {
    assert.equal(s.width, 1080, key);
    if (key.startsWith("ig_") && key !== "ig_story") {
      const ar = s.width / s.height;
      assert.ok(ar <= 1.91 && ar >= 0.75, `${key} 長寬比 ${ar}`);
      assert.ok(s.height >= 566 && s.height <= 1440, `${key} 高度超出官方範圍`);
    }
  }
  assert.equal(CARD_SIZES.ig_story.height, 1920);
  assert.equal(CARD_SIZES.ig_story.official, false);
  assert.equal(resolveCardSize("不存在").key, "ig_feed");
});

test("版面：文字區不超出畫面、限動文字避開上下留白", () => {
  for (const key of Object.keys(CARD_SIZES)) {
    for (const id of Object.keys(CARD_BRANDS)) {
      const l = computeLayout(key, id, SAMPLES[2]);
      assert.ok(l.blockTop >= l.size.insetTop);
      assert.ok(l.blockTop + l.blockHeight <= l.size.height - l.size.insetBottom, `${key} ${id} 文字超出`);
    }
  }
});
