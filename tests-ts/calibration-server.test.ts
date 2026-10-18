// 校正的伺服器端：對照日不套用指令、決策裡落在對照日的排程被略過、報告含 calibration、警示 7 天內只發一次。
import assert from "node:assert/strict";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://stub.supabase.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "stub-key";
process.env.EXPERIMENT_ENABLED = "true";
process.env.TELEGRAM_BOT_TOKEN = "stub-token";
process.env.TELEGRAM_CHAT_ID = "stub-chat";

const RUN_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
let experiments: Record<string, unknown>[] = [];
let alertRows: { sent_at: string }[] = [];
const calls: { method: string; host: string; table: string; body: string }[] = [];

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(String(input));
  const table = url.pathname.split("/").pop() || "";
  const method = init?.method || "GET";
  calls.push({ method, host: url.host, table, body: String(init?.body || "") });
  const json = (status: number, value: unknown) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
  if (url.host === "api.telegram.org") return json(200, { ok: true });
  if (method === "GET") {
    if (table === "experiments") return json(200, experiments);
    if (table === "calibration_alerts") return json(200, alertRows);
    if (table === "strategy_params") return json(200, [{ experiment_id: RUN_ID, arm: "story_open" }]);
    return json(200, []);
  }
  if (table === "analyst_runs") return json(201, [{ id: "33333333-3333-4333-8333-333333333333" }]);
  return json(201, [{}]);
}) as typeof fetch;

const dayOffset = (base: Date, n: number) => new Date(base.getTime() + n * 86400000).toISOString().slice(0, 10);

async function main() {
  const { isControlDay } = await import("../src/lib/calibration");
  const { addDays, taipeiDate } = await import("../src/lib/experiment-arms");
  const { applyDecision, buildReport, resolveExperimentArm, sendCalibrationAlerts } = await import("../src/lib/experiment-server");

  // 找一個 nas 的對照日與一個非對照日（未來 14 天內）
  const base = new Date();
  const dates = Array.from({ length: 14 }, (_, i) => dayOffset(base, i + 1));
  const controlDate = dates.find((d) => isControlDay("nas", d)) as string;
  const normalDate = dates.find((d) => !isControlDay("nas", d)) as string;
  assert.ok(controlDate && normalDate);

  // 對照日不套用實驗指令；非對照日照常
  experiments = [{ id: RUN_ID, brand: "nas", variable: "structure", arm_a: "story_open", arm_b: "question_open", status: "running", winner: null, started_at: "2026-10-17T07:56:00Z", decision_note: null, concluded_at: null }];
  assert.equal(await resolveExperimentArm("nas", `${controlDate}T02:10:00Z`), null);
  const normal = await resolveExperimentArm("nas", `${normalDate}T02:10:00Z`);
  assert.ok(normal && normal.arm === "story_open");

  // 決策：落在對照日的排程被略過（只在最近三天內才合法，所以挑今天起三天內剛好是對照日的品牌；找不到就改測純函式已涵蓋的部分）
  const today = taipeiDate(new Date());
  const window3 = [1, 2, 3].map((n) => addDays(today, n));
  const pick = (["nas", "abl", "i8"] as const).flatMap((brand) => window3.filter((d) => isControlDay(brand, d)).map((d) => ({ brand, date: d })))[0];
  assert.ok(pick, "三天內每個品牌至少有一天落在某個品牌的對照日（每 7 天 1 天，三品牌錯開）");
  experiments = [{ id: RUN_ID, brand: pick.brand, variable: "structure", arm_a: "story_open", arm_b: "question_open", status: "running", winner: null, started_at: new Date(Date.now() - 4 * 86400000).toISOString(), decision_note: null, concluded_at: null }];
  calls.length = 0;
  const other = window3.find((d) => !isControlDay(pick.brand, d)) as string;
  const result = await applyDecision({
    summary: "排程",
    next_days: [{ brand: pick.brand, date: pick.date, experiment_id: RUN_ID, arm: "story_open" }, ...(other ? [{ brand: pick.brand, date: other, experiment_id: RUN_ID, arm: "question_open" }] : [])],
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.ok(result.ok && result.applied.some((a) => a.includes("對照日")));
  const params = calls.find((c) => c.method === "POST" && c.table === "strategy_params");
  const rows = params ? (JSON.parse(params.body) as { valid_date: string }[]) : [];
  assert.ok(!rows.some((r) => r.valid_date === pick.date), "對照日不寫入參數");

  // 報告含 calibration，空資料也不會出錯
  experiments = [];
  const report = await buildReport();
  const cal = report.calibration;
  assert.ok(cal && Array.isArray(cal.alerts) && cal.alerts.length === 0);
  assert.equal(cal.brand_status.nas, "insufficient");
  assert.equal(cal.next_candidate.nas?.variable, "structure");
  assert.equal(cal.trend.length, 6);

  // 警示：nas 可測組合用完 → 發一次；7 天內不重發
  const done = (variable: string, a: string, b: string, winner: string | null, at: string) => ({ id: crypto.randomUUID(), brand: "nas", variable, arm_a: a, arm_b: b, status: "concluded", winner, started_at: "2026-10-10T00:00:00Z", decision_note: null, concluded_at: at });
  experiments = [
    done("structure", "story_open", "question_open", "story_open", "2026-10-20T00:00:00Z"),
    done("structure", "story_open", "claim_open", "story_open", "2026-10-28T00:00:00Z"),
    done("genre", "breakdown", "stance", "stance", "2026-11-08T00:00:00Z"),
  ];
  alertRows = [];
  calls.length = 0;
  let sent = await sendCalibrationAlerts();
  assert.equal(sent.sent, 1, JSON.stringify(sent));
  const telegram = calls.filter((c) => c.host === "api.telegram.org");
  assert.equal(telegram.length, 1);
  assert.ok(telegram[0].body.includes("平衡空間") && !/[—–─*#]/.test(telegram[0].body));
  assert.ok(calls.some((c) => c.method === "POST" && c.table === "calibration_alerts"));

  alertRows = [{ sent_at: new Date().toISOString() }];
  calls.length = 0;
  sent = await sendCalibrationAlerts();
  assert.equal(sent.sent, 0);
  assert.equal(sent.skipped, 1);
  assert.equal(calls.filter((c) => c.host === "api.telegram.org").length, 0, "冷卻期內不重發");

  // 沒設 Telegram 時不丟錯
  delete process.env.TELEGRAM_BOT_TOKEN;
  alertRows = [];
  sent = await sendCalibrationAlerts();
  assert.equal(sent.sent, 0);

  console.log("calibration-server tests passed");
}
main().catch((error) => { console.error(error); process.exit(1); });
