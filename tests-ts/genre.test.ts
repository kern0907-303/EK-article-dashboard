import { checkGenreText, blockingIssues } from "../src/lib/genre-check";
import { buildGenrePrompt, GENRES, brandKeyFromId, PROMPT_VERSION } from "../src/data/skills/genres";
import { stripMarkdown } from "../src/lib/plain-text";

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
t("stripMarkdown 保留 【】 與 ──", stripMarkdown("【標題】\n\n── 小標\n**重點**") === "【標題】\n\n── 小標\n重點");
void filler;

console.log(`\n結果: ${pass} 通過 / ${fail} 失敗`);
process.exit(fail ? 1 : 0);
