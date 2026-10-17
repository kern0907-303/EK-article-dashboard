// 題材標記寫入流程：模擬 PostgREST，驗證白名單、品牌比對、不可改標、全有或全無。
import assert from "node:assert/strict";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://stub.supabase.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "stub-key";

const NAS_POST = "11111111-1111-4111-8111-111111111111";
const ABL_POST = "22222222-2222-4222-8222-222222222222";
const TAGGED_POST = "44444444-4444-4444-8444-444444444444";
const MISSING_POST = "55555555-5555-4555-8555-555555555555";
const calls: { method: string; table: string; body: string }[] = [];
const sentAt = new Date().toISOString();

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(String(input));
  const table = url.pathname.split("/").pop() || "";
  const method = init?.method || "GET";
  calls.push({ method, table, body: String(init?.body || "") });
  const json = (status: number, value: unknown) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
  if (method === "GET") {
    if (table === "social_publish_queue") return json(200, [
      { id: NAS_POST, platform: "threads", brand: "nas", content: "生命數字不是預言", sent_at: sentAt, experiment_json: null },
      { id: ABL_POST, platform: "instagram", brand: "abl", content: "睡不好的人", sent_at: sentAt, experiment_json: null },
      { id: TAGGED_POST, platform: "threads", brand: "nas", content: "已標記", sent_at: sentAt, experiment_json: null },
    ]);
    if (table === "post_topics") return json(200, [{ queue_id: TAGGED_POST, topic: "空巢期" }]);
    return json(200, []);
  }
  if (table === "analyst_runs") return json(201, [{ id: "33333333-3333-4333-8333-333333333333" }]);
  return json(201, [{}]);
}) as typeof fetch;

const writes = () => calls.filter((c) => c.method !== "GET" && c.table !== "analyst_runs");

async function main() {
  const { applyDecision } = await import("../src/lib/experiment-server");

  // 1. 合法標記：兩篇不同品牌各用自己的題材，寫入 post_topics 並留下一筆 accepted
  let result = await applyDecision({
    summary: "標記題材",
    topic_tags: [{ queue_id: NAS_POST, topic: "生命數字" }, { queue_id: ABL_POST, topic: "其他" }, { queue_id: TAGGED_POST, topic: "空巢期" }],
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  const topicWrites = writes().filter((c) => c.table === "post_topics");
  assert.equal(topicWrites.length, 1);
  const rows = JSON.parse(topicWrites[0].body) as { queue_id: string; brand: string; topic: string }[];
  assert.deepEqual(rows.map((r) => r.queue_id).sort(), [ABL_POST, NAS_POST].sort(), "已標記且相同題材的不重複寫入");
  assert.equal(rows.find((r) => r.queue_id === NAS_POST)?.topic, "生命數字");

  // 2. 其他品牌的題材：整份拒絕，什麼都不寫
  calls.length = 0;
  result = await applyDecision({ summary: "x", topic_tags: [{ queue_id: NAS_POST, topic: "生命數字" }, { queue_id: ABL_POST, topic: "生命數字" }] });
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.status, 422);
  assert.equal(writes().length, 0, "有任何一筆不合規就整份不寫入");

  // 3. 不存在的貼文、不在清單的題材、改標已標記貼文，都要被擋
  for (const tag of [
    { queue_id: MISSING_POST, topic: "其他" },
    { queue_id: NAS_POST, topic: "亂寫的題材" },
    { queue_id: TAGGED_POST, topic: "生命數字" },
  ]) {
    calls.length = 0;
    result = await applyDecision({ summary: "x", topic_tags: [tag] });
    assert.equal(result.ok, false, JSON.stringify(tag));
    assert.equal(writes().length, 0);
  }
  console.log("topic-decision tests passed");
}
main().catch((error) => { console.error(error); process.exit(1); });
