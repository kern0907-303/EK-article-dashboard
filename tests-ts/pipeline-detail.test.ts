import { collectDetail } from "../src/lib/pipeline-detail";

const originalFetch = globalThis.fetch;
const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only";

let passed = 0;
let failed = 0;
function test(name: string, ok: boolean) {
  if (ok) passed++; else failed++;
  console.log(`${ok ? "✓" : "✗"} ${name}`);
}

async function detailFor(job: Record<string, unknown>, queue: Record<string, unknown> | null, websiteResult: Record<string, unknown> = {}) {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/auto_pipeline_jobs")) {
      return Response.json(url.searchParams.get("select") === "social_results" ? [{ social_results: { website: websiteResult } }] : [job]);
    }
    if (url.pathname.endsWith("/publish_queue")) return Response.json(queue ? [queue] : []);
    if (url.pathname.endsWith("/social_publish_queue")) return Response.json([]);
    if (url.pathname.endsWith("/insights_articles")) return Response.json([{ id: "22222222-2222-4222-8222-222222222222", title: "官網文章", content: "已發佈全文", status: "published" }]);
    return Response.json([]);
  }) as typeof fetch;
  return collectDetail("8489b299-71eb-4f09-9e1d-2f20ee0fde74");
}

async function run() {
  try {
    const planned = "2026-10-24T12:10:00Z";
    const base = { id: "8489b299-71eb-4f09-9e1d-2f20ee0fde74", brand_id: "nas", scheduled_at: planned, draft_content: "FB 草稿", prompt: "主題" };
    const manual = await detailFor({ ...base, status: "manual", error_reason: "品管未通過", queue_id: null }, null);
    test("只有預定時間的 FB 草稿不被當成已排程", !!manual && manual.jobStatus === "manual" && manual.jobError === "品管未通過" && manual.scheduledAt === planned && manual.fbQueueId === null && manual.fb.status === "draft" && manual.fb.scheduledAt === null);

    const actual = "2026-10-24T12:20:00Z";
    const scheduled = await detailFor({ ...base, status: "scheduled", error_reason: null, queue_id: "queue-1" }, { id: "queue-1", status: "pending", scheduled_at: actual, content: "已排程 FB", article_id: null });
    test("有 FB 佇列時才顯示實際排程時間與佇列編號", !!scheduled && scheduled.fbQueueId === "queue-1" && scheduled.fb.status === "pending" && scheduled.fb.scheduledAt === actual && scheduled.fb.text === "已排程 FB");

    const published = await detailFor({ ...base, status: "scheduled", queue_id: "queue-1" }, { id: "queue-1", status: "sent", scheduled_at: actual, content: "已發佈 FB", article_id: null }, { ok: false, error: "FB 已送出，沒有寫入官網連結", articleId: "22222222-2222-4222-8222-222222222222" });
    test("FB 關聯缺失但生成結果留有文章 ID 時仍顯示已上線官網文章", !!published && published.website.exists && published.website.status === "published" && published.website.title === "官網文章");

    const empty = await detailFor({ ...base, status: "manual", error_reason: null, queue_id: null, draft_content: null }, null);
    test("尚未有 FB 草稿時不誤顯示草稿狀態", !!empty && !empty.fb.exists && empty.fb.status === "none" && empty.fb.scheduledAt === null);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  }
  console.log(`\n結果: ${passed} 通過 / ${failed} 失敗`);
  process.exit(failed ? 1 : 0);
}

void run();
