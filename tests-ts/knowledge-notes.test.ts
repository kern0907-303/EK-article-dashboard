import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  applyValidatedKnowledgeCitation,
  buildKnowledgeImportPlan,
  selectRelevantKnowledgeContent,
  toKnowledgeNoteDirectoryEntry,
} from "../src/lib/knowledge-note-utils";
import {
  resolveStoryArgumentSelection,
  STORY_ARGUMENT_CITATION_OPTIONS,
  STORY_ARGUMENT_FRAMEWORK_ID,
} from "../src/data/skills/story-argument";

let passed = 0;
let failed = 0;
function t(name: string, condition: boolean) {
  if (condition) { passed += 1; console.log(`✓ ${name}`); }
  else { failed += 1; console.error(`✗ ${name}`); }
}

const selection = resolveStoryArgumentSelection(STORY_ARGUMENT_FRAMEWORK_ID, "full", "情緒起伏需要被理解");
t("引用選項包含自動、指定與不引用，預設自動挑選", STORY_ARGUMENT_CITATION_OPTIONS.map((item) => item.id).join(",") === "auto,selected,none" && selection?.citationMode === "auto");
t("既有框架不會取得知識引用選項", resolveStoryArgumentSelection("default", "full", "主題") === undefined);

const record = {
  id: "note-1", domain: "emotions-psychology", title: "情緒書", author: "作者甲", subdomain: "情緒",
  domain_tags: ["情緒"], source_file: "source.md", content: "全文不應傳至瀏覽器", chars: 11,
  content_md5: "abc", imported_at: "2026-10-07T00:00:00.000Z",
};
const directoryEntry = toKnowledgeNoteDirectoryEntry(record);
t("書目 API 投影只有 id、title、author、domain、subdomain，不含全文", Object.keys(directoryEntry).sort().join(",") === "author,domain,id,subdomain,title" && !("content" in directoryEntry));
const serverDirectorySource = readFileSync(join(process.cwd(), "src/lib/knowledge-notes-server.ts"), "utf8");
const tableSql = readFileSync(join(process.cwd(), "docs/sql/2026-10-07_knowledge_notes.sql"), "utf8");
t("伺服器書目查詢不選全文，全文另由伺服器函式讀取", serverDirectorySource.includes("select=id,domain,title,author,subdomain") && serverDirectorySource.includes("select=id,domain,title,author,domain_tags,subdomain,source_file,content"));
t("知識表啟用 RLS 並撤銷瀏覽器角色權限", tableSql.includes("enable row level security") && tableSql.includes("from public, anon, authenticated") && !/create\s+policy/i.test(tableSql));

const incoming = [
  { source_file: "new.md", content_md5: "a" },
  { source_file: "changed.md", content_md5: "new" },
  { source_file: "same.md", content_md5: "same" },
];
const importPlan = buildKnowledgeImportPlan(incoming, [
  { source_file: "changed.md", content_md5: "old" },
  { source_file: "same.md", content_md5: "same" },
]);
t("匯入分類具冪等性：新增一筆、更新一筆、相同 MD5 略過", importPlan.inserts.length === 1 && importPlan.updates.length === 1 && importPlan.skipped === 1);
t("重跑相同資料全部略過", buildKnowledgeImportPlan(incoming, incoming).skipped === 3);

const longContent = [
  "# 一般背景\n與主題無關的通用內容。".repeat(1800),
  "# 情緒起伏\n情緒波動與情緒辨識的相關內容。".repeat(5000),
].join("\n\n");
const excerpt = selectRelevantKnowledgeContent(longContent, "情緒起伏與煩躁", 20_000);
t("超過 20,000 字時選取相關章節並限制上限", [...excerpt].length <= 20_000 && excerpt.includes("情緒波動"));

const mismatch = applyValidatedKnowledgeCitation(
  "### 論點支持\n情緒可能受到多種因素影響。\n\n出處：別本，錯誤作者",
  "別本", "錯誤作者", record, true
);
t("出處與伺服器讀入筆記不一致時改為【需補：引用來源】", mismatch.content.endsWith("【需補：引用來源】") && !mismatch.content.includes("出處：別本") && !mismatch.valid);
t("即使回報欄位正確，正文引用未讀入書籍仍改為待補", applyValidatedKnowledgeCitation(`正文提到《另一本書》`, record.title, record.author, record, true).content.endsWith("【需補：引用來源】"));
t("來源不存在時強制標示待補，不接受未讀入書籍", applyValidatedKnowledgeCitation("正文", "書名", "作者", null, true).content.endsWith("【需補：引用來源】"));
t("本篇不引用時不產生【需補】或出處行", !applyValidatedKnowledgeCitation("正文\n出處：編造，作者", "編造", "作者", null, false).content.includes("需補") && !applyValidatedKnowledgeCitation("正文", "", "", null, false).content.includes("出處："));
t("驗證通過時伺服器固定輸出實際讀入筆記的純文字出處", applyValidatedKnowledgeCitation("正文", record.title, record.author, record, true).content.endsWith(`出處：${record.title}，${record.author}`));

const longTitleRecord = {
  ...record,
  title: "黑馬思維：哈佛最推崇的人生計畫，教你成就更好的自己（Dark Horse: Achieving Success Through the Pursuit of Fulfillment）",
  author: "陶德·羅斯（Todd Rose）、奧吉·歐加斯（Ogi Ogas）",
};
const normalizedCitation = applyValidatedKnowledgeCitation(
  `作者在《黑馬思維》提出一個觀點。\n出處：黑 馬 思維:出版補充，${longTitleRecord.author}`,
  "《黑馬思維》",
  longTitleRecord.author,
  longTitleRecord,
  true
);
t("正文主書名與資料庫長書名正規化後通過驗證，不再誤標需補", normalizedCitation.valid && !normalizedCitation.content.includes("【需補：引用來源】") && normalizedCitation.content.endsWith(`出處：黑馬思維，${longTitleRecord.author}`));
t("書名標點、空白與副標題差異只正規化書名，不放寬作者驗證", !applyValidatedKnowledgeCitation("正文《黑馬思維》", "黑馬思維", "不同作者", longTitleRecord, true).valid);

const plain = applyValidatedKnowledgeCitation("### **小標**\n情緒起伏——值得理解。", "", "", null, false).content;
t("輸出清除破折號與 Markdown 符號", !/[—―─━═–－#*`]/.test(plain));

console.log(`結果: ${passed} 通過 / ${failed} 失敗`);
if (failed > 0) process.exit(1);
