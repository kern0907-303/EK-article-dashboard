import { inspectForPublish, checkText, rewriteText, resolveBrandContext } from "../src/lib/brand-guardrail";

const cases: Array<[string, string, boolean]> = [
  // [brandId, 文字, 期望 passed]
  ["brand_c_abl", "這個療程可以根治你的失眠問題，療效顯著。", false],
  ["brand_c_abl", "調和不是逼自己馬上變好，而是讓自己慢慢回到比較穩的狀態。", true],
  ["brand_a_i8", "透過靈性頻率調整來顯化你的business成長。", false],
  ["brand_a_i8", "企業卡住，不一定是努力不夠，而是還沒看見真正影響結果的關鍵因素。", true],
  ["brand_b_nas", "透過信息場調頻來認識自己。", false],
  ["brand_b_nas", "生命數字不是告訴你命運已經決定，而是讓你看懂自己的天賦與盲點。", true],
  ["personal_brand", "如何透過能量磁場無痛成交高票價諮詢", false],
];

let pass = 0, fail = 0;
for (const [brandId, text, expected] of cases) {
  const r = inspectForPublish(text, brandId);
  const ok = r.passed === expected;
  ok ? pass++ : fail++;
  console.log(`${ok ? "✓" : "✗"} [${r.context.padEnd(10)}] passed=${r.passed}  ${text.slice(0, 28)}...`);
  if (!r.passed) {
    console.log(`     違規詞: ${r.violatedWords.join("、")}`);
    console.log(`     建議  : ${r.suggestion}`);
  }
}
console.log(`\n結果: ${pass} 通過 / ${fail} 失敗`);
process.exit(fail > 0 ? 1 : 0);
