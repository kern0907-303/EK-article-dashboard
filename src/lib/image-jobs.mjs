// 本機 ComfyUI 生圖工作的純函式：提示詞（不呼叫 LLM、不花 token）、在線判斷、輸入檢查。
// 不依賴伺服器環境，方便單獨測試；資料庫存取在 image-jobs-server.ts。

export const JOB_STATUSES = ["pending", "running", "done", "failed", "cancelled"];
export const JOB_PURPOSES = ["card", "article"];

/** Mac mini 小程式每 60 秒回報一次；超過這個秒數沒回報就當作離線。 */
export const WORKER_ONLINE_SECONDS = 150;

/** 品牌的畫面氛圍（英文，給生圖模型）。顏色取自各品牌參考圖的色系。 */
export const BRAND_SCENE_STYLE = {
  brand_c_abl: "serene and peaceful atmosphere about rest and inner balance, soft diffused light, calm teal and soft white tones",
  brand_b_nas: "warm gentle atmosphere about self-understanding, soft light, quiet and hopeful, soft plum and warm cream tones",
  brand_a_i8: "calm modern business atmosphere, clean composition, soft natural light, muted deep blue and white tones",
  personal_brand: "quiet thoughtful atmosphere, soft light, deep teal and navy tones, minimal and calm",
};

/** 場景變化：同一品牌每次抽不同場景，避免每張底圖都一樣。 */
export const SCENE_VARIANTS = [
  "an empty wooden desk by a window with morning light and a single plant",
  "a calm lake surface at dawn with soft mist",
  "gentle fabric folds in soft light, abstract and minimal",
  "a quiet path through tall grass at golden hour, shallow depth of field",
  "soft clouds and sky gradient, wide empty space",
  "smooth stones stacked on a table, soft shadow, minimal",
  "a window with sheer curtains moving slightly, diffused daylight",
  "abstract flowing watercolor shapes, gentle gradients, no objects",
];

export const NEGATIVE_PROMPT = "text, letters, words, watermark, logo, signature, people, face, hands, busy background, high contrast";

export function brandSceneStyle(brandId) {
  return BRAND_SCENE_STYLE[brandId] || BRAND_SCENE_STYLE.personal_brand;
}

/** 用 seed 穩定地挑一個場景（同一個 seed 得到同一個場景，方便重現）。 */
export function pickScene(seed) {
  const n = Math.abs(Number.isFinite(Number(seed)) ? Math.trunc(Number(seed)) : 0);
  return SCENE_VARIANTS[n % SCENE_VARIANTS.length];
}

/** 組出正向與負向提示詞。圖上不放字：文字由儀表板另外疊上去。 */
export function buildComfyPrompt({ brandId, seed }) {
  const prompt = `${pickScene(seed)}, ${brandSceneStyle(brandId)}, soft muted colors, large calm empty areas for text overlay, photographic, high quality, no text`;
  return { prompt, negative: NEGATIVE_PROMPT };
}

export function randomSeed() {
  return Math.floor(Math.random() * 2147483647);
}

/** Mac mini 是否在線：seenAt 是 ISO 時間字串或 Date。 */
export function isWorkerOnline(seenAt, now = Date.now(), maxAgeSeconds = WORKER_ONLINE_SECONDS) {
  if (!seenAt) return false;
  const t = typeof seenAt === "number" ? seenAt : new Date(seenAt).getTime();
  if (!Number.isFinite(t)) return false;
  return now - t <= maxAgeSeconds * 1000;
}

/** 檢查建立工作的輸入，回傳 { ok, error?, value? }。sizeKeys 由呼叫端傳入（避免這裡依賴版面檔）。 */
export function validateJobInput(input, sizeKeys) {
  const brandId = typeof input?.brandId === "string" ? input.brandId : "";
  const sizeKey = typeof input?.sizeKey === "string" ? input.sizeKey : "";
  const purpose = input?.purpose === "article" ? "article" : "card";
  if (!brandId) return { ok: false, error: "缺少品牌。" };
  if (!sizeKeys.includes(sizeKey)) return { ok: false, error: "不支援的尺寸。" };
  return { ok: true, value: { brandId, sizeKey, purpose } };
}

/** 工作的顯示狀態（給畫面的中文）。 */
export function jobStatusLabel(status) {
  return { pending: "等待 Mac mini 領單", running: "Mac mini 生成中", done: "已完成", failed: "失敗", cancelled: "已取消" }[status] || status;
}
