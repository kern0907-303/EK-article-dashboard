import { readFileSync } from "node:fs";
import {
  buildKnowledgeTitleImportPlan,
  getKnowledgeTitleUpdateColumns,
  parseKnowledgeTitlesCsv,
  toKnowledgeTitlePatch,
} from "../src/lib/knowledge-title-import-core.mjs";
import { parseKnowledgeImportResponse } from "../src/lib/knowledge-import-response.mjs";

let passed = 0;
let failed = 0;
function t(name: string, condition: boolean) {
  if (condition) { passed += 1; console.log(`✓ ${name}`); }
  else { failed += 1; console.error(`✗ ${name}`); }
}

const header = "source_file,domain,title_en,author_en,title_zh,title_zh_subtitle,author_zh,translator_zh,publisher_zh,zh_source_url,zh_status,note";
const csv = `\uFEFF${header}\r\nbook-a.md,psychology,Title,Author,中文書名,副標,中文作者,譯者,出版社,https://example.test,confirmed,"備註,含逗號"\r\nbook-b.md,psychology,Title,Author,,,,,,,no_zh_edition,\r\n`;
const rows = parseKnowledgeTitlesCsv(csv);
t("CSV 匯入器會移除 BOM 並依欄名正確解析", rows.length === 2 && rows[0].source_file === "book-a.md" && rows[0].title_zh === "中文書名");
t("CSV 引號、逗號與結尾空欄會正確保留", rows[0].note === "備註,含逗號" && rows[1].note === "");
t("相同書名的不同 source_file 保留為兩筆，不合併", buildKnowledgeTitleImportPlan(rows, [{ source_file: "book-a.md", domain: "psychology" }, { source_file: "book-b.md", domain: "psychology" }]).matched.length === 2);

const plan = buildKnowledgeTitleImportPlan(rows, [{ source_file: "book-a.md", domain: "psychology" }]);
t("dry-run 計畫回報來源未找到與狀態筆數", plan.matched.length === 1 && plan.missingSourceFiles[0] === "book-b.md" && plan.statusCounts.confirmed === 1 && plan.statusCounts.no_zh_edition === 1);
const patch = toKnowledgeTitlePatch(rows[0]);
t("PATCH 只更新七個中文書目欄位，不碰正文、MD5 或批次欄", Object.keys(patch).sort().join(",") === getKnowledgeTitleUpdateColumns().sort().join(",") && !("content" in patch) && !("content_md5" in patch) && !("import_batch_id" in patch));

async function main() {
  const empty201 = await parseKnowledgeImportResponse({ ok: true, status: 201, text: async () => "" } as Response);
  const empty204 = await parseKnowledgeImportResponse({ ok: true, status: 204, text: async () => "" } as Response);
  const json201 = await parseKnowledgeImportResponse({ ok: true, status: 201, text: async () => "{\"ok\":true}" } as Response);
  t("沿用共同回應解析器處理 201／204 空回應與 JSON 內容", empty201 === null && empty204 === null && json201.ok === true);

  const scriptSource = readFileSync("scripts/import-knowledge-titles-zh.mjs", "utf8");
  t("匯入腳本預設 dry-run 並沿用空回應解析器", scriptSource.includes("const apply = args.includes(\"--apply\")") && scriptSource.includes("parseKnowledgeImportResponse(response)"));

  console.log(`結果: ${passed} 通過 / ${failed} 失敗`);
  if (failed > 0) process.exit(1);
}

void main();
