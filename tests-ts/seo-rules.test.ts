import { scoreArticle, parseArticle, brandAliasesFor } from "../src/lib/seo-rules";
let pass = 0, fail = 0;
const t = (name: string, cond: boolean) => { cond ? pass++ : fail++; console.log(`${cond ? "✓" : "✗"} ${name}`); };

const para = (n: number) => "這是一段用來測試的內容，說明組織流程盤點在中小企業裡扮演的角色與限制。".repeat(n);
const good = [
  "中小企業管理卡點如何突破？組織流程盤點能做與不能做的邊界",
  "組織流程盤點是指由客觀第三方檢視經營流程斷點與角色權責的診斷工作，目的是看見內部看不到的盲區。",
  "為什麼加開會議還是沒用",
  para(2),
  para(2),
  "組織流程盤點能做什麼",
  "1. 找出流程斷點",
  "2. 釐清角色權責",
  "3. 排出處理順序",
  para(2),
  "盤點之後怎麼辦？",
  para(2), para(2), para(2), para(2), para(2), para(2), para(2),
  "總結來說，I8 企業醫生做的是看見關鍵因素，再決定下一步，而不是替你做決定。",
].join("\n\n");

const r = scoreArticle({ content: good, keywords: ["組織流程盤點"], brandAliases: ["I8", "企業醫生"], faqText: "Q：什麼是盤點？\nA：略\n\nQ：要多久？\nA：略\n\nQ：誰來做？\nA：略", schemaText: '{"@type":"FAQPage"}' });
t("完整文章三項都高於 80", r.scores.seo >= 80 && r.scores.aeo >= 80 && r.scores.geo >= 80);
t("同一篇重算分數完全相同（可重現）", JSON.stringify(scoreArticle({ content: good, keywords: ["組織流程盤點"] }).scores) === JSON.stringify(scoreArticle({ content: good, keywords: ["組織流程盤點"] }).scores));

const bare = "短標題\n\n只有一小段文字。";
const rb = scoreArticle({ content: bare, keywords: ["組織流程盤點"], brandAliases: ["I8"] });
t("很薄的文章分數明顯偏低", rb.scores.seo < 40 && rb.scores.geo < 50);
t("薄文章列出前三個問題", rb.topIssues.length === 3);

t("沒設關鍵字時，關鍵字規則不納入", !scoreArticle({ content: good }).results.some((x) => x.id.startsWith("kw-")));
t("沒給品牌別名時，品牌規則不納入", !scoreArticle({ content: good }).results.some((x) => x.id === "brand"));

const hype = scoreArticle({ content: good + "\n\n保證有效，100%見效。" });
t("誇大用詞會被抓出", hype.results.find((x) => x.id === "hype")?.status === "fail");

const dash = scoreArticle({ content: good + "\n\n這是——破折號。" });
t("殘留破折號會被抓出", dash.results.find((x) => x.id === "clean")?.status === "fail");

const stuffed = scoreArticle({ content: "盤點盤點盤點\n\n" + "盤點".repeat(80), keywords: ["盤點"] });
t("關鍵字堆砌會被抓出", stuffed.results.find((x) => x.id === "kw-density")!.earned < 0.5);

const withFaq = scoreArticle({ content: good, faqText: "Q：a\nA：b" }).results.find((x) => x.id === "faq")!;
const noFaq = scoreArticle({ content: good }).results.find((x) => x.id === "faq")!;
t("有問答集比沒有高", withFaq.earned > noFaq.earned && noFaq.earned === 0);

const withMermaid = scoreArticle({ content: good + "\n\n```mermaid\ngraph TD; A-->B\n```" });
t("Mermaid 圖表算圖表、且不被當成文字", withMermaid.results.find((x) => x.id === "visual")!.earned === 1 && !withMermaid.stats.title.includes("graph"));
const placeholder = scoreArticle({ content: good + "\n\n【保留區塊1】" });
t("保留區塊佔位標記算圖表", placeholder.results.find((x) => x.id === "visual")!.earned === 1);

const p = parseArticle("標題\n\n小標題在這\n\n這是一個很長很長的完整句子，結尾有標點。\n\n另一個小標題");
t("解析：結尾有標點的是段落，沒有的短行是小標題", p.subheads.length === 2 && p.paragraphs.length === 1);

t("品牌別名對照", brandAliasesFor("I8 (Initial 8 CO.)").includes("企業醫生") && brandAliasesFor("NAS (平衡空間)").includes("平衡空間") && brandAliasesFor("ABL (量子調頻)").includes("艾伯林"));
t("分數在 0 到 100", [r, rb].every((x) => Object.values(x.scores).every((v) => v >= 0 && v <= 100)));
console.log(`\n結果: ${pass} 通過 / ${fail} 失敗`);
process.exit(fail ? 1 : 0);
