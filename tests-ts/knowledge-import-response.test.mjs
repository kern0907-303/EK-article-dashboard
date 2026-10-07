import assert from "node:assert/strict";
import test from "node:test";
import { parseKnowledgeImportResponse } from "../src/lib/knowledge-import-response.mjs";

test("201 空回應回傳 null", async () => {
  const response = new Response("", { status: 201 });
  assert.equal(await parseKnowledgeImportResponse(response), null);
});

test("204 空回應回傳 null", async () => {
  const response = new Response(null, { status: 204 });
  assert.equal(await parseKnowledgeImportResponse(response), null);
});

test("有 JSON 內容時解析並回傳物件", async () => {
  const response = new Response('{"id":"note-1"}', {
    status: 201,
    headers: { "content-type": "application/json" },
  });
  assert.deepEqual(await parseKnowledgeImportResponse(response), { id: "note-1" });
});
