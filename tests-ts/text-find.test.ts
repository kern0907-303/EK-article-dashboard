import assert from "node:assert/strict";
import { countWords, extractRedlineWords, findAll } from "../src/lib/text-find";

assert.deepEqual(findAll("靈性的靈性", "靈性"), [0, 3]);
assert.deepEqual(findAll("Hello hello", "HELLO"), [0, 6]);
assert.deepEqual(findAll("abc", ""), []);
assert.deepEqual(findAll("aaaa", "aa"), [0, 2]);

const words = extractRedlineWords([
  "「這是靈性的路」命中「靈性」，屬於硬性紅線，必須先修改。",
  "文案含未補的標記 【需補：案例】、【需補：數據】，請補上依據或刪除後再發",
  "未通過品牌紅線：命運、頻率",
  "品牌名稱不可當主詞發言（例如「平衡空間認為」），請改成艾瑞克的第一人稱",
]);
assert.ok(words.includes("靈性") && words.includes("【需補：案例】") && words.includes("命運") && words.includes("頻率") && words.includes("平衡空間認為"));
assert.equal(new Set(words).size, words.length);

const counted = countWords("命運很重要，命運。", ["靈性", "命運"]);
assert.equal(counted[0].word, "命運");
assert.equal(counted[0].count, 2);
assert.equal(counted[1].count, 0);

console.log("text-find tests passed");
