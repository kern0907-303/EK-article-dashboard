// Instagram 配圖：依文章內容產生情境圖（圖上不放字），裁成 4:5、轉 JPEG，上傳到 Supabase 公開儲存桶。
// 只在伺服器端使用；密鑰都來自環境變數，不會送到瀏覽器。

import { getSupabaseEnv } from "@/lib/publish-queue";

export const IMAGE_BUCKET = "social-images";
const OUTPUT_WIDTH = 1080;
const OUTPUT_HEIGHT = 1350; // 4:5，Instagram 動態接受的比例範圍內

export type BrandKey = "abl" | "nas" | "i8";

const BRAND_STYLE: Record<BrandKey, string> = {
  i8: "calm modern business atmosphere, clean composition, soft natural light, muted blue and warm gray tones",
  nas: "warm gentle atmosphere about self-understanding, soft golden light, quiet and hopeful, earthy warm tones",
  abl: "serene and peaceful atmosphere about rest and inner balance, soft diffused light, calm teal and soft lavender tones",
};

/** 公開網址的前綴，發文時用來確認圖片是我們自己存的 */
export function publicImagePrefix(): string | null {
  const env = getSupabaseEnv();
  if (!env) return null;
  return `${env.url.replace(/\/$/, "")}/storage/v1/object/public/${IMAGE_BUCKET}/`;
}

function cleanText(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** 請文字模型把文章濃縮成一段英文生圖描述（圖上不得有文字） */
export async function buildImagePrompt(article: string, brand: BrandKey): Promise<string> {
  const instruction =
    "You write prompts for an image generator. Read the article (Traditional Chinese) and describe ONE evocative scene or " +
    "visual metaphor that fits its core feeling, in English, 2 to 4 sentences. Rules: no text, no letters, no numbers, no logos, " +
    "no watermarks in the image; avoid close-up faces; no religious or medical symbols; no before/after imagery. " +
    `Style: ${BRAND_STYLE[brand]}. Photographic or soft illustration look. Output only the prompt.`;
  const body = cleanText(article).slice(0, 3000);

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": anthropicKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
        max_tokens: 400,
        system: instruction,
        messages: [{ role: "user", content: body }],
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (res.ok) {
      const json = (await res.json()) as { content?: { type: string; text?: string }[] };
      const text = (json.content || []).filter((c) => c.type === "text").map((c) => c.text || "").join("").trim();
      if (text) return text;
    }
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) throw new Error("沒有可用的文字模型密鑰（ANTHROPIC_API_KEY 或 OPENAI_API_KEY），無法產生配圖描述");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
      messages: [
        { role: "system", content: instruction },
        { role: "user", content: body },
      ],
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`產生配圖描述失敗（${res.status}）`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = (json.choices?.[0]?.message?.content || "").trim();
  if (!text) throw new Error("產生配圖描述失敗：模型沒有回傳內容");
  return text;
}

async function requestImage(model: string, prompt: string): Promise<Buffer> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("後台沒有設定 OPENAI_API_KEY，無法生成圖片");
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, size: "1024x1536", quality: "medium", n: 1 }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    let detail = "";
    try {
      const j = (await res.json()) as { error?: { message?: string } };
      detail = j.error?.message || "";
    } catch {
      // 非 JSON 回應，維持空字串
    }
    throw new Error(`圖片服務回應 ${res.status}${detail ? "：" + detail.slice(0, 160) : ""}`);
  }
  const json = (await res.json()) as { data?: { b64_json?: string }[] };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("圖片服務沒有回傳圖片內容");
  return Buffer.from(b64, "base64");
}

/** 先用設定的模型，失敗再退回 gpt-image-1 一次 */
export async function generateImageBuffer(prompt: string): Promise<{ buffer: Buffer; model: string }> {
  const primary = process.env.IMAGE_MODEL || "gpt-image-2.5-flare";
  try {
    return { buffer: await requestImage(primary, prompt), model: primary };
  } catch (first) {
    if (primary === "gpt-image-1") throw first;
    try {
      return { buffer: await requestImage("gpt-image-1", prompt), model: "gpt-image-1" };
    } catch {
      throw first;
    }
  }
}

/** 置中裁成 4:5 並轉成 JPEG（Instagram 只接受 JPEG） */
export async function toInstagramJpeg(input: Buffer): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  return sharp(input)
    .resize(OUTPUT_WIDTH, OUTPUT_HEIGHT, { fit: "cover", position: "centre" })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
}

async function ensureBucket(url: string, key: string): Promise<void> {
  const res = await fetch(`${url}/storage/v1/bucket`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify({ id: IMAGE_BUCKET, name: IMAGE_BUCKET, public: true, file_size_limit: 8_000_000, allowed_mime_types: ["image/jpeg"] }),
    signal: AbortSignal.timeout(20_000),
  });
  // 已存在會回 400 或 409，不算錯
  if (!res.ok && res.status !== 400 && res.status !== 409) {
    throw new Error(`建立圖片儲存桶失敗（${res.status}）`);
  }
}

/** 上傳 JPEG，回傳公開網址 */
export async function uploadPublicJpeg(buffer: Buffer, brand: BrandKey | string): Promise<string> {
  const env = getSupabaseEnv();
  if (!env) throw new Error("後台沒有設定 Supabase 連線資訊，無法存放圖片");
  const base = env.url.replace(/\/$/, "");
  await ensureBucket(base, env.key);
  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `${brand}/${stamp}-${rand}.jpg`;
  const res = await fetch(`${base}/storage/v1/object/${IMAGE_BUCKET}/${path}`, {
    method: "POST",
    headers: { apikey: env.key, Authorization: `Bearer ${env.key}`, "Content-Type": "image/jpeg", "x-upsert": "false" },
    body: new Uint8Array(buffer),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`上傳圖片失敗（${res.status}）`);
  return `${base}/storage/v1/object/public/${IMAGE_BUCKET}/${path}`;
}
