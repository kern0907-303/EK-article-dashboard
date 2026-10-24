import { collectTimeline } from "../src/lib/pipeline-timeline";

const originalFetch = globalThis.fetch;
const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only";

const articleId = "22222222-2222-4222-8222-222222222222";
let articleStatus = "published";
let articleBrand = "i8";
let passed = 0;
let failed = 0;
function test(name: string, ok: boolean) {
  if (ok) passed++; else failed++;
  console.log(`${ok ? "✓" : "✗"} ${name}`);
}

globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = new URL(String(input));
  if (url.pathname.endsWith("/auto_pipeline_jobs")) return Response.json([{
    id: "11111111-1111-4111-8111-111111111111", brand_id: "i8", status: "scheduled",
    scheduled_at: new Date().toISOString(), queue_id: "33333333-3333-4333-8333-333333333333",
    draft_content: "FB 主稿", reviewed: true,
    social_results: { website: { ok: false, error: "FB 已送出，沒有寫入官網連結", articleId } },
  }]);
  if (url.pathname.endsWith("/publish_queue")) return Response.json([{
    id: "33333333-3333-4333-8333-333333333333", status: "sent", scheduled_at: new Date().toISOString(), article_id: null,
  }]);
  if (url.pathname.endsWith("/social_publish_queue")) return Response.json([]);
  if (url.pathname.endsWith("/insights_articles")) return Response.json(articleStatus === "published" ? [{ id: articleId, brand_id: articleBrand }] : []);
  return Response.json([]);
}) as typeof fetch;

async function run() {
  try {
    test("官網實際已發佈時，流水線總覽不再顯示失敗", (await collectTimeline())[0]?.website.state === "sent");
    articleStatus = "draft";
    test("官網尚未發佈時保留失敗", (await collectTimeline())[0]?.website.state === "failed");
    articleStatus = "published";
    articleBrand = "nas";
    test("不同品牌文章不得掩蓋失敗", (await collectTimeline())[0]?.website.state === "failed");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  }
  console.log(`\n結果: ${passed} 通過 / ${failed} 失敗`);
  process.exit(failed ? 1 : 0);
}

void run();
