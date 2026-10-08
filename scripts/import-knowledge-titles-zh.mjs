import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { buildKnowledgeTitleImportPlan, parseKnowledgeTitlesCsv, toKnowledgeTitlePatch } from "../src/lib/knowledge-title-import-core.mjs";
import { parseKnowledgeImportResponse } from "../src/lib/knowledge-import-response.mjs";

const DEFAULT_CSV_PATH = "/Users/erickair/Downloads/knowledge_titles_zh_filled.csv";

function loadEnvLocal(text) {
  for (const line of text.split(/\r?\n/u)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/u);
    if (!match || process.env[match[1]] !== undefined) continue;
    let value = match[2].trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/u, "");
    }
    process.env[match[1]] = value;
  }
}

async function request(url, init, headers) {
  const response = await fetch(url, {
    ...init,
    headers: { ...headers, ...(init?.headers || {}) },
    cache: "no-store",
  });
  return parseKnowledgeImportResponse(response);
}

export async function runKnowledgeTitleImport({ csvPath = DEFAULT_CSV_PATH, apply = false } = {}) {
  const source = await readFile(csvPath, "utf8");
  const rows = parseKnowledgeTitlesCsv(source);
  const envFile = await readFile(".env.local", "utf8");
  loadEnvLocal(envFile);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) throw new Error("缺少伺服器端 Supabase 設定，請確認 .env.local 變數名稱；未輸出任何金鑰內容。");

  const baseUrl = `${supabaseUrl.replace(/\/$/u, "")}/rest/v1/knowledge_notes`;
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const existingRows = await request(`${baseUrl}?select=source_file,domain&limit=1000`, undefined, headers);
  if (!Array.isArray(existingRows)) throw new Error("知識筆記查詢沒有回傳資料列陣列。");
  const plan = buildKnowledgeTitleImportPlan(rows, existingRows);
  const result = {
    mode: apply ? "apply" : "dry-run",
    csvRows: rows.length,
    matchedSourceFiles: plan.matched.length,
    missingSourceFiles: plan.missingSourceFiles,
    domainMismatches: plan.domainMismatches,
    zhStatusCounts: plan.statusCounts,
    writtenRows: 0,
  };

  if (apply) {
    for (const row of plan.matched) {
      const sourceFile = encodeURIComponent(row.source_file);
      await request(`${baseUrl}?source_file=eq.${sourceFile}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(toKnowledgeTitlePatch(row)),
      }, headers);
      result.writtenRows += 1;
    }
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const paths = args.filter((arg) => arg !== "--apply");
  if (args.some((arg) => arg.startsWith("-") && arg !== "--apply") || paths.length > 1) {
    console.error("用法：node scripts/import-knowledge-titles-zh.mjs [CSV 路徑] [--apply]");
    process.exitCode = 2;
  } else {
    runKnowledgeTitleImport({ csvPath: paths[0] || DEFAULT_CSV_PATH, apply })
      .then((result) => {
        console.log(JSON.stringify(result, null, 2));
        if (!apply) console.log("dry-run 完成，未寫入 Supabase。");
      })
      .catch((error) => {
        console.error(error instanceof Error ? error.message : "知識書目處理失敗。");
        process.exitCode = 1;
      });
  }
}
