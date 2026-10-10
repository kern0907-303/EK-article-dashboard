import { genreBlockers } from "../src/lib/derivatives-genre";

let failed = 0;
function check(name: string, ok: boolean) {
  if (ok) console.log(`PASS ${name}`);
  else { failed += 1; console.error(`FAIL ${name}`); }
}

check("沒有禁用詞時不擋", genreBlockers("調和是讓自己慢慢回到穩定的狀態。").length === 0);
check("命中禁用詞時回報並列出詞", genreBlockers("調和不會立刻翻轉你的人生。").join("").includes("立刻翻轉"));
check("多個禁用詞合併成一條", genreBlockers("這能治療也能開運").length === 1);
check("信息場、調頻不屬於文體禁用詞", genreBlockers("信息場調頻與頻率支持").length === 0);

if (failed) { console.error(`${failed} 項失敗`); process.exit(1); }
console.log("derivatives-genre 全部通過");
