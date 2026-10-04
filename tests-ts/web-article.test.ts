import { textHash, dropHashtagLines, resolveWebContent, isArticleStale, hasWebArticle } from "../src/lib/web-article";
let pass = 0, fail = 0;
const t = (name: string, cond: boolean) => { cond ? pass++ : fail++; console.log(`${cond ? "✓" : "✗"} ${name}`); };

const long = "這是一段足夠長的官網文章內容，用來測試是否被判定為有效文章。".repeat(2);
t("相同文字雜湊相同、不同文字不同", textHash("甲") === textHash("甲") && textHash("甲") !== textHash("乙"));
t("拿掉只有 hashtag 的行", dropHashtagLines("正文\n\n#個人品牌 #自我成長\n") === "正文");
t("保留句中有井字號的正文", dropHashtagLines("我喜歡 #這個 概念，所以寫了。") === "我喜歡 #這個 概念，所以寫了。");
t("有官網文章 → 送官網文章", resolveWebContent(long, "社群").content === long && resolveWebContent(long, "社群").usedFallback === false);
t("沒有官網文章 → 退回社群文案並標示 fallback", resolveWebContent(undefined, "社群貼文").usedFallback === true && resolveWebContent("", "社群貼文").content === "社群貼文");
t("生成中提示不算官網文章", hasWebArticle("⏳ 正在生成中……".repeat(5)) === false);
t("沒有 meta → 不算過期", isArticleStale(undefined, "x") === false);
t("社群貼文沒變 → 不過期", isArticleStale({ from_hash: textHash("原文") }, "原文") === false);
t("社群貼文被改過 → 過期", isArticleStale({ from_hash: textHash("原文") }, "改過的原文") === true);
console.log(`\n結果: ${pass} 通過 / ${fail} 失敗`);
process.exit(fail ? 1 : 0);
