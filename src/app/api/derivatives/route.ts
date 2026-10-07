import { NextRequest, NextResponse } from "next/server";
import { DERIVATIVE_PLATFORM_ORDER, DERIVATIVE_PROMPT_VERSION, carryMissingMarkers, checkPlainText, deriveChecks, derivativeLanguages, ensureScienceMarker, formatDerivativeContent, isDerivativesEnabled, shouldSkipSciencePlatform, stableParentId, validateDerivativePayload } from "@/lib/derivatives-core.mjs";
import { chooseKnowledgeSource, generatePlatformPayload } from "@/lib/derivatives-ai";
import { derivativesDb, getRulesFor, getSpecFor, readDerivativeCatalog, upsertDerivativeRows } from "@/lib/derivatives-server";
import { inspectForPublish } from "@/lib/brand-guardrail";
import { stripDashes, stripMarkdown } from "@/lib/plain-text";

const BRANDS = new Set(["brand_a_i8", "brand_b_nas", "brand_c_abl", "personal_brand"]);
const EDITABLE_SPEC_FIELDS = new Set(["max_text_length", "title_max_length", "image_aspect_ratios", "image_dimensions", "carousel_max", "hashtag_guidance", "video_duration", "video_aspect_ratios", "max_file_size", "ai_label_requirement", "source_urls", "status", "field_status", "notes"]);
const EDITABLE_RULE_FIELDS = new Set(["description", "blocked_terms", "source_urls", "enabled", "block_available"]);

function disabled() {
  return NextResponse.json({ enabled: false, error: "多平台衍生功能尚未啟用。" }, { status: 404 });
}

function safeMessage(error: unknown) {
  return (error instanceof Error ? error.message : String(error))
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[已遮蔽]")
    .replace(/\bAIzaSy[A-Za-z0-9_-]{8,}\b/g, "[已遮蔽]")
    .replace(/Bearer\s+\S+/gi, "Bearer [已遮蔽]")
    .replace(/[\r\n\t]+/g, " ").slice(0, 400);
}

function validProviderOverride(value: unknown): string | undefined {
  if (typeof value !== "string" || !/^(openai|anthropic|gemini)(?::[A-Za-z0-9._-]{1,64})?$/.test(value)) return undefined;
  return value;
}

export async function GET(request: NextRequest) {
  if (!isDerivativesEnabled()) return disabled();
  if (request.nextUrl.searchParams.get("summary") === "1") return NextResponse.json({ enabled: true });
  try {
    return NextResponse.json({ enabled: true, ...(await readDerivativeCatalog()) });
  } catch (error) {
    return NextResponse.json({ enabled: true, error: safeMessage(error) }, { status: 503 });
  }
}

/** 僅建立衍生草稿，不呼叫既有生成、健檢、排程、發佈或流水線端點。 */
export async function POST(request: NextRequest) {
  if (!isDerivativesEnabled()) return disabled();
  try {
    const body = await request.json();
    const parent = body?.parent;
    const selected: string[] = Array.isArray(body?.platforms)
      ? [...new Set<string>(body.platforms.filter((value: unknown): value is string => typeof value === "string"))]
      : [];
    const providerOverride = validProviderOverride(body?.provider);
    if (!parent || typeof parent.content !== "string" || !parent.content.trim() || parent.content.length > 80_000) {
      return NextResponse.json({ error: "母文章內容無效或超過 80,000 字。" }, { status: 400 });
    }
    if (!BRANDS.has(parent.brandId) || selected.length < 1 || selected.some((platform: string) => !DERIVATIVE_PLATFORM_ORDER.includes(platform))) {
      return NextResponse.json({ error: "請選擇有效品牌與至少一個支援的平台。" }, { status: 400 });
    }

    const catalog = await readDerivativeCatalog();
    const skipped: Array<{ platform: string; reason: string }> = [];
    const eligible = selected.filter((platform: string) => {
      if (shouldSkipSciencePlatform(platform, parent.content)) {
        skipped.push({ platform, reason: "此母文章主題不適合科普頻道，請改用心理或行為角度的母文章。" });
        return false;
      }
      return true;
    });
    if (!eligible.length) return NextResponse.json({ success: true, created: [], skipped, failures: [] });

    const needScienceSource = eligible.some((platform: string) => platform === "小紅書" || platform === "抖音");
    const source = needScienceSource ? await chooseKnowledgeSource(parent.content, providerOverride, parent.content) : { note: null, content: "", citation: null, directory: [] };
    const generationId = crypto.randomUUID();
    const rows: any[] = [];
    const failures: Array<{ platform: string; language_version: string; error: string }> = [];

    // 逐平台、逐語言序列執行，任一稿失敗不影響其他草稿。
    for (const platform of eligible) {
      for (const languageVersion of derivativeLanguages(platform)) {
        try {
          const useScienceSource = platform === "小紅書" || platform === "抖音";
          const generated = await generatePlatformPayload({ platform, languageVersion, parentText: parent.content, source: useScienceSource ? source : { note: null, content: "", citation: null, directory: [] }, providerOverride });
          if (!validateDerivativePayload(platform, generated.payload || {})) throw new Error("模型輸出結構不完整，未保存此平台草稿。請重新產生。");
          let content = formatDerivativeContent(platform, languageVersion, generated.payload || {});
          content = stripDashes(stripMarkdown(content));
          content = carryMissingMarkers(parent.content, content);
          let sourceValid = false;
          if (platform === "小紅書" || platform === "抖音") {
            const citationTitle = generated.payload?.citation_title;
            const citationAuthor = generated.payload?.citation_author;
            const bodySourceMentions = [...content.matchAll(/《([^》]+)》/g)].map((match) => match[1].trim());
            const unselectedTitleMentions = source.directory.filter((entry) => entry.title !== source.citation?.title && entry.title && content.includes(entry.title));
            const unselectedAuthorMentions = source.directory.filter((entry) => entry.author !== source.citation?.author && entry.author && content.includes(entry.author));
            const citationLine = source.citation ? `出處：${source.citation.title}，${source.citation.author}` : "";
            const citationIsPlainText = !checkPlainText(citationLine).length;
            sourceValid = !!source.citation && citationTitle === source.citation.title && citationAuthor === source.citation.author && bodySourceMentions.every((title) => title === source.citation?.title) && !unselectedTitleMentions.length && !unselectedAuthorMentions.length && citationIsPlainText;
            if (sourceValid && source.citation) content = `${content}\n出處：${source.citation.title}，${source.citation.author}`;
            else content = ensureScienceMarker(content, false);
          }
          const guardrail = inspectForPublish(content, parent.brandId);
          const specFormat = platform === "Threads" ? "單則文字貼文" : platform === "IG" ? "輪播" : platform === "Reel" ? "Reel" : platform === "YT" ? "長片文字稿綱" : platform === "小紅書" ? "圖文筆記" : "圖文";
          const checkResults = deriveChecks({
            parentText: parent.content, content, platform, languageVersion,
            rules: getRulesFor(catalog.rules, platform, languageVersion),
            spec: getSpecFor(catalog.specs, platform, specFormat),
            existingGuardrailPassed: guardrail.passed,
          });
          rows.push({
            generation_id: generationId,
            parent_article_id: stableParentId(parent.brandId, parent.sourcePlatform || "social_copy", parent.content),
            parent_brand_id: parent.brandId,
            platform,
            format: platform === "Threads" ? "單則與串文" : platform === "IG" ? "說明與輪播" : platform === "Reel" ? "動態圖文腳本" : platform === "YT" ? "Shorts與長片稿綱" : platform === "小紅書" ? "圖文筆記與輪播" : "動態圖文",
            language_version: languageVersion,
            content,
            check_results: { ...checkResults, source_valid: sourceValid, source_required: platform === "小紅書" || platform === "抖音" },
            status: checkResults.blockers.length ? "needs_review" : "draft",
            model_version: generated.modelVersion,
            prompt_version: DERIVATIVE_PROMPT_VERSION,
            source_note_id: sourceValid ? source.note?.id || null : null,
            source_content_md5: sourceValid ? source.note?.content_md5 || null : null,
          });
        } catch (error) {
          failures.push({ platform, language_version: languageVersion, error: safeMessage(error) });
        }
      }
    }
    const created = rows.length ? await upsertDerivativeRows(rows) : [];
    return NextResponse.json({ success: failures.length === 0, generation_id: generationId, created, skipped, failures });
  } catch (error) {
    return NextResponse.json({ error: safeMessage(error) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!isDerivativesEnabled()) return disabled();
  try {
    const body = await request.json();
    if (body.action === "save-spec" || body.action === "save-rule") {
      const table = body.action === "save-spec" ? "platform_specs" : "platform_content_rules";
      const fields = body.action === "save-spec" ? EDITABLE_SPEC_FIELDS : EDITABLE_RULE_FIELDS;
      if (typeof body.id !== "string" || !body.id) return NextResponse.json({ error: "缺少設定項目 ID。" }, { status: 400 });
      const safeUpdate = Object.fromEntries(Object.entries(body.values || {}).filter(([key]) => fields.has(key)));
      safeUpdate.updated_at = new Date().toISOString();
      const rows = await derivativesDb<any[]>(table, `id=eq.${encodeURIComponent(body.id)}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(safeUpdate) });
      return rows[0] ? NextResponse.json({ success: true, row: rows[0] }) : NextResponse.json({ error: "找不到設定資料。" }, { status: 404 });
    }
    if (typeof body.id !== "string" || !body.id) return NextResponse.json({ error: "缺少衍生稿 ID。" }, { status: 400 });
    const currentRows = await derivativesDb<any[]>("derivative_posts", `id=eq.${encodeURIComponent(body.id)}&limit=1`);
    const current = currentRows[0];
    if (!current) return NextResponse.json({ error: "找不到衍生稿。" }, { status: 404 });
    const nextContent = typeof body.content === "string" ? body.content : current.content;
    const storedMarkers = Array.isArray(current.check_results?.required_markers) ? current.check_results.required_markers.join("\n") : "";
    const parentText = `${storedMarkers}\n${nextContent}`;
    const guardrail = inspectForPublish(nextContent, current.parent_brand_id);
    const catalog = await readDerivativeCatalog();
    if (body.action === "make-available" && body.humanConfirmed !== true) return NextResponse.json({ error: "標記可用前必須完成頁面上的人工確認。" }, { status: 400 });
    const checkResults = deriveChecks({
      parentText, content: nextContent, platform: current.platform, languageVersion: current.language_version,
      rules: getRulesFor(catalog.rules, current.platform, current.language_version),
      spec: getSpecFor(catalog.specs, current.platform, current.format), existingGuardrailPassed: guardrail.passed,
      humanConfirmed: body.action === "make-available" && body.humanConfirmed === true,
    });
    if (body.action === "make-available" && checkResults.blockers.length) return NextResponse.json({ error: "仍有阻擋項目，不能標為可用。", check_results: checkResults }, { status: 422 });
    const status = body.action === "make-available" ? "available" : checkResults.blockers.length ? "needs_review" : "draft";
    const rows = await derivativesDb<any[]>("derivative_posts", `id=eq.${encodeURIComponent(body.id)}`, {
      method: "PATCH", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ content: nextContent, check_results: checkResults, status, human_confirmed_at: body.action === "make-available" ? new Date().toISOString() : current.human_confirmed_at, updated_at: new Date().toISOString() }),
    });
    return NextResponse.json({ success: true, row: rows[0] });
  } catch (error) {
    return NextResponse.json({ error: safeMessage(error) }, { status: 500 });
  }
}
