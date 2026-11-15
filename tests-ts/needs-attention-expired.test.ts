// 2026-11-15：主稿改過但發文時間已經過了的文章，不再列在待處理中心
import { collectAttention } from "../src/lib/needs-attention";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only";

const past = { id: "11111111-1111-4111-8111-111111111111", brand_id: "nas", status: "scheduled", scheduled_at: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(), queue_id: null, draft_content: "已發出的舊文", social_results: { stale_platforms: ["instagram"] } };
const future = { id: "22222222-2222-4222-8222-222222222222", brand_id: "nas", status: "scheduled", scheduled_at: new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString(), queue_id: null, draft_content: "還沒發的文", social_results: { stale_platforms: ["instagram"] } };

globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = new URL(String(input));
  if (url.pathname.endsWith("/auto_pipeline_jobs")) {
    const q = url.search;
    if (q.includes("reviewed=eq.false") || q.includes("status=in.(manual")) return Response.json([]);
    return Response.json([past, future]);
  }
  return Response.json([]);
}) as typeof fetch;

let failed = 0;
const check = (name: string, ok: boolean) => { if (!ok) failed++; console.log(`${ok ? "✓" : "✗"} ${name}`); };

(async () => {
  const { items } = await collectAttention();
  const stale = items.filter((item: any) => String(item.reason || "").startsWith("主稿改過"));
  check("還沒發的文章照樣列出主稿改過", stale.some((item: any) => item.jobId === future.id));
  check("已過發文時間的文章不再列出", !items.some((item: any) => item.jobId === past.id));
  process.exit(failed ? 1 : 0);
})();
