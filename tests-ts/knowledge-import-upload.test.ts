import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { classifyKnowledgeImportFiles } from "../src/lib/knowledge-import-core.mjs";
import { getKnowledgeImportInputFiles } from "../src/lib/knowledge-import-server";
import {
  KNOWLEDGE_IMPORT_MAX_FILE_BYTES,
  KNOWLEDGE_IMPORT_MAX_REQUEST_BODY_BYTES,
  knowledgeImportFileSizeError,
  knowledgeImportRequestBodyError,
} from "../src/lib/knowledge-import-limits";

function paddedMarkdown(targetBytes: number): string {
  const header = [
    "---",
    'domain: "business-strategy"',
    'title_en: "Upload Size Test"',
    'author_en: "Test Author"',
    'title_zh: "上傳大小測試"',
    'title_zh_subtitle: ""',
    'author_zh: "測試作者"',
    'translator_zh: ""',
    'publisher_zh: ""',
    'zh_source_url: ""',
    'zh_status: "confirmed"',
    'domain_tags: "business"',
    'subdomain: ""',
    'source_file: "upload-size-test.md"',
    "---",
    "正文起始。",
  ].join("\n") + "\n";
  const bytes = Buffer.byteLength(header, "utf8");
  assert.ok(bytes < targetBytes, "測試 frontmatter 必須小於目標檔案大小");
  return header + "x".repeat(targetBytes - bytes);
}

function makeForm(file: File): FormData {
  const form = new FormData();
  form.append("files", file, file.name);
  form.set("overrides", "{}");
  return form;
}

async function main() {
  const acceptedFile = new File([paddedMarkdown(650 * 1024)], "650kb.md", { type: "text/markdown" });
  assert.equal(acceptedFile.size, 650 * 1024);
  assert.equal(knowledgeImportFileSizeError(acceptedFile), null, "650 KB 檔案應通過前端檢查");
  const acceptedInputs = await getKnowledgeImportInputFiles(makeForm(acceptedFile));
  const acceptedPreview = classifyKnowledgeImportFiles(acceptedInputs, []);
  assert.equal(acceptedPreview[0].classification, "insert", "650 KB 檔案應可進入預覽");
  assert.deepEqual(acceptedPreview[0].problems, []);

  const rejectedFile = new File([paddedMarkdown(750 * 1024)], "750kb.md", { type: "text/markdown" });
  assert.equal(rejectedFile.size, 750 * 1024);
  const chineseError = knowledgeImportFileSizeError(rejectedFile);
  assert.match(chineseError || "", /單檔 700 KB 上限/u, "750 KB 檔案應顯示中文錯誤");
  const rejectedInputs = await getKnowledgeImportInputFiles(makeForm(rejectedFile));
  const rejectedPreview = classifyKnowledgeImportFiles(rejectedInputs, []);
  assert.equal(rejectedPreview[0].classification, "problem", "750 KB 檔案應被伺服器端預覽拒絕");
  assert.ok(rejectedPreview[0].problems.some((problem: string) => problem.includes("單檔 700 KB 上限")));
  assert.equal(rejectedInputs[0].content, "", "超限檔案不讀取正文");

  assert.equal(KNOWLEDGE_IMPORT_MAX_FILE_BYTES, 700 * 1024);
  assert.equal(knowledgeImportRequestBodyError(String(KNOWLEDGE_IMPORT_MAX_REQUEST_BODY_BYTES)), null);
  assert.match(knowledgeImportRequestBodyError(String(KNOWLEDGE_IMPORT_MAX_REQUEST_BODY_BYTES + 1)) || "", /40 MB/u);

  const page = readFileSync("src/components/KnowledgeImportWorkspace.tsx", "utf8");
  const previewRoute = readFileSync("src/app/api/knowledge-import/preview/route.ts", "utf8");
  const commitRoute = readFileSync("src/app/api/knowledge-import/commit/route.ts", "utf8");
  const nextConfig = readFileSync("next.config.ts", "utf8");
  const schema = readFileSync("docs/sql/2026-10-07_knowledge_notes.sql", "utf8");
  assert.match(page, /每個不超過 700 KB/u);
  assert.match(page, /knowledgeImportFileSizeError\(file\)/u);
  assert.match(previewRoute, /knowledgeImportRequestBodyError/u);
  assert.match(commitRoute, /knowledgeImportRequestBodyError/u);
  assert.match(nextConfig, /proxyClientMaxBodySize: "40mb"/u);
  assert.match(schema, /content text not null/u);
  assert.doesNotMatch(schema, /check\s*\([^)]*(?:content|chars)[^)]*(?:length|octet_length)/iu);
  console.log("knowledge-import-upload: 650 KB 可預覽、750 KB 顯示中文錯誤、40 MB 請求上限與 text 欄位核對通過");
}

void main();
