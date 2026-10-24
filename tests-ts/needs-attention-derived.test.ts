import { NextRequest } from "next/server";
import { collectAttention } from "../src/lib/needs-attention";
import { POST } from "../src/app/api/needs-attention/route";

const originalFetch = globalThis.fetch;
const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only";

const id = "11111111-1111-4111-8111-111111111111";
const job: { id: string; brand_id: string; status: string; scheduled_at: string; draft_content: string; social_results: Record<string, { ok: boolean; error?: string; id?: string; dismissed?: boolean }> } = {
  id, brand_id: "i8", status: "scheduled", scheduled_at: new Date().toISOString(), draft_content: "FB 主稿",
  social_results: { website: { ok: false, error: "官網文章未通過品牌紅線：頻率" }, threads: { ok: true, id: "thread-1" } },
};
let patchBody: Record<string, unknown> | null = null;
let passed = 0, failed = 0;
function test(name: string, ok: boolean) {
  if (ok) passed++; else failed++;
  console.log(`${ok ? "✓" : "✗"} ${name}`);
}

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(String(input));
  if (url.pathname.endsWith("/auto_pipeline_jobs")) {
    if (init?.method === "PATCH") {
      patchBody = JSON.parse(String(init.body));
      job.social_results = patchBody!.social_results as typeof job.social_results;
      return Response.json([job]);
    }
    if (url.searchParams.get("select")?.includes("social_results")) return Response.json([job]);
  }
  return Response.json([]);
}) as typeof fetch;

async function run() {
  try {
    const before = await collectAttention();
    const failure = before.items.find((item) => item.derivativePlatform === "website");
    test("官網衍生失敗有重做入口與移除提醒權限", !!failure && failure.jobId === id && failure.canDismiss && !failure.canEdit);

    const bad = await POST(new NextRequest("http://localhost/api/needs-attention", { method: "POST", body: JSON.stringify({ action: "dismiss_derived", source: "job", id, platform: "facebook" }) }));
    test("不可移除不在白名單的平台", bad.status === 400 && patchBody === null);

    const response = await POST(new NextRequest("http://localhost/api/needs-attention", { method: "POST", body: JSON.stringify({ action: "dismiss_derived", source: "job", id, platform: "website" }) }));
    test("只標記官網失敗提醒已放棄，保留原錯誤與其他平台", response.status === 200 && job.social_results.website.dismissed === true && job.social_results.website.error?.includes("頻率") === true && job.social_results.threads.id === "thread-1");

    const after = await collectAttention();
    test("移除後待處理清單不再顯示該項", !after.items.some((item) => item.derivativePlatform === "website"));
    const repeat = await POST(new NextRequest("http://localhost/api/needs-attention", { method: "POST", body: JSON.stringify({ action: "dismiss_derived", source: "job", id, platform: "website" }) }));
    test("重複移除不會再改資料", repeat.status === 409);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  }
  console.log(`\n結果: ${passed} 通過 / ${failed} 失敗`);
  process.exit(failed ? 1 : 0);
}

void run();
