import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { brandWeSpeak, fictionAsRealClient, runQualityGate, gateBlockers, gateWarnings } from "../src/lib/quality-gate";
import { DERIVATIVES_SYSTEM_PROMPT, DERIVATIVES_PROMPT_VERSION } from "../src/data/prompts/derivatives-v1";
import { buildRevisePrompt } from "../src/data/skills/revise-prompt";

// 2026-10-29 回歸案例：編輯 AI 擋下一組 NAS 內容。三個問題全部出在衍生稿那一邊，
// FB 主稿是乾淨的。原因是說話的人與虛構人物這兩條規則只寫在主稿路徑，衍生稿的提示詞沒有。

// 一、用「我們」替品牌發言。品牌名在這句裡是合法的（當地點），所以品牌當主詞那條抓不到。
const weSpeakCase = "在平衡空間的自我探索裡，我們透過生命數字看見自己的慣性。";
assert.deepEqual(brandWeSpeak(weSpeakCase, "nas"), ["在平衡空間的自我探索裡，我們透過生命數字看見自己的慣性"]);
// 泛指所有人的「我們」是好文案，不可以擋
assert.deepEqual(brandWeSpeak("我們常以為自己在等待一個完美的轉折點。", "nas"), []);
assert.deepEqual(brandWeSpeak("我們都會累。", "nas"), []);
// 沒指定品牌時三個品牌都查
assert.equal(brandWeSpeak("初八企業顧問相信，我們可以一起把現金流看清楚。").length, 1);
// 只提醒不擋稿
const weIssues = runQualityGate(weSpeakCase, { platform: "website", brandId: "nas" });
assert.equal(gateBlockers(weIssues).length, 0, "我們替品牌發言不可以擋稿");
assert.ok(gateWarnings(weIssues).some((issue) => issue.code === "brand_we"));

// 二、把虛構人物寫成親身接觸過的真實客戶
assert.ok(fictionAsRealClient("她跟我說那天其實很平靜。").length, "她跟我說要抓出來");
assert.ok(fictionAsRealClient("她告訴我，那天她沒有哭。").length);
assert.ok(fictionAsRealClient("當初她對我說，再撐一下就好。").length);
assert.ok(fictionAsRealClient("我一開始以為只要陪她整理行李就好。").length);
assert.ok(fictionAsRealClient("我在平衡空間接觸過不少類似的個案。").length);
assert.ok(fictionAsRealClient("某位客戶告訴我，他也是這樣。").length);
assert.ok(fictionAsRealClient("林小姐跟我說她不後悔。").length, "具名人物也要抓");
// 第三人稱寫法是對的，不可以誤擋
assert.deepEqual(fictionAsRealClient("她在兒子成年那天搬出那個家，沒有哭。"), []);
assert.deepEqual(fictionAsRealClient("她看著浴室鏡子裡的自己，不知道明天該為誰忙碌。"), []);
assert.deepEqual(fictionAsRealClient("我陪人整理角色的時候，最常聽到這句話。"), [], "泛稱的人不是具名人物");
// 真實去識別化案例也會用同樣句型，所以只提醒不擋稿，交給審稿端判斷
const witnessIssues = runQualityGate("她跟我說那天其實很平靜。", { platform: "facebook" });
assert.equal(gateBlockers(witnessIssues).length, 0, "這條不可以擋稿");
assert.ok(gateWarnings(witnessIssues).some((issue) => issue.code === "fiction_as_client"));

// 三、兩條規則要真的寫進衍生稿的系統提示詞，不是只在主稿那一支
assert.ok(DERIVATIVES_SYSTEM_PROMPT.includes("說話的人"), "衍生稿要帶說話的人規則");
assert.ok(DERIVATIVES_SYSTEM_PROMPT.includes("不可以用「我們」替品牌發言"));
assert.ok(DERIVATIVES_SYSTEM_PROMPT.includes("常見問答"), "問答也要適用");
assert.ok(DERIVATIVES_SYSTEM_PROMPT.includes("虛構人物"), "衍生稿要帶虛構人物規則");
assert.ok(DERIVATIVES_SYSTEM_PROMPT.includes("她跟我說"), "要把實際違規句型寫出來");
assert.ok(DERIVATIVES_SYSTEM_PROMPT.includes("維持母文章的第三人稱寫法"));
assert.equal(DERIVATIVES_PROMPT_VERSION, "derivatives-v2", "規則改了要換版本");

// 官網文章的提示詞同樣要帶虛構人物那條
const provider = readFileSync("src/lib/ai-provider.ts", "utf8");
assert.ok(/callWebArticle[\s\S]{0,4000}?不可以寫成我親身接觸過的真實客戶/.test(provider), "官網改寫要帶虛構人物規則");
assert.ok(/callWebArticle[\s\S]{0,4000}?常見問答（FAQ）同樣適用/.test(provider), "要明講 FAQ 也適用");

// 四、常見問答原本完全沒過閘，直接寫進資料庫
const multi = readFileSync("src/lib/auto-multiplatform.ts", "utf8");
assert.ok(/faqProblems/.test(multi), "FAQ 要過閘");
assert.ok(/faqProblems[\s\S]{0,400}?brandSubjectSentences/.test(multi), "FAQ 要查品牌當主詞");
assert.ok(/faqProblems[\s\S]{0,400}?inspectForPublish/.test(multi), "FAQ 要查紅線詞");
assert.ok(/faqProblems[\s\S]{0,400}?unverifiedCitations/.test(multi), "FAQ 要查引用");
assert.ok(/faqProblems\.length[\s\S]{0,200}?faqText = ""/.test(multi), "過不了就不附 FAQ，不要發出去");
assert.ok(/faqProblems\.length[\s\S]{0,220}?schemaText = ""/.test(multi), "結構化資料要一起拿掉，不然 schema 還留著違規問答");
// 官網文章的品管要帶 brandId，否則抓不到「我們」替品牌發言
assert.ok(/platform: "website", master, brandId: brandShort/.test(multi));

// 2026-10-29 第二次踩到：規則寫在提示詞裡但沒有任何地方檢查，所以模型照樣違規，
// 而且一路排程出去。實例是重跑後的 NAS 主稿，標題三個短句黏成一串，正文又出現
// 「她對我說，走出大門坐上計程車的那一刻」。警示級檢查抓到了，但警示不會擋稿。
// 修法：把這兩條接進主稿生成的重寫迴圈，用便宜的修改模式改掉，而不是只記一條警示。
const gen2 = readFileSync("src/lib/auto-generate.ts", "utf8");
assert.ok(/const titleIssue = hardToReadTitle\(draft\)/.test(gen2), "主稿迴圈要檢查標題好不好讀");
assert.ok(/fictionAsRealClient\(draft\)/.test(gen2), "主稿迴圈要檢查虛構人物當真實個案");
assert.ok(/!titleIssue && !witness\.length/.test(gen2), "這兩條沒過就不可以跳出迴圈");
assert.ok(/標題不好讀：/.test(gen2) && /把虛構人物寫成我親身接觸過的真實個案/.test(gen2), "要帶進問題清單給模型修");
// 案例文寫的是真實個案，第一人稱見證句是對的，不可以被改掉
assert.ok(/readGenreFromPrompt\(prompt\) === "case"/.test(gen2), "案例文要豁免");
assert.ok(/allowsRealClient \? \[\] : fictionAsRealClient/.test(gen2));

// 修改模式原本鎖死標題（不要換題目），標題有問題時必須能解鎖，否則修不掉
const lockedRevise = buildRevisePrompt("全文", ["品牌名稱當主詞：平衡空間提醒你"], null);
assert.ok(lockedRevise.includes("不要換題目"), "預設還是鎖住標題");
const openRevise = buildRevisePrompt("全文", ["標題不好讀：標題有 3 個短句黏成一串"], null, { allowTitle: true });
assert.ok(!openRevise.includes("不要換題目"), "標題有問題時要解鎖");
assert.ok(openRevise.includes("場景必須是文章裡真的寫出來的畫面"));
assert.ok(openRevise.includes("最多兩個短句"));
assert.ok(openRevise.includes("論點不變"), "換標題不等於換主題");
assert.ok(openRevise.includes("不要調整段落順序"), "其他結構還是鎖著");

console.log("derivative-voice 測試通過");
