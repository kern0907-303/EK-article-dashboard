// 題材成效回流：純邏輯測試（白名單、格式、標籤門檻、收縮）。
import assert from "node:assert/strict";
import { OTHER_TOPIC, allowedTopicsFor, labelFor, parseTopicTags, scoreTopics } from "../src/lib/topic-feedback";
import { parseDecision } from "../src/lib/experiment-arms";

const Q1 = "11111111-1111-4111-8111-111111111111";
const Q2 = "22222222-2222-4222-8222-222222222222";

// 白名單：只含該品牌的關鍵字，不含 bridge 借勢詞，一定有「其他」
const nas = allowedTopicsFor("nas");
assert.ok(nas.includes("生命數字") && nas.includes(OTHER_TOPIC));
assert.ok(!nas.includes("情緒調節"), "abl 專屬題材不應出現在 nas");
assert.ok(!nas.includes("AI 取代 工作"), "bridge 層不當固定題材");
assert.equal(new Set(nas).size, nas.length);

// 格式檢查
assert.deepEqual(parseTopicTags(undefined), { ok: true, value: [] });
assert.equal(parseTopicTags("x").ok, false);
assert.equal(parseTopicTags([{ queue_id: "bad", topic: "生命數字" }]).ok, false);
assert.equal(parseTopicTags([{ queue_id: Q1, topic: "" }]).ok, false);
assert.equal(parseTopicTags([{ queue_id: Q1, topic: "a" }, { queue_id: Q1, topic: "b" }]).ok, false, "同一篇不可重複標記");
assert.equal(parseTopicTags(Array.from({ length: 61 }, (_, i) => ({ queue_id: Q1.replace(/1/g, String(i % 10)), topic: "x" }))).ok, false);
const okTags = parseTopicTags([{ queue_id: Q1, topic: " 生命數字 " }, { queue_id: Q2, topic: OTHER_TOPIC }]);
assert.ok(okTags.ok && okTags.value[0].topic === "生命數字");

// parseDecision 接受 topic_tags，且未帶時為空陣列
const base = { summary: "測試" };
const withTags = parseDecision({ ...base, topic_tags: [{ queue_id: Q1, topic: "生命數字" }] });
assert.ok(withTags.ok && withTags.value.topicTags.length === 1);
const noTags = parseDecision(base);
assert.ok(noTags.ok && noTags.value.topicTags.length === 0);
assert.equal(parseDecision({ ...base, topic_tags: "x" }).ok, false);

// 標籤門檻：少於 3 篇一律 untested
assert.equal(labelFor(2, 3), "untested");
assert.equal(labelFor(3, 1.15), "hot");
assert.equal(labelFor(3, 0.85), "cold");
assert.equal(labelFor(5, 1.0), "neutral");
assert.equal(labelFor(5, null), "untested");

// 彙整：收縮讓 3 篇極端值不會直接衝到頂；「其他」不輸出；依 shrunk 由高到低
const obs = [
  ...[3, 3, 3].map((relative) => ({ brand: "nas" as const, topic: "生命數字", relative })),
  ...[0.2, 0.2, 0.2, 0.2].map((relative) => ({ brand: "nas" as const, topic: "空巢期", relative })),
  ...[5].map((relative) => ({ brand: "abl" as const, topic: "情緒調節", relative })),
  { brand: "nas" as const, topic: OTHER_TOPIC, relative: 9 },
];
const scores = scoreTopics(obs);
assert.ok(!scores.some((s) => s.topic === OTHER_TOPIC));
const hot = scores.find((s) => s.topic === "生命數字")!;
assert.equal(hot.meanRelative, 3);
assert.equal(hot.shrunk, 2); // (9 + 3) / 6
assert.equal(hot.label, "hot");
const cold = scores.find((s) => s.topic === "空巢期")!;
assert.equal(cold.label, "cold");
const thin = scores.find((s) => s.topic === "情緒調節")!;
assert.equal(thin.label, "untested", "只有 1 篇不下結論");
assert.ok(scores[0].shrunk! >= scores[scores.length - 1].shrunk!);

console.log("topic-feedback tests passed");
