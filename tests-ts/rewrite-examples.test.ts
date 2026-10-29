import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildExampleRewritePrompt, EXAMPLE_STANDARD, TITLE_STANDARD } from "../src/data/skills/example-rewrite-prompt";
import { hardToReadTitle } from "../src/lib/quality-gate";
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

// 2026-10-29 回歸案例：他按了一鍵重寫，內文確實換了，但他說「一個字沒變」。
// 兩個原因都是我的：畫面重寫後沒有重新載入清單，點回那一則會讀到舊內容；
// 而他真正看不懂的那一行是標題，標題被我鎖成一個字都不能改，模型想改還被換回去。

// 標題預設鎖住
assert.ok(locked.includes("標題一個字都不要改"));
assert.ok(!locked.includes("標題要重寫"));
// 勾了「標題也要重寫」才解鎖，而且條件要寫清楚
const titleOn = buildExampleRewritePrompt({ draft, keepCitationTitle: null, allowTitle: true });
assert.ok(!titleOn.includes("標題一個字都不要改"), "解鎖後不可以還鎖著");
assert.ok(titleOn.includes("標題要重寫，條件如下"));
assert.ok(titleOn.includes(TITLE_STANDARD));
assert.ok(TITLE_STANDARD.includes("文章裡真的寫出來的畫面"), "標題不可以寫文章沒有的場景");
assert.ok(TITLE_STANDARD.includes("一次讀完就要懂"));
assert.ok(TITLE_STANDARD.includes("兩個否定詞"));
assert.ok(TITLE_STANDARD.includes("論點不變"), "換標題不等於換主題");
// 解鎖後論點與結構還是鎖著
assert.ok(titleOn.includes("核心論點"));
assert.ok(titleOn.includes("段落順序"));

// 標題好不好讀：只提醒不擋稿
const badTitle = "簽下離婚協議那天，她把客廳十九年份的日曆一張張撕下來，沒有勇氣不是留下來的原因";
assert.ok(hardToReadTitle(badTitle).includes("否定詞"), "兩個否定詞要被抓出來");
assert.equal(hardToReadTitle("她等了十九年，等的不是兒子成年"), "", "一個否定詞的短標題要放行");
assert.equal(hardToReadTitle("兒子搬進宿舍那天，她拉著兩個行李箱走出住了十九年的家"), "", "場景型標題要放行");
assert.ok(hardToReadTitle("第一句，第二句，第三句").includes("短句"), "三個短句黏成一串要提醒");
assert.equal(hardToReadTitle(""), "");
// 標題檢查吃的是第一行，不是整篇
assert.equal(hardToReadTitle(`她等了十九年\n\n沒有勇氣不是留下來的原因，也不是能力不足`), "");

const gate = readFileSync("src/lib/quality-gate.ts", "utf8");
assert.ok(gate.includes('code: "title_readability"'), "要進品管關卡讓審稿端看得到");
assert.ok(/title_readability[\s\S]{0,120}?level: "warn"|level: "warn"[\s\S]{0,120}?title_readability/.test(gate), "標題只提醒不擋稿");

const gen = readFileSync("src/lib/auto-generate.ts", "utf8");
assert.ok(gen.includes("allowTitle"), "換例子要能解鎖標題");
assert.ok(/titleChanged && !allowTitle/.test(gen), "只有鎖住時才把標題換回去");
assert.ok(gen.includes("hardToReadTitle"), "換完標題要檢查好不好讀");

const route2 = readFileSync("src/app/api/auto-pipeline/rewrite-examples/route.ts", "utf8");
assert.ok(route2.includes("allowTitle"), "端點要收這個開關");

const page2 = readFileSync("src/app/needs-attention/page.tsx", "utf8");
assert.ok(page2.includes("標題也要重寫"), "畫面要有這個勾選");
assert.ok(page2.includes("allowTitle: rewriteTitle"), "勾選要送出去");
// 重寫成功後一定要重新載入清單，否則點回那一則會看到舊內容
assert.ok(/await load\(\);\s*\n\s*setDraft\(after\);/.test(page2), "重寫後要先重載清單再放回新稿");

console.log("標題解鎖與重載測試通過");

// 2026-10-29：標題手動改掉之後，圖卡上印的還是舊標題，而且沒有任何地方只能重做圖卡。
// 圖卡會跟著貼文發出去，所以這是「該接的沒接上」的同一類洞。
const pipeline2 = readFileSync("src/app/api/auto-pipeline/route.ts", "utf8");
assert.ok(pipeline2.includes('action === "remake_card"'), "要有只重做圖卡的動作");
assert.ok(/remake_card[\s\S]{0,1400}?makeCardUrl/.test(pipeline2), "要真的重畫一張");
assert.ok(/remake_card[\s\S]{0,1800}?image_url: card\.url/.test(pipeline2), "要寫回排程列的圖卡網址");
assert.ok(/remake_card[\s\S]{0,1600}?status !== "pending"/.test(pipeline2), "已派發的不可以換圖");
assert.ok(!/remake_card[\s\S]{0,1600}?callErickCOO/.test(pipeline2), "重做圖卡不可以呼叫 AI");

const page3 = readFileSync("src/app/needs-attention/page.tsx", "utf8");
assert.ok(page3.includes("重做標題圖卡"), "待處理中心要有這顆按鈕");
assert.ok(page3.includes('action: "remake_card"'));
assert.ok(page3.includes("這是會跟著貼文發出去的圖卡"), "重做後要讓他看到那張圖");

console.log("rewrite-examples 測試通過");
