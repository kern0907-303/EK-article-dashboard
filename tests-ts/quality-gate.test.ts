import assert from "node:assert/strict";
import { applyMechanicalFixes, enforceCopyRules, checkConsistency, checkFormat, checkGarbled, gateBlockers, runQualityGate } from "../src/lib/quality-gate";

const codes = (issues: { code: string }[]) => issues.map((issue) => issue.code);
const good = "很多人以為努力就會有結果，但真正卡住的往往不是不夠努力。我們這週聊三個常見的盲點，第一個是方向，第二個是節奏，第三個是你願不願意先停下來看一看。";

// 正常文章通過
assert.deepEqual(gateBlockers(runQualityGate(good, { platform: "facebook" })), []);

// 亂碼與編碼殘留
assert.ok(codes(checkGarbled("這是一段文字�壞掉了")).includes("replacement_char"));
assert.ok(codes(checkGarbled("æ ¸å¿ƒ ä¸­æ–‡ è¢«ç·¨ç¢¼ æäº†")).includes("mojibake"));
assert.ok(codes(checkGarbled("Donâ€™t stop")).includes("mojibake"));
assert.ok(codes(checkGarbled("正常\u0007文字")).includes("control_char"));
assert.ok(codes(checkGarbled("")).includes("empty"));

// AI 殘留與 JSON 殘留
assert.ok(codes(checkGarbled("以下是改寫後的版本：\n" + good)).includes("ai_chatter"));
assert.ok(codes(checkGarbled("很抱歉，我無法提供這個內容")).includes("ai_chatter"));
assert.ok(!codes(checkGarbled("抱歉，這週我沒有準時發文，因為我在處理一件很重要的事。")).includes("ai_chatter"));
assert.ok(!codes(checkGarbled("我無法忘記那一天，客戶哭著說她終於被看見了。" + good)).includes("ai_chatter"));
assert.ok(codes(checkGarbled('{"threads":"內容","instagram":"內容"}')).includes("json_leak"));

// 預留字樣
assert.ok(codes(checkGarbled(good + "【需補：案例】")).includes("placeholder"));
assert.ok(codes(checkGarbled(good + " undefined")).includes("placeholder"));

// 重複與截斷
assert.ok(codes(checkGarbled(good + "啊啊啊啊啊啊啊啊")).includes("repeat_run"));
assert.ok(codes(checkGarbled(good + "\n" + good)).includes("duplicate_line"));
assert.ok(codes(checkGarbled(good + good.replace(/。/g, "！") + "而且我們還可以，")).includes("truncated"));

// 簡體字：三個以上擋，一兩個提醒
assert.ok(gateBlockers(checkGarbled("这个时间我们来说一说，" + good)).some((i) => i.code === "simplified_chars"));
const one = checkGarbled("這是繁體文章，只有一個字「发」混進來。" + good);
assert.ok(one.some((i) => i.code === "simplified_chars" && i.level === "warn"));

// 格式
assert.ok(codes(checkFormat("這段話——有破折號", "facebook")).includes("dash"));
assert.ok(codes(checkFormat("## 標題\n內容", "threads")).includes("markdown"));
assert.ok(codes(checkFormat("**粗體**內容", "instagram")).includes("markdown"));
assert.ok(codes(checkFormat("字".repeat(501), "threads")).includes("too_long"));
assert.deepEqual(checkFormat("字".repeat(500), "threads"), []);
assert.ok(codes(checkFormat("字".repeat(61), "slide")).includes("too_long"));

// 一致性：新增數字會被擋，改寫後主題相近通過，完全不同的主題被擋
const master = "我有一位客戶，做了十五年的生意，每天忙到凌晨，卻總覺得自己沒有往前走。後來我們一起看了她的決策節奏，發現她把八成的時間花在別人的事情上。";
assert.ok(codes(checkConsistency(master, "客戶做了28年的生意，每天忙到凌晨。")).includes("new_numbers"));
assert.ok(codes(checkConsistency(master, "客戶做了二十八年的生意，每天忙到凌晨。")).includes("new_amounts"));
const paraphrase = "我有一位客戶，做生意做了十五年，每天忙到凌晨，卻覺得自己沒有前進。我們一起看她的決策節奏，才發現她把大部分時間花在別人的事情上。";
assert.deepEqual(gateBlockers(checkConsistency(master, paraphrase)), []);
const drift = "今天天氣很好，我們去海邊散步吧，看看浪花和夕陽，順便吃一份冰淇淋，再去市場挑選新鮮的水果和蔬菜，晚上回家煮一鍋熱湯。";
assert.ok(codes(checkConsistency(master, drift)).includes("topic_drift"));

// 免責聲明與品牌縮寫
assert.ok(codes(checkFormat("這是一個故事。故事情境為示意。", "facebook")).includes("disclaimer"));
assert.ok(codes(checkFormat("ABL 的方法很簡單。", "facebook")).includes("brand_abbrev"));
assert.ok(!codes(checkFormat("歡迎使用 #I8企業醫生 這個主題標籤。", "facebook")).includes("brand_abbrev"));

// 機械式自動修正
const fixed = applyMechanicalFixes("ABL 幫助很多人休息。\n這個故事很真實。故事情境為示意。\n，\nNAS 與 I8 一起合作 #I8企業醫生");
assert.ok(!/情境為示意/.test(fixed.text));
assert.ok(fixed.text.includes("艾伯林量子調頻 幫助很多人休息"));
assert.ok(fixed.text.includes("這個故事很真實。"));
assert.ok(fixed.text.includes("平衡空間 與 初八企業顧問"));
assert.ok(fixed.text.includes("#I8企業醫生"));
assert.ok(!fixed.text.split("\n").some((line) => line.trim() === "，"));
assert.ok(fixed.fixes.length >= 3);
assert.deepEqual(applyMechanicalFixes(good), { text: good, fixes: [] });

// 單一入口：實例全文一次處理
const failing = enforceCopyRules("ABL 信息場調和幫你。\n一位女性，我們叫她 Joanna，每天很累。\n\n（故事情境為示意）", "facebook");
assert.ok(!/故事情境為示意|ABL/.test(failing.text));
// 故事與人名是允許的寫法，不會被擋
assert.equal(failing.blockers.length, 0);
assert.ok(failing.text.includes("Joanna"));
assert.equal(enforceCopyRules(good, "facebook").blockers.length, 0);

// 次要問題只提醒、不擋稿：品牌當主詞、重複段落、母稿沒有的數字、普通的【】
const levelOf = (issues: { code: string; level: string }[], code: string) => issues.find((issue) => issue.code === code)?.level;
assert.equal(levelOf(checkFormat("艾伯林量子調頻陪你走過每一天。" + good, "facebook"), "brand_voice"), "warn");
assert.equal(levelOf(checkGarbled(good + "\n" + good), "duplicate_line"), "warn");
assert.equal(levelOf(checkConsistency(master, "客戶做了28年的生意，每天忙到凌晨。"), "new_numbers"), "warn");
assert.ok(!codes(checkGarbled(good + "【小提醒】")).includes("placeholder"));
assert.ok(codes(checkGarbled(good + "【需補：案例】")).includes("placeholder"));
assert.equal(enforceCopyRules("艾伯林量子調頻陪你走過每一天。" + good, "facebook").blockers.length, 0);

console.log("quality-gate tests passed");
