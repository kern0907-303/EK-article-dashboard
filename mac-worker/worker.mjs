// Mac mini 生圖小程式。
// 流程：連上 Supabase Realtime → 有新單就領單 → 叫本機 ComfyUI 生底圖 → 轉 JPEG、裁成目標尺寸 → 上傳 → 回報。
// 不輪詢：只在啟動、以及 Realtime 重新連上時，掃一次「還在等待」的單（補做離線期間的單）。
// 每 60 秒寫一筆心跳，讓儀表板知道 Mac mini 在線（只寫入，不讀取）。
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { TARGET_SIZES, buildWorkflow, checkpointsFromObjectInfo, generationSize, modelFamily, parseEnv, pickCheckpoint, samplingFor } from "./lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const log = (...a) => console.log(new Date().toISOString(), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function loadConfig(dir = HERE) {
  const cfg = JSON.parse(await readFile(path.join(dir, "config.json"), "utf8"));
  const envPath = path.join(dir, ".env");
  const fileEnv = existsSync(envPath) ? parseEnv(await readFile(envPath, "utf8")) : {};
  const env = { ...fileEnv, ...process.env };
  const url = (env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const key = env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("找不到 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY，請檢查 mac-worker/.env");
  return { cfg: { ...cfg, comfyUrl: (env.COMFY_URL || cfg.comfyUrl).replace(/\/$/, "") }, url, key, workerId: env.WORKER_ID || `${os.hostname()}` };
}

/** ctx = { cfg, url, key, workerId, fetchFn } */
function headers(ctx, extra = {}) {
  return { apikey: ctx.key, Authorization: `Bearer ${ctx.key}`, "Content-Type": "application/json", ...extra };
}

async function rest(ctx, table, query, init = {}) {
  const res = await ctx.fetchFn(`${ctx.url}/rest/v1/${table}${query ? `?${query}` : ""}`, { ...init, headers: headers(ctx, init.headers) });
  if (!res.ok) throw new Error(`${table} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.status === 204 ? [] : res.json();
}

/** 領單：只有狀態還是 pending 才會更新成功，兩台機器不會領到同一筆。回傳領到的單，沒領到回 null。 */
export async function claimJob(ctx, job) {
  if ((job.attempts || 0) >= ctx.cfg.maxAttempts) {
    await rest(ctx, "image_jobs", `id=eq.${job.id}&status=eq.pending`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "failed", error: `已重試 ${job.attempts} 次仍未成功`, finished_at: new Date().toISOString() }) });
    return null;
  }
  const rows = await rest(ctx, "image_jobs", `id=eq.${job.id}&status=eq.pending`, {
    method: "PATCH", headers: { Prefer: "return=representation" },
    body: JSON.stringify({ status: "running", claimed_at: new Date().toISOString(), attempts: (job.attempts || 0) + 1 }),
  });
  return rows[0] || null;
}

export async function finishJob(ctx, id, patch) {
  await rest(ctx, "image_jobs", `id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ ...patch, finished_at: new Date().toISOString() }) });
}

/** 啟動時：卡在 running 太久的單（上次當機或關機）退回 pending，之後會被重新做 */
export async function reclaimStale(ctx) {
  const cutoff = new Date(Date.now() - ctx.cfg.staleRunningMinutes * 60_000).toISOString();
  const rows = await rest(ctx, "image_jobs", `status=eq.running&claimed_at=lt.${encodeURIComponent(cutoff)}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: "pending" }) });
  return rows.length;
}

export async function listPending(ctx) {
  return rest(ctx, "image_jobs", "status=eq.pending&order=created_at.asc&limit=50");
}

export async function sendHeartbeat(ctx, info = {}) {
  await rest(ctx, "image_worker_heartbeat", "on_conflict=worker_id", {
    method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ worker_id: ctx.workerId, seen_at: new Date().toISOString(), info }),
  });
}

async function comfyJson(ctx, p, init) {
  const res = await ctx.fetchFn(`${ctx.cfg.comfyUrl}${p}`, init);
  if (!res.ok) throw new Error(`ComfyUI ${p} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

export async function listCheckpoints(ctx) {
  return checkpointsFromObjectInfo(await comfyJson(ctx, "/object_info/CheckpointLoaderSimple"));
}

/** 叫 ComfyUI 生一張圖，回傳原始圖檔的 Buffer */
export async function generateWithComfy(ctx, job) {
  const names = await listCheckpoints(ctx);
  const checkpoint = pickCheckpoint(names, ctx.cfg.preferredCheckpoint);
  if (!checkpoint) throw new Error("ComfyUI 裡沒有任何模型（checkpoints 資料夾是空的），請先放一個模型");
  const family = modelFamily(checkpoint, ctx.cfg.modelFamily);
  const { width, height } = generationSize(job.size_key, family);
  const sampling = samplingFor(checkpoint, ctx.cfg);
  const graph = buildWorkflow({ checkpoint, prompt: job.prompt, negative: job.negative, seed: Number(job.seed), width, height, ...sampling, sampler: ctx.cfg.sampler, scheduler: ctx.cfg.scheduler });
  const queued = await comfyJson(ctx, "/prompt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: graph, client_id: ctx.workerId }) });
  const promptId = queued.prompt_id;
  if (!promptId) throw new Error("ComfyUI 沒有回傳 prompt_id" + (queued.error ? `：${JSON.stringify(queued.error).slice(0, 200)}` : ""));

  const deadline = Date.now() + ctx.cfg.jobTimeoutSeconds * 1000;
  while (Date.now() < deadline) {
    await sleep(ctx.pollMs ?? 1000);
    const hist = await comfyJson(ctx, `/history/${promptId}`);
    const entry = hist[promptId];
    if (!entry) continue;
    if (entry.status?.status_str === "error") throw new Error("ComfyUI 生圖出錯：" + JSON.stringify(entry.status.messages || "").slice(0, 200));
    const img = entry.outputs?.["7"]?.images?.[0];
    if (!img) { if (entry.status?.completed) throw new Error("ComfyUI 完成了但沒有輸出圖片"); continue; }
    const q = new URLSearchParams({ filename: img.filename, subfolder: img.subfolder || "", type: img.type || "output" });
    const res = await ctx.fetchFn(`${ctx.cfg.comfyUrl}/view?${q}`);
    if (!res.ok) throw new Error(`讀取 ComfyUI 圖片失敗 HTTP ${res.status}`);
    return { buffer: Buffer.from(await res.arrayBuffer()), checkpoint, width, height };
  }
  throw new Error(`ComfyUI 超過 ${ctx.cfg.jobTimeoutSeconds} 秒沒有完成`);
}

/** 裁成目標尺寸、轉 JPEG（與儀表板現有流程一致：cover 置中裁切、quality 90） */
export async function toTargetJpeg(buffer, sizeKey) {
  const sharp = (await import("sharp")).default;
  const t = TARGET_SIZES[sizeKey] || TARGET_SIZES.ig_feed;
  return sharp(buffer).resize(t.width, t.height, { fit: "cover", position: "centre" }).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
}

let bucketReady = false;
export async function uploadJpeg(ctx, jpeg, brandId) {
  const bucket = ctx.cfg.bucket;
  if (!bucketReady) {
    const res = await ctx.fetchFn(`${ctx.url}/storage/v1/bucket`, { method: "POST", headers: headers(ctx), body: JSON.stringify({ id: bucket, name: bucket, public: true, file_size_limit: 8_000_000, allowed_mime_types: ["image/jpeg"] }) });
    if (!res.ok && res.status !== 400 && res.status !== 409) throw new Error(`建立儲存桶失敗 HTTP ${res.status}`);
    bucketReady = true;
  }
  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 8);
  const folder = String(brandId).replace(/[^a-z0-9_]/gi, "") || "misc";
  const objectPath = `comfy/${folder}/${stamp}-${rand}.jpg`;
  const res = await ctx.fetchFn(`${ctx.url}/storage/v1/object/${bucket}/${objectPath}`, { method: "POST", headers: { apikey: ctx.key, Authorization: `Bearer ${ctx.key}`, "Content-Type": "image/jpeg", "x-upsert": "false" }, body: new Uint8Array(jpeg) });
  if (!res.ok) throw new Error(`上傳圖片失敗 HTTP ${res.status}`);
  return `${ctx.url}/storage/v1/object/public/${bucket}/${objectPath}`;
}

/** 處理一筆單：領單 → 生圖 → 上傳 → 回報。任何錯誤都寫進單的 error，不讓程式當掉。 */
export async function processJob(ctx, job) {
  const claimed = await claimJob(ctx, job);
  if (!claimed) return "skipped";
  log("領單", claimed.id, claimed.size_key, claimed.brand_id);
  try {
    const { buffer, checkpoint } = await generateWithComfy(ctx, claimed);
    const jpeg = await toTargetJpeg(buffer, claimed.size_key);
    const url = await uploadJpeg(ctx, jpeg, claimed.brand_id);
    await finishJob(ctx, claimed.id, { status: "done", result_url: url, error: null });
    log("完成", claimed.id, checkpoint);
    return "done";
  } catch (error) {
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 300);
    log("失敗", claimed.id, message);
    await finishJob(ctx, claimed.id, { status: "failed", error: message }).catch((e) => log("回報失敗也失敗", e.message));
    return "failed";
  }
}

/** 一次只做一筆（避免同時塞爆 GPU），同一筆不重複排 */
export function createQueue(ctx) {
  const seen = new Set();
  let chain = Promise.resolve();
  return {
    push(job) {
      if (!job?.id || seen.has(job.id)) return;
      seen.add(job.id);
      chain = chain.then(() => processJob(ctx, job)).catch((e) => log("處理錯誤", e.message)).finally(() => seen.delete(job.id));
    },
    idle: () => chain,
  };
}

export async function scanPending(ctx, queue) {
  const reclaimed = await reclaimStale(ctx);
  if (reclaimed) log("退回卡住的單", reclaimed);
  const jobs = await listPending(ctx);
  if (jobs.length) log("補做等待中的單", jobs.length);
  jobs.forEach((j) => queue.push(j));
}

async function main() {
  const loaded = await loadConfig();
  const ctx = { ...loaded, fetchFn: fetch };
  const queue = createQueue(ctx);
  log("啟動", ctx.workerId, "ComfyUI:", ctx.cfg.comfyUrl);

  const beat = async () => {
    let models = [];
    try { models = await listCheckpoints(ctx); } catch { /* ComfyUI 沒開時照樣回報心跳，但標示它不可用 */ }
    await sendHeartbeat(ctx, { comfy: models.length > 0, models: models.length }).catch((e) => log("心跳失敗", e.message));
  };
  await beat();
  setInterval(beat, ctx.cfg.heartbeatSeconds * 1000);
  if (ctx.cfg.safetyScanMinutes > 0) setInterval(() => scanPending(ctx, queue).catch((e) => log("掃描失敗", e.message)), ctx.cfg.safetyScanMinutes * 60_000);

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(ctx.url, ctx.key, { auth: { persistSession: false, autoRefreshToken: false } });
  supabase
    .channel("image_jobs_inserts")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "image_jobs" }, (payload) => {
      if (payload.new?.status === "pending") queue.push(payload.new);
    })
    .subscribe((status, err) => {
      log("Realtime 狀態", status, err?.message || "");
      // 每次（重新）連上，就補掃一次離線期間漏掉的單
      if (status === "SUBSCRIBED") scanPending(ctx, queue).catch((e) => log("掃描失敗", e.message));
    });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error("啟動失敗：", e.message); process.exit(1); });
}
