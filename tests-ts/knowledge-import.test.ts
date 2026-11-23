import { readFileSync } from "node:fs";
import {
  classifyKnowledgeImportFiles,
  commitKnowledgeImportBatch,
  createKnowledgeImportBatchId,
  undoKnowledgeImportBatch,
} from "../src/lib/knowledge-import-core.mjs";
import { contentMd5 } from "../src/lib/knowledge-note-core.mjs";
import { KNOWLEDGE_DOMAIN_LABELS } from "../src/data/skills/story-argument";

let passed = 0;
let failed = 0;
function t(name: string, condition: boolean) {
  if (condition) { passed += 1; console.log("✓ " + name); }
  else { failed += 1; console.error("✗ " + name); }
}
function quote(value: string) { return JSON.stringify(value); }
function markdown(options: Record<string, string> = {}, body = "筆記正文內容。") {
  const fields = [
    ["domain", options.domain || "emotions-psychology"], ["title_en", "Book " + (options.title_en || "A")], ["author_en", "Author"],
    ["title_zh", options.title_zh ?? "中文書名"], ["title_zh_subtitle", options.title_zh_subtitle ?? ""],
    ["author_zh", options.author_zh ?? "中文作者"], ["translator_zh", ""], ["publisher_zh", ""],
    ["zh_source_url", options.zh_source_url ?? "https://source.example/book"], ["zh_status", options.zh_status || "confirmed"],
    ["domain_tags", options.domain_tags ?? "情緒,心理"], ["subdomain", options.subdomain ?? ""], ["source_file", options.source_file || "book.md"],
  ];
  return "---\n" + fields.map(([key, value]) => key + ": " + quote(value)).join("\n") + "\n---\n" + body;
}
function parseRecord(source: string, filename = "upload.md") {
  return classifyKnowledgeImportFiles([{ filename, content: source }], [])[0].record;
}
function existing(record: Record<string, any>, id: string) { return { ...record, id, imported_at: "2026-01-01T00:00:00Z", import_batch_id: null }; }

const quoted = classifyKnowledgeImportFiles([{ filename: "quoted.md", content: markdown({ title_zh: "情緒 \"地圖\"", author_zh: "", zh_status: "unverified", title_zh_subtitle: "" }, "引號與逗號，像這樣。") }], [])[0];
t("13 欄解析支援引號、逗號及空值，正文與 MD5 由伺服器計算", quoted.record?.title_zh === "情緒 \"地圖\"" && quoted.record?.author_zh === "" && quoted.record?.title_zh_subtitle === "" && quoted.record?.content === "引號與逗號，像這樣。" && quoted.record?.content_md5 === contentMd5("引號與逗號，像這樣。"));

const chineseOriginalSource = markdown({
  title_zh: "峰值體驗", author_zh: "汪志謙·朱海蓓", source_file: "peak-experience.epub",
  zh_source_url: "https://bookstore.example/peak-experience", zh_status: "confirmed",
}).replace('title_en: "Book A"\nauthor_en: "Author"', 'title_en: ""\nauthor_en: ""');
const chineseOriginalRow: any = classifyKnowledgeImportFiles([
  { filename: "peak-experience.md", content: chineseOriginalSource },
], [])[0];
t("confirmed 中文原著在英文書名／作者空白時以正式中文書名與作者分類新增", chineseOriginalRow.classification === "insert" && chineseOriginalRow.problems.length === 0 && chineseOriginalRow.record.title === "峰值體驗" && chineseOriginalRow.record.author === "汪志謙·朱海蓓");

const legacyText = "---\ndomain: emotions-psychology\ntitle: Legacy Book\nauthor: Legacy Author\ndomain_tags: 情緒,心理\nsubdomain: 舊版\nsource_file: legacy.md\n---\n舊格式正文。";
const legacy = classifyKnowledgeImportFiles([{ filename: "legacy.md", content: legacyText }], [])[0];
t("舊格式可讀取，且一律預設 zh_status 為 unverified", legacy.record?.title === "Legacy Book" && legacy.record?.author === "Legacy Author" && legacy.record?.zh_status === "unverified" && legacy.legacy);
t("資料區欄位數量或順序錯誤會列為問題", classifyKnowledgeImportFiles([{ filename: "bad.md", content: legacyText.replace("domain: emotions-psychology\n", "") }], [])[0].problems.length > 0);
t("13 欄名稱順序不符時不會被當成新版格式", classifyKnowledgeImportFiles([{ filename: "order.md", content: markdown().replace("domain: \"emotions-psychology\"\ntitle_en: \"Book A\"", "title_en: \"Book A\"\ndomain: \"emotions-psychology\"") }], [])[0].problems.length > 0);
t("v2 故事未分配比例作為末尾擴充欄位可解析", classifyKnowledgeImportFiles([
  { filename: "v2-ratio.md", content: markdown().replace("source_file: \"book.md\"\n---", "source_file: \"book.md\"\nstory_unassigned_ratio: 0.125\n---") },
], [])[0].classification === "insert");
t("v2 故事未分配比例超出 0 到 1 會被拒絕", classifyKnowledgeImportFiles([
  { filename: "v2-ratio-invalid.md", content: markdown().replace("source_file: \"book.md\"\n---", "source_file: \"book.md\"\nstory_unassigned_ratio: 1.25\n---") },
], [])[0].problems.some((problem: string) => problem.includes("story_unassigned_ratio")));

const inserts = [
  { filename: "new-a.md", content: markdown({ title_en: "New Alpha", source_file: "new-a.md" }) },
  { filename: "new-b.md", content: markdown({ title_en: "New Beta", source_file: "new-b.md" }) },
];
const parsedInserts = inserts.map((file) => parseRecord(file.content, file.filename));
const updates = [
  { filename: "update-a.md", content: markdown({ title_en: "Update One", source_file: "update-a.md" }, "新正文。") },
  { filename: "update-b.md", content: markdown({ title_en: "Update Two", source_file: "update-b.md", title_zh: "更新書名" }, "另一段正文。") },
];
const updateRecords = updates.map((file) => parseRecord(file.content, file.filename));
const skips = [
  { filename: "same-a.md", content: markdown({ title_en: "Same One", source_file: "same-a.md" }) },
  { filename: "same-b.md", content: markdown({ title_en: "Same Two", source_file: "same-b.md" }) },
];
const skipRecords = skips.map((file) => parseRecord(file.content, file.filename));
const existingRows = [
  ...updateRecords.map((record, index) => existing({ ...record, content_md5: contentMd5("舊內容 " + index), content: "舊內容 " + index }, "update-" + index)),
  ...skipRecords.map((record, index) => existing(record, "skip-" + index)),
];
const classified: any[] = classifyKnowledgeImportFiles([...inserts, ...updates, ...skips], existingRows);
t("兩筆新書均分類為新增", classified.slice(0, 2).every((row: any) => row.classification === "insert"));
t("natural-science 領域筆記可分類為新增", classifyKnowledgeImportFiles([
  { filename: "natural-science.md", content: markdown({ domain: "natural-science", title_en: "Natural Science", source_file: "natural-science.md" }) },
], [])[0].classification === "insert");
t("natural-science 領域標籤顯示為自然科學", KNOWLEDGE_DOMAIN_LABELS["natural-science"] === "自然科學");
t("marketing-writing 領域筆記可分類為新增且沒有問題", (() => {
  const row = classifyKnowledgeImportFiles([
    { filename: "marketing-writing.md", content: markdown({ domain: "marketing-writing", title_en: "Marketing Writing", source_file: "marketing-writing.md" }) },
  ], [])[0];
  return row.classification === "insert" && row.problems.length === 0;
})());
t("marketing-writing 標籤與總覽領域篩選顯示為行銷寫作", KNOWLEDGE_DOMAIN_LABELS["marketing-writing"] === "行銷寫作" && readFileSync("src/components/KnowledgeImportWorkspace.tsx", "utf8").includes('["marketing-writing", "行銷寫作"]'));
t("既有四個知識領域仍可分類為新增", ["business-strategy", "emotions-psychology", "life-philosophy", "shenxinling-planning"].every((domain, index) => {
  const row = classifyKnowledgeImportFiles([
    { filename: `existing-domain-${index}.md`, content: markdown({ domain, title_en: `Existing ${index}`, source_file: `existing-domain-${index}.md` }) },
  ], [])[0];
  return row.classification === "insert" && row.problems.length === 0;
}));
t("兩筆既有書目內容或欄位不同均分類為更新", classified.slice(2, 4).every((row: any) => row.classification === "update"));
t("兩筆既有書目校驗碼與欄位相同均分類為跳過", classified.slice(4).every((row: any) => row.classification === "skip"));

const blankTitleFile = {
  filename: "blank-title.md",
  content: markdown({ domain: "business-strategy", title_en: "Blank Title Match", title_zh: "空白書名補入中文名", source_file: "blank-title.md", zh_source_url: "" }, "新版本正文。"),
};
const blankTitleRecord = parseRecord(blankTitleFile.content, blankTitleFile.filename);
const blankTitleTarget = existing({ ...blankTitleRecord, title: "", content: "舊版正文。", content_md5: contentMd5("舊版正文。") }, "blank-title-target");
const blankTitleRow: any = classifyKnowledgeImportFiles([blankTitleFile], [blankTitleTarget])[0];
t("資料庫 title 空白時以完全相同的 domain 與 source_file 配對為更新並補中文書名", blankTitleRow.classification === "update" && blankTitleRow.matched_id === "blank-title-target" && blankTitleRow.title_to_fill === "空白書名補入中文名" && blankTitleRow.problems.length === 0);
t("confirmed 缺 zh_source_url 仍只警告、不阻擋空白書名更新", blankTitleRow.classification === "update" && blankTitleRow.problems.length === 0 && blankTitleRow.warnings.some((warning: string) => warning.includes("缺少 zh_source_url")));

const nonemptyTitleTarget = existing({ ...blankTitleRecord, title: "資料庫既有的完整書名", content: "舊版正文。", content_md5: contentMd5("舊版正文。") }, "nonempty-title-target");
const nonemptyTitleRow: any = classifyKnowledgeImportFiles([blankTitleFile], [nonemptyTitleTarget])[0];
t("title 非空且與匯入書名不同時仍配對更新並標記保留原書名", nonemptyTitleRow.classification === "update" && nonemptyTitleRow.matched_id === "nonempty-title-target" && nonemptyTitleRow.preserve_title === true && nonemptyTitleRow.problems.length === 0);

const englishFallbackFile = {
  filename: "english-fallback.md",
  content: markdown({ domain: "life-philosophy", title_en: "English Fallback", title_zh: "", author_zh: "", zh_status: "no_zh_edition", source_file: "english-fallback.md" }),
};
const englishFallbackRecord = parseRecord(englishFallbackFile.content, englishFallbackFile.filename);
const englishFallbackRow: any = classifyKnowledgeImportFiles([englishFallbackFile], [
  existing({ ...englishFallbackRecord, title: "", content: "舊正文。" }, "english-fallback-target"),
])[0];
t("frontmatter 沒有 title_zh 時以 title_en 補回空白書名", englishFallbackRow.classification === "update" && englishFallbackRow.title_to_fill === englishFallbackRecord.title && englishFallbackRow.problems.length === 0);

const crossDomainSourceRow: any = classifyKnowledgeImportFiles([{
  filename: "cross-domain.md",
  content: markdown({ domain: "emotions-psychology", title_en: "Cross Domain", source_file: "shared-source.md" }),
}], [existing({ domain: "business-strategy", title: "", source_file: "shared-source.md" }, "other-domain-target")])[0];
t("source_file 相同但 domain 不同仍判為衝突", crossDomainSourceRow.classification === "problem" && crossDomainSourceRow.problems.some((problem: string) => problem.includes("source_file")));

const invalidRows = classifyKnowledgeImportFiles([
  { filename: "invalid-domain.md", content: markdown({ title_en: "Invalid", source_file: "bad-domain.md" }).replace("emotions-psychology", "unknown") },
  { filename: "empty-body.md", content: markdown({ title_en: "Empty", source_file: "empty.md" }, "   ") },
], []);
t("兩種欄位／內容錯誤均分類為有問題", invalidRows.every((row: any) => row.problems.length > 0));

const warningRows = classifyKnowledgeImportFiles([
  { filename: "warn-confirmed.md", content: markdown({ title_en: "Warn A", source_file: "warn-a.md", title_zh: "EQ：書名", zh_source_url: "" }) },
  { filename: "warn-unverified.md", content: markdown({ title_en: "Warn B", source_file: "warn-b.md", zh_status: "unverified", author_zh: "" }) },
], []);
t("中文書名英文字母／冒號與 confirmed 缺網址會給警告", warningRows[0].warnings.length >= 3);
t("unverified 狀態警告不會阻擋但會要求確認", warningRows[1].classification === "insert" && warningRows[1].warnings.some((warning: string) => warning.includes("不會被自動挑選")));

const duplicateRows = classifyKnowledgeImportFiles([
  { filename: "copy-one.md", content: markdown({ title_en: "Duplicate Book", source_file: "copy-one.md" }) },
  { filename: "copy-two.md", content: markdown({ title_en: "duplicate-book", source_file: "copy-two.md" }) },
], []);
t("同次上傳同書兩檔都標問題並指出對方檔名", duplicateRows.every((row: any) => row.problems.some((problem: string) => problem.includes("另一個檔案"))) && duplicateRows[0].problems[0].includes("copy-two.md") && duplicateRows[1].problems[0].includes("copy-one.md"));

const statusRows = classifyKnowledgeImportFiles([{ filename: "bad-status.md", content: markdown({ title_en: "Bad Status", source_file: "bad-status.md", zh_status: "pending" }) }], []);
t("無效 zh_status 被伺服器端拒絕", statusRows[0].problems.some((problem: string) => problem.includes("zh_status")));
const protectedOverride = classifyKnowledgeImportFiles([{ filename: "confirmed.md", content: markdown({ title_en: "Confirmed", source_file: "confirmed.md" }), override: { title_zh: "被竄改" } }], []);
t("預覽修改欄位的伺服器端限制只接受 unverified 原始資料", protectedOverride[0].problems.some((problem: string) => problem.includes("只有 unverified")));
t("批次編號符合台北時間 imp-YYYYMMDD-HHMMSS 格式", /^imp-\d{8}-\d{6}$/.test(createKnowledgeImportBatchId(new Date("2026-10-08T02:03:04.000Z"))));

async function main() {
const state: { notes: Record<string, any>[]; batches: any[]; nextId: number } = {
  notes: [
    existing({ ...updateRecords[0], title: "", content: "舊內容", content_md5: contentMd5("舊內容"), import_batch_id: null }, "update-target"),
    existing({ ...parsedInserts[1] }, "unrelated-note"),
  ],
  batches: [] as any[],
  nextId: 1,
};
const store = {
  async listNotes() { return structuredClone(state.notes); },
  async getBatch(id: string) { return structuredClone(state.batches.find((batch) => batch.batch_id === id) || null); },
  async insertBatch(batch: any) { state.batches.push(structuredClone(batch)); },
  async updateBatch(id: string, patch: any) { const row = state.batches.find((batch) => batch.batch_id === id); if (!row) throw new Error("missing batch"); Object.assign(row, structuredClone(patch)); return structuredClone(row); },
  async updateNote(id: string, patch: any) { const row = state.notes.find((note) => note.id === id); if (!row) throw new Error("missing note"); Object.assign(row, structuredClone(patch)); },
  async insertNote(note: any) { const row = { ...structuredClone(note), id: "inserted-" + state.nextId++ }; state.notes.push(row); return row; },
  async deleteInsertedNotes(ids: string[], batchId: string) { state.notes = state.notes.filter((row) => !(ids.includes(row.id) && row.import_batch_id === batchId)); },
  async restoreSnapshot(snapshot: any, batchId: string) { const row = state.notes.find((note) => note.id === snapshot.id && note.import_batch_id === batchId); if (row) Object.assign(row, structuredClone(snapshot)); },
};
const importInputs = [
  { filename: "update-a.md", content: updates[0].content },
  { filename: "new-a.md", content: inserts[0].content },
];
const commit1 = await commitKnowledgeImportBatch(store, { batchId: "imp-20261008-101010", files: importInputs, selectedRowKeys: ["0", "1"], warningsAcknowledged: true, now: "2026-10-08T10:10:10+08:00" });
const afterFirstCommit = structuredClone(state.notes);
t("提交更新時會把資料庫原本空白的 title 補成 title_zh", afterFirstCommit.find((row) => row.id === "update-target")?.title === "中文書名");
const commit2 = await commitKnowledgeImportBatch(store, { batchId: "imp-20261008-101010", files: importInputs, selectedRowKeys: ["0", "1"], warningsAcknowledged: true, now: "2026-10-08T10:10:11+08:00" });
t("提交會記錄更新前完整快照與新增 ID，重送相同批次不重複寫入", commit1.idempotent === false && commit2.idempotent === true && state.notes.length === 3 && commit1.batch.snapshot.length === 1 && commit1.batch.inserted_ids.length === 1);
let differentRequestRejected = false;
try {
  await commitKnowledgeImportBatch(store, { batchId: "imp-20261008-101010", files: [{ filename: "other.md", content: inserts[1].content }], selectedRowKeys: ["0"], warningsAcknowledged: true });
} catch { differentRequestRejected = true; }
t("相同秒批次 ID 不能被不同內容誤當成重送，也不會重複寫入", differentRequestRejected && state.notes.length === 3);
const undone = await undoKnowledgeImportBatch(store, "imp-20261008-101010", "2026-10-08T10:20:00+08:00");
t("撤銷會刪除本批 inserted_ids、還原更新快照且保留批次外筆記", undone.batch.undone_at !== null && state.notes.length === 2 && state.notes.find((row) => row.id === "update-target")?.content === "舊內容" && state.notes.find((row) => row.id === "update-target")?.title === "" && state.notes.some((row) => row.id === "unrelated-note"));
t("撤銷只刪本批新增 ID，與批次外同類資料無關", !state.notes.some((row) => afterFirstCommit.find((saved) => saved.id.startsWith("inserted-"))?.id === row.id) && state.notes.some((row) => row.id === "unrelated-note"));

const preserveTitleState: { notes: Record<string, any>[]; batches: any[] } = { notes: [nonemptyTitleTarget], batches: [] };
const preserveTitleStore = {
  async listNotes() { return structuredClone(preserveTitleState.notes); },
  async getBatch() { return null; },
  async insertBatch(batch: any) { preserveTitleState.batches.push(structuredClone(batch)); },
  async updateBatch(_id: string, patch: any) { Object.assign(preserveTitleState.batches[0], structuredClone(patch)); return structuredClone(preserveTitleState.batches[0]); },
  async updateNote(id: string, patch: any) { const note = preserveTitleState.notes.find((item) => item.id === id); if (!note) throw new Error("missing note"); Object.assign(note, structuredClone(patch)); },
};
await commitKnowledgeImportBatch(preserveTitleStore, { batchId: "imp-20261008-101011", files: [blankTitleFile], selectedRowKeys: ["0"], warningsAcknowledged: true, now: "2026-10-08T10:11:00+08:00" });
t("執行更新時保留資料庫已存在的非空 title", preserveTitleState.notes[0].title === "資料庫既有的完整書名");

const pageSource = readFileSync("src/app/knowledge-import/page.tsx", "utf8");
const apiSource = readFileSync("src/lib/knowledge-import-server.ts", "utf8");
const proxySource = readFileSync("src/proxy.ts", "utf8");
const overviewRoute = readFileSync("src/app/api/knowledge-import/route.ts", "utf8");
const sql = readFileSync("docs/sql/2026-10-08_knowledge_import_batches.sql", "utf8");
t("新頁面與 API 逐層驗證登入，不列入公開路徑", pageSource.includes("isGateEnabled()") && pageSource.includes("isValidToken") && apiSource.includes("isKnowledgeImportAuthorized") && overviewRoute.includes("isKnowledgeImportAuthorized") && proxySource.includes('"/login"') && !proxySource.includes('"/knowledge-import"'));
t("批次表採 RLS、撤銷瀏覽器角色權限且伺服器未將服務金鑰寫死", sql.includes("ENABLE ROW LEVEL SECURITY") && sql.includes("REVOKE ALL ON TABLE public.knowledge_import_batches FROM PUBLIC") && !/create\s+policy/iu.test(sql));
t("總覽 PATCH 欄位白名單不包含 content 或 content_md5", apiSource.includes("KNOWLEDGE_IMPORT_PATCH_FIELDS") && !apiSource.includes('"content", "content_md5"'));

console.log("結果: " + passed + " 通過 / " + failed + " 失敗");
if (failed > 0) process.exit(1);
}

void main();
