// 自動流水線的多平台延伸：以 FB 最終稿為母稿，改寫 IG 與 Threads 版本、渲染輪播圖卡、
// 排入 Threads / Instagram 佇列，並同步產生官網文章（取得 article_id 給 FB 首則留言連結）。
// 設計原則：
// 1. 三個平台與官網都從同一份母稿出發，觀點與事實一致，只改格式與長度。
// 2. 任何一個平台失敗，不影響其他平台，也不影響已排好的 FB。失敗只回報，不自動重發。
// 3. 預設關閉：Render 環境變數 AUTO_MULTIPLATFORM_ENABLED=true 才會執行。
// 只給伺服器端使用。

import { callSeoOptimizer, callWebArticle } from "@/lib/ai-provider";
import { checkText, inspectForPublish, resolveBrandContext } from "@/lib/brand-guardrail";
import { stripDashes, stripMarkdown } from "@/lib/plain-text";
import { buildFaqJsonLd, faqToPlainText } from "@/lib/seo-optimizer";
import { articleUpdateUrl, existingArticleQuery, pickExistingId } from "@/lib/publish-dedupe";
import { withCoverImage } from "@/lib/article-image.mjs";
import { CAROUSEL_TARGET_MAX, parseSlidesJson, sanitizeSlides, splitArticleToSlides } from "@/lib/carousel-slides.mjs";
import { renderCardJpeg } from "@/lib/card-render-server";
import { completeText, uploadPublicJpeg } from "@/lib/social-image-server";
import { applyMechanicalFixes, BRAND_AS_SUBJECT, gateBlockers, gateMessage, runQualityGate } from "@/lib/quality-gate";

export const THREADS_MAX = 500;
export const INSTAGRAM_MAX = 2200;
const THREADS_TARGET = 460;
const INSTAGRAM_TARGET = 1800;

const FULL_BRAND_IDS: Record<string, string> = { nas: "brand_b_nas", abl: "brand_c_abl", i8: "brand_a_i8" };

export function isMultiplatformEnabled(): boolean {
  return process.env.AUTO_MULTIPLATFORM_ENABLED === "true";
}

function offsetMs(envName: string, fallbackMinutes: number): number {
  const parsed = Number.parseInt(process.env[envName] || "", 10);
  const minutes = Number.isFinite(parsed) && parsed >= 0 && parsed <= 24 * 60 ? parsed : fallbackMinutes;
  return minutes * 60 * 1000;
}

/** FB 預定時間往後推：IG 預設 +2 小時（10:10 變 12:10），Threads 預設 +10 小時（變 20:10）。 */
export function platformTimes(fbIso: string): { instagram: string; threads: string } {
  const base = new Date(fbIso).getTime();
  return {
    instagram: new Date(base + offsetMs("AUTO_IG_OFFSET_MIN", 120)).toISOString(),
    threads: new Date(base + offsetMs("AUTO_THREADS_OFFSET_MIN", 600)).toISOString(),
  };
}

/** 在句號、問號、驚嘆號或換行處截斷，不硬砍在句子中間。 */
export function trimAtBoundary(text: string, max: number): string {
  const clean = text.trim();
  if (clean.length <= max) return clean;
  const slice = clean.slice(0, max);
  const cut = Math.max(slice.lastIndexOf("。"), slice.lastIndexOf("？"), slice.lastIndexOf("！"), slice.lastIndexOf("\n"));
  return (cut >= max * 0.5 ? slice.slice(0, cut + (slice[cut] === "\n" ? 0 : 1)) : slice).trim();
}

const clean = (text: string): string => applyMechanicalFixes(stripDashes(stripMarkdown(String(text || ""))).replace(/【[^】]*】/g, "").trim()).text;

const SYSTEM_DERIVE =
  "你是社群編輯。下面是一篇已定稿的 Facebook 貼文（繁體中文），請把同一份內容改寫成 Threads、Instagram 說明文字和 Instagram 輪播圖卡文字。" +
  "原則：三個版本必須和原文是同一個觀點、同一組事實，只改格式與長度，不可新增原文沒有的觀點、數字、案例或承諾，不可改變原文立場。" +
  "Threads 版：約 400 到 460 字，第一句就是鉤子，口語，一口氣讀完，結尾留一句讓人想回覆的話。" +
  "Instagram 說明版：約 900 到 1500 字，第一行是鉤子（會被截斷預覽，要在前面就吸引人），段落短，保留原文的故事與論點。" +
  "輪播圖卡：5 到 7 張，第 1 張是封面鉤子（改寫，不要只複製標題），中間每張只講一個重點，最後一張是溫和收尾或一個問題。每張不超過 40 字，一到兩句，口語。" +
  "說話的人：只能是艾瑞克的第一人稱，或不指名的客觀陳述，品牌名稱不可以當主詞去認為、相信、陪伴、提供、協助，也不可以用「我們」替品牌發言，原文若有這類句子要改寫掉。" +
  "全部文字：不可出現任何破折號（——、—、─、-），不可出現 Markdown 符號（# * 等），不可出現【】標記或括號註記，不要加主題標籤，停頓用逗號或句號。不可用立刻、保證、一定會這類催促或絕對說法。" +
  '只輸出 JSON：{"threads":"...","instagram":"...","slides":["...","..."]}，不要其他說明。';

export interface DerivedVersions {
  threads: string;
  instagram: string;
  slides: string[];
  source: "ai" | "fallback";
  note: string;
}

function parseDerived(raw: string): { threads: string; instagram: string; slides: string[] } | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const json = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
    if (typeof json.threads !== "string" || typeof json.instagram !== "string" || !Array.isArray(json.slides)) return null;
    return { threads: json.threads, instagram: json.instagram, slides: json.slides.map(String) };
  } catch {
    return null;
  }
}

/** 從母稿改寫 Threads、IG 與輪播文字。AI 失敗時退回機械式截斷與切段，仍然來自同一份母稿。 */
export async function deriveVersions(master: string): Promise<DerivedVersions> {
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await completeText(SYSTEM_DERIVE, master.slice(0, 6000), 3000);
      const parsed = parseDerived(raw);
      if (!parsed) { lastError = "AI 回傳格式無法解析"; continue; }
      const threads = trimAtBoundary(clean(parsed.threads), THREADS_MAX - 20);
      const instagram = trimAtBoundary(clean(parsed.instagram), INSTAGRAM_MAX - 100);
      const slides = sanitizeSlides(parsed.slides.map(clean), CAROUSEL_TARGET_MAX);
      if (threads.length < 40 || instagram.length < 80 || slides.length < 2) { lastError = "AI 回傳內容太短或張數不足"; continue; }
      return { threads, instagram, slides, source: "ai", note: "" };
    } catch (error) {
      lastError = error instanceof Error ? error.message.slice(0, 120) : "改寫失敗";
    }
  }
  const base = clean(master);
  return {
    threads: trimAtBoundary(base, THREADS_TARGET),
    instagram: trimAtBoundary(base, INSTAGRAM_TARGET),
    slides: splitArticleToSlides(base, CAROUSEL_TARGET_MAX),
    source: "fallback",
    note: `AI 改寫失敗，改用機械式截斷（${lastError}）`,
  };
}

/** 渲染輪播圖卡（IG 貼文 4:5，1080x1350）並上傳到 Supabase 公開儲存桶，回傳公開網址。 */
export async function renderSlideUrls(brandShort: string, slides: string[]): Promise<string[]> {
  const brandId = ({ nas: "brand_b_nas", abl: "brand_c_abl", i8: "brand_a_i8" } as Record<string, string>)[brandShort] || "personal_brand";
  const urls: string[] = [];
  for (let i = 0; i < slides.length; i++) {
    const jpeg = await renderCardJpeg({ brandId, text: slides[i], index: i + 1, total: slides.length, sceneDataUri: null, size: "ig_feed" });
    urls.push(await uploadPublicJpeg(jpeg, brandShort));
  }
  return urls;
}

interface SupabaseEnv { url: string; key: string }
const authHeaders = (env: SupabaseEnv): Record<string, string> => ({
  "Content-Type": "application/json", apikey: env.key, Authorization: `Bearer ${env.key}`, Prefer: "return=representation",
});

/** 寫入 Threads / IG 佇列。新欄位（job_id、article_id、image_urls）尚未建立時，退回不帶新欄位的寫入。 */
async function enqueueSocial(env: SupabaseEnv, row: Record<string, unknown>): Promise<string> {
  const attempt = async (body: Record<string, unknown>) =>
    fetch(`${env.url}/rest/v1/social_publish_queue`, { method: "POST", headers: authHeaders(env), body: JSON.stringify(body), signal: AbortSignal.timeout(30_000) });
  let res = await attempt(row);
  if (!res.ok && res.status === 400) {
    const text = await res.clone().text();
    if (/job_id|article_id|image_urls|experiment_json|column/i.test(text)) {
      const { job_id: _job, article_id: _article, experiment_json: _experiment, ...rest } = row;
      void _job; void _article; void _experiment;
      res = await attempt(rest);
    }
  }
  if (!res.ok) throw new Error(`寫入排程失敗（${res.status}）：${(await res.text()).slice(0, 160)}`);
  const rows = await res.json();
  const id = Array.isArray(rows) ? rows[0]?.id : rows?.id;
  if (!id) throw new Error("排程已寫入但沒有取得編號");
  return String(id);
}

export interface PlatformOutcome { ok: boolean; id?: string; error?: string; scheduledAt?: string; slides?: number }

export interface MultiplatformInput {
  env: SupabaseEnv;
  jobId: string;
  brandShort: "nas" | "abl" | "i8";
  brandName: string;
  master: string;
  fbScheduledAt: string;
  fbQueueId: string;
  coverUrl: string | null;
  /** 成效回流實驗標籤：寫進 Threads / IG 排程列，之後成效才能對回是哪個結構臂 */
  experiment?: { experiment_id: string; variable: string; arm: string };
}

export interface MultiplatformResult {
  derived: { source: string; note: string };
  instagram: PlatformOutcome;
  threads: PlatformOutcome;
  website: PlatformOutcome & { articleId?: string };
}

const safe = (error: unknown): string => (error instanceof Error ? error.message : String(error)).replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[已遮蔽]").replace(/Bearer\s+\S+/gi, "Bearer [已遮蔽]").slice(0, 200);

/** 找出品牌名稱當主詞的句子（最多 3 句、每句截 60 字），給重寫要求用。 */
function brandVoiceSentences(article: string): string[] {
  return String(article || "").split(/(?<=[。！？\n])/).map((line) => line.trim()).filter((line) => line && BRAND_AS_SUBJECT.test(line)).slice(0, 3).map((line) => line.slice(0, 60));
}

/** 官網文章：母稿改寫成文章，SEO / AEO 優化，上架，回傳 article_id。優化版含紅線詞時保留未優化版。 */
async function publishWebsite(input: MultiplatformInput, forceArticleId?: string): Promise<{ articleId: string }> {
  const { env, brandShort, brandName, master, coverUrl } = input;
  const fullBrand = FULL_BRAND_IDS[brandShort];
  const provider = process.env.AI_PROVIDER;
  let written = await callWebArticle(master, brandName, [], undefined, provider);
  if (written.is_local_check) throw new Error("AI 服務未啟用，無法產生官網文章");
  // 品牌名稱不可當主詞發言：發現就帶著問題句子要求重寫，最多再試兩次
  for (let attempt = 0; attempt < 2; attempt++) {
    const offending = brandVoiceSentences(written.article);
    if (!offending.length) break;
    written = await callWebArticle(
      `${master}\n\n【修改要求，不是原文】上一版出現品牌名稱當主詞的句子：${offending.join("｜")}。請全文重寫，這些句子改成艾瑞克的第一人稱或不指名的客觀陳述，品牌名稱全文最多出現一次且只當地點或服務名稱，標題也不要讓品牌名稱當主詞。`,
      brandName, [], undefined, provider,
    );
  }
  let article = clean(written.article);
  if (article.length < 120) throw new Error("官網文章內容太短");
  let faqText = "";
  let schemaText = "";
  try {
    const optimized = await callSeoOptimizer(article, brandName, [], provider);
    const optimizedText = clean(optimized.optimized_content);
    const faq = (optimized.faq || []).map((item) => ({ q: stripMarkdown(item.q), a: stripMarkdown(item.a) }));
    const context = resolveBrandContext(fullBrand);
    const hits = [
      ...checkText(optimizedText, context).violatedWords,
      ...checkText(faq.map((item) => `${item.q}${item.a}`).join("\n"), context).violatedWords,
    ];
    if (optimizedText.length >= 120 && hits.length === 0 && !BRAND_AS_SUBJECT.test(optimizedText)) {
      article = optimizedText;
      // FAQ 與結構化資料只用「這一篇」優化結果組出，避免沿用上一篇的內容
      faqText = faq.length ? faqToPlainText(faq) : "";
      schemaText = faq.length ? buildFaqJsonLd(faq, optimized.title, optimized.meta_description) : "";
    }
  } catch (error) {
    console.warn("[auto-multiplatform] SEO 優化失敗，使用未優化的官網文章：", safe(error));
  }
  if (coverUrl) article = withCoverImage(article, coverUrl);
  const guard = inspectForPublish(article, fullBrand, "warm");
  if (!guard.passed) throw new Error(`官網文章未通過品牌紅線：${guard.violatedWords.slice(0, 5).join("、")}`);
  const webGate = gateBlockers(runQualityGate(article.replace(/!\[[^\]]*\]\([^)]*\)/g, ""), { platform: "website", master }));
  if (webGate.length) throw new Error(`官網文章品管未通過：${gateMessage(webGate)}`);

  const lines = article.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const titleLine = lines.find((line) => !/^!\[/.test(line)) || "未命名文章";
  const title = titleLine.replace(/^#+\s*/, "").replace(/[#*_]/g, "").trim() || "未命名文章";
  const row = { brand_id: brandShort, title, content: article, aeo_schema: schemaText, aeo_faq: faqText ? stripMarkdown(faqText) : "", status: "published" };

  let existingId: string | null = forceArticleId || null;
  if (!forceArticleId) {
    try {
      const existing = await fetch(existingArticleQuery(env.url, brandShort, title), { headers: { apikey: env.key, Authorization: `Bearer ${env.key}` }, signal: AbortSignal.timeout(20_000) });
      existingId = existing.ok ? pickExistingId(await existing.json()) : null;
    } catch { existingId = null; }
  }
  const res = await fetch(existingId ? articleUpdateUrl(env.url, existingId) : `${env.url}/rest/v1/insights_articles`, {
    method: existingId ? "PATCH" : "POST", headers: authHeaders(env), body: JSON.stringify(row), signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`官網寫入失敗（${res.status}）：${(await res.text()).slice(0, 160)}`);
  const data = await res.json();
  const id = Array.isArray(data) ? data[0]?.id : data?.id;
  if (id === undefined || id === null) throw new Error("官網已寫入但沒有取得文章編號");
  return { articleId: String(id) };
}

/** 用新規則重寫既有官網文章（同一個 article_id，網址與 FB 留言連結不變）。失敗時舊文章保持原樣。 */
export async function rewriteWebsiteArticle(input: Pick<MultiplatformInput, "env" | "brandShort" | "brandName" | "master" | "coverUrl"> & { articleId: string }): Promise<{ articleId: string }> {
  return publishWebsite({ ...input, jobId: "", fbScheduledAt: "", fbQueueId: "" }, input.articleId);
}

/** 把官網文章編號寫回 FB 排程，讓 FB 首則留言帶官網連結。 */
async function linkArticleToFacebookQueue(env: SupabaseEnv, queueId: string, articleId: string): Promise<void> {
  const res = await fetch(`${env.url}/rest/v1/publish_queue?id=eq.${encodeURIComponent(queueId)}&status=eq.pending`, {
    method: "PATCH", headers: authHeaders(env), body: JSON.stringify({ article_id: articleId, updated_at: new Date().toISOString() }), signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`官網連結寫回 FB 排程失敗（${res.status}）`);
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) throw new Error("FB 排程已不是待發狀態，沒有寫入官網連結");
}

/**
 * 主流程。每個平台獨立 try，互不影響。回傳每個平台的結果，由呼叫端決定要通知什麼。
 * 順序：官網（取得連結）→ 改寫 → 圖卡 → IG → Threads。
 */
export async function runMultiplatform(input: MultiplatformInput): Promise<MultiplatformResult> {
  const { env, jobId, brandShort, master, fbScheduledAt } = input;
  const fullBrand = FULL_BRAND_IDS[brandShort];
  const times = platformTimes(fbScheduledAt);
  const result: MultiplatformResult = {
    derived: { source: "none", note: "" },
    instagram: { ok: false }, threads: { ok: false }, website: { ok: false },
  };

  let articleId: string | undefined;
  try {
    const site = await publishWebsite(input);
    articleId = site.articleId;
    await linkArticleToFacebookQueue(env, input.fbQueueId, articleId);
    result.website = { ok: true, articleId, id: articleId };
  } catch (error) {
    result.website = { ok: false, error: safe(error), ...(articleId ? { articleId } : {}) };
  }

  let derived: DerivedVersions | null = null;
  try {
    derived = await deriveVersions(master);
    result.derived = { source: derived.source, note: derived.note };
  } catch (error) {
    const message = safe(error);
    result.instagram = { ok: false, error: `改寫失敗：${message}` };
    result.threads = { ok: false, error: `改寫失敗：${message}` };
    return result;
  }

  let imageUrls: string[] = [];
  let imageError = "";
  try {
    const slideBlocks = derived.slides.flatMap((slide) => gateBlockers(runQualityGate(slide, { platform: "slide" })));
    if (slideBlocks.length) throw new Error(`圖卡文字品管未通過：${gateMessage(slideBlocks)}`);
    imageUrls = await renderSlideUrls(brandShort, derived.slides);
  } catch (error) {
    imageError = safe(error);
  }

  // Instagram：一定要有圖，圖卡失敗就不發（不發沒有圖的 IG）
  try {
    if (imageUrls.length < 2) throw new Error(`輪播圖卡失敗：${imageError || "張數不足"}`);
    const content = derived.instagram;
    if (content.length > INSTAGRAM_MAX) throw new Error("IG 說明超過 2200 字");
    const guard = inspectForPublish(content, fullBrand, "warm");
    if (!guard.passed) throw new Error(`未通過品牌紅線：${guard.violatedWords.slice(0, 5).join("、")}`);
    const gate = gateBlockers(runQualityGate(content, { platform: "instagram", master }));
    if (gate.length) throw new Error(`品管未通過：${gateMessage(gate)}`);
    const id = await enqueueSocial(env, {
      platform: "instagram", brand: brandShort, content, image_url: imageUrls[0], image_urls: imageUrls,
      scheduled_at: times.instagram, status: "pending", job_id: jobId, ...(articleId ? { article_id: articleId } : {}),
      ...(input.experiment ? { experiment_json: input.experiment } : {}),
    });
    result.instagram = { ok: true, id, scheduledAt: times.instagram, slides: imageUrls.length };
  } catch (error) {
    result.instagram = { ok: false, error: safe(error) };
  }

  // Threads：有輪播就帶輪播，圖卡失敗時退回純文字（Threads 允許純文字）
  try {
    const content = derived.threads;
    if (content.length > THREADS_MAX) throw new Error("Threads 超過 500 字");
    const guard = inspectForPublish(content, fullBrand, "warm");
    if (!guard.passed) throw new Error(`未通過品牌紅線：${guard.violatedWords.slice(0, 5).join("、")}`);
    const gate = gateBlockers(runQualityGate(content, { platform: "threads", master }));
    if (gate.length) throw new Error(`品管未通過：${gateMessage(gate)}`);
    const withImages = imageUrls.length >= 2;
    const id = await enqueueSocial(env, {
      platform: "threads", brand: brandShort, content,
      image_url: withImages ? imageUrls[0] : null, ...(withImages ? { image_urls: imageUrls } : {}),
      scheduled_at: times.threads, status: "pending", job_id: jobId, ...(articleId ? { article_id: articleId } : {}),
      ...(input.experiment ? { experiment_json: input.experiment } : {}),
    });
    result.threads = { ok: true, id, scheduledAt: times.threads, slides: withImages ? imageUrls.length : 0 };
    if (!withImages) result.threads.error = `Threads 改為純文字：${imageError || "圖卡不足"}`;
  } catch (error) {
    result.threads = { ok: false, error: safe(error) };
  }
  return result;
}

/** 給 current_step 與 Telegram 用的簡短摘要 */
export function summarize(result: MultiplatformResult): { step: string; problems: string[] } {
  const problems: string[] = [];
  const label = (name: string, outcome: PlatformOutcome) => {
    if (!outcome.ok) { problems.push(`${name}：${outcome.error || "失敗"}`); return `${name}失敗`; }
    if (outcome.error) problems.push(`${name}：${outcome.error}`);
    return `${name}已排程`;
  };
  if (result.derived.note) problems.push(result.derived.note);
  const parts = [label("官網", result.website), label("IG", result.instagram), label("Threads", result.threads)];
  return { step: `已排程，未審（FB、${parts.join("、")}）`, problems };
}
