import { checkGenreText, blockingIssues } from "../src/lib/genre-check";
import { buildGenrePrompt, GENRES, brandKeyFromId, PROMPT_VERSION, SHARED_PREFIX, goalOf } from "../src/data/skills/genres";
import { stripMarkdown, stripDividers, stripDashes } from "../src/lib/plain-text";
import { genreFromText, materialFor, parsePastedTopics } from "../src/lib/topic-parse";

let pass = 0, fail = 0;
const t = (name: string, cond: boolean) => { cond ? pass++ : fail++; console.log(`${cond ? "✓" : "✗"} ${name}`); };

const meta = (genre: any, funnel: any) => ({ genre, funnel, prompt_version: PROMPT_VERSION });
const filler = (n: number) => "這是一段很短的句子。\n\n".repeat(Math.ceil(n / 10)).slice(0, n * 2);

// 禁用詞與【需補】會擋住
t("禁用詞會擋住", blockingIssues(checkGenreText("這個方法可以治療失眠。", meta("case", "cold"))).length === 1);
t("【需補】會擋住", blockingIssues(checkGenreText("開頭。\n\n【需補：個案的原話】\n\n結尾。", meta("case", "cold"))).length === 1);
t("乾淨文章不擋", blockingIssues(checkGenreText("今天想跟你聊一件小事。", meta("case", "hot"))).length === 0);
// 只提醒、不擋
const md = checkGenreText("## 標題\n這是**重點**。", meta("breakdown", "hot"));
t("Markdown 只提醒", md.some((i) => i.code === "markdown" && i.level === "warn") && blockingIssues(md).length === 0);
// 冷流量謹慎詞
t("冷流量出現調頻 → 提醒", checkGenreText("我做的是調頻。", meta("case", "cold")).some((i) => i.code === "funnel-terms"));
t("熱流量出現調頻 → 不提醒", !checkGenreText("我做的是調頻。", meta("case", "hot")).some((i) => i.code === "funnel-terms"));
t("溫流量出現 TimeWaver → 提醒", checkGenreText("我學了 TimeWaver。", meta("case", "warm")).some((i) => i.code === "funnel-terms"));
// 長段落與字數（只對 facebook / 未指定平台）
const longPara = "很長的一段話".repeat(30);
t("長段落提醒", checkGenreText(longPara, meta("case", "hot"), "facebook").some((i) => i.code === "long-paragraph"));
t("threads 不檢查長段落與字數", !checkGenreText(longPara, meta("case", "hot"), "threads").some((i) => i.code === "long-paragraph" || i.code === "length"));
t("字數過短提醒", checkGenreText("太短了。", meta("case", "hot"), "facebook").some((i) => i.code === "length"));
// 生成中提示不檢查
t("生成中提示不檢查", checkGenreText("⏳ 專家助理 Maya 正在撰寫", meta("case", "cold")).length === 0);

// 提示詞組裝：四層都在
const p = buildGenrePrompt("i8", { genre: "case", funnel: "cold", claim: "決策不該都靠老闆", material: "某個案", metaphor: "", length: "", cta: "" });
t("包含共用前綴", p.includes("你在替艾瑞克（Erick）寫文案"));
t("包含 I8 語氣", p.includes("本篇品牌：初八企業顧問") && p.includes("不歸咎任何個人"));
t("包含冷流量規則", p.includes("漏斗層：冷") && p.includes("全文不得出現 TimeWaver"));
t("包含案例文骨架", p.includes("本篇文體：案例文") && p.includes("找出落差"));
t("比喻留空 → 提醒放文章外面，文章不加標記", p.includes("post_reminders") && p.includes("文章裡不要加任何標記"));
t("CTA 留空 → 不放", p.includes("全文不放 CTA"));
t("主張與素材代入", p.includes("決策不該都靠老闆") && p.includes("某個案"));
t("回應文標為未啟用", GENRES.response.enabled === false);
t("品牌對應", brandKeyFromId("brand_c_abl") === "abl" && brandKeyFromId("brand_b_nas") === "nas" && brandKeyFromId("personal_brand") === "erick");
t("stripMarkdown 保留 【】、去掉 ── 小標記號", stripMarkdown("【標題】\n\n── 小標\n**重點**") === "【標題】\n\n小標\n重點");
t("stripMarkdown 只有符號的 ── 線不留殘字", !/[^\s]/.test(stripMarkdown("──────").replace(/[─—]/g, "")));
t("stripDividers 移除整行破折號分隔線", stripDividers("標題\n———\n第一段\n──────\n第二段") === "標題\n\n第一段\n\n第二段");
t("stripDividers 不動句中的破折號（由 stripDashes 處理）", stripDividers("他說——這很重要") === "他說——這很重要");
t("stripDashes 句中 —— 換成逗號", stripDashes("他說——這很重要") === "他說，這很重要");
t("stripDashes 單一 — 與 – 也處理", stripDashes("甲—乙–丙―丁") === "甲，乙，丙，丁");
t("stripDashes 行尾與引號前直接刪除", stripDashes("他停了一下——\n「就是這樣——」") === "他停了一下\n「就是這樣」");
t("stripDashes 貼著標點直接刪除", stripDashes("真的，——不是") === "真的，不是");
t("stripDashes 數字區間改成到", stripDashes("5–50 人與10-20件") === "5到50 人與10-20件");
t("stripDashes 空格夾住的 - 與 -- ", stripDashes("甲 - 乙 -- 丙") === "甲，乙，丙");
t("stripDashes 不動連字號與網址", stripDashes("02-1234 與 well-being") === "02-1234 與 well-being");
t("stripDashes 保留 mermaid 區塊", stripDashes("前——文\n```mermaid\nA --> B\nA --- C\n```\n後") === "前，文\n```mermaid\nA --> B\nA --- C\n```\n後");
t("stripMarkdown 同時清掉 —— ", stripMarkdown("**重點**——很重要") === "重點，很重要");
t("全部輸出不含任何破折號", !/[—―─━═–－]/.test(stripMarkdown("甲——乙\n———\n── 小標\n丙–丁")));
t("stripDividers 移除 --- 與 === 線", stripDividers("甲\n---\n乙\n===\n丙") === "甲\n\n乙\n\n丙");
t("共用前綴不再要求 ── 當小標", !SHARED_PREFIX.includes("小標用 ──"));
void filler;

// ───────────── 寵粉文（v3） ─────────────
{
  const fanSettings = (funnel: any = "hot") => ({ genre: "fan" as const, funnel, claim: "謝謝一路跟著的人", material: "我最近在課堂上說了一句話，大家都笑了。", metaphor: "", length: "", cta: "" });
  const brands = ["nas", "abl", "i8", "erick"] as const;
  t("寵粉文已啟用且要口述逐字稿", GENRES.fan.enabled === true && GENRES.fan.materialRequired === true && GENRES.fan.materialLabel === "口述逐字稿");
  t("版本升為 genre-v4", PROMPT_VERSION === "genre-v4");
  const prompts = brands.map((b) => buildGenrePrompt(b, fanSettings()));
  t("四個品牌的寵粉提示詞都含寵粉骨架與領域", prompts.every((p) => p.includes("【本篇文體：寵粉文】") && p.includes("【寵粉領域：")));
  t("各品牌領域寫法不同", new Set(prompts.map((p) => p.match(/【寵粉領域：[^】]+】/)?.[0])).size === 4);
  t("平衡空間領域含生命數字語彙", prompts[0].includes("【寵粉領域：平衡空間】") && prompts[0].includes("主命數"));
  t("艾伯林領域限制 TimeWaver 與保證效果", prompts[1].includes("TimeWaver 只能出現在經歷陳述") && prompts[1].includes("不保證效果"));
  t("初八領域不歸咎個人", prompts[2].includes("不指向任何個人"));
  t("寵粉文不套用給陌生人的入口橋接", !prompts[0].includes("【入口橋接規則") && !prompts[1].includes("【入口橋接規則"));
  t("寵粉文一律用熱層規則，即使選了冷", buildGenrePrompt("abl", fanSettings("cold")).includes("【漏斗層：熱】") && !buildGenrePrompt("abl", fanSettings("cold")).includes("【漏斗層：冷】"));
  t("其他文體不帶寵粉領域", !buildGenrePrompt("nas", { genre: "case", funnel: "cold", claim: "x", material: "y", metaphor: "", length: "", cta: "" }).includes("【寵粉領域："));
  t("寵粉骨架與領域本身不含破折號", !/[—─–]/.test(GENRES.fan.skeleton) && !/[—─–]/.test(prompts.map((p) => p.match(/【寵粉領域：[\s\S]*?(?=\n\n【本篇文體)/)?.[0] || "").join("")));
  t("goalOf 對照：冷=破圈 溫=信任 寵粉文=寵粉", goalOf("case", "cold") === "reach" && goalOf("breakdown", "warm") === "trust" && goalOf("fan", "hot") === "fan");
  t("文字能辨識寵粉文", genreFromText("寵粉文") === "fan");
  t("寵粉文不代填素材，等你的逐字稿", materialFor(parsePastedTopics("題目 1｜x\n標題\n【建議】寵粉文｜熱流量\n【主張】甲").topics[0], "fan") === "");
  t("寵粉文字數區間 500 到 1100", GENRES.fan.lengthRange[0] === 500 && GENRES.fan.lengthRange[1] === 1100);
}

console.log(`\n結果: ${pass} 通過 / ${fail} 失敗`);
process.exit(fail ? 1 : 0);

