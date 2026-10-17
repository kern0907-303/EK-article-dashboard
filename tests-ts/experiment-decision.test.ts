// 回歸測試：決策寫入流程對 Supabase（PostgREST）各種回應都要正確處理。
// 重點是「return=minimal」會回 201 且內容為空，不能對空內容做 JSON 解析（2026-10-17 線上曾因此回 500，資料其實已寫入）。
import assert from "node:assert/strict";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://stub.supabase.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "stub-key";

const NEW_ID = "22222222-2222-4222-8222-222222222222";
const calls: { method: string; table: string; prefer: string; body: string }[] = [];

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(String(input));
  const table = url.pathname.split("/").pop() || "";
  const method = init?.method || "GET";
  const prefer = String((init?.headers as Record<string, string> | undefined)?.Prefer || "");
  calls.push({ method, table, prefer, body: String(init?.body || "") });
  const json = (status: number, value: unknown) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
  if (method === "GET") return json(200, []);
  // PostgREST：return=minimal 時是 201 加空內容
  if (prefer.includes("return=minimal")) return new Response(null, { status: 201 });
  if (table === "experiments") return json(201, [{ id: NEW_ID }]);
  if (table === "analyst_runs") return json(201, [{ id: "33333333-3333-4333-8333-333333333333" }]);
  return json(201, [{}]);
}) as typeof fetch;

async function main() {
  const { applyDecision } = await import("../src/lib/experiment-server");
  const { addDays, taipeiDate } = await import("../src/lib/experiment-arms");
  const tomorrow = addDays(taipeiDate(new Date()), 1);

  const result = await applyDecision({
    summary: "開始新實驗並排好明天的臂",
    start: { brand: "nas", variable: "structure", arm_a: "story_open", arm_b: "question_open" },
    next_days: [{ brand: "nas", date: tomorrow, experiment_id: "new", arm: "story_open" }],
  });

  assert.equal(result.ok, true, JSON.stringify(result));
  const params = calls.find((c) => c.method === "POST" && c.table === "strategy_params");
  assert.ok(params, "必須寫入 strategy_params");
  const rows = JSON.parse(params.body) as { experiment_id: string; brand: string; arm: string }[];
  assert.equal(rows[0].experiment_id, NEW_ID);
  assert.equal(rows[0].brand, "nas");
  assert.equal(rows[0].arm, "story_open");
  // 成功的一次提交不應留下任何 rejected 紀錄
  const logs = calls.filter((c) => c.table === "analyst_runs" && c.method === "POST");
  assert.equal(logs.length, 1);
  assert.equal(JSON.parse(logs[0].body).status, "accepted");
  console.log("experiment-decision tests passed");
}
main().catch((error) => { console.error(error); process.exit(1); });
