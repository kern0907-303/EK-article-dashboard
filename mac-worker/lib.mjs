// 純函式：挑模型、算生成尺寸、組 ComfyUI 工作流程。不碰網路，方便測試。

/** 目標輸出尺寸，必須和儀表板 src/lib/card-layout.mjs 的 CARD_SIZES 一致（有測試會比對）。 */
export const TARGET_SIZES = {
  ig_feed: { width: 1080, height: 1350 },
  ig_grid34: { width: 1080, height: 1440 },
  ig_square: { width: 1080, height: 1080 },
  ig_story: { width: 1080, height: 1920 },
  fb_feed: { width: 1080, height: 1350 },
  threads: { width: 1080, height: 1350 },
};

const SD15 = /sd[-_ ]?1[._-]?5|v1[-_.]5|sd15/i;

/** 依模型名稱判斷系列。auto：名稱像 SD1.5 就用 sd15，其餘一律當 sdxl（含 SDXL、Flux 等大圖模型）。 */
export function modelFamily(checkpoint, setting = "auto") {
  if (setting === "sdxl" || setting === "sd15") return setting;
  return SD15.test(checkpoint || "") ? "sd15" : "sdxl";
}

/** 生成尺寸：保持目標長寬比，像素量約 1MP（sdxl）或 0.26MP（sd15），邊長取 64 的倍數。 */
export function generationSize(sizeKey, family = "sdxl") {
  const t = TARGET_SIZES[sizeKey] || TARGET_SIZES.ig_feed;
  const budget = family === "sd15" ? 512 * 512 : 1024 * 1024;
  const s = Math.sqrt(budget / (t.width * t.height));
  const snap = (n) => Math.max(64, Math.round((n * s) / 64) * 64);
  return { width: snap(t.width), height: snap(t.height) };
}

/** 挑模型：設定的名稱 → 名稱含 xl → 清單第一個。清單是空的回 null。 */
export function pickCheckpoint(available, preferred = "") {
  const list = Array.isArray(available) ? available.filter((x) => typeof x === "string") : [];
  if (!list.length) return null;
  if (preferred && list.includes(preferred)) return preferred;
  if (preferred) {
    const loose = list.find((x) => x.toLowerCase().includes(preferred.toLowerCase()));
    if (loose) return loose;
  }
  return list.find((x) => /xl/i.test(x)) || list[0];
}

/** 加速版模型（turbo、lightning）步數少、cfg 低，否則畫面會過曝。 */
export function samplingFor(checkpoint, cfg) {
  const name = (checkpoint || "").toLowerCase();
  if (name.includes("turbo")) return { steps: 4, cfg: 1.0 };
  if (name.includes("lightning")) return { steps: 6, cfg: 1.5 };
  return { steps: cfg.steps, cfg: cfg.cfg };
}

/** 標準的文字生圖流程（不需要使用者匯出任何檔案）。 */
export function buildWorkflow({ checkpoint, prompt, negative, seed, width, height, steps, cfg, sampler = "euler", scheduler = "normal", prefix = "ek" }) {
  return {
    1: { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: checkpoint } },
    2: { class_type: "CLIPTextEncode", inputs: { text: prompt, clip: ["1", 1] } },
    3: { class_type: "CLIPTextEncode", inputs: { text: negative || "", clip: ["1", 1] } },
    4: { class_type: "EmptyLatentImage", inputs: { width, height, batch_size: 1 } },
    5: { class_type: "KSampler", inputs: { seed, steps, cfg, sampler_name: sampler, scheduler, denoise: 1, model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0] } },
    6: { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    7: { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: prefix } },
  };
}

/** 從 /object_info/CheckpointLoaderSimple 的回應取出模型清單 */
export function checkpointsFromObjectInfo(info) {
  const names = info?.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0];
  return Array.isArray(names) ? names : [];
}

/** 簡單的 .env 解析（KEY=VALUE，# 開頭是註解），不依賴 Node 的 --env-file 旗標 */
export function parseEnv(text) {
  const out = {};
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 1) continue;
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return out;
}
