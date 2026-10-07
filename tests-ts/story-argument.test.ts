import {
  buildStoryArgumentPrompt,
  getStoryArgumentSections,
  getWritingFrameworkOptions,
  normalizeStoryArgumentCopy,
  resolveStoryArgumentSelection,
  STORY_ARGUMENT_FRAMEWORK_ID,
} from "../src/data/skills/story-argument";
import { COPYWRITING_FRAMEWORKS } from "../src/data/skills/frameworks";
import { blockingIssues, checkGenreText } from "../src/lib/genre-check";

let passed = 0;
let failed = 0;
function t(name: string, condition: boolean) {
  if (condition) {
    passed++;
    console.log(`✓ ${name}`);
  } else {
    failed++;
    console.error(`✗ ${name}`);
  }
}

const options = getWritingFrameworkOptions(Object.values(COPYWRITING_FRAMEWORKS));
t("寫作框架下拉新增故事論點且保留所有既有選項", options.some((item) => item.id === STORY_ARGUMENT_FRAMEWORK_ID) && Object.keys(COPYWRITING_FRAMEWORKS).every((id) => options.some((item) => item.id === id)));
t("既有框架不會被解析成故事論點", resolveStoryArgumentSelection("default", "empathy", "測試") === undefined);

const empathy = buildStoryArgumentPrompt({ version: "empathy", thesis: "陪伴比急著給答案重要" });
const full = buildStoryArgumentPrompt({ version: "full", thesis: "陪伴比急著給答案重要" });
t("共情版只設定前三段且明確禁止第四段", getStoryArgumentSections("empathy").length === 3 && empathy.includes("共情版只寫前三段") && !getStoryArgumentSections("empathy").includes("解決方案"));
t("完整版依序包含四段", getStoryArgumentSections("full").join("、") === "切入現象、故事、論點支持、解決方案" && full.includes("完整版必須依序寫完四段"));
t("沒有來源時明確保留引用來源標記", full.includes("【需補：引用來源】") && full.includes("不得編造出處"));
t("提示詞要求單一論點、純文字及文體優先", full.includes("只講一個論點") && full.includes("不得出現 Markdown 符號或任何破折號") && buildStoryArgumentPrompt({ version: "full", thesis: "" }, { genreMode: true }).includes("文體提示詞的段落骨架"));
const storyCheckMeta = { genre: "case" as const, funnel: "warm" as const, prompt_version: "story-argument-v1" };
t("【需補】仍會擋住故事論點框架發佈", blockingIssues(checkGenreText("文章有【需補：引用來源】", storyCheckMeta)).some((issue) => issue.code === "need-fill"));
t("既有禁用詞檢查仍套用於故事論點框架", blockingIssues(checkGenreText("文章含有保證改善", storyCheckMeta)).some((issue) => issue.code === "forbidden"));

const normalized = normalizeStoryArgumentCopy("一句話論點：主張甲\n### **標題**\n\n- 故事——內容", "主張甲");
t("正文清除論點標籤、Markdown 與破折號", !normalized.includes("主張甲") && !/[#*`—―─━═–－]/.test(normalized) && normalized.includes("標題"));

console.log(`結果: ${passed} 通過 / ${failed} 失敗`);
if (failed > 0) process.exitCode = 1;
