import {
  buildStoryArgumentPrompt,
  getStoryArgumentSections,
  getStoryArgumentChineseAuthor,
  getStoryArgumentChineseBookTitle,
  getWritingFrameworkOptions,
  normalizeStoryArgumentCitationWording,
  normalizeStoryArgumentCopy,
  isStoryArgumentCitationEligible,
  getStoryArgumentSelectionError,
  resolveStoryArgumentSelection,
  resolveStoryArgumentThesis,
  shouldIncludeMayaDiagram,
  STORY_ARGUMENT_FRAMEWORK_ID,
  STORY_ARGUMENT_PROMPT_VERSION,
} from "../src/data/skills/story-argument";
import { COPYWRITING_FRAMEWORKS } from "../src/data/skills/frameworks";
import { blockingIssues, checkGenreText } from "../src/lib/genre-check";
import { replaceStoryArgumentSupportParagraph } from "../src/lib/story-argument-reselection";

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
const citedBookPrompt = buildStoryArgumentPrompt(
  { version: "full", thesis: "陪伴比急著給答案重要" },
  { knowledgeNote: { title_zh: "黑馬思維", author_zh: "陶德·羅斯", zh_status: "confirmed", content: "筆記全文" } }
);
const englishBookPrompt = buildStoryArgumentPrompt(
  { version: "full", thesis: "陪伴比急著給答案重要" },
  { knowledgeNote: { title_zh: "EQ", author_zh: "Isabella Price", zh_status: "confirmed", content: "筆記全文" } }
);
t("共情版只設定前三段且明確禁止第四段", getStoryArgumentSections("empathy").length === 3 && empathy.includes("共情版只寫前三段") && !getStoryArgumentSections("empathy").includes("解決方案"));
t("完整版依序包含四段", getStoryArgumentSections("full").join("、") === "切入現象、故事、論點支持、解決方案" && full.includes("完整版必須依序寫完四段"));
t("沒有來源時明確保留引用來源標記", full.includes("【需補：引用來源】") && full.includes("不得編造出處"));
t("引用提示允許 confirmed 欄位逐字含英文，並只限制引用以外新增英文書目", citedBookPrompt.includes("陶德·羅斯在《黑馬思維》提出") && citedBookPrompt.includes("只使用 title_zh 與 author_zh") && englishBookPrompt.includes("Isabella Price在《EQ》提出") && englishBookPrompt.includes("即使其中含英文字母或英文姓名") && englishBookPrompt.includes("引用以外的內文不得另加未提供的英文書名或人名") && !englishBookPrompt.includes("不得輸出 Dr.") && !englishBookPrompt.includes("不得輸出英文書名"));
t("引用措辭提示統一使用提出並禁止評價書籍或觀點", full.includes("引用動詞一律使用「提出」") && full.includes("最著名的") && full.includes("一致認為"));
t("提示詞要求單一論點、純文字及文體優先", full.includes("只講一個論點") && full.includes("不得出現 Markdown 符號或任何破折號") && buildStoryArgumentPrompt({ version: "full", thesis: "" }, { genreMode: true }).includes("文體提示詞的段落骨架"));
t("提示詞禁止輸出段落標籤並要求單論點自我檢查", full.includes("不得出現「切入現象」「故事」「論點支持」「解決方案」作為獨立標題或標籤") && full.includes("若出現第二個獨立論點，刪除它") && full.includes("結尾不得拆成多個並列問題"));
t("提示詞要求直接開場、短段落與擬真故事不得冒充真人", full.includes("前三句內進入主題") && full.includes("每段最多三行") && full.includes("不得聲稱真人真事") && full.includes("轉折只靠一句關鍵話"));
t("完整版論點支持固定引用、白話轉譯、回扣故事三步", full.includes("一個通過既有驗證的知識庫引用、一句白話轉譯、回扣本篇故事"));
t("共情版引用規則維持不變且以一句看見收束", empathy.includes("不強制引用、不加出處與待補標記") && empathy.includes("把故事翻成一句看見"));
t("AI 論點最多 30 字且保留使用者指定原文", resolveStoryArgumentThesis("使用者提供的論點超過三十字也完全照用", "這是超過三十個字元的生成論點文字內容") === "使用者提供的論點超過三十字也完全照用" && [...resolveStoryArgumentThesis("", "這是超過三十個字元的生成論點文字內容")].length <= 30);
t("故事論點停用 Mermaid，其他框架仍保留原流程圖提示", !shouldIncludeMayaDiagram({ version: "full", thesis: "主張" }) && shouldIncludeMayaDiagram());
const storyCheckMeta = { genre: "case" as const, funnel: "warm" as const, prompt_version: STORY_ARGUMENT_PROMPT_VERSION };
t("【需補】仍會擋住故事論點框架發佈", blockingIssues(checkGenreText("文章有【需補：引用來源】", storyCheckMeta)).some((issue) => issue.code === "need-fill"));
t("既有禁用詞檢查仍套用於故事論點框架", blockingIssues(checkGenreText("文章含有保證改善", storyCheckMeta)).some((issue) => issue.code === "forbidden"));

const normalized = normalizeStoryArgumentCopy("一句話論點：主張甲\n### **標題**\n\n- 故事——內容", "主張甲");
t("正文清除論點標籤、Markdown 與破折號", !normalized.replace(/^#.*$/gm, "").includes("一句話論點：主張甲") && !/[#*`—―─━═–－]/.test(normalized.replace(/^#.*$/gm, "")) && normalized.includes("標題"));

const labeledCopy = normalizeStoryArgumentCopy(
  "（一）切入現象：\n你剛下班，手機還亮著。\n二、【故事】：\n這個故事裡，她把杯子放回桌上。\n3.（論點支持）：\n她忽然明白一件事。\n四、解決方案。\n今天先停一下。",
  "先看見自己的疲憊"
);
t("獨立段落標籤含編號與括號變體會移除", !labeledCopy.split("\n").some((line) => /^(?:切入現象|故事|論點支持|解決方案)$/.test(line.replace(/[\s\p{P}\p{S}\p{N}]/gu, ""))));
t("四種段落名稱的編號行不殘留", !labeledCopy.split("\n").some((line) => ["切入現象", "故事", "論點支持", "解決方案"].includes(line.trim())));
t("正文中含故事二字的句子不會誤刪", labeledCopy.includes("這個故事裡，她把杯子放回桌上。"));

const mermaidCopy = normalizeStoryArgumentCopy(
  "前文保留。\n\n```mermaid\n%%{init: {'theme':'base'}}%%\nflowchart TD\n  A[開始] --> B[結束]\n```\n\n後文保留。\n\nflowchart LR\nA --> B",
  "陪伴比急著給答案重要"
);
t("Mermaid 區塊、init、flowchart 與 graph 程式碼會移除", !/mermaid|%%\{init|flowchart|graph\s+(?:TD|LR|BT|RL|TB)|A\s*-->\s*B/i.test(mermaidCopy) && mermaidCopy.includes("前文保留") && mermaidCopy.includes("後文保留"));

const taggedCopy = normalizeStoryArgumentCopy("正文內容。\n\n主題標籤：情緒覺察，關係溝通", "情緒起伏時先看見感受");
t("缺少井字號的主題標籤會補上並以空格分隔", taggedCopy.endsWith("#情緒覺察 #關係溝通") && !taggedCopy.endsWith("，關係溝通"));
t("正文逗號句不會被誤認成主題標籤", normalizeStoryArgumentCopy("句子寫著先停一下，再慢慢看清楚。", "先停一下更能看清楚").includes("句子寫著先停一下，再慢慢看清楚。"));
const citedTaggedCopy = normalizeStoryArgumentCopy("正文。\n\n#情緒覺察 #自我理解\n\n出處：書名，作者", "情緒起伏時先看見感受");
t("驗證出處位於標籤之前，標籤保留在文末", citedTaggedCopy.endsWith("#情緒覺察 #自我理解") && citedTaggedCopy.indexOf("出處：書名，作者") < citedTaggedCopy.lastIndexOf("#情緒覺察"));
t("沒有標籤時依論點補一個主題標籤", normalizeStoryArgumentCopy("只有正文。", "陪伴比急著給答案重要").endsWith("#陪伴比急著給答案重要"));

const titleNormalizedCopy = normalizeStoryArgumentCopy(
  "陶德·羅斯在《黑馬思維：哈佛最推崇的人生計畫，教你成就更好的自己》提出一個觀點。正文外的時間：晚上八點，仍要保留。\n\n作者也在《黑馬思維:出版補充說明》提到相似概念。",
  "理解差異能幫助找到方向"
);
t("故事論點後處理不再從引用正文剝除副標題，正文冒號照常保留", titleNormalizedCopy.includes("《黑馬思維：哈佛最推崇的人生計畫，教你成就更好的自己》") && titleNormalizedCopy.includes("《黑馬思維:出版補充說明》") && titleNormalizedCopy.includes("時間：晚上八點"));

const evaluatedCitation = normalizeStoryArgumentCitationWording("作者在《某書》提出一個核心概念是：先辨認感受，再決定下一步。");
t("含核心概念的引用句會安全改寫為提出", evaluatedCitation.includes("作者在《某書》提出") && !evaluatedCitation.includes("核心概念"));
const plainCitation = "作者在《某書》提出一個整理方法，幫助讀者看見當下。";
t("不含評價詞的引用句保持原樣", normalizeStoryArgumentCitationWording(plainCitation) === plainCitation);
const unrelatedCoreSentence = "這是文章的核心概念，但這句不是引用。";
t("非引用正文中的核心用語不受影響", normalizeStoryArgumentCitationWording(unrelatedCoreSentence) === unrelatedCoreSentence);
const originalWarn = console.warn;
let wordingWarnings = 0;
console.warn = () => { wordingWarnings += 1; };
const unsafeCitation = "作者在《某書》提出，這是最著名的核心概念。";
const unsafeResult = normalizeStoryArgumentCitationWording(unsafeCitation);
console.warn = originalWarn;
t("無法安全改寫的引用句保留原文並記錄內部警告", unsafeResult === unsafeCitation && wordingWarnings === 1);

const chineseTitle = getStoryArgumentChineseBookTitle("黑馬思維");
const chineseAuthor = getStoryArgumentChineseAuthor("陶德·羅斯");
t("書名與作者只直接使用提供欄位，不解析括號或翻譯英文內容", chineseTitle === "黑馬思維" && chineseAuthor === "陶德·羅斯" && getStoryArgumentChineseBookTitle("黑馬思維（Dark Horse）") === "黑馬思維（Dark Horse）" && getStoryArgumentChineseAuthor("Todd Rose") === "Todd Rose");
t("只有中文書名、作者皆存在且狀態 confirmed 才符合引用資格", isStoryArgumentCitationEligible({ title_zh: "黑馬思維", author_zh: "陶德·羅斯", zh_status: "confirmed" }) && !isStoryArgumentCitationEligible({ title_zh: "黑馬思維", author_zh: "陶德·羅斯", zh_status: "unverified" }));
t("指定書籍模式未選書會回傳阻擋提示", getStoryArgumentSelectionError({ version: "full", thesis: "論點", citationMode: "selected" })?.includes("請先選擇") === true);

const originalStory = [
  "開頭段落，原字保留。",
  "故事段落，杯子仍放在桌上。",
  "舊的論點支持段。",
  "結尾回到故事。",
  "出處：舊作者，《舊書》",
  "#情緒覺察 #自我理解",
].join("\n\n");
const reselectedStory = replaceStoryArgumentSupportParagraph(originalStory, "新的論點支持段。\n\n出處：陶德·羅斯，《黑馬思維》", false);
const originalBlocks = originalStory.split("\n\n");
const reselectedBlocks = reselectedStory.split("\n\n");
t("未勾全文重寫時只替換論點支持段與出處，其他段落逐字不變", reselectedBlocks[0] === originalBlocks[0] && reselectedBlocks[1] === originalBlocks[1] && reselectedBlocks[2] === "新的論點支持段。" && reselectedBlocks[3] === originalBlocks[3] && reselectedBlocks.includes("出處：陶德·羅斯，《黑馬思維》") && reselectedBlocks.at(-1) === originalBlocks.at(-1));
t("想法欄位不會進入替換後文章", !reselectedStory.includes("只供本次選書的想法"));

console.log(`結果: ${passed} 通過 / ${failed} 失敗`);
if (failed > 0) process.exitCode = 1;
