import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { NextRequest } from "next/server";
import { POST } from "../src/app/api/knowledge-import/delete/route";
import { postgrestSnapshotFilter } from "../src/lib/knowledge-import-server";
import {
  deleteKnowledgeNoteWithBackup,
  knowledgeImportDeleteConfirmationTitle,
  undoKnowledgeImportBatch,
} from "../src/lib/knowledge-import-core.mjs";

const original = {
  id: "11111111-1111-4111-8111-111111111111",
  domain: "business-strategy",
  title: "Original English Title",
  author: "Original Author",
  domain_tags: ["business", "leadership"],
  subdomain: "management",
  source_file: "original.md",
  content: "完整筆記正文，備份必須包含這段內容。",
  chars: 20,
  content_md5: "original-md5",
  imported_at: "2026-01-01T00:00:00.000Z",
  title_zh: "原有中文書名",
  title_zh_subtitle: "副標題",
  author_zh: "原作者",
  translator_zh: "譯者",
  publisher_zh: "出版社",
  zh_source_url: "https://example.test/book",
  zh_status: "confirmed",
  import_batch_id: "imp-20260101-010101",
};

function makeStore(rows: Record<string, any>[]) {
  const state = structuredClone(rows);
  const backups: Record<string, any>[] = [];
  const events: string[] = [];
  return {
    state, backups, events,
    async getNote(id: string) { return structuredClone(state.find((row) => row.id === id) || null); },
    async insertDeletionBackup(backup: Record<string, any>) {
      events.push("backup"); backups.push(structuredClone(backup)); return { batch_id: backup.batch_id };
    },
    async deleteNote(id: string, expected: Record<string, any>) {
      events.push("delete");
      const index = state.findIndex((row) => row.id === id);
      if (index < 0 || state[index].content_md5 !== expected.content_md5) return null;
      return state.splice(index, 1)[0];
    },
  };
}

async function main() {
  const unauthenticatedRequest = { cookies: { get: () => undefined } } as unknown as NextRequest;
  const unauthorized = await POST(unauthenticatedRequest);
  assert.equal(unauthorized.status, 401, "未登入的單筆刪除必須回 401");

  const sibling = { ...original, id: "22222222-2222-4222-8222-222222222222", title_zh: "同批次另一筆", source_file: "sibling.md" };
  const store = makeStore([original, sibling]);
  const result = await deleteKnowledgeNoteWithBackup(store, {
    noteId: original.id,
    confirmationTitle: "原有中文書名",
    backupId: "del-test-backup",
    now: "2026-11-22T10:00:00.000Z",
  });
  assert.equal(result.kind, "deleted");
  assert.deepEqual(store.events, ["backup", "delete"], "完整備份必須先寫入，之後才刪除原列");
  assert.deepEqual(store.backups[0].snapshot[0], original, "備份必須包含完整原列與 content");
  assert.equal(store.backups[0].summary.original_id, original.id);
  assert.equal(store.backups[0].summary.deleted_at, "2026-11-22T10:00:00.000Z");
  assert.equal(await store.getNote(original.id), null, "刪除後原 ID 查不到");
  assert.ok(await store.getNote(sibling.id), "同批次的其他列必須保留");

  const mismatchStore = makeStore([original]);
  const mismatch = await deleteKnowledgeNoteWithBackup(mismatchStore, {
    noteId: original.id, confirmationTitle: "不是這本書", backupId: "del-mismatch",
  });
  assert.equal(mismatch.kind, "confirmation-mismatch");
  assert.deepEqual(mismatchStore.events, [], "確認字串不符時不得備份或刪除");
  assert.ok(await mismatchStore.getNote(original.id), "確認字串不符時原資料必須保留");

  const fallback = knowledgeImportDeleteConfirmationTitle({ title_zh: "   ", title: "English fallback" });
  assert.equal(fallback, "English fallback", "中文書名空白時改用英文書名確認");

  const encodedFilter = new URLSearchParams({
    title: postgrestSnapshotFilter("title", "A & B"),
    domain_tags: postgrestSnapshotFilter("domain_tags", ["a&b", "c\"d"]),
  });
  assert.equal(encodedFilter.get("title"), "eq.A & B", "PostgREST 字串條件只透過 URLSearchParams 編碼一次");
  assert.equal(encodedFilter.get("domain_tags"), 'eq.{"a&b","c\\"d"}', "PostgREST 陣列條件維持有效陣列文字格式");

  let unsafeUndoCalled = false;
  await assert.rejects(() => undoKnowledgeImportBatch({
    async getBatch() { return { batch_id: "del-test", summary: { operation: "single_note_delete" }, snapshot: [original], inserted_ids: [] }; },
    async deleteInsertedNotes() { unsafeUndoCalled = true; },
    async restoreSnapshot() { unsafeUndoCalled = true; },
  }, "del-test"), /單筆刪除備份/u);
  assert.equal(unsafeUndoCalled, false, "單筆刪除備份不得走匯入批次撤銷流程");

  const ui = readFileSync("src/components/KnowledgeImportWorkspace.tsx", "utf8");
  const server = readFileSync("src/lib/knowledge-import-server.ts", "utf8");
  const core = readFileSync("src/lib/knowledge-import-core.mjs", "utf8");
  const route = readFileSync("src/app/api/knowledge-import/delete/route.ts", "utf8");
  assert.match(ui, /刪除後無法在此頁復原/u);
  assert.match(ui, /刪除中…/u);
  assert.match(ui, /已刪除：/u);
  assert.match(core, /operation: "single_note_delete"/u);
  assert.match(route, /isKnowledgeImportAuthorized/u);
  assert.ok(server.includes("knowledge_import_batches?select=batch_id"));
  console.log("knowledge-import-delete: 登入保護、先備份、確認字串、單列刪除、同批次隔離與 SQL 還原備份通過");
}

void main();
