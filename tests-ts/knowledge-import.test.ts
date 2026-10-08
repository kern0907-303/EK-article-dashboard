import { readFileSync } from "node:fs";
import {
  classifyKnowledgeImportFiles,
  commitKnowledgeImportBatch,
  createKnowledgeImportBatchId,
  undoKnowledgeImportBatch,
} from "../src/lib/knowledge-import-core.mjs";
import { contentMd5 } from "../src/lib/knowledge-note-core.mjs";

let passed = 0;
let failed = 0;
function t(name: string, condition: boolean) {
  if (condition) { passed += 1; console.log("✓ " + name); }
  else { failed += 1; console.error("✗ " + name); }
}
function quote(value: string) { return JSON.stringify(value); }
function markdown(options: Record<string, string> = {}, body = "筆記正文內容。") {
  const fields = [
    ["domain", "emotions-psychology"], ["title_en", "Book " + (options.title_en || "A")], ["author_en", "Author"],
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

const legacyText = "---\ndomain: emotions-psychology\ntitle: Legacy Book\nauthor: Legacy Author\ndomain_tags: 情緒,心理\nsubdomain: 舊版\nsource_file: legacy.md\n---\n舊格式正文。";
const legacy = classifyKnowledgeImportFiles([{ filename: "legacy.md", content: legacyText }], [])[0];
t("舊格式可讀取，且一律預設 zh_status 為 unverified", legacy.record?.title === "Legacy Book" && legacy.record?.author === "Legacy Author" && legacy.record?.zh_status === "unverified" && legacy.legacy);
t("資料區欄位數量或順序錯誤會列為問題", classifyKnowledgeImportFiles([{ filename: "bad.md", content: legacyText.replace("domain: emotions-psychology\n", "") }], [])[0].problems.length > 0);
t("13 欄名稱順序不符時不會被當成新版格式", classifyKnowledgeImportFiles([{ filename: "order.md", content: markdown().replace("domain: \"emotions-psychology\"\ntitle_en: \"Book A\"", "title_en: \"Book A\"\ndomain: \"emotions-psychology\"") }], [])[0].problems.length > 0);

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
t("兩筆既有書目內容或欄位不同均分類為更新", classified.slice(2, 4).every((row: any) => row.classification === "update"));
t("兩筆既有書目校驗碼與欄位相同均分類為跳過", classified.slice(4).every((row: any) => row.classification === "skip"));

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
    existing({ ...updateRecords[0], content: "舊內容", content_md5: contentMd5("舊內容"), import_batch_id: null }, "update-target"),
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
const commit2 = await commitKnowledgeImportBatch(store, { batchId: "imp-20261008-101010", files: importInputs, selectedRowKeys: ["0", "1"], warningsAcknowledged: true, now: "2026-10-08T10:10:11+08:00" });
t("提交會記錄更新前完整快照與新增 ID，重送相同批次不重複寫入", commit1.idempotent === false && commit2.idempotent === true && state.notes.length === 3 && commit1.batch.snapshot.length === 1 && commit1.batch.inserted_ids.length === 1);
let differentRequestRejected = false;
try {
  await commitKnowledgeImportBatch(store, { batchId: "imp-20261008-101010", files: [{ filename: "other.md", content: inserts[1].content }], selectedRowKeys: ["0"], warningsAcknowledged: true });
} catch { differentRequestRejected = true; }
t("相同秒批次 ID 不能被不同內容誤當成重送，也不會重複寫入", differentRequestRejected && state.notes.length === 3);
const undone = await undoKnowledgeImportBatch(store, "imp-20261008-101010", "2026-10-08T10:20:00+08:00");
t("撤銷會刪除本批 inserted_ids、還原更新快照且保留批次外筆記", undone.batch.undone_at !== null && state.notes.length === 2 && state.notes.find((row) => row.id === "update-target")?.content === "舊內容" && state.notes.some((row) => row.id === "unrelated-note"));
t("撤銷只刪本批新增 ID，與批次外同類資料無關", !state.notes.some((row) => afterFirstCommit.find((saved) => saved.id.startsWith("inserted-"))?.id === row.id) && state.notes.some((row) => row.id === "unrelated-note"));

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
