import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildExampleRewritePrompt, EXAMPLE_STANDARD } from "../src/data/skills/example-rewrite-prompt";
import {
  clearStalePlatform, existingDerivatives, markDerivativesStale, readStalePlatforms,
} from "../src/data/skills/derivative-sync";

// 2026-10-29 需求：待處理中心要有一鍵重寫，主題方向不變，只換掉看不懂或不妥的例子。
// 原本只有兩條路：自己改字，或整篇重新生成（會換掉題目與論點）。

const draft = [
  "睡飽了還是覺得累，問題可能不在睡眠",
  "",
  "她把手機放到充電器上，然後去洗澡了。",
  "文中引用的觀點，出自克莉絲汀·聶夫所著《自我慈悲》。",
].join("\n");

// 鎖住題目：這是整個需求的重點，提示詞必須明講不准換
const locked = buildExampleRewritePrompt({ draft, keepCitationTitle: null, note: "" });
assert.ok(locked.includes("標題一個字都不要改"), "標題要鎖住");
assert.ok(locked.includes("核心論點"), "論點要鎖住");
assert.ok(locked.includes("段落順序"), "結構要鎖住");
assert.ok(locked.includes("不是重新創作"), "要明講這是修改任務");
assert.ok(locked.includes("只換故事、情境與舉例的段落"), "要明講只能動例子");
assert.ok(locked.includes(draft), "要帶上一版全文");

// 看得懂的標準要進提示詞，而且是具體標準不是形容詞
assert.ok(locked.includes(EXAMPLE_STANDARD));
assert.ok(EXAMPLE_STANDARD.includes("具體的人"));
assert.ok(EXAMPLE_STANDARD.includes("三句話"));
assert.ok(/量子|能量場|頻率共振/.test(EXAMPLE_STANDARD), "不要用需要先解釋的比喻當例子");
assert.ok(EXAMPLE_STANDARD.includes("有些人會這樣"), "要擋沒有主角的泛稱");
// 虛構人物是艾瑞克刻意的設定，不可以在換例子時被禁掉
assert.ok(EXAMPLE_STANDARD.includes("人物可以是虛構的"), "虛構人物要放行");
assert.ok(EXAMPLE_STANDARD.includes("不可以編造數字"), "但不可以編造數字與成效");

// 文案規則要跟著帶：純文字、不要破折號、不要聲明
assert.ok(locked.includes("Markdown"));
assert.ok(locked.includes("破折號"));
assert.ok(locked.includes("（故事情境為示意）"), "要明講不要加這類註記");
assert.ok(locked.includes("品牌名稱後面不可以接任何動詞"), "說話的人規則要帶");

// 引用：原本沒引用就不准長出來
assert.ok(locked.includes("不可以引用任何書籍"));
assert.ok(locked.includes("上一版沒有引用，重寫後也不准有"));
// 原本有引用就只能原樣保留，不可以換書
const withCite = buildExampleRewritePrompt({ draft, keepCitationTitle: "自我慈悲" });
assert.ok(withCite.includes("原本引用的《自我慈悲》要保留原樣"));
assert.ok(withCite.includes("不可以換成別本書"));

// 艾瑞克寫的說明要放在優先位置
const noted = buildExampleRewritePrompt({ draft, keepCitationTitle: null, note: "第二段開會的例子看不懂" });
assert.ok(noted.includes("艾瑞克指出的問題，優先處理"));
assert.ok(noted.includes("第二段開會的例子看不懂"));
// 沒寫說明就不要出現空的區塊
assert.ok(!locked.includes("艾瑞克指出的問題"));

// 上一輪沒修掉的問題要帶進下一輪
const retried = buildExampleRewritePrompt({ draft, keepCitationTitle: null, problems: ["品牌名稱當主詞：平衡空間提醒你"] });
assert.ok(retried.includes("還是被抓到的問題"));
assert.ok(retried.includes("1. 品牌名稱當主詞：平衡空間提醒你"));

// ---- 衍生稿待同步狀態 ----
// 主稿換了，官網、IG、Threads 還是舊例子。原本沒有任何地方記住這件事，重新整理就看不到了。
const social = { instagram: { ok: true }, threads: { ok: true }, website: { ok: true } };
assert.deepEqual(existingDerivatives(social, true), ["website", "instagram", "threads"]);
// 官網看排程列的 article_id，沒有文章就不算有衍生稿
assert.deepEqual(existingDerivatives(social, false), ["instagram", "threads"]);
// 失敗的那次沒有稿可以同步
assert.deepEqual(existingDerivatives({ instagram: { ok: false }, threads: { ok: true } }, false), ["threads"]);
assert.deepEqual(existingDerivatives({}, false), []);
assert.deepEqual(existingDerivatives(null, false), []);

const staled = markDerivativesStale({ ...social, rules_version: { website: "rules-x" } }, true);
assert.deepEqual(readStalePlatforms(staled), ["website", "instagram", "threads"]);
assert.ok(!("rules_version" in staled), "主稿換了要連舊規則版本一起清掉");
// 沒有衍生稿就不要留空欄位
assert.ok(!("stale_platforms" in markDerivativesStale({}, false)));

// 同步完一個平台只移掉那一個，其他不動
const afterWebsite = clearStalePlatform(staled, "website");
assert.deepEqual(readStalePlatforms(afterWebsite), ["instagram", "threads"]);
const afterAll = clearStalePlatform(clearStalePlatform(afterWebsite, "instagram"), "threads");
assert.deepEqual(readStalePlatforms(afterAll), []);
assert.ok(!("stale_platforms" in afterAll), "全部同步完要把欄位移掉");
// 不認識的平台不要寫進去
assert.deepEqual(readStalePlatforms({ stale_platforms: ["facebook", "website"] }), ["website"]);

// ---- 該接的都要接上（這是他最在意的一條：不要只改文字，其他地方都沒改到）----
const route = readFileSync("src/app/api/auto-pipeline/rewrite-examples/route.ts", "utf8");
assert.ok(route.includes("rewriteExamples"), "要用換例子的修改模式，不是重新生成");
assert.ok(!route.includes("generateFacebookDraft"), "不可以改成整篇重新生成，那會換掉題目");
assert.ok(/publish_queue\?id=eq\./.test(route), "真的會發出去的排程文案要跟著換");
assert.ok(route.includes("makeCardUrl"), "標題圖卡要重做");
assert.ok(route.includes("markDerivativesStale"), "衍生稿要標成待同步");
assert.ok(route.includes("reviewed: false"), "重寫過要回到待審稿");
assert.ok(route.includes("draft_content"), "草稿要跟著換");
assert.ok(/blockedReason[\s\S]{0,200}?保留原稿/.test(route), "新稿沒過檢查要保留原稿");
assert.ok(route.includes("status: 409") && route.includes("已進入派發"), "已派發的不可以再改");
assert.ok(!/dryRun/.test(route), "一鍵重寫是單篇動作，不做批次試算");

// 手動改字那條路也要接上，否則圖卡與衍生稿一樣會留在舊版
const pipeline = readFileSync("src/app/api/auto-pipeline/route.ts", "utf8");
assert.ok(pipeline.includes("titleChanged"), "手動改字也要判斷標題有沒有變");
assert.ok(pipeline.includes("makeCardUrl"), "標題變了圖卡要重做");
assert.ok(pipeline.includes("markDerivativesStale"), "手動改字也要把衍生稿標成待同步");

// 同步完要把平台從待同步清單移掉，不然永遠顯示待同步
const reopt = readFileSync("src/app/api/auto-pipeline/reoptimize/route.ts", "utf8");
assert.ok(reopt.includes("clearStalePlatform"), "同步完要移掉那個平台");

// 待處理中心要讀得到待同步狀態，重新整理後還看得見
const attention = readFileSync("src/lib/needs-attention.ts", "utf8");
assert.ok(attention.includes("readStalePlatforms"), "待處理項目要帶出待同步平台");
assert.ok(attention.includes("social_results"), "要把 social_results 撈出來才算得出來");

// 畫面：按鈕要在，而且同步是一次一個平台
const page = readFileSync("src/app/needs-attention/page.tsx", "utf8");
assert.ok(page.includes("一鍵重寫（換例子）"), "待處理中心要有這顆按鈕");
assert.ok(page.includes("/api/auto-pipeline/rewrite-examples"));
assert.ok(page.includes("確認內容，同步其他平台"), "要在確認內容之後才同步");
assert.ok(/for \(let n = 0; n < rows\.length; n\+\+\)/.test(page), "同步要依序一個平台跑一次，不要同時發四個");
assert.ok(page.includes("哪裡不妥、哪一段看不懂"), "要能寫清楚哪裡看不懂");

console.log("rewrite-examples 測試通過");
