import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CATEGORY_WEIGHT, TITLE_NEGATIVES, TITLE_STYLE_IDS, TITLE_STYLES, buildTitleDirective, pickTitleStyle,
} from "../src/data/skills/title-styles";
import { BANNED_FIRST_SENTENCE, OPENING_STYLE_IDS } from "../src/data/skills/opening-styles";
import { COPY_TYPES, COPY_TYPE_IDS, buildCopyTypeBlock } from "../src/data/skills/copy-types";

// Caples 三分類：每一型都要歸類，權重是自身利益 > 新聞 > 好奇心
for (const id of TITLE_STYLE_IDS) {
  assert.ok(["self", "news", "curiosity"].includes(TITLE_STYLES[id].category), `${id} 要有分類`);
}
assert.ok(CATEGORY_WEIGHT.self > CATEGORY_WEIGHT.news, "自身利益要重於新聞");
assert.ok(CATEGORY_WEIGHT.news > CATEGORY_WEIGHT.curiosity, "新聞要重於好奇心");

// 加權輪換：跑很多個種子，自身利益型挑中的次數要明顯多於好奇心型
const tally: Record<string, number> = { self: 0, news: 0, curiosity: 0 };
for (let i = 0; i < 2000; i++) tally[TITLE_STYLES[pickTitleStyle([], `seed-${i}`)].category] += 1;
assert.ok(tally.self > tally.curiosity * 2, `自身利益要遠多於好奇心，實際 ${tally.self} vs ${tally.curiosity}`);
assert.ok(tally.curiosity > 0, "好奇心型不可以完全不出現，還要留句型變化");

// 加權之後，避開最近三型的規則仍然要成立，而且同種子結果固定
const avoid = TITLE_STYLE_IDS.slice(0, 3);
for (let i = 0; i < 300; i++) assert.ok(!avoid.includes(pickTitleStyle(avoid, `s${i}`)), "不可以挑到要避開的型");
assert.equal(pickTitleStyle([], "same-seed"), pickTitleStyle([], "same-seed"), "同種子要給同結果");

// 標題負面清單要寫進提示詞，但不可以變成品管阻擋
assert.ok(TITLE_NEGATIVES.includes("死板") && TITLE_NEGATIVES.includes("過度聰明"));
assert.ok(buildTitleDirective("blunt").includes("死板"), "負面清單要出現在標題指令裡");
const gate = readFileSync("src/lib/quality-gate.ts", "utf8");
assert.ok(!gate.includes("TITLE_NEGATIVES"), "負面清單不可以進品管閘，機器判斷不可靠會誤殺");

// 空泛哲理開場要擋，但具體場景開場不可以誤擋
for (const bad of ["人生就是一連串的選擇", "這個世界總是對認真的人比較嚴格", "每個人都有一段撐著的日子", "很多人以為努力就有用"]) {
  assert.ok(BANNED_FIRST_SENTENCE.test(bad), `空泛開場要擋：${bad}`);
}
for (const ok of ["她在停車場坐了二十分鐘才上樓", "那天的會議開到晚上九點", "我上週遇到一個老闆", "你現在手上有三個案子在跑"]) {
  assert.ok(!BANNED_FIRST_SENTENCE.test(ok), `具體開場不可以擋：${ok}`);
}

// 只收 Caples 推薦的 13 種，慎用與不推薦的刻意不收
assert.equal(COPY_TYPE_IDS.length, 13, "推薦的文案類型是 13 種");
const names = COPY_TYPE_IDS.map((id) => COPY_TYPES[id].name).join("、");
for (const excluded of ["詩意", "矯飾", "誇大", "俏皮", "幽默", "卡片"]) {
  assert.ok(!names.includes(excluded), `不收「${excluded}」，避免把抒情句誤判成錯誤寫法`);
}
assert.ok(buildCopyTypeBlock().includes("事實加風格"));
for (const id of COPY_TYPE_IDS) {
  assert.equal(COPY_TYPES[id].source.book, "Tested Advertising Methods", `${id} 要標出處`);
}

// 端點必須從規則檔推導，不可以自己再抄一份文字
const route = readFileSync("src/app/api/rules/styles/route.ts", "utf8");
assert.ok(route.includes("TITLE_STYLE_IDS.map") && route.includes("OPENING_STYLE_IDS.map"), "要從資料推導");
assert.ok(!route.includes("否定對比：") && !route.includes("延續標題："), "端點裡不可以硬寫規則文字");
assert.ok(route.includes("AUTO_PIPELINE_CRON_SECRET") && route.includes("timingSafeEqual"), "要驗 Bearer");
assert.equal(OPENING_STYLE_IDS.length, 9);
assert.equal(TITLE_STYLE_IDS.length, 8);

console.log("caples-rules 測試通過");
