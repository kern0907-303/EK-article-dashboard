// 文體實驗：臂定義、開實驗的順序規則（先結構後文體）、對照臂、文體實驗進行時結構鎖在上一輪勝者。
import assert from "node:assert/strict";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://stub.supabase.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "stub-key";
process.env.EXPERIMENT_ENABLED = "true";

const STRUCT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const GENRE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const NEW_ID = "22222222-2222-4222-8222-222222222222";

let experiments: Record<string, unknown>[] = [];
const calls: { method: string; table: string; query: string; body: string }[] = [];

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(String(input));
  const table = url.pathname.split("/").pop() || "";
  const method = init?.method || "GET";
  const query = decodeURIComponent(url.search);
  calls.push({ method, table, query, body: String(init?.body || "") });
  const json = (status: number, value: unknown) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
  if (method === "GET") {
    if (table === "experiments") {
      if (query.includes("variable=eq.structure") && query.includes("status=eq.concluded")) return json(200, experiments.filter((e) => e.variable === "structure" && e.status === "concluded" && e.winner));
      if (query.includes("status=eq.running") && query.includes("id=eq.")) return json(200, experiments.filter((e) => e.status === "running"));
      return json(200, experiments);
    }
    if (table === "strategy_params") return json(200, [{ experiment_id: GENRE_ID, arm: "stance" }]);
    return json(200, []);
  }
  if (table === "experiments") return json(201, [{ id: NEW_ID }]);
  if (table === "analyst_runs") return json(201, [{ id: "33333333-3333-4333-8333-333333333333" }]);
  return json(201, [{}]);
}) as typeof fetch;

const writes = () => calls.filter((c) => c.method !== "GET" && c.table !== "analyst_runs");
const concludedStructure = { id: STRUCT_ID, brand: "nas", variable: "structure", arm_a: "story_open", arm_b: "question_open", status: "concluded", winner: "story_open", started_at: "2026-10-10T00:00:00Z", decision_note: null, concluded_at: "2026-10-16T00:00:00Z" };
const start = (armA: string, armB: string) => ({ summary: "開文體實驗", start: { brand: "nas", variable: "genre", arm_a: armA, arm_b: armB } });

async function main() {
  const { armDirective, isKnownArm, parseDecision } = await import("../src/lib/experiment-arms");
  const { applyDecision, resolveExperimentArm } = await import("../src/lib/experiment-server");

  // 臂定義
  assert.ok(isKnownArm("genre", "breakdown") && isKnownArm("genre", "stance"));
  assert.ok(!isKnownArm("genre", "invite"), "邀請文不進實驗");
  assert.ok(!isKnownArm("genre", "story_open"), "結構的臂不能用在文體");
  assert.ok(!isKnownArm("structure", "stance"));
  assert.ok(armDirective("genre", "stance")?.includes("觀點表態"));
  assert.ok(armDirective("genre", "breakdown")?.includes("拆解"));
  assert.equal(armDirective("genre", "nope"), null);
  const dash = /[—–─]/;
  for (const arm of ["breakdown", "stance"]) assert.ok(!dash.test(armDirective("genre", arm) as string), "指令本身不含破折號");
  const parsed = parseDecision(start("breakdown", "stance"));
  assert.ok(parsed.ok && parsed.value.start?.variable === "genre");
  assert.equal(parseDecision(start("breakdown", "story_open")).ok, false);

  // 還沒完成任何結構實驗：拒絕
  experiments = [];
  let result = await applyDecision(start("breakdown", "stance"));
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.errors.some((e) => e.includes("結構實驗")));
  assert.equal(writes().length, 0);

  // 只有進行中的結構實驗也不行（要先結案）
  experiments = [{ ...concludedStructure, status: "running", winner: null, concluded_at: null }];
  calls.length = 0;
  result = await applyDecision(start("breakdown", "stance"));
  assert.equal(result.ok, false);

  // 結構已結案，但 arm_a 不是對照臂：拒絕
  experiments = [concludedStructure];
  calls.length = 0;
  result = await applyDecision(start("stance", "breakdown"));
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.errors.some((e) => e.includes("breakdown")));
  assert.equal(writes().length, 0);

  // 結構已結案（含結論為證據不足）且 arm_a 正確：通過
  for (const status of ["concluded", "inconclusive"]) {
    experiments = [{ ...concludedStructure, status, winner: status === "concluded" ? "story_open" : null }];
    calls.length = 0;
    result = await applyDecision(start("breakdown", "stance"));
    assert.equal(result.ok, true, `${status}: ${JSON.stringify(result)}`);
    const created = writes().find((c) => c.table === "experiments");
    assert.ok(created && JSON.parse(created.body).variable === "genre");
  }

  // 同一組已經測過：拒絕重複
  experiments = [concludedStructure];
  calls.length = 0;
  result = await applyDecision({ summary: "重複", start: { brand: "nas", variable: "structure", arm_a: "question_open", arm_b: "story_open" } });
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.errors.some((e) => e.includes("已經測過")));
  assert.equal(writes().length, 0);

  // 文體實驗進行時：指令 = 文體臂 + 鎖定的結構勝者
  experiments = [concludedStructure, { id: GENRE_ID, brand: "nas", variable: "genre", arm_a: "breakdown", arm_b: "stance", status: "running", winner: null, started_at: "2026-10-23T00:00:00Z", decision_note: null, concluded_at: null }];
  const assignment = await resolveExperimentArm("nas", "2026-10-24T02:10:00Z");
  assert.ok(assignment, "應取得指派");
  assert.equal(assignment.variable, "genre");
  assert.equal(assignment.arm, "stance");
  assert.ok(assignment.directive.includes("觀點表態"));
  assert.ok(assignment.directive.includes("開頭用一個具體的生活場景"), "要附上鎖定的結構勝者 story_open 的指令");

  // 沒有結構勝者時只有文體指令
  experiments = [{ ...concludedStructure, status: "inconclusive", winner: null }, experiments[1]];
  const noLock = await resolveExperimentArm("nas", "2026-10-24T02:10:00Z");
  assert.ok(noLock && noLock.directive.includes("觀點表態") && !noLock.directive.includes("開頭用一個具體的生活場景"));

  console.log("genre-experiment tests passed");
}
main().catch((error) => { console.error(error); process.exit(1); });
