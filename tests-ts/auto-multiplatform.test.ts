import assert from "node:assert/strict";
import { deriveVersions, isMultiplatformEnabled, linkArticleToFacebookQueue, platformTimes, summarize, trimAtBoundary } from "../src/lib/auto-multiplatform";

async function main() {

  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENAI_API_KEY;

  // 開關預設關閉
  delete process.env.AUTO_MULTIPLATFORM_ENABLED;
  assert.equal(isMultiplatformEnabled(), false);
  process.env.AUTO_MULTIPLATFORM_ENABLED = "true";
  assert.equal(isMultiplatformEnabled(), true);

  // 時間錯開：預設 IG +2 小時、Threads +10 小時
  const fb = "2026-10-20T02:10:00.000Z";
  delete process.env.AUTO_IG_OFFSET_MIN;
  delete process.env.AUTO_THREADS_OFFSET_MIN;
  const t = platformTimes(fb);
  assert.equal(t.instagram, "2026-10-20T04:10:00.000Z");
  assert.equal(t.threads, "2026-10-20T12:10:00.000Z");
  process.env.AUTO_IG_OFFSET_MIN = "30";
  assert.equal(platformTimes(fb).instagram, "2026-10-20T02:40:00.000Z");
  process.env.AUTO_IG_OFFSET_MIN = "abc";
  assert.equal(platformTimes(fb).instagram, "2026-10-20T04:10:00.000Z");

  // 截斷在句尾，不砍在句中
  const long = "這是第一句。".repeat(100);
  const cut = trimAtBoundary(long, 50);
  assert.ok(cut.length <= 50 && cut.endsWith("。"));
  assert.equal(trimAtBoundary("短文", 50), "短文");

  // 沒有任何文字模型密鑰時退回機械式版本，仍來自同一份母稿，長度符合平台上限
  const master = Array.from({ length: 30 }, (_, i) => `第${i + 1}段，講一個重點，讓人讀完有感覺。這是補充說明。`).join("\n\n");
  const derived = await deriveVersions(master);
  assert.equal(derived.source, "fallback");
  assert.ok(derived.threads.length > 0 && derived.threads.length <= 500);
  assert.ok(derived.instagram.length > 0 && derived.instagram.length <= 2200);
  assert.ok(derived.slides.length >= 2 && derived.slides.length <= 7);
  assert.ok(!/[—─]/.test(derived.threads + derived.instagram));
  assert.ok(derived.note.includes("機械式"));

  // 摘要：全部成功與部分失敗
  const ok = { ok: true } as const;
  assert.equal(summarize({ derived: { source: "ai", note: "" }, instagram: ok, threads: ok, website: ok }).problems.length, 0);
  const partial = summarize({ derived: { source: "ai", note: "" }, instagram: { ok: false, error: "圖卡失敗" }, threads: ok, website: ok });
  assert.ok(partial.step.includes("IG失敗") && partial.problems.some((p) => p.includes("圖卡失敗")));

  // FB 已送出後補官網，仍應把文章 ID 記回佇列，不可誤報官網生成失敗。
  const originalFetch = globalThis.fetch;
  let linkedUrl = "";
  let linkedBody: Record<string, unknown> = {};
  try {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      linkedUrl = String(input);
      linkedBody = JSON.parse(String(init?.body));
      return Response.json([{ id: "queue-1" }]);
    }) as typeof fetch;
    await linkArticleToFacebookQueue({ url: "https://example.supabase.co", key: "test-only" }, "queue-1", "article-1");
    assert.ok(linkedUrl.includes("status=in.(pending,sent)"));
    assert.equal(linkedBody.article_id, "article-1");
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log("auto-multiplatform tests passed");

}

main().catch((error) => { console.error(error); process.exit(1); });
