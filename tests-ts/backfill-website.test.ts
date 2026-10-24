import { NextRequest } from "next/server";

const previous = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  pipeline: process.env.AUTO_PIPELINE_ENABLED,
  multi: process.env.AUTO_MULTIPLATFORM_ENABLED,
};
const originalFetch = globalThis.fetch;
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only";
process.env.AUTO_PIPELINE_ENABLED = "true";
process.env.AUTO_MULTIPLATFORM_ENABLED = "true";

const queueId = "11111111-1111-4111-8111-111111111111";
let passed = 0, failed = 0;
function test(name: string, ok: boolean) {
  if (ok) passed++; else failed++;
  console.log(`${ok ? "✓" : "✗"} ${name}`);
}

globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = new URL(String(input));
  if (url.pathname.endsWith("/publish_queue")) {
    return Response.json(url.searchParams.get("status") === "in.(pending,sent)"
      ? [{ id: queueId, status: "sent", scheduled_at: "2026-10-01T12:00:00Z", target_pages: ["fb_nas"], article_id: "existing-article", content: "FB 主稿" }]
      : []);
  }
  if (url.pathname.endsWith("/auto_pipeline_jobs")) return Response.json([{ id: "job-1", social_results: {} }]);
  if (url.pathname.endsWith("/social_publish_queue")) return Response.json([]);
  return Response.json([]);
}) as typeof fetch;

async function run() {
  try {
    const { POST } = await import("../src/app/api/auto-pipeline/backfill/route");
    const request = (platform: string) => new NextRequest("http://localhost/api/auto-pipeline/backfill", {
      method: "POST", body: JSON.stringify({ queueId, platforms: [platform] }),
    });
    const website = await POST(request("website"));
    const websiteBody = await website.json();
    test("已發佈且排程時間已過的 FB 母稿可進入官網補做流程", website.status === 200 && websiteBody.message === "選到的平台都已經有草稿了");

    const social = await POST(request("instagram"));
    test("已發佈 FB 不能沿用過去時間新增 IG 排程", social.status === 409);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries({ NEXT_PUBLIC_SUPABASE_URL: previous.url, SUPABASE_SERVICE_ROLE_KEY: previous.key, AUTO_PIPELINE_ENABLED: previous.pipeline, AUTO_MULTIPLATFORM_ENABLED: previous.multi })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
  console.log(`\n結果: ${passed} 通過 / ${failed} 失敗`);
  process.exit(failed ? 1 : 0);
}

void run();
