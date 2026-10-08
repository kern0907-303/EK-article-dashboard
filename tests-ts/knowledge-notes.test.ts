import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  applyValidatedKnowledgeCitation,
  buildKnowledgeImportPlan,
  extractKnowledgeNoteHighlight,
  selectRelevantKnowledgeContent,
  toKnowledgeNoteDirectoryEntry,
} from "../src/lib/knowledge-note-utils";
import {
  getStoryArgumentSelectionError,
  isStoryArgumentCitationEligible,
  resolveStoryArgumentSelection,
  STORY_ARGUMENT_CITATION_OPTIONS,
  STORY_ARGUMENT_FRAMEWORK_ID,
} from "../src/data/skills/story-argument";
import { chooseStoryArgumentNote } from "../src/lib/story-argument-reselection";
import { blockingIssues, checkGenreText } from "../src/lib/genre-check";

let passed = 0;
let failed = 0;
function t(name: string, condition: boolean) {
  if (condition) { passed += 1; console.log(`✓ ${name}`); }
  else { failed += 1; console.error(`✗ ${name}`); }
}

const selection = resolveStoryArgumentSelection(STORY_ARGUMENT_FRAMEWORK_ID, "full", "情緒起伏需要被理解");
t("引用選項包含自動、指定與不引用，預設自動挑選", STORY_ARGUMENT_CITATION_OPTIONS.map((item) => item.id).join(",") === "auto,selected,none" && selection?.citationMode === "auto");
t("既有框架不會取得知識引用選項", resolveStoryArgumentSelection("default", "full", "主題") === undefined);
t("指定書籍模式未選書會得到明確阻擋提示", getStoryArgumentSelectionError({ version: "full", thesis: "主張", citationMode: "selected" })?.includes("請先選擇") === true);

const record = {
  id: "note-1", domain: "emotions-psychology", title: "Dark Horse", author: "Todd Rose",
  title_zh: "黑馬思維", title_zh_subtitle: "哈佛最推崇的人生計畫", author_zh: "陶德·羅斯", zh_status: "confirmed",
  subdomain: "情緒", domain_tags: ["情緒"], source_file: "source.md", content: "全文不應傳至瀏覽器。情緒辨識能協助人理解當下。",
  chars: 28, content_md5: "abc", imported_at: "2026-10-07T00:00:00.000Z",
};
const directoryEntry = toKnowledgeNoteDirectoryEntry(record);
t("目錄只含書目欄位且保留其他功能使用的原始書目，不含全文", Object.keys(directoryEntry).sort().join(",") === "author,author_zh,domain,id,subdomain,title,title_zh,zh_status" && !("content" in directoryEntry));
t("只有 confirmed 且中文書名與作者完整才可引用", isStoryArgumentCitationEligible(record) && !isStoryArgumentCitationEligible({ ...record, zh_status: "unverified" }) && !isStoryArgumentCitationEligible({ ...record, author_zh: "" }));

const serverDirectorySource = readFileSync(join(process.cwd(), "src/lib/knowledge-notes-server.ts"), "utf8");
const knowledgeApiSource = readFileSync(join(process.cwd(), "src/app/api/knowledge-notes/route.ts"), "utf8");
const workspaceBoardSource = readFileSync(join(process.cwd(), "src/components/WorkspaceBoard.tsx"), "utf8");
const chatBoxSource = readFileSync(join(process.cwd(), "src/components/ChatBox.tsx"), "utf8");
const chatRouteSource = readFileSync(join(process.cwd(), "src/app/api/chat/route.ts"), "utf8");
const tableSql = readFileSync(join(process.cwd(), "docs/sql/2026-10-07_knowledge_notes.sql"), "utf8");
t("伺服器目錄僅查書目欄位，全文另由伺服器函式讀取", serverDirectorySource.includes("select=id,domain,title,author,title_zh,author_zh,zh_status,subdomain") && serverDirectorySource.includes("source_file,content,chars,content_md5"));
t("中文欄位 migration 尚未套用時退回舊查詢，維持既有衍生功能可讀", serverDirectorySource.includes("fetchKnowledgeRowsWithLegacyFallback") && serverDirectorySource.includes("!error.message.includes(\"HTTP 400\")") && serverDirectorySource.includes("title_zh: null"));
t("自動選書目錄只提供中文欄位且候選先過 confirmed 篩選", serverDirectorySource.includes("directory.filter(isStoryArgumentCitationEligible)") && serverDirectorySource.includes("title_zh: entry.title_zh") && serverDirectorySource.includes("selectable: false"));
t("候選摘句取自筆記原文，API 不回傳全文或檔案路徑", extractKnowledgeNoteHighlight("# 標題\n第一句是筆記原文。第二句不需要。") === "第一句是筆記原文。" && serverDirectorySource.includes("highlight: extractKnowledgeNoteHighlight(note.content)") && knowledgeApiSource.includes("story-argument-candidates") && !knowledgeApiSource.includes("source_file") && !serverDirectorySource.includes("content: note.content"));
t("指定書籍下拉顯示中文書目，未確認項目灰階且不可選", chatBoxSource.includes("《${note.title_zh}》，${note.author_zh}") && chatBoxSource.includes("disabled={!eligible}") && chatBoxSource.includes("中文資料待確認"));
t("重新挑選候選列出中文資料，未確認項目不可點選且區塊位於結果後", workspaceBoardSource.includes("candidate.title_zh") && workspaceBoardSource.includes("disabled={!candidate.selectable}") && workspaceBoardSource.includes("border-2 border-indigo-400/50"));
t("指定書籍未選會在前端及 API 阻擋生成", chatBoxSource.includes("validateStoryArgumentSelection") && chatRouteSource.includes("STORY_ARGUMENT_SELECTION_REQUIRED"));
t("我的想法只送本次 API 請求，不寫入 workspace 欄位", workspaceBoardSource.includes("idea: storyReselectIdea") && workspaceBoardSource.includes("saveWorkspace(brandId, { social_copy: dispatch.social_copy, story_argument_meta: nextMeta })") && !workspaceBoardSource.includes("storyReselectIdea:"));
t("知識表維持 RLS 並撤銷瀏覽器角色權限", tableSql.includes("enable row level security") && tableSql.includes("from public, anon, authenticated") && !/create\s+policy/i.test(tableSql));

const incoming = [
  { source_file: "new.md", content_md5: "a" },
  { source_file: "changed.md", content_md5: "new" },
  { source_file: "same.md", content_md5: "same" },
];
const importPlan = buildKnowledgeImportPlan(incoming, [
  { source_file: "changed.md", content_md5: "old" },
  { source_file: "same.md", content_md5: "same" },
]);
t("知識匯入分類具冪等性：新增、更新、略過各一筆", importPlan.inserts.length === 1 && importPlan.updates.length === 1 && importPlan.skipped === 1);
t("重跑相同資料全部略過", buildKnowledgeImportPlan(incoming, incoming).skipped === 3);

const longContent = [
  "# 一般背景\n與主題無關的通用內容。".repeat(1800),
  "# 情緒起伏\n情緒波動與情緒辨識的相關內容。".repeat(5000),
].join("\n\n");
const excerpt = selectRelevantKnowledgeContent(longContent, "情緒起伏與煩躁", 20_000);
t("超過 20,000 字時選取相關章節並限制上限", [...excerpt].length <= 20_000 && excerpt.includes("情緒波動"));

const validCitation = applyValidatedKnowledgeCitation("陶德·羅斯在《黑馬思維》提出一個觀點。", "黑馬思維", "陶德·羅斯", record, true);
t("引用句型與書名、作者完全取自已讀入的中文欄位", validCitation.valid && validCitation.content.endsWith("出處：陶德·羅斯，《黑馬思維》"));
const mismatch = applyValidatedKnowledgeCitation("情緒可能受到多種因素影響。\n\n出處：別本，錯誤作者", "別本", "錯誤作者", record, true);
t("AI 出處與實際讀入筆記不一致時以完整引用來源標記阻擋", mismatch.content.endsWith("【需補：引用來源】") && !mismatch.content.includes("出處：別本") && !mismatch.valid);
t("即使 metadata 正確，正文引用未讀入書籍仍以完整標記阻擋", applyValidatedKnowledgeCitation("正文提到《另一本書》", "黑馬思維", "陶德·羅斯", record, true).content.endsWith("【需補：引用來源】"));
t("中文欄位缺漏或非 confirmed 時不使用英文書目且不產生殘缺標記", (() => {
  const result = applyValidatedKnowledgeCitation("Dr. Rose在《Dark Horse》提出一點。", "Dark Horse", "Todd Rose", { title_zh: null, author_zh: null, zh_status: "unverified" }, true);
  return result.content === "【需補：引用來源】" && !/【需補：中文|《【需補|Dark Horse|Todd Rose|Dr\./u.test(result.content);
})());
t("來源不存在時只輸出整句引用來源標記", applyValidatedKnowledgeCitation("作者在《未知書》提出一點。", "未知書", "作者", null, true).content === "【需補：引用來源】");
t("AI 產生殘缺中文書目標記時只保留完整引用來源標記", (() => {
  const result = applyValidatedKnowledgeCitation("作者在《【需補：中文書名】提出一點。", "", "", null, true);
  return result.content === "【需補：引用來源】" && !/【需補：中文|《【需補/u.test(result.content);
})());
t("本篇不引用時不產生出處或任何完整、殘缺需補標記", !applyValidatedKnowledgeCitation("正文\n出處：編造，作者\n作者在《【需補：中文書名】提出", "編造", "作者", null, false).content.match(/出處：|需補/u));
t("主書名不可從英文舊欄位或副標題推導，只接受中文欄位逐字比對", !applyValidatedKnowledgeCitation("作者在《黑馬思維》提出一點。", "黑馬思維：出版副標", "陶德·羅斯", record, true).valid);
t("需補引用來源仍由既有發佈檢查擋住", blockingIssues(checkGenreText(mismatch.content, { genre: "case", funnel: "warm", prompt_version: "test" })).some((issue) => issue.code === "need-fill"));

const eligibleNote = { id: "used", source_file: "used.md", title_zh: "黑馬思維", author_zh: "陶德·羅斯", zh_status: "confirmed" };
const freshNote = { id: "fresh", source_file: "fresh.md", title_zh: "情緒地圖", author_zh: "作者乙", zh_status: "confirmed" };
const pendingNote = { id: "pending", source_file: "pending.md", title_zh: "待確認", author_zh: "作者丙", zh_status: "unverified" };
t("自動重選排除同工作階段已用筆記，也跳過未確認筆記", chooseStoryArgumentNote([eligibleNote, pendingNote, freshNote], ["used.md"])?.id === "fresh");
t("使用者明確選同一本時允許，但仍只接受已確認筆記", chooseStoryArgumentNote([eligibleNote, pendingNote], ["used.md"], "used")?.id === "used" && chooseStoryArgumentNote([eligibleNote, pendingNote], [], "pending") === null);

const plain = applyValidatedKnowledgeCitation("### **小標**\n情緒起伏——值得理解。", "", "", null, false).content;
t("故事論點引用後處理維持純文字並清除破折號與 Markdown", !/[—―─━═–－#*`]/u.test(plain));

console.log(`結果: ${passed} 通過 / ${failed} 失敗`);
if (failed > 0) process.exit(1);
