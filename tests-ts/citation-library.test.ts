import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { allowedCitationFromTitles } from "../src/data/skills/citation-rules";
import { stripUnapprovedCitations } from "../src/lib/quality-gate";

// 2026-11-03：待發與未上線的內容裡，3 篇 FB、16 篇 IG／Threads、15 篇官網草稿
// 引用了知識庫沒有的書。《為什麼要睡覺》出現十次，還有英文原名 Being Mortal，
// 以及把庫裡書名記錯的《第五項修煉》對《第五項修練》、《自我疼惜》對《自我慈悲》。
// 原因是衍生稿的查證標準是母稿，不是知識庫。

const LIB = ["第五項修練", "自我慈悲", "原子習慣"];

// 母稿引的書在知識庫裡，衍生稿才能沿用
assert.deepEqual(allowedCitationFromTitles(["原子習慣"], LIB), { title: "原子習慣" });
// 母稿引了庫外的書，衍生稿一本都不准引
assert.equal(allowedCitationFromTitles(["為什麼要睡覺"], LIB), null);
// 書名記錯一個字也不算數
assert.equal(allowedCitationFromTitles(["第五項修煉"], LIB), null);
assert.equal(allowedCitationFromTitles(["自我疼惜"], LIB), null);
// 引兩本以上無法判斷哪一本查證過
assert.equal(allowedCitationFromTitles(["原子習慣", "自我慈悲"], LIB), null);
// 清單讀不到（空陣列）時退回舊行為，不要把每一篇都判成違規
assert.deepEqual(allowedCitationFromTitles(["為什麼要睡覺"], []), { title: "為什麼要睡覺" });
assert.deepEqual(allowedCitationFromTitles(["為什麼要睡覺"]), { title: "為什麼要睡覺" });

// 最後一道：重寫三次還是違規就整句拿掉，文章照發
const a = stripUnapprovedCitations("先看見，再決定下一步。文中引用的觀點，出自《為什麼要睡覺》。", LIB);
assert.ok(!a.text.includes("為什麼要睡覺"), "庫外的引用要移除");
assert.ok(a.text.includes("先看見，再決定下一步。"), "正文不可被誤刪");
assert.deepEqual(a.removed, ["為什麼要睡覺"]);

// 庫內的引用不可以被動到
const b = stripUnapprovedCitations("文中引用的觀點，出自《原子習慣》。", LIB);
assert.equal(b.text, "文中引用的觀點，出自《原子習慣》。");
assert.deepEqual(b.removed, []);

// 清單讀不到時什麼都不動，不要在資料庫不通時把引用全部拔光
const c = stripUnapprovedCitations("出自《為什麼要睡覺》。", []);
assert.equal(c.text, "出自《為什麼要睡覺》。");
assert.deepEqual(c.removed, []);

// 同一行混著正文與違規引用，只拿掉違規那一句
const d = stripUnapprovedCitations("這件事今天就能開始。靈感出自《存在與時間》。", LIB);
assert.ok(d.text.includes("這件事今天就能開始。"));
assert.ok(!d.text.includes("存在與時間"));

// 三個衍生路徑都要改成問知識庫，不是問母稿
const multi = readFileSync(new URL("../src/lib/auto-multiplatform.ts", import.meta.url), "utf8");
assert.ok(multi.includes("loadApprovedCitationTitles"), "衍生路徑要載入核可清單");
assert.ok(!/allowedCitationFromMaster\(master\)/.test(multi), "不可以再有只看母稿的呼叫");

// 母稿最後要有一道自動移除
const gen = readFileSync(new URL("../src/lib/auto-generate.ts", import.meta.url), "utf8");
assert.ok(gen.includes("stripUnapprovedCitations"), "母稿要有最後一道移除");
assert.ok(gen.includes("移除不在知識庫的引用"), "移除要留下紀錄");

// 清單讀取失敗要回空陣列，不可以讓整批文章被誤判
const lib = readFileSync(new URL("../src/lib/citation-library.ts", import.meta.url), "utf8");
assert.ok(lib.includes("cache?.titles ?? []"), "讀取失敗要退回快取或空陣列");

console.log("citation-library 測試通過");
