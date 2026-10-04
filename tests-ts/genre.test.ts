import { checkGenreText, blockingIssues } from "../src/lib/genre-check";
import { buildGenrePrompt, GENRES, brandKeyFromId, PROMPT_VERSION, SHARED_PREFIX } from "../src/data/skills/genres";
import { stripMarkdown, stripDividers, stripDashes } from "../src/lib/plain-text";

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
t("包含 I8 語氣", p.includes("本篇品牌：I8") && p.includes("不歸咎任何個人"));
t("包含冷流量規則", p.includes("漏斗層：冷") && p.includes("全文不得出現 TimeWaver"));
t("包含案例文骨架", p.includes("本篇文體：案例文") && p.includes("找出落差"));
t("比喻留空 → 要求標示待確認", p.includes("【比喻待確認】"));
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

console.log(`\n結果: ${pass} 通過 / ${fail} 失敗`);
process.exit(fail ? 1 : 0);
