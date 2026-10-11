import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { CARD_SIZES } from "../src/lib/card-layout.mjs";
import { TARGET_SIZES, buildWorkflow, generationSize, modelFamily, parseEnv, pickCheckpoint, samplingFor, checkpointsFromObjectInfo } from "../mac-worker/lib.mjs";
import { claimJob, createQueue, processJob, reclaimStale } from "../mac-worker/worker.mjs";

test("Mac mini 的目標尺寸與儀表板的尺寸預設一致", () => {
  for (const [key, size] of Object.entries(CARD_SIZES)) {
    assert.deepEqual(TARGET_SIZES[key], { width: size.width, height: size.height }, key);
  }
  assert.equal(Object.keys(TARGET_SIZES).length, Object.keys(CARD_SIZES).length);
});

test("生成尺寸：64 的倍數、長寬比接近目標", () => {
  assert.deepEqual(generationSize("ig_feed"), { width: 896, height: 1152 });
  assert.deepEqual(generationSize("ig_story"), { width: 768, height: 1344 });
  assert.deepEqual(generationSize("ig_square"), { width: 1024, height: 1024 });
  assert.deepEqual(generationSize("ig_grid34"), { width: 896, height: 1152 });
  for (const key of Object.keys(TARGET_SIZES)) for (const fam of ["sdxl", "sd15"]) {
    const g = generationSize(key, fam);
    assert.equal(g.width % 64, 0); assert.equal(g.height % 64, 0);
    const t = TARGET_SIZES[key];
    assert.ok(Math.abs(g.width / g.height - t.width / t.height) < 0.12, `${key} ${fam}`);
  }
  assert.ok(generationSize("ig_feed", "sd15").width <= 512);
});

test("挑模型與取樣設定", () => {
  assert.equal(pickCheckpoint([], ""), null);
  assert.equal(pickCheckpoint(["a.safetensors", "sdxl_base.safetensors"], ""), "sdxl_base.safetensors");
  assert.equal(pickCheckpoint(["a.safetensors", "b.safetensors"], ""), "a.safetensors");
  assert.equal(pickCheckpoint(["a.safetensors", "b.safetensors"], "b.safetensors"), "b.safetensors");
  assert.equal(pickCheckpoint(["a.safetensors", "dream.safetensors"], "dream"), "dream.safetensors");
  assert.equal(modelFamily("v1-5-pruned.ckpt"), "sd15");
  assert.equal(modelFamily("juggernautXL.safetensors"), "sdxl");
  assert.equal(modelFamily("x", "sd15"), "sd15");
  assert.deepEqual(samplingFor("sdxl_turbo.safetensors", { steps: 25, cfg: 6.5 }), { steps: 4, cfg: 1.0 });
  assert.deepEqual(samplingFor("plain.safetensors", { steps: 25, cfg: 6.5 }), { steps: 25, cfg: 6.5 });
  assert.deepEqual(checkpointsFromObjectInfo({ CheckpointLoaderSimple: { input: { required: { ckpt_name: [["m1", "m2"]] } } } }), ["m1", "m2"]);
  assert.deepEqual(checkpointsFromObjectInfo({}), []);
});

test("工作流程節點相連正確", () => {
  const g = buildWorkflow({ checkpoint: "m", prompt: "p", negative: "n", seed: 5, width: 512, height: 640, steps: 20, cfg: 7 });
  assert.equal(g[1].inputs.ckpt_name, "m");
  assert.deepEqual(g[5].inputs.positive, ["2", 0]);
  assert.deepEqual(g[5].inputs.negative, ["3", 0]);
  assert.deepEqual(g[6].inputs.vae, ["1", 2]);
  assert.deepEqual(g[7].inputs.images, ["6", 0]);
  assert.equal(g[4].inputs.width, 512);
});

test(".env 解析", () => {
  assert.deepEqual(parseEnv("# c\nA=1\nB = \"x y\"\n\nbad\nC=a=b\n"), { A: "1", B: "x y", C: "a=b" });
});

// ---- 模擬 Supabase 與 ComfyUI ----
async function makeMock({ models = ["sdxl_base.safetensors"], comfyFail = "", claimLost = false } = {}) {
  const png = await sharp({ create: { width: 896, height: 1152, channels: 3, background: "#336699" } }).png().toBuffer();
  const state = { patches: [], uploads: [], prompts: [], jobs: new Map() };
  const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
  const fetchFn = async (url, init = {}) => {
    const u = new URL(url);
    const method = init.method || "GET";
    if (u.pathname === "/object_info/CheckpointLoaderSimple") return json({ CheckpointLoaderSimple: { input: { required: { ckpt_name: [models] } } } });
    if (u.pathname === "/prompt") { const body = JSON.parse(init.body); state.prompts.push(body); return comfyFail === "prompt" ? json({ error: "bad" }, 400) : json({ prompt_id: "p1" }); }
    if (u.pathname === "/history/p1") return json({ p1: { status: { status_str: "success", completed: true }, outputs: { 7: { images: [{ filename: "ek_1.png", subfolder: "", type: "output" }] } } } });
    if (u.pathname === "/view") return new Response(png, { status: 200 });
    if (u.pathname === "/storage/v1/bucket") return json({}, 409);
    if (u.pathname.startsWith("/storage/v1/object/social-images/")) { state.uploads.push({ path: u.pathname, bytes: init.body.length }); state.lastUpload = init.body; return json({ Key: "ok" }); }
    if (u.pathname === "/rest/v1/image_jobs" && method === "PATCH") {
      const body = JSON.parse(init.body);
      state.patches.push({ query: u.search, body });
      if (/status=eq\.pending/.test(u.search) && body.status === "running") return json(claimLost ? [] : [{ ...state.currentJob, ...body }]);
      if (/status=eq\.running/.test(u.search) && body.status === "pending") return json([{ id: "stale" }]);
      return new Response(null, { status: 204 });
    }
    throw new Error("unexpected " + method + " " + url);
  };
  return { fetchFn, state };
}
const cfg = { comfyUrl: "http://comfy", preferredCheckpoint: "", modelFamily: "auto", steps: 5, cfg: 6, sampler: "euler", scheduler: "normal", jobTimeoutSeconds: 5, staleRunningMinutes: 15, maxAttempts: 3, bucket: "social-images" };
const baseJob = { id: "j1", brand_id: "brand_b_nas", size_key: "ig_story", prompt: "a calm lake", negative: "text", seed: 42, attempts: 0, status: "pending" };

test("整條流程：領單 → 生圖 → 裁成 1080x1920 JPEG → 上傳 → 回報 done", async () => {
  const { fetchFn, state } = await makeMock();
  state.currentJob = baseJob;
  const ctx = { cfg, url: "http://sb", key: "k", workerId: "w", fetchFn, pollMs: 1 };
  assert.equal(await processJob(ctx, baseJob), "done");
  const wf = state.prompts[0].prompt;
  assert.equal(wf[1].inputs.ckpt_name, "sdxl_base.safetensors");
  assert.deepEqual([wf[4].inputs.width, wf[4].inputs.height], [768, 1344]);
  assert.equal(wf[5].inputs.seed, 42);
  const meta = await sharp(state.lastUpload).metadata();
  assert.deepEqual([meta.width, meta.height, meta.format], [1080, 1920, "jpeg"]);
  const last = state.patches.at(-1).body;
  assert.equal(last.status, "done");
  assert.match(last.result_url, /^http:\/\/sb\/storage\/v1\/object\/public\/social-images\/comfy\/brand_b_nas\//);
});

test("被別台搶先領走就略過，不生圖", async () => {
  const { fetchFn, state } = await makeMock({ claimLost: true });
  const ctx = { cfg, url: "http://sb", key: "k", workerId: "w", fetchFn, pollMs: 1 };
  assert.equal(await processJob(ctx, baseJob), "skipped");
  assert.equal(state.prompts.length, 0);
});

test("ComfyUI 沒有模型或出錯：單標成 failed 並寫明原因，不會丟出例外", async () => {
  let m = await makeMock({ models: [] });
  m.state.currentJob = baseJob;
  let ctx = { cfg, url: "http://sb", key: "k", workerId: "w", fetchFn: m.fetchFn, pollMs: 1 };
  assert.equal(await processJob(ctx, baseJob), "failed");
  assert.equal(m.state.patches.at(-1).body.status, "failed");
  assert.match(m.state.patches.at(-1).body.error, /沒有任何模型/);
  m = await makeMock({ comfyFail: "prompt" });
  m.state.currentJob = baseJob;
  ctx = { cfg, url: "http://sb", key: "k", workerId: "w", fetchFn: m.fetchFn, pollMs: 1 };
  assert.equal(await processJob(ctx, baseJob), "failed");
});

test("重試太多次的單直接標失敗，不再領", async () => {
  const { fetchFn, state } = await makeMock();
  const ctx = { cfg, url: "http://sb", key: "k", workerId: "w", fetchFn, pollMs: 1 };
  assert.equal(await claimJob(ctx, { ...baseJob, attempts: 3 }), null);
  assert.equal(state.patches[0].body.status, "failed");
});

test("啟動時退回卡住的單；佇列同一筆不重複做", async () => {
  const { fetchFn, state } = await makeMock();
  state.currentJob = baseJob;
  const ctx = { cfg, url: "http://sb", key: "k", workerId: "w", fetchFn, pollMs: 1 };
  assert.equal(await reclaimStale(ctx), 1);
  const q = createQueue(ctx);
  q.push(baseJob); q.push(baseJob);
  await q.idle();
  assert.equal(state.prompts.length, 1);
});
