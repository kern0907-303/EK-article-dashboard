import test from "node:test";
import assert from "node:assert/strict";
import { buildComfyPrompt, isWorkerOnline, pickScene, validateJobInput, SCENE_VARIANTS, NEGATIVE_PROMPT, BRAND_SCENE_STYLE } from "../src/lib/image-jobs.mjs";
import { CARD_SIZES } from "../src/lib/card-layout.mjs";

test("提示詞：同 seed 得到同場景，不同 seed 會輪替，且帶負向詞", () => {
  assert.equal(pickScene(7), pickScene(7));
  const scenes = new Set(Array.from({ length: SCENE_VARIANTS.length }, (_, i) => pickScene(i)));
  assert.equal(scenes.size, SCENE_VARIANTS.length);
  const p = buildComfyPrompt({ brandId: "brand_b_nas", seed: 3 });
  assert.match(p.prompt, /no text/);
  assert.ok(p.prompt.includes(BRAND_SCENE_STYLE.brand_b_nas));
  assert.equal(p.negative, NEGATIVE_PROMPT);
  assert.match(NEGATIVE_PROMPT, /text/);
});

test("提示詞：未知品牌退回個人品牌樣式；異常 seed 不會丟錯", () => {
  assert.ok(buildComfyPrompt({ brandId: "x", seed: NaN }).prompt.length > 20);
  assert.ok(buildComfyPrompt({ brandId: "x", seed: -5 }).prompt.length > 20);
});

test("Mac mini 在線判斷", () => {
  const now = Date.parse("2026-10-11T10:00:00Z");
  assert.equal(isWorkerOnline("2026-10-11T09:59:00Z", now), true);
  assert.equal(isWorkerOnline("2026-10-11T09:50:00Z", now), false);
  assert.equal(isWorkerOnline(null, now), false);
  assert.equal(isWorkerOnline("garbage", now), false);
});

test("建立工作的輸入檢查", () => {
  const keys = Object.keys(CARD_SIZES);
  assert.equal(validateJobInput({ brandId: "brand_b_nas", sizeKey: "ig_story" }, keys).ok, true);
  assert.equal(validateJobInput({ brandId: "", sizeKey: "ig_feed" }, keys).ok, false);
  assert.equal(validateJobInput({ brandId: "a", sizeKey: "nope" }, keys).ok, false);
  assert.equal(validateJobInput({ brandId: "a", sizeKey: "ig_feed", purpose: "article" }, keys).value.purpose, "article");
  assert.equal(validateJobInput({ brandId: "a", sizeKey: "ig_feed", purpose: "evil" }, keys).value.purpose, "card");
});
