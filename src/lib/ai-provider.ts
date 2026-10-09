import { ChatMessage, TheoAnalysis, ReachKillerItem } from "./storage";
import { stripMarkdown, stripDashes } from "@/lib/plain-text";
import { friendlyLeonError, hasUsableSocialCopy, LEON_GENERATION_OPTIONS } from "@/lib/expert-routing";
import { buildGenrePrompt, PROMPT_VERSION, type GenreSettings, type BrandKey } from "@/data/skills/genres";
import { getBrandConversion } from "@/data/brands/conversion";
import { I8_BRAND_CONTEXT } from "../data/brands/i8";
import { NAS_BRAND_CONTEXT, NAS_WRITING_PROMPT } from "../data/brands/nas";
import { ABL_BRAND_CONTEXT } from "../data/brands/abl";
import { ERICK_BRAND_CONTEXT } from "../data/brands/erick";
import { ERICK_PERSONA_SKILL } from "../data/brands/persona";
import { COPYWRITING_FRAMEWORKS } from "../data/skills/frameworks";
import { buildStoryArgumentPrompt, isStoryArgumentCitationEligible, normalizeStoryArgumentCopy, resolveStoryArgumentThesis, shouldIncludeMayaDiagram, STORY_ARGUMENT_PROMPT_VERSION, type StoryArgumentReselectRequest, type StoryArgumentSelection } from "../data/skills/story-argument";
import { applyValidatedKnowledgeCitation, selectRelevantKnowledgeContent, type KnowledgeNoteRecord } from "@/lib/knowledge-note-utils";
import { getKnowledgeNoteById, getKnowledgeNoteDirectory, getKnowledgeNoteSelectionDirectory } from "@/lib/knowledge-notes-server";
import { chooseStoryArgumentNote, replaceStoryArgumentSupportParagraph } from "@/lib/story-argument-reselection";

// Erick COO Router System Prompt (OpenAI)
export const ERICK_SYSTEM_PROMPT = `你是一個人工智慧團隊總指揮「Erick 營運長」(COO)。
你負責將使用者的戰略指令或營運目標進行邏輯拆解，並指派任務給右側的四位 AI 專家。你必須為他們生成具體的「子提示詞」(Sub-prompts)：
1. **Maya** (社群行銷專家，產出「社群文案」 -> 提示其撰寫純文字格式文案，禁止包含任何 ** 或 # 等 Markdown 符號，最開頭第一行必須是聳動且完整的文章主標題，標題與內文以空行或換行區隔，適合直接複製貼上到 Facebook 等社群平台)
2. **Leon** (系統架構師，產出「網頁架構」)
3. **Iris** (SEO 專家，產出「SEO關鍵字」)
4. **Jack** (廣告數據分析師，產出「廣告數據」)

### 標題優化指引 (極重要)：
- 當使用者給予的文章主題、任務目標或參考標題中包含「...」或有字數截斷現象時，你作為總指揮，**必須主動在指派給 Maya 的子提示詞中，將該標題補全為一個「完整、聳動、具有極高點閱張力」的文章主標題**，絕對禁止直接將帶有「...」或被截斷的半殘標題傳遞給專家！

### 任務傳遞與內容留存指引 (極重要)：
- 如果使用者在輸入指令中提及了具體的「文案內容要求」、「分析框架」、「特定段落」、「名詞解釋」（例如：必須包含氣場、經絡、身體、情緒、理智、精神等層次的分析，或是要求特定的寫作方向與重點），你作為總指揮，**必須百分之百完整地保留這些細節要求，並將其明確地寫入指派給對應專家（特別是 Maya 與 Iris）的子提示詞中**。絕對禁止過度簡化或將這些關鍵細節概括抹除，否則專家將無法產出符合使用者要求的主題內容！

### 回覆規範 (為了避免伺服器超時，必須極其精簡)：
1. **角色口吻**：專業、有洞察力、果斷的營運長 (COO)。用繁體中文回覆。
2. **任務拆解與指派**：在你的回覆文字中，以【極簡短】的 2-3 句話（不超過 80 字）向使用者說明你如何拆解任務並指派工作給四位專家，不要囉唆，不要生成冗長的前言。
3. **子提示詞輸出格式 (關鍵)**：
   你必須在回覆的最尾端，附帶一個符合 JSON 格式的代碼區塊，其中包含為每位專家量身訂做的具體任務指派（子提示詞）。
   子提示詞必須非常詳細，包含具體的品牌定位調性、背景與產出格式要求。
   你的 JSON 區塊必須是唯一的，且以 \`\`\`json 開始，以 \`\`\` 結束。

JSON 格式如下：

\`\`\`json
{
  "sub_prompts": {
    "maya": "Maya 的子提示詞（包含品牌背景、文案要求與目標）",
    "leon": "Leon 的子提示詞（包含網站架構、功能路由設計要求，並指定輸出 Markdown 樹狀大綱）",
    "iris": "Iris 的子提示詞（要求分析相關關鍵字，且必須包含 outline 大綱欄位，指定輸出 JSON 格式）",
    "jack": "Jack 的子提示詞（要求產出 ROAS、CPA、轉換率等廣告數據，指定輸出 JSON 格式）"
  }
}
\`\`\`

注意：
- **每一次回覆的最尾端，都必須輸出此 JSON 代碼區塊**，這是指派任務給後續專家的唯一依據！
- 請確保 JSON 語法完全正確。`;

export interface AIServiceResponse {
  content: string;
  dispatchData?: any; // 解析出來的 dispatch JSON 物件
}

function getTimeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

export interface AIProviderConfig {
  provider: string;
  apiKey?: string;
  geminiApiKey?: string;
  anthropicApiKey?: string;
  model?: string;
  geminiModel?: string;
  anthropicModel?: string;
  webhookUrl?: string;
}

// 取得當前設定
export function getAIConfig(): AIProviderConfig {
  return {
    provider: process.env.AI_PROVIDER || "mock",
    apiKey: process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY || "",
    geminiApiKey: process.env.GEMINI_API_KEY || "",
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
    model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
    geminiModel: process.env.GEMINI_MODEL || "gemini-flash-latest",
    anthropicModel: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
    webhookUrl: process.env.N8N_WEBHOOK_URL || "",
  };
}

/**
 * 下拉選單的值可以是 "openai" 或 "openai:gpt-6.1-sol" 這種「廠商:模型」寫法。
 * 這裡把它拆開：回傳廠商名稱，並在有指定模型時覆蓋 config.model（只限 OpenAI）。
 */
export function resolveProvider(config: AIProviderConfig, override?: string): string {
  const raw = override || config.provider;
  const idx = raw.indexOf(":");
  if (idx === -1) return raw;
  const provider = raw.slice(0, idx);
  const model = raw.slice(idx + 1).trim();
  if (provider === "openai" && /^[A-Za-z0-9._-]{1,64}$/.test(model)) config.model = model;
  return provider;
}

function extractJSONAt(text: string, start: number): string | null {
  const stack: string[] = [];
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const char = text[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (char === '\\') {
      escape = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '{' || char === '[') stack.push(char);
      else if (char === '}' || char === ']') {
        const opener = stack.pop();
        if ((char === '}' && opener !== '{') || (char === ']' && opener !== '[')) return null;
        if (stack.length === 0) return text.substring(start, i + 1);
      }
    }
  }

  return null;
}

export function extractFirstCompleteJSON(text: string): string | null {
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '{' && text[i] !== '[') continue;
    const candidate = extractJSONAt(text, i);
    if (!candidate) continue;
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      // 有些前置說明也會含括號；繼續找下一個完整且有效的 JSON。
    }
  }
  return null;
}

export function robustJSONParse(text: string): any {
  const clean = text.trim();
  const fenced = [...clean.matchAll(/```(?:json)?\s*([\s\S]*?)(?:```|$)/gi)]
    .map(match => match[1].trim())
    .filter(Boolean);

  for (const candidate of [...fenced, clean]) {
    try {
      return JSON.parse(candidate);
    } catch {
      const extracted = extractFirstCompleteJSON(candidate);
      if (extracted) return JSON.parse(extracted);
    }
  }

  throw new Error(`JSON 格式錯誤 (原始長度: ${text.length})`);
}

type AIResponseReport = {
  label?: string;
  provider?: string;
  model?: string;
  httpStatus?: number;
  finishReason?: string;
  responsePreview?: string;
};

type ProviderCallOptions = { maxTokens?: number; timeoutMs?: number; report?: AIResponseReport };

function safeResponsePreview(text: string): string {
  return text
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[REDACTED_API_KEY]")
    .replace(/\bAIzaSy[A-Za-z0-9_-]{8,}\b/g, "[REDACTED_API_KEY]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [REDACTED]")
    .slice(0, 300)
    .replace(/[\r\n\t]+/g, " ");
}

function logAIParseFailure(label: string, error: unknown, report?: AIResponseReport, responseText = ""): void {
  console.error(`[AI_JSON_PARSE_FAILURE] ${JSON.stringify({
    label,
    provider: report?.provider || "unknown",
    model: report?.model || "unknown",
    http_status: report?.httpStatus,
    finish_reason: report?.finishReason || "unknown",
    error: error instanceof Error ? error.message : String(error),
    response_preview: safeResponsePreview(responseText || report?.responsePreview || ""),
  })}`);
}

function logAIModelResult(report?: AIResponseReport): void {
  if (!report) return;
  console.info(`[AI_MODEL_RESULT] ${JSON.stringify({
    label: report.label || "AI",
    provider: report.provider || "unknown",
    model: report.model || "unknown",
    http_status: report.httpStatus,
    finish_reason: report.finishReason || "unknown",
  })}`);
}

function providerHTTPError(provider: string, model: string, status: number, body: string): Error {
  let detail = body;
  try {
    const parsed = JSON.parse(body);
    detail = parsed?.error?.message || parsed?.message || body;
  } catch {}
  detail = safeResponsePreview(detail);

  const lower = detail.toLowerCase();
  let cause = `${provider} API HTTP ${status}`;
  if (status === 429 || /quota|rate.?limit|billing|resource exhausted/.test(lower)) cause = `${provider} 額度不足或請求頻率受限 (HTTP ${status})`;
  else if (status === 400 && /model|not found|does not exist|invalid/.test(lower)) cause = `${provider} 模型名稱或請求格式無效 (HTTP ${status})`;
  else if (status === 401 || status === 403) cause = `${provider} API 驗證或權限錯誤 (HTTP ${status})`;
  return new Error(`${cause}，模型 ${model}：${detail}`);
}

function normalizeAIError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/HTTP 429|quota|rate.?limit|billing|resource exhausted/i.test(message)) return `服務額度不足或達到頻率限制。${message}`;
  if (/HTTP 400|model.*(invalid|not found|does not exist)|model_not_found/i.test(message)) return `模型名稱或 API 請求格式無效。${message}`;
  if (/HTTP 401|HTTP 403|authentication|unauthorized|forbidden/i.test(message)) return `供應商驗證或權限錯誤。${message}`;
  if (/截斷|finish_reason=length|MAX_TOKENS|max_tokens/i.test(message)) return `模型回覆達到長度上限。${message}`;
  return message;
}

async function runQueryWithFallback(
  prompt: string,
  config: AIProviderConfig,
  jsonMode?: boolean,
  preferredProvider?: "openai" | "gemini" | "anthropic",
  opts?: ProviderCallOptions
): Promise<string> {
  const isOpenAIKeyValid = !!(config.apiKey && config.apiKey.trim().startsWith("sk-"));
  const isGeminiKeyValid = !!((config.geminiApiKey || process.env.GEMINI_API_KEY) && 
    (config.geminiApiKey || process.env.GEMINI_API_KEY || "").trim().startsWith("AIzaSy"));
  const isAnthropicKeyValid = !!((config.anthropicApiKey || process.env.ANTHROPIC_API_KEY) && 
    (config.anthropicApiKey || process.env.ANTHROPIC_API_KEY || "").trim().startsWith("sk-ant-"));
    
  const providersToTry: string[] = [];
  const primaryProvider = preferredProvider || config.provider || "openai";
  
  if (primaryProvider === "gemini") {
    providersToTry.push("gemini", "openai", "anthropic");
  } else if (primaryProvider === "anthropic") {
    providersToTry.push("anthropic", "openai", "gemini");
  } else {
    providersToTry.push("openai", "gemini", "anthropic");
  }

  const validProviders = providersToTry.filter(p => {
    if (p === "openai") return isOpenAIKeyValid;
    if (p === "gemini") return isGeminiKeyValid;
    if (p === "anthropic") return isAnthropicKeyValid;
    return false;
  });

  if (validProviders.length === 0) {
    throw new Error("沒有可用的 AI 金鑰 (OpenAI、Gemini 與 Anthropic 金鑰均無效)");
  }

  let lastError: any = null;
  for (const provider of validProviders) {
    try {
      console.log(`[runQueryWithFallback] Attempting ${provider}...`);
      if (opts?.report) {
        opts.report.provider = provider;
        opts.report.model = provider === "openai" ? config.model || "gpt-5.4-mini" : provider === "gemini" ? config.geminiModel || "gemini-flash-latest" : (config.anthropicModel || process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6");
      }
      if (provider === "gemini") {
        return await callGemini([{ role: "user", content: prompt }], config, jsonMode, opts);
      } else if (provider === "openai") {
        return await callOpenAI([{ role: "user", content: prompt }], config, jsonMode, opts);
      } else if (provider === "anthropic") {
        return await callAnthropic([{ role: "user", content: prompt }], config, opts);
      }
    } catch (err: any) {
      console.error(`[runQueryWithFallback] ${provider} failed:`, err);
      lastError = err;
    }
  }

  throw new Error(`所有可用 AI 服務均呼叫失敗。最後一個錯誤為: ${lastError?.message || lastError}`);
}

async function resolveStoryArgumentKnowledge(
  selection: StoryArgumentSelection,
  topic: string,
  config: AIProviderConfig
): Promise<{ required: boolean; note: KnowledgeNoteRecord | null; content: string }> {
  const citationMode = selection.citationMode || "auto";
  const required = selection.version === "full" && citationMode !== "none";
  if (!required) return { required: false, note: null, content: "" };

  if (citationMode === "selected") {
    if (!selection.noteId?.trim()) throw new Error("指定書籍模式請先選擇一筆中文資料已確認的筆記。");
    const selected = await getKnowledgeNoteById(selection.noteId);
    if (!isStoryArgumentCitationEligible(selected)) {
      throw new Error("指定書籍的中文書名與作者尚未確認，請改選已確認的筆記。");
    }
    return { required, note: selected, content: selectRelevantKnowledgeContent(selected.content, topic, 20_000) };
  }

  try {
    let note: KnowledgeNoteRecord | null = null;
    if (citationMode === "auto") {
      const directory = (await getKnowledgeNoteDirectory()).filter(isStoryArgumentCitationEligible);
      if (directory.length > 0) {
        // 只把中文書目與分類交給選書模型，全文只在選定後由伺服器讀取。
        const catalog = directory.map(({ id, title_zh, author_zh, domain, subdomain }) => ({ id, title_zh, author_zh, domain, subdomain }));
        const selectionPrompt = [
          "請從以下知識筆記目錄挑選一本最貼近使用者主題且有中文書名與作者的筆記。目錄不含全文。若沒有明確合適的筆記，回傳 {\"matched\":false}，不要硬選。",
          "若有合適筆記，只回傳 JSON：{\"matched\":true,\"id\":\"目錄中的 id\"}。",
          `文章主題與任務：${topic.slice(0, 10000)}`,
          `可選目錄：${JSON.stringify(catalog)}`,
        ].join("\n\n");
        const response = await runQueryWithFallback(selectionPrompt, config, true, "anthropic", { maxTokens: 1200, timeoutMs: 60000 });
        const parsed = robustJSONParse(response);
        const candidate = directory.find((entry) => parsed?.matched === true && parsed?.id === entry.id);
        if (candidate) {
          const fetched = await getKnowledgeNoteById(candidate.id);
          if (isStoryArgumentCitationEligible(fetched)) note = fetched;
        }
      }
    }
    return { required, note, content: note ? selectRelevantKnowledgeContent(note.content, topic, 20_000) : "" };
  } catch (error) {
    console.warn("故事論點引用來源選取或讀取失敗，文章將保留引用待補標記。", error instanceof Error ? error.message : "unknown error");
    return { required, note: null, content: "" };
  }
}

async function resolveReselectionKnowledge(
  selection: StoryArgumentSelection,
  request: StoryArgumentReselectRequest,
  config: AIProviderConfig
): Promise<{ note: KnowledgeNoteRecord | null; error: "no_matching_note" | "no_available_notes" | "selection_failed" | null; topic: string }> {
  const excludedNoteIds = Array.isArray(request.excludeNoteIds)
    ? request.excludeNoteIds.filter((id): id is string => typeof id === "string")
    : [];
  const topic = request.idea.trim() || selection.thesis || request.currentCopy;
  try {
    const directory = await getKnowledgeNoteSelectionDirectory();
    if (!directory.length) return { note: null, error: "no_matching_note", topic };
    if (request.mode === "candidate" && request.selectedNoteId) {
      const explicit = chooseStoryArgumentNote(directory, [], request.selectedNoteId);
      const note = explicit ? await getKnowledgeNoteById(explicit.id) : null;
      return { note: isStoryArgumentCitationEligible(note) ? note : null, error: isStoryArgumentCitationEligible(note) ? null : "no_matching_note", topic };
    }

    const excludedSourceFiles = directory
      .filter((entry) => excludedNoteIds.includes(entry.id))
      .map((entry) => entry.source_file);
    const eligible = directory.filter((entry) => chooseStoryArgumentNote([entry], excludedSourceFiles) !== null);
    if (!eligible.length) return { note: null, error: "no_available_notes", topic };
    const catalog = eligible.map(({ id, title_zh, author_zh, domain, subdomain }) => ({ id, title_zh, author_zh, domain, subdomain }));
    const selectionPrompt = [
      "你是故事論點框架的知識來源挑選器。僅依據目錄欄位判斷是否有筆記能支持使用者的想法，不得憑記憶補充來源。",
      "若沒有明確合適的筆記，回傳 {\"matched\":false}，不要硬選。若有，只回傳 {\"matched\":true,\"id\":\"目錄中的 id\"}。只輸出 JSON。",
      `使用者的想法（只作挑選依據，不得放入文章）：${topic.slice(0, 3000)}`,
      `可選目錄：${JSON.stringify(catalog)}`,
    ].join("\n\n");
    const raw = await runQueryWithFallback(selectionPrompt, config, true, "anthropic", { maxTokens: 1200, timeoutMs: 60000 });
    const parsed = robustJSONParse(raw);
    if (!parsed || parsed.matched !== true) return { note: null, error: "no_matching_note", topic };
    const candidate = eligible.find((entry) => parsed.id === entry.id);
    if (!candidate) return { note: null, error: "no_matching_note", topic };
    const note = await getKnowledgeNoteById(candidate.id);
    if (!isStoryArgumentCitationEligible(note)) return { note: null, error: "no_matching_note", topic };
    return { note, error: null, topic };
  } catch (error) {
    console.warn("故事論點重新選書失敗。", error instanceof Error ? error.message : "unknown error");
    return { note: null, error: "selection_failed", topic };
  }
}

async function callStoryArgumentReselection(
  brandContext: string,
  config: AIProviderConfig,
  selection: StoryArgumentSelection,
  request: StoryArgumentReselectRequest
): Promise<AIServiceResponse> {
  if (selection.version !== "full") throw new Error("共情版不強制引用，不能使用重新挑選引用。");
  if (!request || typeof request.idea !== "string" || typeof request.currentCopy !== "string" || !Array.isArray(request.excludeNoteIds)) {
    throw new Error("故事論點重新挑選引用的輸入格式不正確。");
  }
  if (request.mode !== "auto" && request.mode !== "candidate") throw new Error("重新挑選引用模式不正確。");
  if (request.mode === "candidate" && !request.selectedNoteId) throw new Error("請先選擇一筆引用候選。");

  const resolved = await resolveReselectionKnowledge(selection, request, config);
  const activeSelection: StoryArgumentSelection = {
    ...selection,
    citationMode: "selected",
    ...(resolved.note ? { noteId: resolved.note.id } : {}),
  };
  const noteContent = resolved.note
    ? selectRelevantKnowledgeContent(resolved.note.content, resolved.topic, 20_000)
    : "";
  if (!resolved.note) {
    const missing = applyValidatedKnowledgeCitation(
      request.rewriteFull ? request.currentCopy : "",
      "", "", null, true
    );
    const socialCopy = request.rewriteFull
      ? normalizeStoryArgumentCopy(missing.content, selection.thesis)
      : replaceStoryArgumentSupportParagraph(request.currentCopy, missing.content, false, selection.thesis);
    return {
      content: "",
      dispatchData: {
        social_copy: socialCopy,
        citation_error: resolved.error || "no_matching_note",
        story_argument_meta: {
          ...selection,
          prompt_version: STORY_ARGUMENT_PROMPT_VERSION,
          knowledge_note_id: null,
          knowledge_content_md5: null,
          citation_title: null,
          citation_author: null,
          citation_valid: false,
          citation_error: resolved.error || "no_matching_note",
        },
      },
    };
  }

  const notePrompt = { title_zh: resolved.note.title_zh, author_zh: resolved.note.author_zh, zh_status: resolved.note.zh_status, content: noteContent };
  const basePrompt = buildStoryArgumentPrompt(activeSelection, { knowledgeNote: notePrompt, citationRequired: true });
  const taskPrompt = request.rewriteFull
    ? [
        basePrompt,
        "【重新挑選引用，全文重寫】依照既有故事論點框架重寫全文，只以目前文章與本次讀入筆記為事實依據。保留原有核心論點，不要把使用者想法原句複製進文章。使用者想法只作為論點支持挑選依據，不是輸出內容。",
        `使用者想法（不得照抄到文章）：${request.idea.trim() || "未提供"}`,
        `目前文章（只供保留原有主題與事實）：\n<current_article>\n${request.currentCopy}\n</current_article>`,
      ].join("\n\n")
    : [
        `【故事論點框架，僅重寫論點支持段】使用者想法只作為本次支持論點與挑選筆記的指令，不得照抄或放入輸出。\n${request.idea.trim() ? `使用者想法：${request.idea.trim()}` : "使用者未補充想法，依原文章論點重新挑選支持內容。"}`,
        `原文章論點：${selection.thesis}`,
        `原文章（僅供理解論點與故事，不得重寫或輸出）：\n<current_article>\n${request.currentCopy}\n</current_article>`,
        `唯一可用的知識筆記全文節錄：\n<knowledge_note_excerpt>\n${noteContent}\n</knowledge_note_excerpt>`,
        `請只依筆記內容產出一段「論點支持」，只含一個概念，包含引用、白話轉譯、回扣故事。引用只能使用「作者欄位原文在《title_zh 欄位原文》提出」句型，使用 ${activeSelection.noteId} 所代表筆記的 title_zh 與 author_zh。不得輸出出處行；伺服器會驗證後補上。引用欄位即使含英文字母也必須逐字保留；引用以外的內容不得另加英文姓名或書名。不得輸出評價詞、Markdown 符號或破折號。若筆記沒有可驗證的來源，不得改用其他來源或自行翻譯。`,
        "只輸出 JSON：{\"support_paragraph\":\"單一論點支持段\",\"citation_title\":\"知識庫 title_zh\",\"citation_author\":\"知識庫 author_zh\"}。citation_title 與 citation_author 必須逐字填入所附筆記的 title_zh 與 author_zh 欄位。",
      ].join("\n\n");

  const raw = await runQueryWithFallback(`${brandContext}\n\n${taskPrompt}`, config, true, "anthropic", { maxTokens: 12000, timeoutMs: 120000 });
  const result = robustJSONParse(raw);
  const generatedCopy = request.rewriteFull ? result?.social_copy : result?.support_paragraph;
  if (typeof generatedCopy !== "string" || !generatedCopy.trim()) throw new Error("重新挑選引用的模型回覆缺少文章或論點支持段。");
  const citation = applyValidatedKnowledgeCitation(
    generatedCopy,
    result.citation_title,
    result.citation_author,
    resolved.note,
    true
  );
  const socialCopy = request.rewriteFull
    ? normalizeStoryArgumentCopy(citation.content, selection.thesis)
    : replaceStoryArgumentSupportParagraph(request.currentCopy, citation.content, false, selection.thesis);
  const meta = {
    ...selection,
    citationMode: "selected" as const,
    noteId: resolved.note.id,
    prompt_version: STORY_ARGUMENT_PROMPT_VERSION,
    knowledge_note_id: resolved.note.id,
    knowledge_content_md5: resolved.note.content_md5,
    citation_title: citation.citationTitle,
    citation_author: citation.citationAuthor,
    citation_valid: citation.valid,
    citation_error: null,
  };
  return { content: "", dispatchData: { social_copy: socialCopy, story_argument_meta: meta, citation_error: null } };
}

async function fetchLiveKeywordMetrics(keywords: string[]): Promise<any[]> {
  const dseoLogin = process.env.DATAFORSEO_API_LOGIN;
  const dseoPassword = process.env.DATAFORSEO_API_PASSWORD;

  // 1. 優先嘗試對接 DataForSEO (Google Ads API 平替，極度省錢)
  if (dseoLogin && dseoPassword && !dseoLogin.includes("YOUR_")) {
    try {
      const auth = Buffer.from(`${dseoLogin}:${dseoPassword}`).toString("base64");
      const url = "https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live";
      
      const payload = [{
        keywords: keywords.slice(0, 10),
        location_name: "Taiwan",
        language_name: "Chinese (Traditional)"
      }];

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${auth}`
        },
        body: JSON.stringify(payload),
        signal: getTimeoutSignal(3000)
      });

      if (res.ok) {
        const json = await res.json();
        const taskResult = json.tasks?.[0]?.result;
        if (Array.isArray(taskResult)) {
          return taskResult.map((item: any) => {
            const vol = item.search_volume !== undefined ? String(item.search_volume) : "0";
            const compRaw = String(item.competition || "").toUpperCase();
            const competition = compRaw === "HIGH" ? "高" : (compRaw === "MEDIUM" ? "中" : "低");
            return {
              keyword: item.keyword,
              volume: vol,
              competition,
              outline: `已成功與 DataForSEO (Google Ads) 連線對齊。地區: 台灣`
            };
          });
        }
      }
    } catch (e) {
      console.error("DataForSEO fetch error:", e);
    }
  }

  // 2. 次要嘗試對接 SEMrush
  const apiKey = process.env.SEMRUSH_API_KEY;
  if (apiKey && !apiKey.includes("YOUR_")) {
    try {
      const results = [];
      for (const kw of keywords.slice(0, 5)) {
        const url = `https://api.semrush.com/?type=phrase_this&key=${apiKey}&phrase=${encodeURIComponent(kw)}&database=tw&export_columns=Ph,Nq,Cp`;
        const res = await fetch(url, { signal: getTimeoutSignal(3000) });
        if (res.ok) {
          const text = await res.text();
          const lines = text.trim().split("\n");
          if (lines.length > 1) {
            const parts = lines[1].split(";");
            results.push({
              keyword: kw,
              volume: parts[1] || "300",
              competition: parseFloat(parts[2]) > 0.7 ? "高" : (parseFloat(parts[2]) > 0.3 ? "中" : "低"),
              outline: "已與 SEMrush 台灣關鍵字資料庫對齊..."
            });
            continue;
          }
        }
        results.push({ keyword: kw, volume: "320", competition: "中", outline: "SEMrush 查無此字..." });
      }
      return results;
    } catch (e) {
      console.error("SEMrush fetch error:", e);
    }
  }

  // 3. 無金鑰時自動降級模擬
  return keywords.map(kw => ({
    keyword: kw,
    volume: String(Math.floor(Math.random() * 8000) + 500),
    competition: Math.random() > 0.6 ? "高" : (Math.random() > 0.3 ? "中" : "低"),
    outline: "免 Key 體驗模式，大綱計算中..."
  }));
}

async function fetchMetaAdAccountInsights(adAccountId: string, accessToken: string): Promise<any[]> {
  if (!adAccountId || !accessToken || adAccountId.includes("YOUR_")) {
    return [];
  }
  
  try {
    const url = `https://graph.facebook.com/v19.0/${adAccountId}/insights?fields=spend,clicks,impressions,actions&date_preset=last_30d`;
    const res = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${accessToken}`
      },
      signal: getTimeoutSignal(3000)
    });
    if (res.ok) {
      const data = await res.json();
      const insights = data.data?.[0];
      if (insights) {
        const spend = parseFloat(insights.spend || "0");
        const impressions = parseInt(insights.impressions || "0");
        
        const actions = insights.actions || [];
        const leads = actions.find((a: any) => a.action_type === 'lead')?.value || "0";
        const conversions = parseInt(leads);
        
        const cpa = conversions > 0 ? `$${(spend / conversions).toFixed(2)}` : "$0.00";
        const cvr = impressions > 0 ? `${((conversions / impressions) * 100).toFixed(2)}%` : "0.00%";
        
        return [
          { label: "廣告總花費 (Spend)", value: `$${spend.toLocaleString()}`, change: "實體後台同步", isPositive: true },
          { label: "單次取得名單成本 (CPA)", value: cpa, change: "實體後台同步", isPositive: true },
          { label: "名單預約轉換率 (CVR)", value: cvr, change: "實體後台同步", isPositive: true },
          { label: "廣告曝光次數 (Impressions)", value: impressions.toLocaleString(), change: "實體後台同步", isPositive: true }
        ];
      }
    }
    return [];
  } catch (e) {
    console.error("Meta Marketing API error:", e);
    return [];
  }
}

function getBrandColorsForPrompt(brandName: string) {
  const isI8 = brandName.includes("I8") || brandName.includes("brand_a");
  const isAbl = brandName.includes("ABL") || brandName.includes("brand_c");
  const isNas = brandName.includes("NAS") || brandName.includes("brand_b");

  if (isI8) {
    return {
      name: "I8 (Initial 8 CO.)",
      colorName: "海軍深藍 (Navy Deep Blue)",
      hexPrimary: "#1e3a8a",
      hexAccent: "#3b82f6",
      tailwindClasses: "主色：海軍藍 (bg-blue-900 / text-blue-100)，輔助色：靛藍色 (text-indigo-400) 或深藍 (slate-900)"
    };
  } else if (isAbl) {
    return {
      name: "ABL (量子調頻)",
      colorName: "蒂芬妮藍 (Tiffany Blue)",
      hexPrimary: "#0abab5",
      hexAccent: "#22d3ee",
      tailwindClasses: "主色：蒂芬妮藍 (bg-cyan-500 / text-cyan-950)，輔助色：深青色 (text-cyan-400 / border-cyan-500/20) 或湖綠色"
    };
  } else if (isNas) {
    return {
      name: "NAS (平衡空間)",
      colorName: "神秘紫 (Mysterious Purple)",
      hexPrimary: "#7c3aed",
      hexAccent: "#c084fc",
      tailwindClasses: "主色：神秘紫 (bg-purple-900 / text-purple-100)，輔助色：紫色 (text-purple-400 / border-purple-500/20) 或深紫"
    };
  } else {
    // Personal Erick
    return {
      name: "Erick 個人品牌",
      colorName: "金色 (Gold)",
      hexPrimary: "#d4af37",
      hexAccent: "#f59e0b",
      tailwindClasses: "主色：金色/琥珀色 (bg-amber-500 / text-amber-950)，輔助色：橘黃色 (text-amber-400 / border-amber-500/20)"
    };
  }
}

/**
 * 核心 AI 雙模型協作調度路由
 */
const NO_DASH_LAYOUT_RULE = `【絕對禁止破折號】全文任何位置都不可出現破折號或橫線符號，包含「——」「—」「–」「─」「━」「--」。這一條優先於前面所有品牌範例與語氣示範（範例裡若有破折號，一律不要模仿）。不可當分隔線，不可標記小標，也不可用在句子中間。需要停頓、補充或轉折時，一律改用逗號、句號，或直接拆成兩句。段落之間只用空行分隔，小標寫成單獨一行的純文字，行首不加任何符號。`;

export async function callErickCOO(
  history: ChatMessage[],
  brandName: string,
  overrideProvider?: string,
  stage?: string,
  expertType?: string,
  subPromptsInput?: any,
  brandGuidelines?: string,
  prevData?: any,
  platform?: string,
  copywritingFramework?: string,
  genre?: { settings: GenreSettings; brandKey: BrandKey },
  storyArgument?: StoryArgumentSelection,
  storyReselection?: StoryArgumentReselectRequest
): Promise<AIServiceResponse> {
  const config = getAIConfig();
  const provider = resolveProvider(config, overrideProvider);
  config.provider = provider; // 確保專家端能讀取到目前選用的 Provider
  const brandColors = getBrandColorsForPrompt(brandName);
  const activePlatform = platform || "threads";
  
  if (provider === "mock") {
    if (stage === "story_argument_reselect") {
      throw new Error("故事論點重新挑選引用需要可用的 AI 供應商，mock 模式不會呼叫模型。");
    }
    if (stage === "adapt") {
      const sourceCopy = prevData?.social_copy || "";
      const targetPlatform = platform || "threads";
      const keywords = prevData?.seo_keywords ? JSON.stringify(prevData.seo_keywords) : "";
      
      let mockAdapted = "";
      if (sourceCopy) {
        mockAdapted = `【MOCK 改寫 - ${targetPlatform.toUpperCase()}】\n這是根據原有文案改寫為符合 ${targetPlatform.toUpperCase()} 規格的內容：\n\n${sourceCopy}\n\n#mock_${targetPlatform}`;
      } else {
        mockAdapted = `【MOCK 生成 - ${targetPlatform.toUpperCase()}】\n這是根據關鍵字：${keywords} 全新生成的符合 ${targetPlatform.toUpperCase()} 規格的內容。\n\n#mock_${targetPlatform}`;
      }
      return {
        content: "",
        dispatchData: {
          social_copy: mockAdapted
        }
      };
    }
    if (stage === "expert" && expertType === "leon") {
      if (!hasUsableSocialCopy(prevData?.social_copy)) throw new Error("請先生成社群文案，再生成網頁架構。");
      return {
        content: "",
        dispatchData: {
          web_architecture: `<div class="min-h-screen bg-slate-950 text-white p-8"><section class="mx-auto max-w-4xl py-24"><p class="text-amber-400">${brandName}</p><h1 class="mt-4 text-4xl font-bold">${prevData.social_copy.slice(0, 90)}</h1><p class="mt-6 text-slate-300">本地模擬預覽，尚未呼叫 AI 服務。</p></section></div>`,
          visual_direction: { theme: "本地模擬預覽" },
        },
      };
    }
    if (stage === "expert" && expertType === "jack") {
      return {
        content: "",
        dispatchData: {
          ad_data: [{ label: "模擬曝光", value: "本地預覽", change: "未呼叫模型", isPositive: true }],
          ad_strategy_notes: "本地模擬模式未呼叫廣告模型。",
        },
      };
    }
    const mockResult = await callMockCOO(history[history.length - 1]?.content || "", brandName);
    const parsed = parseCOOOutput(mockResult);
    if (stage === "coo") {
      return {
        content: parsed.content,
        dispatchData: {
          subPrompts: { mockData: parsed.dispatchData }
        }
      };
    }
    return parsed;
  }

  const isI8Brand = brandName.includes("I8") || brandName.includes("brand_a");
  let brandContext = `當前切換的品牌/領域是：【${brandName}】。請確保所有對話與產出完全符合此品牌的調性，並隔離其他品牌的資訊。`;

  if (brandGuidelines && brandGuidelines.trim().length > 0) {
    brandContext += "\n\n【品牌定位與知識大腦規範】：\n" + brandGuidelines;
  } else {
    const isI8 = isI8Brand;
    const isAbl = brandName.includes("ABL") || brandName.includes("brand_c");
    const isNas = brandName.includes("NAS") || brandName.includes("brand_b");

    if (isI8) {
      brandContext += "\n\n" + I8_BRAND_CONTEXT;
    } else if (isNas) {
      brandContext += "\n\n" + NAS_BRAND_CONTEXT + "\n\n" + NAS_WRITING_PROMPT;
    } else if (isAbl) {
      brandContext += "\n\n" + ABL_BRAND_CONTEXT;
    } else if (brandName.includes("個人") || brandName.includes("personal") || brandName.includes("Erick")) {
      brandContext += "\n\n" + ERICK_BRAND_CONTEXT;
    }
  }

  // I8 的現行對外文章規格優先於瀏覽器 LocalStorage 中的舊品牌大腦。
  // 這確保部署後每一次 I8 產稿都會先帶入使用者指定的寫作與事實邊界。
  if (isI8Brand) {
    brandContext += "\n\n【I8 現行必遵守的對外內容規格，優先於其他 I8 文字】：\n" + I8_BRAND_CONTEXT;
  }

  const frameworkData = copywritingFramework ? COPYWRITING_FRAMEWORKS[copywritingFramework] : null;
  if (frameworkData && frameworkData.promptContext) {
    brandContext += "\n\n" + frameworkData.promptContext;
  }

  // 全品牌、全路徑通用：最後再提醒一次（放在最後，模型最容易遵守）
  brandContext += "\n\n" + NO_DASH_LAYOUT_RULE;

  if (stage === "story_argument_reselect") {
    if (!storyArgument || !storyReselection) throw new Error("缺少故事論點重新挑選引用資料。");
    return callStoryArgumentReselection(brandContext, config, storyArgument, storyReselection);
  }

  if (stage === "adapt") {
    const currentCopy = prevData?.social_copy || "";
    const targetPlatform = platform || "threads";
    
    let platformInstructions = "";
    if (targetPlatform === "threads") {
      platformInstructions = `1. 完全使用繁體中文(台灣)，文章字數嚴格限制在 500 字以內，建議 200-400 字，結構短小精悍。
2. 【最嚴格限制】：絕對禁止使用任何 Markdown 格式符號（包含但不限於 **粗體**, #標題, ---分隔線等）。社群平台不支援這些語法！文案必須是「純淨文字」，僅能用換行與表情符號排版，連粗體黑體都不能有！
3. 最開頭第一行必須是聳動、具備極強互動感、痛點共鳴或好奇心缺口的文章主標題，標題與內文以換行區隔，適合直接貼到 Threads。
4. 嚴禁在文案正文中包含任何外部連結 (HTTP/HTTPS URL)，如果是改寫，請將其改寫為「詳細連結我放在留言區第一則了」。
5. 語意風格親切口語，像跟朋友分享，多用痛點句和好奇心 Hook。結尾 Hashtags 只能挑選 0-2 個。`;
    } else if (targetPlatform === "instagram") {
      platformInstructions = `1. 完全使用繁體中文(台灣)，文章字數限制在 2200 字以內，但請以視覺體驗優先，排版要保持極高的舒適度。
2. 【最嚴格限制】：絕對禁止使用任何 Markdown 格式符號（包含但不限於 **粗體**, #標題, ---分隔線等）。社群平台不支援這些語法！文案必須是「純淨文字」，僅能用換行與表情符號排版，連粗體黑體都不能有！
3. 每段之間多用合適且高質感的表情符號 (Emojis) 進行引導與分隔。
4. 嚴禁在正文中放入無法點擊的網址。請在貼文末尾引導讀者點擊「個人檔案首頁連結 (Link in Bio)」或「私訊小盒子」。
5. 最開頭第一行必須是吸睛的文章主標題，標題與內文以換行區隔。結尾必須包含 5-15 個高度相關的標籤（Hashtags）。`;
    } else {
      // Facebook
      platformInstructions = `1. 完全使用繁體中文(台灣)，文章字數 800 至 1500 字左右，適合進行深度痛點共鳴與說書解析。
2. 最開頭第一行必須是聳動且完整的文章主標題，如【標題】，標題與內文以空行或換行區隔。
3. 【最嚴格限制】：絕對禁止使用任何 Markdown 格式符號（包含但不限於 **粗體**, #標題, ---分隔線等）。社群平台不支援這些語法！文案必須是「純淨文字」，僅能用換行與空白段落區隔重點，連粗體黑體都不能有，確保複製貼上不會變成亂碼！
4. 建議在文案結尾寫「詳細資訊與連結我放在留言區第一則」，避免在貼文正文中直接塞網址。
5. 結尾 Hashtags 只能從標準標籤庫中挑選 3-5 個。`;
    }

    platformInstructions += "\n" + NO_DASH_LAYOUT_RULE;

    let adaptPrompt = "";
    if (currentCopy) {
      adaptPrompt = `你現在是社群行銷專家 Maya。
你的任務是將以下現有的社群文案，改寫並轉化為適合在【${targetPlatform.toUpperCase()}】平台發布的規格與排版樣式。

【品牌與語氣背景限制】：
${brandContext}

【目標平台 ${targetPlatform.toUpperCase()} 寫作限制】：
${platformInstructions}

### 原始文案內容：
"""
${currentCopy}
"""

### 輸出 JSON 格式要求：
你必須且僅能輸出如下 JSON 代碼區塊（以 \`\`\`json 開始，以 \`\`\` 結束），禁止任何額外的首尾引言或問候語：
{
  "social_copy": "改寫後符合 ${targetPlatform.toUpperCase()} 平台限制的乾淨純淨文字社群文案內容 (絕對禁止包含任何 **粗體**, #標題 或 ---分隔線等 Markdown 符號)"
}
`;
    } else {
      const keywords = prevData?.seo_keywords ? JSON.stringify(prevData.seo_keywords) : "";
      adaptPrompt = `你現在是社群行銷專家 Maya。
你的任務是為【${targetPlatform.toUpperCase()}】平台撰寫一篇全新的爆款社群貼文。

【品牌與語氣背景限制】：
${brandContext}

【目標平台 ${targetPlatform.toUpperCase()} 寫作限制】：
${platformInstructions}

【參考關鍵字與大綱】：
${keywords || "根據品牌核心定位自由發揮撰寫一個吸引人的主題。"}

### 輸出 JSON 格式要求：
你必須且僅能輸出如下 JSON 代碼區塊（以 \`\`\`json 開始，以 \`\`\` 結束），禁止任何額外的首尾引言或問候語：
{
  "social_copy": "生成的符合 ${targetPlatform.toUpperCase()} 平台限制的乾淨純淨文字社群文案內容 (絕對禁止包含任何 **粗體**, #標題 或 ---分隔線等 Markdown 符號)"
}
`;
    }

    const response = await runQueryWithFallback(adaptPrompt, config, true, "anthropic");
    const result = robustJSONParse(response);
    return {
      content: "",
      dispatchData: {
        // 改寫結果一律清成純文字（AI 偶爾仍會帶出 ** ## 等符號，Facebook / Threads / IG 都不吃）
        social_copy: stripMarkdown(result.social_copy || "")
      }
    };
  }

  let subPrompts: any = null;
  let cleanErickContent = "";

  if (stage === "expert" && subPromptsInput) {
    subPrompts = subPromptsInput;
  } else {
    // 1. Erick 總指揮 (OpenAI)
    const systemMessage = {
      role: "system",
      content: `${ERICK_SYSTEM_PROMPT}\n\n【發布平台指令】：\n當前使用者選擇的社群平台是：【${activePlatform.toUpperCase()}】。請務必在指派給 Maya 的子提示詞（maya）中，明確指定該平台的寫作限制（如 Threads 限 500 字以內且禁正文連結；IG 限 2200 字以內且多 emoji；FB 適合 800-1500 字長文說書且連結放留言）。\n\n【Erick 核心語氣與思考邏輯最高工作準則】：\n${ERICK_PERSONA_SKILL}\n\n${brandContext}`
    };

    const cooReport: AIResponseReport = { label: "COO" };
    const recentHistory = history.slice(-12);
    const formattedMessages = [
      systemMessage,
      ...recentHistory.map(msg => ({
        role: msg.role === "user" ? "user" : "assistant",
        content: msg.content
      }))
    ];

    // 檢查金鑰有效性
    const isOpenAIKeyValid = !!(config.apiKey && config.apiKey.trim().startsWith("sk-"));
    const isGeminiKeyValid = !!((config.geminiApiKey || process.env.GEMINI_API_KEY) && 
      (config.geminiApiKey || process.env.GEMINI_API_KEY || "").trim().startsWith("AIzaSy"));
    const isAnthropicKeyValid = !!((config.anthropicApiKey || process.env.ANTHROPIC_API_KEY) && 
      (config.anthropicApiKey || process.env.ANTHROPIC_API_KEY || "").trim().startsWith("sk-ant-"));

    const providersToTry: string[] = [];
    if (provider === "gemini") {
      providersToTry.push("gemini", "openai", "anthropic");
    } else if (provider === "anthropic") {
      providersToTry.push("anthropic", "openai", "gemini");
    } else {
      providersToTry.push("openai", "gemini", "anthropic");
    }

    const validProviders = providersToTry.filter(p => {
      if (p === "openai") return isOpenAIKeyValid;
      if (p === "gemini") return isGeminiKeyValid;
      if (p === "anthropic") return isAnthropicKeyValid;
      return false;
    });

    let erickOutput = "";
    let lastError: any = null;

    if (validProviders.length > 0) {
      for (const p of validProviders) {
        try {
          console.log(`[callErickCOO] Attempting COO generation with ${p}...`);
          cooReport.provider = p;
          cooReport.model = p === "openai" ? config.model || "gpt-5.4-mini" : p === "gemini" ? config.geminiModel || "gemini-flash-latest" : config.anthropicModel || process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
          if (p === "gemini") {
            erickOutput = await callGemini(formattedMessages, config, false, { maxTokens: 8000, report: cooReport });
          } else if (p === "openai") {
            erickOutput = await callOpenAI(formattedMessages, config, false, { maxTokens: 8000, report: cooReport });
          } else if (p === "anthropic") {
            erickOutput = await callAnthropic(formattedMessages, config, { maxTokens: 8000, timeoutMs: 100000, report: cooReport });
          }
          break; // Success!
        } catch (error: any) {
          console.error(`[callErickCOO] ${p} failed:`, error);
          lastError = error;
        }
      }
    }

    if (!erickOutput) {
      if (provider !== "mock") {
        throw new Error(`Erick COO 呼叫失敗: 所有可用 AI 服務均呼叫失敗。最後一個錯誤為: ${lastError?.message || lastError}`);
      }
      return parseCOOOutput(await callMockCOO(history[history.length - 1]?.content || "", brandName));
    }

    // 解析 Erick 的輸出以提取子提示詞
    cleanErickContent = erickOutput;
    try {
      const parsed = robustJSONParse(erickOutput);
      subPrompts = parsed?.sub_prompts;
      if (subPrompts) {
        const jsonBlock = erickOutput.match(/```(?:json)?\s*[\s\S]*?(?:```|$)/i)?.[0] || extractFirstCompleteJSON(erickOutput) || "";
        cleanErickContent = erickOutput.replace(jsonBlock, "").trim();
      }
    } catch (error) {
      logAIParseFailure("COO sub_prompts", error, cooReport, erickOutput);
    }

    if (!subPrompts) {
      const fallbackParsed = parseCOOOutput(erickOutput, cooReport);
      console.warn(`[callErickCOO] 營運長回覆未附可用的 sub_prompts（長度 ${erickOutput.length}），供應商=${cooReport.provider || "unknown"}，模型=${cooReport.model || "unknown"}，finish_reason=${cooReport.finishReason || "unknown"}，前 300 字：${safeResponsePreview(erickOutput)}`);
      // 營運長口頭說要派工、卻漏了 JSON：用使用者原始指令代替，讓專家照常生成
      const lastUserText = history[history.length - 1]?.content || "";
      if (stage === "coo" && !fallbackParsed.dispatchData && lastUserText && /Maya|Leon|Iris|Jack/.test(erickOutput)) {
        console.warn("[callErickCOO] 啟用備援：以使用者原始指令派給四位專家");
        return {
          content: fallbackParsed.content,
          dispatchData: { subPrompts: { maya: lastUserText, iris: lastUserText, leon: lastUserText, jack: lastUserText }, fallback: true }
        };
      }
      return fallbackParsed;
    }

    if (stage === "coo") {
      return {
        content: cleanErickContent,
        dispatchData: { subPrompts }
      };
    }
  }

  // 2. 專家工作流調度 (Chained Multi-Agent Pipeline)
  const mayaPrompt = subPrompts.maya || "請寫作一份社群行銷貼文";
  const irisPrompt = subPrompts.iris || "請規劃適當的 SEO 關鍵字與大綱";
  const leonPrompt = subPrompts.leon || "請設計 Landing Page 銷售頁網頁架構";
  const jackPrompt = subPrompts.jack || "請提供預估的廣告數據指標";

  if (stage === "expert" && expertType === "leon") {
    const socialCopy = typeof prevData?.social_copy === "string" ? prevData.social_copy.trim().slice(0, 3000) : "";
    if (!hasUsableSocialCopy(socialCopy)) throw new Error("請先生成社群文案，再生成網頁架構。");

    const leonStepPrompt = `你是設計總監 Leon。根據目前這篇社群文案，為【${brandName}】製作一份可預覽的 Landing Page。

【品牌規範】
${brandContext}

【目前社群文案，最多 3000 字，這是唯一內容依據】
${socialCopy}

【補充指示】
${typeof subPromptsInput?.leon === "string" ? subPromptsInput.leon : "依社群文案整理成精簡 Landing Page。"}

輸出限制：只產出單一精簡 HTML 片段，不含 html、head、body 標籤，樣式使用 Tailwind 類名。最多 5 個主要區塊，每區標題最多 12 個中文字、說明最多 2 句、行動按鈕最多 1 個。不得新增社群文案沒有提供的事實、案例、數據、客戶見證或承諾。用 HTML 文字節點呈現內容，不插入 Markdown，不產生 script、流程圖或長篇說明。

只輸出一個 JSON 物件：{"web_architecture":"HTML 字串","visual_direction":{"palette":["顏色"],"fonts":"字體","theme":"風格"}}。HTML 必須完整且精簡。`;

    const leonReport: AIResponseReport = { label: "Leon" };
    try {
      const response = await runQueryWithFallback(
        leonStepPrompt,
        config,
        true,
        "openai",
        { ...LEON_GENERATION_OPTIONS, report: leonReport }
      );
      const result = robustJSONParse(response);
      if (typeof result?.web_architecture !== "string" || !result.web_architecture.trim()) {
        throw new Error("Leon 回覆格式不完整，缺少網頁內容。");
      }
      return {
        content: "",
        dispatchData: {
          web_architecture: result.web_architecture,
          visual_direction: result.visual_direction || {},
        },
      };
    } catch (error) {
      throw new Error(friendlyLeonError(error));
    }
  }

  if (stage === "expert" && expertType === "jack") {
    const keywordsStr = prevData?.seo_keywords ? JSON.stringify(prevData.seo_keywords) : "";
    const socialCopyStr = typeof prevData?.social_copy === "string" ? prevData.social_copy.slice(0, 3000) : "";
    const jackStepPrompt = `你現在是廣告策略師 Jack。你負責判讀行銷數據、規劃 Meta/Google 廣告素材方向與投放預算分配。

【Erick 核心語氣與思考邏輯最高工作準則】
${ERICK_PERSONA_SKILL}

【品牌知識背景與限制】
${brandContext}

【上游專家規劃成果】
1. Iris 關鍵字：${keywordsStr}
2. Maya 社群貼文：${socialCopyStr || "目前社群文案未成功產生，請只依任務子提示詞完成可行的方向性估算，不要假設文章內容。"}

【任務指派】
${jackPrompt}

只輸出 JSON：{"ad_data":[{"label":"數據指標","value":"估算值","change":"變化","isPositive":true}],"ad_strategy_notes":"具體判讀與素材建議"}。不得將估算寫成實際成效。`;
    const response = await runQueryWithFallback(jackStepPrompt, config, true, "openai");
    const result = robustJSONParse(response);
    let adData = Array.isArray(result?.ad_data) ? result.ad_data : [];
    const adAccountId = process.env.META_AD_ACCOUNT_ID || "";
    const metaAccessToken = process.env.META_MARKETING_ACCESS_TOKEN || "";
    if (adAccountId && metaAccessToken && !adAccountId.includes("YOUR_")) {
      try {
        const realInsights = await fetchMetaAdAccountInsights(adAccountId, metaAccessToken);
        if (realInsights?.length) adData = [...realInsights, ...adData];
      } catch (error) {
        console.error("fetchMetaAdAccountInsights failed:", error);
      }
    }
    return {
      content: "",
      dispatchData: {
        ad_data: adData,
        ad_strategy_notes: typeof result?.ad_strategy_notes === "string" ? stripDashes(result.ad_strategy_notes) : "",
      },
    };
  }

  // ========== 第一條鏈：Maya (社群) + Iris (SEO) ==========
  if (stage === "expert" && expertType === "maya_iris") {
    // 步驟 1：先呼叫 Iris 生成 SEO 關鍵字策略
    const irisStepPrompt = `你現在是 SEO 專家 Iris。
    
【Erick 核心語氣與思考邏輯最高工作準則】：
${ERICK_PERSONA_SKILL}

【品牌知識背景與限制】：
${brandContext}

請根據以下指派的子提示詞，規劃 3-5 個針對繁體中文(台灣)市場的高潛力關鍵字，並提供文章大綱、AEO 結構化 Schema 與 FAQ 問答集。

### 任務指派 (子提示詞)：
${irisPrompt}

### 輸出 JSON 格式要求：
你必須且僅能輸出如下 JSON 格式內容：
{
  "seo_keywords": [
    { "keyword": "關鍵字1", "volume": "月搜尋量", "competition": "高|中|低", "outline": "此關鍵字的文章大綱說明" }
  ],
  "aeo_schema": {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "問題？",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "回答"
        }
      }
    ]
  },
  "aeo_faq": "針對 AEO 設計的 FAQ 問答集。請針對文章中的核心議題與規劃的關鍵字，寫出 2-3 個問答對（純文字，不要任何 Markdown 符號（不可出現 ** ## - 等），格式例如：Q：問題？換行 A：回答，Q 與 A 後面一律不加數字）"
}`;

    // 2026-08 修正：原本這裡會要求 Maya 為每篇文章產出 DALL-E 3 生圖描述，
    // 並嵌入 https://filedn.com/... 的 Markdown 圖片標籤（含各品牌的 imgLabel /
    // imgSuffix / imgExample 設定）。
    //
    // 但下游的 n8n 工作流「Erick Dashboard Social Router」在 MapBrandToken
    // 節點明確排除 filedn.com 網址：
    //     if (!extractedUrl.includes('filedn.com') && ...) { imageUrl = extractedUrl; }
    // 並用 regex 移除整個圖片標籤（cleanContent），改以文章標題的 hash 從各品牌
    // 固定的 Unsplash 圖池挑圖。也就是說那段生圖描述從未被採用，只是在燒 token。
    //
    // 若日後在 n8n 補上生圖節點（接收描述 → 呼叫生圖 API → 上傳圖床 → 回填網址），
    // 再把生圖指令加回來。詳見 docs/PIPELINE_FINDINGS_AND_PLAN.md。
    const imgInstruction = `請在文章中提供一個符合該文章邏輯的完整 Mermaid 圖表代碼區塊（使用 \`\`\`mermaid 包覆），作為官網 Insights 頁面的結構流程圖。

【重要】：不要自行插入任何 Markdown 圖片標籤（![...](...)）或圖片網址。社群貼文的配圖由發布流程自動處理，你寫的圖片網址不會被採用。`;
    const diagramInstruction = shouldIncludeMayaDiagram(storyArgument) ? `4. ${imgInstruction}
   Mermaid 圖表必須符合以下品牌配色規範：
   - 當前品牌：${brandColors.name}，系統色為：${brandColors.colorName}。
   - 請在 Mermaid 開頭注入以下高質感配色 %%{init: ... }%% 區塊，使圖表底色、文字、框線與系統色完美契合：
     \`\`\`mermaid
     %%{init: {
       'theme': 'base',
       'themeVariables': {
         'primaryColor': '${brandColors.hexPrimary}',
         'primaryTextColor': '#ffffff',
         'primaryBorderColor': '${brandColors.hexAccent}',
         'lineColor': '${brandColors.hexAccent}',
         'secondaryColor': '#1e293b',
         'tertiaryColor': '#0f172a'
       }
     }}%%
     ...圖表內容...
     \`\`\`` : "";

    let mayaPlatformRules = "";
    if (activePlatform === "threads") {
      mayaPlatformRules = `1. 完全使用繁體中文(台灣)，文章字數嚴格限制在 500 字以內，建議 200-400 字，結構短小精悍。
2. 【最嚴格限制】：絕對禁止使用任何 Markdown 格式符號（包含但不限於 **粗體**, #標題, ---分隔線等）。社群平台不支援這些語法！文案必須是「純淨文字」，僅能用換行與表情符號排版，連粗體黑體都不能有！
3. 嚴禁在文案正文中包含任何外部連結 (HTTP/HTTPS URL)，否則會被算法降權。如果有連結需求，請在貼文末尾引導讀者「詳細連結我放在留言區第一則了」。
4. 語意風格偏向親切口語，像跟朋友分享，多用痛點句和好奇心 Hook。
5. 結尾 Hashtags 只能挑選 0-2 個，維持頁面乾淨。`;
    } else if (activePlatform === "instagram") {
      mayaPlatformRules = `1. 完全使用繁體中文(台灣)，文章字數限制在 2200 字以內，但請以視覺體驗優先，排版要保持極高的舒適度。
2. 【最嚴格限制】：絕對禁止使用任何 Markdown 格式符號（包含但不限於 **粗體**, #標題, ---分隔線等）。社群平台不支援這些語法！文案必須是「純淨文字」，僅能用換行與表情符號排版，連粗體黑體都不能有！
3. 嚴禁在正文中放入無法點擊的網址。請在貼文末尾引導讀者點擊「個人檔案首頁連結 (Link in Bio)」或「私訊小盒子」。
4. 最開頭第一行必須是吸睛的文章主標題，標題與內文以換行區隔。
5. 結尾必須包含 5-15 個高度相關的標籤（Hashtags），可從品牌標準標籤庫中挑選並補充 2-3 個熱門探索詞。`;
    } else {
      // 預設為 Facebook (或 fallback)
      mayaPlatformRules = `1. 完全使用繁體中文(台灣)，文章字數 800 至 1500 字左右，適合進行深度痛點共鳴與說書解析。
2. 最開頭第一行必須是聳動且完整的文章主標題，如【標題】，標題與內文以空行或換行區隔。
3. 【最嚴格限制】：絕對禁止使用任何 Markdown 格式符號（包含但不限於 **粗體**, #標題, ---分隔線等）。社群平台不支援這些語法！文案必須是「純淨文字」，僅能用換行與空白段落區隔重點，連粗體黑體都不能有，確保複製貼上不會變成亂碼！
4. 為了防止演算法降權，建議在文案結尾寫「詳細資訊與連結我放在留言區第一則」，避免在貼文正文中直接塞網址。
5. 結尾 Hashtags 只能從標準標籤庫中挑選 3-5 個。`;
    }

    mayaPlatformRules += "\n" + NO_DASH_LAYOUT_RULE;

    const mayaStepPrompt = `你現在是社群行銷專家 Maya。
    
【Erick 核心語氣與思考邏輯最高工作準則】：
${ERICK_PERSONA_SKILL}

【品牌知識背景與限制】：
${brandContext}

【SEO 核心寫作指導】：
請主動分析並在文案中巧妙融入與主題相關的高價值 SEO/AEO 關鍵字與行銷標籤，以極大化搜尋擴散與曝光效益。

請根據以下指派的子提示詞，撰寫一篇深度社群貼文。

### 任務指派 (子提示詞)：
${mayaPrompt}

### 寫作平台自適應限制 (當前發布平台: ${activePlatform.toUpperCase()})：
${mayaPlatformRules}
${diagramInstruction}
5. 結尾 Hashtags 只能從標準標籤庫中挑選 3-5 個：
   - Erick專欄：#個人品牌, #自我成長, #商業思維, #決策邏輯, #人生下半場
   - I8 (企業醫生)：#企業醫生, #企業管理, #決策校準, #組織優化, #營運策略
   - NAS (生命數字)：#生命數字, #自我探索, #關係說明書, #人生節奏, #天賦性格
   - ABL (量子調頻)：#狀態調和, #內在消耗, #情緒穩定, #壓力管理, #自我照顧
 6. 寫作核心主題：你的整篇文章必須緊密圍繞「### 任務指派 (子提示詞)」中要求的特定內容、細節與結構展開。品牌知識背景中包含的語氣範例（例如「你不是沒有努力，而是你已經用撐住的方式活太久了」）僅供撰寫口吻與品牌世界觀的參考，**絕對不可直接拿來作為文章的最主要核心主題或標題，也絕對不能用通用的品牌常規話術取代或覆蓋了使用者指派的特定文案主題**！
   - 如果子提示詞或使用者要求分析具體事物（例如氣場、經絡、身體、情緒、理智、精神等層次），你必須在文章中開闢專門段落/部分，對這些維度進行深度、細膩的逐一分析，而不能只是用一句話含糊帶過！

### 輸出 JSON 格式要求：
你必須且僅能輸出如下 JSON 代碼區塊（以 \`\`\`json 開始，以 \`\`\` 結束）：
{
  "social_copy": "Maya 產出的乾淨純文字社群文案內容 (絕對禁止包含任何 **粗體**, #標題 或 ---分隔線等 Markdown 符號)"
}`;

    // 文體模式：用「共用前綴 + 品牌語氣 + 漏斗層 + 文體骨架 + 本篇變數」取代預設的 Maya 提示詞。
    // 品牌既有規範只保留為事實邊界（語氣衝突時以文體提示詞為準）。
    let finalMayaPrompt = mayaStepPrompt;
    const mayaReport: AIResponseReport = { label: "Maya" };
    if (genre?.settings) {
      finalMayaPrompt = `${buildGenrePrompt(genre.brandKey, genre.settings)}

【事實邊界（品牌既有規範。語氣與格式衝突時，以上方文體提示詞為準；事實、紅線與不可宣稱的內容，以此為準）】
${brandContext}`;
    }
    let storyKnowledge: { required: boolean; note: KnowledgeNoteRecord | null; content: string } = {
      required: false,
      note: null,
      content: "",
    };
    if (storyArgument) {
      const historyTopic = history.filter((message) => message.role === "user").slice(-3).map((message) => message.content).join("\n");
      const assignedMayaPrompt = typeof subPromptsInput === "string"
        ? subPromptsInput
        : typeof subPromptsInput?.maya === "string" ? subPromptsInput.maya : JSON.stringify(subPromptsInput || {});
      storyKnowledge = await resolveStoryArgumentKnowledge(storyArgument, `${historyTopic}\n${assignedMayaPrompt}`, config);
      finalMayaPrompt += `\n\n${buildStoryArgumentPrompt(storyArgument, {
        genreMode: Boolean(genre?.settings),
        citationRequired: storyKnowledge.required,
        knowledgeNote: storyKnowledge.note ? {
          title_zh: storyKnowledge.note.title_zh,
          author_zh: storyKnowledge.note.author_zh,
          zh_status: storyKnowledge.note.zh_status,
          content: storyKnowledge.content,
        } : null,
      })}`;
    }

    const irisReport: AIResponseReport = { label: "Iris" };
    console.log(`[callErickCOO] Running Iris (gemini) and Maya (anthropic${genre?.settings ? ", genre=" + genre.settings.genre : ""}) concurrently...`);
    const runMayaWithJSONRetry = async (): Promise<{ result: any; response: string }> => {
      const mayaOptions: ProviderCallOptions = { maxTokens: 12000, timeoutMs: 120000, report: mayaReport };
      let lastParseError: unknown;
      for (let attempt = 0; attempt < 2; attempt++) {
        const prompt = attempt === 0
          ? finalMayaPrompt
          : `${finalMayaPrompt}\n\n【格式重試】上一次回覆無法解析。這次請只輸出一個完整、合法的 JSON 物件，不要程式碼區塊、不要前言或結語；必須包含非空字串欄位 social_copy${storyArgument ? "，並依框架格式包含 story_thesis 欄位" : ""}${storyKnowledge.required ? "，並包含 citation_title 與 citation_author 欄位" : ""}。`;
        const response = await runQueryWithFallback(prompt, config, true, "anthropic", mayaOptions);
        try {
          const result = robustJSONParse(response);
          if (!result || typeof result.social_copy !== "string" || !result.social_copy.trim()) {
            throw new Error("回覆缺少非空的 social_copy 欄位");
          }
          if (storyArgument && !storyArgument.thesis && (!result.story_thesis || typeof result.story_thesis !== "string" || !result.story_thesis.trim())) {
            throw new Error("故事論點回覆缺少一句話 story_thesis 欄位");
          }
          return { result, response };
        } catch (error) {
          lastParseError = error;
          logAIParseFailure(`Maya attempt ${attempt + 1}`, error, mayaReport, response);
        }
      }
      throw new Error(`Maya（${mayaReport.provider || "AI"}/${mayaReport.model || "未知模型"}）回覆格式無法解析；finish_reason=${mayaReport.finishReason || "unknown"}。${normalizeAIError(lastParseError)}`);
    };
    const [irisOutcome, mayaOutcome] = await Promise.allSettled([
      runQueryWithFallback(irisStepPrompt, config, true, "gemini", { maxTokens: 5000, timeoutMs: 100000, report: irisReport }),
      runMayaWithJSONRetry()
    ]);

    if (mayaOutcome.status === "rejected") {
      throw new Error(`Maya（${mayaReport.provider || "AI"}/${mayaReport.model || "未知模型"}）生成失敗：${normalizeAIError(mayaOutcome.reason)}`);
    }

    const mayaResult = mayaOutcome.value.result;
    const storyThesis = storyArgument
      ? resolveStoryArgumentThesis(storyArgument.thesis, mayaResult.story_thesis || "")
      : "";
    const storyCitation = storyArgument
      ? (() => {
          const normalizedCopy = normalizeStoryArgumentCopy(mayaResult.social_copy || "", storyThesis);
          const citation = applyValidatedKnowledgeCitation(
            normalizedCopy,
            mayaResult.citation_title,
            mayaResult.citation_author,
            storyKnowledge.note,
            storyKnowledge.required
          );
          // 引用驗證完成後再清理一次，讓引用或待補標記位於主題標籤之前。
          return { ...citation, content: normalizeStoryArgumentCopy(citation.content, storyThesis) };
        })()
      : null;

    let irisResult: any = { seo_keywords: [], aeo_faq: "", aeo_schema: "" };
    if (irisOutcome.status === "fulfilled") {
      try {
        irisResult = robustJSONParse(irisOutcome.value);
      } catch (error) {
        logAIParseFailure("Iris", error, irisReport, irisOutcome.value);
        console.warn("Iris 回覆無法解析，保留 Maya 文案並使用空白 SEO 欄位。");
      }
    } else {
      console.error(`[AI_PROVIDER_FAILURE] ${JSON.stringify({ role: "Iris", provider: irisReport.provider || "unknown", model: irisReport.model || "unknown", error: normalizeAIError(irisOutcome.reason) })}`);
    }

    // 如果有找到關鍵字，主動抓取實體 API (如 SEMrush) 的搜尋量與競爭度
    if (irisResult.seo_keywords && Array.isArray(irisResult.seo_keywords)) {
      const kws = irisResult.seo_keywords.map((k: any) => k.keyword).filter(Boolean);
      if (kws.length > 0) {
        try {
          const liveMetrics = await fetchLiveKeywordMetrics(kws);
          irisResult.seo_keywords = irisResult.seo_keywords.map((kwObj: any, index: number) => {
            const live = liveMetrics.find((l: any) => l.keyword === kwObj.keyword) || liveMetrics[index];
            return {
              keyword: kwObj.keyword,
              volume: live ? live.volume : kwObj.volume,
              competition: live ? live.competition : kwObj.competition,
              outline: kwObj.outline
            };
          });
        } catch (err) {
          console.error("fetchLiveKeywordMetrics failed:", err);
        }
      }
    }

    let formattedSchema = "";
    if (irisResult.aeo_schema) {
      if (typeof irisResult.aeo_schema === "object") {
        formattedSchema = `<script type="application/ld+json">\n${JSON.stringify(irisResult.aeo_schema, null, 2)}\n</script>`;
      } else {
        formattedSchema = String(irisResult.aeo_schema);
      }
    }

    return {
      content: "",
      dispatchData: {
        // 文體模式整篇清成純文字；其他框架（如品牌形象與故事）保留文案內容，但一律去掉破折號分隔線與小標記號
        social_copy: storyArgument
          ? storyCitation?.content || ""
          : genre?.settings ? stripMarkdown(mayaResult.social_copy || "") : stripDashes(mayaResult.social_copy || ""),
        seo_keywords: irisResult.seo_keywords || [],
        aeo_schema: formattedSchema,
        aeo_faq: stripMarkdown(irisResult.aeo_faq || ""),
        active_platform: genre?.settings ? "facebook" : activePlatform,
        genre_meta: genre?.settings
          ? {
              genre: genre.settings.genre,
              funnel: genre.settings.funnel,
              prompt_version: PROMPT_VERSION,
              model_version: mayaReport.model || undefined,
            }
          : null,
        story_argument_meta: storyArgument
          ? {
              version: storyArgument.version,
              thesis: storyThesis,
              prompt_version: STORY_ARGUMENT_PROMPT_VERSION,
              model_version: mayaReport.model || undefined,
              citationMode: storyArgument.citationMode || "auto",
              knowledge_note_id: storyKnowledge.note?.id || null,
              knowledge_content_md5: storyKnowledge.note?.content_md5 || null,
              citation_title: storyCitation?.citationTitle || null,
              citation_author: storyCitation?.citationAuthor || null,
              citation_valid: storyCitation?.valid ?? false,
            }
          : null,
      }
    };
  }

    // ========== 第二條鏈：Leon (設計) + Jack (廣告) ==========
  if (stage === "expert" && expertType === "leon_jack") {
    const keywordsStr = prevData?.seo_keywords ? JSON.stringify(prevData.seo_keywords) : "";
    const socialCopyStr = prevData?.social_copy || "";

    // 轉換目標依品牌在信任漏斗中的位置決定，不再全部導向諮詢預約。
    // 設定來源：src/data/brands/conversion.ts（單一事實來源）
    const conversion = getBrandConversion(brandName);
    const ctaStageGuidance =
      conversion.stage === "entry"
        ? "這是漏斗入口，讀者多半是第一次接觸品牌。CTA 的目標是「換取 email」，不是成交。文案要降低承諾感，強調免費、快速、無壓力，絕對不要出現「預約諮詢」「立即購買」這類高承諾字眼。"
        : conversion.stage === "nurture"
        ? "讀者已意識到自己卡住、正在找方法，但尚未準備好付費。CTA 的目標仍是「換取 email」並取得分眾資訊，文案要對準他的具體處境，讓他覺得這個工具正是為他設計的。"
        : "讀者已建立信任、正在評估合作。這是唯一可以直接談諮詢與成交的層級，文案可以明確、有力，直接邀請預約。";

    // 步驟 3：呼叫設計總監 Leon 生成高轉換的 Landing Page 視覺 HTML (Tailwind)
    const leonStepPrompt = `你現在是設計總監 Leon。你的職責是規劃高點閱、高轉換的 Landing Page 網頁版塊架構與視覺配色風格。
    
【Erick 核心語氣與思考邏輯最高工作準則】：
${ERICK_PERSONA_SKILL}

【品牌知識背景與限制】：
${brandContext}

【上游專家 Iris 規劃的核心關鍵字】：
${keywordsStr}

【上游專家 Maya 產出的爆款社群文案】：
${socialCopyStr}

請根據上述上游文案與關鍵字，設計一版結構完整的 Landing Page 銷售頁網頁架構。
你必須直接產出完整的、符合響應式排版的 Tailwind CSS HTML 代碼，並規劃視覺設計風格。

### 網頁板塊必須包含：
1. **導覽列 (Navbar)** 與 **首頁主視覺區 (Hero Section)**：引人入勝的標題、副標題與主按鈕。
2. **痛點共鳴區 (Problem Section)**：點出使用者正面臨的核心內耗與卡點。
3. **關鍵對位區 (Solution Section)**：展示如何透過品牌服務進行對位（結合 ABL, NAS 或 I8 品牌核心）。
4. **客戶見證/信任背書 (Social Proof & Testimonials)**：展示信任度。
5. **行動呼籲區 (Call to Action - CTA)**：
   - 按鈕文字必須是：「${conversion.ctaLabel}」
   - 按鈕連結必須是：${conversion.ctaUrl}
   - 誘因說明（請據此撰寫 CTA 區塊的文案）：${conversion.leadMagnet}
   - 【漏斗階段：${conversion.stage}】${ctaStageGuidance}
   - 絕對禁止使用其他網址或自行更換 CTA 目標。
6. **頁尾 (Footer)**。

### 輸出 HTML 規範：
- 必須是乾淨的 HTML 區塊（不包含 <html> 或 <body> 標籤，僅從最外層容器 <div> 開始）。
- 使用 Tailwind CSS 最新排版類名（如 flex, grid, gap-6, bg-slate-900, text-white, border, hover:scale-105 等），做出質感極高、帶有精美陰影與字體排版的現代視覺頁面。
- 顏色必須依據品牌系統色規範：【${brandColors.name}】的系統色為【${brandColors.colorName}】。
  請使用 Tailwind 類名呈現該品牌風格（建議使用如 ${brandColors.tailwindClasses}），營造出極具質感的網頁視覺。字體使用優質字體。

### 任務指派 (子提示詞)：
${leonPrompt}

### 輸出 JSON 格式要求：
你必須且僅能輸出如下 JSON 代碼區塊（以 \`\`\`json 開始，以 \`\`\` 結束）：
{
  "web_architecture": "Leon 產出的 Landing Page 網頁 Tailwind HTML 內容",
  "visual_direction": {
    "palette": ["主要色代碼", "輔助色代碼", "背景色代碼"],
    "fonts": "推薦字體風格",
    "theme": "風格定位描述 (如 McKinsey 簡約高階商務)"
  }
}`;

    const jackStepPrompt = `你現在是廣告策略師 Jack。你負責判讀行銷數據、規劃 Meta/Google 廣告素材方向與投放預算分配。
    
【Erick 核心語氣與思考邏輯最高工作準則】：
${ERICK_PERSONA_SKILL}

【品牌知識背景與限制】：
${brandContext}

【上游專家規劃成果 (參考依據)】：
1. Iris 關鍵字：${keywordsStr}
2. Maya 社群貼文：${socialCopyStr}

請根據上述行銷目標與上游文案，預估該波廣告宣傳的數據指標，並撰寫具體的加碼/關閉決策與素材優化建議。

### 任務指派 (子提示詞)：
${jackPrompt}

### 輸出 JSON 格式要求：
你必須且僅能輸出如下 JSON 代碼區塊（以 \`\`\`json 開始，以 \`\`\` 結束）：
{
  "ad_data": [
    { "label": "數據指標名稱 (如 預估ROAS, 單次點擊成本CPC, 單次預約名單成本CPA 等)", "value": "數值 (如 4.8x, $1.2, $15.0)", "change": "+/-百分比 (如 +8.5%, -3.1%)", "isPositive": true }
  ],
  "ad_strategy_notes": "針對目前數據的具體判讀：哪組需要加碼、哪組應該關閉、哪組需要更換素材的詳細策略建議文字。"
}`;

    console.log("[callErickCOO] Running Leon (openai) and Jack (openai) concurrently...");
    const [leonResponse, jackResponse] = await Promise.all([
      runQueryWithFallback(leonStepPrompt, config, true, "openai"),
      runQueryWithFallback(jackStepPrompt, config, true, "openai")
    ]);

    const leonResult = robustJSONParse(leonResponse);
    const jackResult = robustJSONParse(jackResponse);

    // 主動嘗試從資料表/環境變數中對接實體 Meta 廣告後台 API 數據
    let adData = jackResult.ad_data || [];
    const adAccountId = process.env.META_AD_ACCOUNT_ID || "";
    const metaAccessToken = process.env.META_MARKETING_ACCESS_TOKEN || "";
    
    if (adAccountId && metaAccessToken && !adAccountId.includes("YOUR_")) {
      try {
        const realInsights = await fetchMetaAdAccountInsights(adAccountId, metaAccessToken);
        if (realInsights && realInsights.length > 0) {
          adData = [...realInsights, ...adData];
        }
      } catch (err) {
        console.error("fetchMetaAdAccountInsights failed:", err);
      }
    }

    return {
      content: "",
      dispatchData: {
        web_architecture: leonResult.web_architecture || "",
        visual_direction: leonResult.visual_direction || {},
        ad_data: adData,
        ad_strategy_notes: typeof jackResult.ad_strategy_notes === "string" ? stripDashes(jackResult.ad_strategy_notes) : (jackResult.ad_strategy_notes || "")
      }
    };
  }

    return {
    content: cleanErickContent,
    dispatchData: null
  };
}

// 1. OpenAI 實作
async function callOpenAI(messages: any[], config: AIProviderConfig, jsonMode?: boolean, opts?: ProviderCallOptions): Promise<string> {
  if (!config.apiKey) throw new Error("Missing OPENAI_API_KEY");

  const requestBody: any = {
    model: config.model || "gpt-5.4-mini",
    messages: messages,
    temperature: 0.7
  };
  if (opts?.maxTokens) requestBody.max_completion_tokens = opts.maxTokens;

  if (jsonMode) {
    requestBody.response_format = { type: "json_object" };
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${config.apiKey}`
    },
    body: JSON.stringify(requestBody),
    signal: getTimeoutSignal(opts?.timeoutMs || 60000)
  });

  if (!response.ok) {
    const errText = await response.text();
    if (opts?.report) opts.report.httpStatus = response.status;
    throw providerHTTPError("OpenAI", requestBody.model, response.status, errText);
  }

  const json = await response.json();
  const choice = json.choices?.[0];
  const text = choice?.message?.content || "";
  if (opts?.report) {
    opts.report.httpStatus = response.status;
    opts.report.finishReason = choice?.finish_reason || "unknown";
    opts.report.responsePreview = safeResponsePreview(text);
  }
  if (choice?.finish_reason === "length") {
    const error = new Error(`OpenAI 回覆被長度上限截斷（finish_reason=length，上限 ${opts?.maxTokens || "供應商預設"} tokens）`);
    logAIParseFailure("OpenAI truncated response", error, opts?.report, text);
    throw error;
  }
  logAIModelResult(opts?.report);
  return text;
}

// 2. Gemini 實作
async function callGemini(messages: any[], config: AIProviderConfig, jsonMode?: boolean, opts?: ProviderCallOptions): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY || config.geminiApiKey || config.apiKey;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  const model = config.geminiModel || process.env.GEMINI_MODEL || "gemini-flash-latest";
  console.log(`[Gemini Call] Using model: ${model}`);

  // Gemini API 格式轉換
  const contents = messages
    .filter(m => m.role !== "system")
    .map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    }));

  if (contents.length === 0) {
    contents.push({
      role: "user",
      parts: [{ text: "Hello" }]
    });
  }

  const systemInstruction = messages.find(m => m.role === "system")?.content;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  const generationConfig: any = {
    temperature: 0.7
  };
  if (opts?.maxTokens) generationConfig.maxOutputTokens = opts.maxTokens;
  if (jsonMode) {
    generationConfig.responseMimeType = "application/json";
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents,
      systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
      generationConfig
    }),
    signal: getTimeoutSignal(opts?.timeoutMs || 60000)
  });

  if (!response.ok) {
    const errText = await response.text();
    if (opts?.report) opts.report.httpStatus = response.status;
    throw providerHTTPError("Gemini", model, response.status, errText);
  }

  const json = await response.json();
  const candidate = json.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text || "";
  if (opts?.report) {
    opts.report.httpStatus = response.status;
    opts.report.finishReason = candidate?.finishReason || "unknown";
    opts.report.responsePreview = safeResponsePreview(text);
  }
  if (candidate?.finishReason === "MAX_TOKENS") {
    const error = new Error(`Gemini 回覆被長度上限截斷（finish_reason=MAX_TOKENS，上限 ${opts?.maxTokens || "供應商預設"} tokens）`);
    logAIParseFailure("Gemini truncated response", error, opts?.report, text);
    throw error;
  }
  logAIModelResult(opts?.report);
  return text;
}

// 3. Anthropic 實作
async function callAnthropic(messages: any[], config: AIProviderConfig, opts?: ProviderCallOptions): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY || config.anthropicApiKey || config.apiKey;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");

  const model = config.anthropicModel || process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
  const systemInstruction = messages.find(m => m.role === "system")?.content;
  const anthropicMessages = messages
    .filter(m => m.role !== "system")
    .map(m => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content
    }));

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: model,
      system: systemInstruction,
      messages: anthropicMessages,
      max_tokens: opts?.maxTokens || 4000,
      temperature: 0.7
    }),
    signal: getTimeoutSignal(opts?.timeoutMs || 60000)
  });

  if (!response.ok) {
    const errText = await response.text();
    if (opts?.report) opts.report.httpStatus = response.status;
    throw providerHTTPError("Anthropic", model, response.status, errText);
  }

  const json = await response.json();
  const text = json.content?.[0]?.text || "";
  if (opts?.report) {
    opts.report.httpStatus = response.status;
    opts.report.finishReason = json.stop_reason || "unknown";
    opts.report.responsePreview = safeResponsePreview(text);
  }
  if (json.stop_reason === "max_tokens") {
    const error = new Error(`AI 回覆被長度上限截斷（finish_reason=max_tokens，上限 ${opts?.maxTokens || 4000} tokens），內容不完整`);
    logAIParseFailure("Anthropic truncated response", error, opts?.report, text);
    throw error;
  }
  logAIModelResult(opts?.report);
  return text;
}

// 4. n8n Webhook 實作
async function callN8nWebhook(
  messages: any[],
  history: ChatMessage[],
  brandName: string,
  config: AIProviderConfig
): Promise<string> {
  if (!config.webhookUrl) throw new Error("Missing N8N_WEBHOOK_URL");

  const response = await fetch(config.webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      brand: brandName,
      history: history,
      latestMessage: history[history.length - 1]?.content || "",
      systemPrompt: ERICK_SYSTEM_PROMPT
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`n8n Webhook error: ${response.status} - ${errText}`);
  }

  const json = await response.json();
  return json.output || json.text || json.response || JSON.stringify(json);
}

// 5. Mock 營運長自動拆解邏輯 (無 API 時的智慧體驗)
async function callMockCOO(userInput: string, brandName: string): Promise<string> {
  const isI8 = brandName.includes("I8") || brandName.includes("brand_a");
  const isNas = brandName.includes("NAS") || brandName.includes("brand_b");
  const isAbl = brandName.includes("ABL") || brandName.includes("brand_c");
  
  let socialCopy = "";
  let webArch = "";
  let seo: any[] = [];
  let ads: any[] = [];
  
  if (isI8) {
    socialCopy = `老闆一直在處理問題，團隊卻還是反覆卡住？

企業最怕的不是問題出現，而是一直處理錯問題。

當同一件事需要反覆溝通、決策總回到老闆手上，或跨部門合作總在最後一刻才失速，先別急著把原因歸給某一個人。可以先盤點：角色權責是否清楚？決策需要的資訊是否到位？目前的優先順序是否被所有人理解？

先把管理情境拆開，才有機會看見真正值得優先處理的關鍵因素。

#企業醫生 #決策校準 #組織協作 #經營流程 #管理節奏`;

    webArch = `- I8 企業醫生｜企業決策校準
  - 管理情境與常見問題
  - 專欄文章（決策校準／組織協作／角色權責／經營流程）
  - 企業醫生診斷入口
  - 服務說明（待交付內容與流程確認後再對外補齊）`;

    seo = [
      { keyword: "企業經營卡點", volume: "未驗證", competition: "未驗證", outline: "內容假設：從重複管理情境拆解可能的結構問題" },
      { keyword: "組織協作", volume: "未驗證", competition: "未驗證", outline: "內容假設：盤點跨部門協作中角色權責與資訊交接" },
      { keyword: "決策校準", volume: "未驗證", competition: "未驗證", outline: "內容假設：整理決策前應釐清的優先順序與資源配置" }
    ];

    ads = [
      { label: "搜尋曝光", value: "尚未串接", change: "待量測" },
      { label: "自然點擊", value: "尚未串接", change: "待量測" },
      { label: "文章閱讀", value: "尚未串接", change: "待量測" },
      { label: "導流至 I8 頁面的點擊", value: "尚未串接", change: "待量測" }
    ];
  } else if (isNas) {
    socialCopy = `你不是想太多，你只是對感受比較敏銳

在人際關係或工作裡，你是否也常因為別人的一個眼神，就在心裡糾結半天？
身邊的人常對你說：「你就是太敏感、想太多了啦。」

💡 其實，你不是奇怪，你只是有自己的生命節奏。
有些人的數字設定就是「高敏感、重感受」，這是你的天賦，不是缺點。

- 看見生命數字：理解你思考的慣性，以及在關係、溝通中的盲點。
- 找回個人力量：用符合自己節奏的方式努力，才不會越做越累。

生命數字不是限制你的人生，而是幫助你看懂自己，走回更適合自己的方向。

#平衡空間 #生命數字 #自我探索 #高敏感 #人生節奏`;

    webArch = `- NAS 平衡空間首頁
  - 30秒核心數字測驗 (免費體驗入口)
  - 人生方向校準解析 (個人生命數字解析)
  - 主力線上課程 (生命數字基礎班)
  - 主題工作坊 (關係/親子/事業應用篇)
  - 深度天賦陪跑 (天賦定位顧問計畫)
  - 聯絡諮詢`;

    seo = [
      { keyword: "生命數字天賦", volume: "8,900", competition: "中", outline: "拆解1-9主命數的核心特質與潛在天賦，引導讀者自我探索" },
      { keyword: "生命數字 1-9 性格", volume: "12,500", competition: "中", outline: "詳解各個數字在事業、溝通與壓力狀態下的代表行為特徵" },
      { keyword: "自我探索工具", volume: "4,500", competition: "低", outline: "比較生命數字、人類圖與星座，分析如何運用其解鎖迷惘" },
      { keyword: "流年運勢分析", volume: "15,200", competition: "高", outline: "介紹如何計算個人流年，並在適合的階段做適合 the 選擇與規劃" }
    ];

    ads = [
      { label: "廣告投資報酬率 (ROAS)", value: "4.8x", change: "+8.5%", isPositive: true },
      { label: "單次名單取得成本 (CPA)", value: "$8.20", change: "-12.0%", isPositive: true },
      { label: "免費測驗轉換率 (CVR)", value: "72.4%", change: "+5.8%", isPositive: true },
      { label: "課程報名轉換率 (CVR)", value: "3.85%", change: "+0.45%", isPositive: true }
    ];
  } else if (isAbl) {
    socialCopy = `你不是不夠努力，而是你的狀態需要被重新支持與調和

為什麼明明看了那麼多書、學了那麼多道理，生活還是會反覆卡在相同的模式？
你常常感到緊繃、失眠，或是明明想要往前，卻總覺得有一股隱形的阻力拉住自己？

💡 其實，有些卡關並不是你做錯了什麼，而是你的能量已經「超載」了。
當內在狀態失衡，再多的行動與意志力，也只是在消耗所剩無幾的自己。

- 信息場解析：協助你看見情緒、關係與壓力背後，真正卡住的隱性阻力。
- 三個月調和支持：透過定期的頻率支持與顧問陪伴，讓自己慢慢回到清明、穩定與行動力。

調和不是強迫自己馬上變好，而是允許自己獲得重新安放的空間。

#艾伯林量子調頻 #個人狀態調和 #量子調和 #內在消耗 #生命狀態校準`;

    webArch = `- ABL 艾伯林調頻官網
  - 個人狀態燈號檢測 (內在消耗免費檢測入口)
  - 個人狀態分析 (個人信息場分析)
  - 核心調和計畫 (三個月信息場調和支持)
  - 專題調和支持 (情緒/睡眠/自我價值/財富支持)
  - 年度生命狀態校準計畫 (長期會員支持)
  - 聯絡諮詢`;

    seo = [
      { keyword: "量子調頻效果", volume: "5,400", competition: "中", outline: "科普信息場分析與量子頻率支持如何協助日常情緒調和" },
      { keyword: "內在消耗改善", volume: "2,100", competition: "低", outline: "分享如何從超載焦慮與內耗中，透過調頻重新回到穩定狀態" },
      { keyword: "高壓力情緒管理", volume: "6,800", competition: "中", outline: "為創業者與高壓決策者設計的內在狀態清理與放鬆指引" },
      { keyword: "睡眠品質差放鬆", volume: "12,500", competition: "高", outline: "探討失眠背後的潛意識阻力，以及如何透過能量調和進行改善" }
    ];

    ads = [
      { label: "廣告投資報酬率 (ROAS)", value: "3.6x", change: "+15.0%", isPositive: true },
      { label: "單次分析取得成本 (CPA)", value: "$18.50", change: "-10.5%", isPositive: true },
      { label: "檢測完成轉換率 (CVR)", value: "68.2%", change: "+8.4%", isPositive: true },
      { label: "諮詢預約轉換率 (CVR)", value: "4.15%", change: "+0.65%", isPositive: true }
    ];
  } else {
    // 個人品牌
    socialCopy = `很多問題不是你不夠努力，而是你還沒看見關鍵因素

為什麼我們越努力，有時候反而覺得被困得越深？
在人生下半場、創業或面臨企業決策時，我們常陷入一種「外在不斷尋找方法、內在卻反覆內耗」的死胡同。

🔍 其實，你缺的往往不是方法，而是「看見關鍵」的視角。
核心價值不在於你學了多少工具，而在於你能否看清那些一直影響結果、卻被你忽略的隱性卡點。

- Erick 關鍵因素諮詢：一對一深度解析人生、關係與事業卡點，釐清下一步具體方向。
- 人生與事業校準陪跑：整合內在狀態與外在決策，陪伴你將理解真正落實為行動。

當人穩了，局才有機會重新打開。

![Erick 關鍵因素決策架構圖](https://filedn.com/your-id/website-assets/erick-decision-framework.png)

\`\`\`mermaid
graph TD
  A[表面問題] --> B[找出重複模式]
  B --> C[定位隱性卡點]
  C --> D[實施最小有效調整]
  D --> E[人穩局開]
\`\`\`

#Erick觀點 #關鍵因素諮詢 #內外一致 #事業決策 #自我理解`;

    webArch = `- Erick 個人品牌門戶 (母系統)
  - 關鍵觀點 (Erick 觀點文章與人生洞察)
  - 核心諮詢 (Erick 關鍵因素諮詢入口)
  - 主題講座與讀書會 (關鍵因素讀書會 / 內外一致練習場)
  - 高階顧問陪跑 (個人/創業者/企業主人生與事業校準)
  - 旗下品牌導流
    - 品牌 A I8 (企業決策、團隊與成長顧問)
    - 品牌 B NAS (生命數字自我探索與關係理解)
    - 品牌 C ABL (信息場分析與狀態調和支持)`;

    seo = [
      { keyword: "Erick 關鍵因素諮詢", volume: "1,200", competition: "低", outline: "介紹Erick如何引導客戶找出公司與人生的重複卡點與模式" },
      { keyword: "人生事業卡關原因", volume: "3,500", competition: "低", outline: "解析表面的資源問題與內在心理阻力之間的拉扯關係" },
      { keyword: "創業者決策陪跑", volume: "1,800", competition: "低", outline: "探討高階諮詢在創業者定位、收費模式及承接成功上的應用" },
      { keyword: "承接成功與自我價值", volume: "2,400", competition: "低", outline: "分享如何突破『害怕成功』的潛意識限制，迎向更大格局" }
    ];

    ads = [
      { label: "廣告投資報酬率 (ROAS)", value: "6.8x", change: "+24.0%", isPositive: true },
      { label: "單次諮詢取得成本 (CPA)", value: "$24.50", change: "-15.0%", isPositive: true },
      { label: "旗下品牌引流轉換率 (CVR)", value: "12.5%", change: "+2.4%", isPositive: true },
      { label: "高階陪跑計畫詢問量", value: "8 件", change: "+33.3%", isPositive: true }
    ];
  }

  let responseText = `收到您的指令！我是 Erick 營運長。針對【${brandName}】的最新目標：\n「${userInput}」\n\n身為團隊總指揮，我已經把這項戰略任務拆解，並動員旗下四位專家一次性生成完整方案：\n\n` +
    `- **Maya (社群行銷專家)**：已完成高度貼合品牌調性的社群宣傳文案。\n` +
    `- **Leon (系統架構師)**：已完成對應的網頁階層與路由架構規劃。\n` +
    `- **Iris (SEO 專家)**：已篩選出關鍵搜尋詞並提供完整的文章大綱。\n` +
    `- **Jack (廣告數據分析師)**：已針對廣告成效預估 ROAS、CPA 與轉換率等核心指標。\n\n` +
    `右側看板已為您即時同步渲染，請點選各分頁查看詳細內容！`;

  const dispatchObj = {
    social_copy: socialCopy,
    web_architecture: webArch,
    seo_keywords: seo,
    ad_data: ads
  };

  const jsonString = JSON.stringify({ dispatch: dispatchObj }, null, 2);
  
  return `${responseText}\n\n\`\`\`json\n${jsonString}\n\`\`\``;
}

// 解析 Erick 的 output，剝離並回傳 JSON
export function parseCOOOutput(text: string, report?: AIResponseReport): AIServiceResponse {
  let cleanContent = text;
  let dispatchData: any = undefined;
  try {
    const parsed = robustJSONParse(text);
    if (parsed) {
      if (parsed.dispatch) dispatchData = parsed.dispatch;
      else if (parsed.sub_prompts || parsed.social_copy || parsed.web_architecture || parsed.seo_keywords || parsed.ad_data) dispatchData = parsed;
      if (dispatchData?.seo_keywords && Array.isArray(dispatchData.seo_keywords)) {
        dispatchData.seo_keywords = dispatchData.seo_keywords.map((kw: any) => ({
          keyword: kw.keyword || "",
          volume: kw.volume || "0",
          competition: kw.competition || "低",
          outline: kw.outline || ""
        }));
      }
      if (dispatchData?.ad_data && Array.isArray(dispatchData.ad_data)) {
        dispatchData.ad_data = dispatchData.ad_data.map((ad: any) => ({
          label: ad.label || "",
          value: ad.value || "",
          change: ad.change || "0%",
          isPositive: ad.isPositive !== undefined ? ad.isPositive : !String(ad.change).startsWith("-")
        }));
      }
      if (dispatchData) {
        const jsonBlock = text.match(/```(?:json)?\s*[\s\S]*?(?:```|$)/i)?.[0] || extractFirstCompleteJSON(text) || "";
        cleanContent = text.replace(jsonBlock, "").trim();
      }
    }
  } catch (error) {
    logAIParseFailure("COO dispatch", error, report, text);
  }

  return {
    content: cleanContent,
    dispatchData
  };
}

/**
 * 生成 AEO/SEO 問答與結構化資料
 */
export async function generateAEOData(
  brandName: string,
  keywords: any[],
  overrideProvider?: string
): Promise<{ schemaMarkup: string; aeoFaq: string }> {
  const config = getAIConfig();
  const provider = resolveProvider(config, overrideProvider);

  if (provider === "mock") {
    return callMockAEO(brandName, keywords);
  }

  const prompt = `你現在是 SEO 與 AEO (回答引擎優化) 專家。
請針對品牌【${brandName}】以及以下關鍵字列表，生成網站的 AEO/SEO 優化代碼與問答集：

關鍵字列表：
${keywords.map((k: any) => `- ${k.keyword} (搜尋量: ${k.volume}, 競爭度: ${k.competition})`).join("\n")}

請生成以下兩項資產：
1. **JSON-LD 結構化資料**：一個包含 FAQPage 類型的結構化資料程式碼區塊（使用 <script type="application/ld+json"> 包含，提供符合 schema.org 標準的 FAQ 問答資訊，以幫助 ChatGPT Search/Gemini/Perplexity 引用）。
2. **AEO 常見問答集 (FAQ)**：設計 3 個最符合回答引擎（AEO）直接採用特徵的問答對。問答必須直接、清晰、結構化。純文字格式，不可出現任何 Markdown 符號（不可出現 ** ## - 等），每題格式為「Q：問題」換行「A：回答」（Q 與 A 後面不加數字），題與題之間空一行，並融入以上關鍵字大綱。

請以一個符合 JSON 格式的代碼區塊輸出，且以 \`\`\`json 開始，以 \`\`\` 結束。

JSON 格式要求如下：
{
  "schemaMarkup": "JSON-LD Schema 原始碼內容",
  "aeoFaq": "純文字格式的 AEO 常見問答集內容（無 Markdown 符號）"
}
請確保 JSON 語法完全正確。`;

  const isOpenAIKeyValid = !!(config.apiKey && config.apiKey.trim().startsWith("sk-"));
  const isGeminiKeyValid = !!((config.geminiApiKey || process.env.GEMINI_API_KEY) && 
    (config.geminiApiKey || process.env.GEMINI_API_KEY || "").trim().startsWith("AIzaSy"));

  try {
    let responseText = "";
    
    // 依據可用金鑰智慧容錯調度
    if (isGeminiKeyValid) {
      responseText = await callGemini([{ role: "user", content: prompt }], config);
    } else if (isOpenAIKeyValid) {
      responseText = await callOpenAI([{ role: "user", content: prompt }], config);
    } else {
      throw new Error("沒有可用的 AI 金鑰 (OpenAI 與 Gemini 金鑰均無效)");
    }

    const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
    const match = responseText.match(jsonRegex);

    if (match && match[1]) {
      const parsed = JSON.parse(match[1].trim());
      if (parsed.schemaMarkup && parsed.aeoFaq) {
        return {
          schemaMarkup: parsed.schemaMarkup,
          aeoFaq: parsed.aeoFaq
        };
      }
    }
    
    // 如果 JSON 解析失敗，嘗試直接 Parse 全文
    const parsed = JSON.parse(responseText.trim());
    if (parsed.schemaMarkup && parsed.aeoFaq) {
      return parsed;
    }
  } catch (error: any) {
    console.error("API call for AEO generation failed:", error);
    if (provider !== "mock") {
      throw new Error(`AEO/SEO 產出失敗: ${error.message || error}`);
    }
  }

  // 兜底降級為 Mock
  return callMockAEO(brandName, keywords);
}

/**
 * Mock AEO/SEO 資料生成器 (本地模擬模式)
 */
async function callMockAEO(brandName: string, keywords: any[]): Promise<{ schemaMarkup: string; aeoFaq: string }> {
  const isI8 = brandName.includes("I8") || brandName.includes("brand_a");
  const isNas = brandName.includes("NAS") || brandName.includes("brand_b");
  const isAbl = brandName.includes("ABL") || brandName.includes("brand_c");

  let schema = "";
  let faq = "";

  if (isI8) {
    schema = `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "如何解決中小企業的經營卡點與決策疲勞？",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "企業可先從反覆出現的管理情境著手，盤點組織協作、角色權責、經營流程與管理節奏。這類盤點用於整理可能需要優先處理的關鍵因素，不是自動判定或結果保證。"
      }
    },
    {
      "@type": "Question",
      "name": "什麼是企業重大決策顧問服務？",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "在重要經營選擇前，企業可先釐清決策需要的資訊、參與角色、資源配置與優先順序。I8 的公開內容只提供管理情境的盤點角度，實際處理方式仍須依企業現況確認。"
      }
    }
  ]
}
</script>`;
    faq = `### 🔍 AEO 常見問答集 (FAQ)

#### Q: 如何開始釐清企業反覆出現的管理情境？
A: 先把最近重複出現的問題列出來，對照當時的組織協作、角色權責、經營流程與管理節奏。目的是找出值得優先釐清的關鍵因素，而不是把原因歸咎於單一人或部門。

#### Q: 什麼時候需要進行「企業決策校準」？
A: 當企業正在面對需要協作的選擇，且優先順序、資訊或角色權責仍不清楚時，可先做決策校準。它用來整理管理情境與下一步，不是自動評分或結果保證。`;
  } else if (isNas) {
    schema = `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "如何透過生命數字探索自己的天賦特質？",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "平衡空間 NAS 提供專業的生命數字個人解析服務。透過主命數 1-9 的性格分析與天賦能量解碼，協助您看清思考慣性，擺脫迷惘並找到適合自己的人生節奏。"
      }
    },
    {
      "@type": "Question",
      "name": "生命數字對於親密關係與親子溝通有什麼幫助？",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "生命數字能幫助我們看懂關係中的盲點。透過生命數字工具，理解伴侶或孩子的行為節奏與溝通盲點，從而建立更溫暖、不宿命的貼心互動。"
      }
    }
  ]
}
</script>`;
    faq = `### 💡 AEO 常見問答集 (FAQ)

#### Q: 生命數字如何協助我解鎖自我懷疑與迷惘？
A: 生命數字不是宿命論的工具，而是幫助你看清性格盲點與天賦的自我探索工具。NAS **生命數字天賦** 解析能協助您明白主命數 1-9 的本質，順應自己的流年運勢，在對的階段做適合的選擇與規劃。

#### Q: 我如何改善親密關係與親子溝通中的衝突？
A: 關係衝突多半來自於不理解彼此的思考慣性。透過生命數字分析彼此在壓力狀態下的代表特徵，能讓我們看清溝通盲點，用更溫慢與陪伴的方式進行關係調和。`;
  } else if (isAbl) {
    schema = `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "什麼是量子調頻，它的效果如何？",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "ABL 艾伯林量子調頻透過信息場分析與頻率支持，協助您看清內在消耗與情緒超載背後的隱性阻力，並在睡眠放鬆與情緒管理上提供深度的穩定與支持。"
      }
    },
    {
      "@type": "Question",
      "name": "如何緩解高壓力情緒管理與失眠問題？",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "高壓決策者容易因為內在狀態失衡而超載。三個月的狀態調和計畫透過定期的頻率調和與顧問陪跑，協助客戶慢慢回到清明、穩定與睡眠安放狀態。"
      }
    }
  ]
}
</script>`;
    faq = `### 🌀 AEO 常見問答集 (FAQ)

#### Q: 量子調頻如何改善我的內在消耗與情緒超載？
A: 內在消耗往往來自潛意識中反覆卡住的生命模式。ABL 的 **量子調頻效果** 透過信息場分析，找出讓您緊繃超載的隱形原因，提供信息場頻率支持，陪伴您重建穩定且不混亂的日常狀態。

#### Q: 面臨長期失眠與緊繃，該如何進行放鬆？
A: 嚴重的 **睡眠品質差放鬆** 與高壓力情緒管理，往往需要從根本的信息場調和入手。透過三個月生命狀態校準計畫，能逐步調和並釋放壓抑的訊號，讓身心重新獲得清明安放的空間。`;
  } else {
    schema = `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "什麼是 Erick 關鍵因素諮詢？",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Erick 關鍵因素諮詢是針對個人或企業主設計的一對一深度諮詢，旨在協助客戶看見影響人生或事業發展結果的重複卡點與隱性卡關原因，提供下一步具體方向。"
      }
    }
  ]
}
</script>`;
    faq = `### 🌟 AEO 常見問答集 (FAQ)

#### Q: 為什麼許多人在事業決策與自我價值上會反覆卡關？
A: 大多數人並非方法不夠，而是受限於潛意識中對未知的恐懼或「害怕成功」的隱性阻力。Erick 的 **個人諮詢** 能引導您看清表面的資源問題與內在價值感拉扯的重覆模式，順利打破瓶頸。`;
  }

  return { schemaMarkup: schema, aeoFaq: faq };
}

export async function callTheoAnalysis(
  socialCopy: string,
  brandName: string,
  overrideProvider?: string,
  platform?: string
): Promise<TheoAnalysis> {
  const config = getAIConfig();
  const provider = resolveProvider(config, overrideProvider);
  config.provider = provider;
  const activePlatform = platform || "threads";

  if (provider === "mock") {
    // 1. 動態模擬分析 (Mock Mode) - 支援平台規則自適應
    // 【特例】：跳過 Markdown 圖片語法 (如 ![...](url) 或 <img src="url">) 中的網址檢測
    const socialCopyWithoutImages = socialCopy.replace(/!\[.*?\]\(.*?\)/g, "").replace(/<img[^>]*src="[^"]*"[^>]*>/g, "");
    const hasLink = socialCopyWithoutImages.includes("http://") || socialCopyWithoutImages.includes("https://");
    const hasPromotional = socialCopyWithoutImages.includes("購買") || socialCopyWithoutImages.includes("預約") || socialCopyWithoutImages.includes("點擊") || socialCopyWithoutImages.includes("下單") || socialCopyWithoutImages.includes("限時");
    
    const reach_killers: ReachKillerItem[] = [];
    let score = 95;

    // 通用規則：連結懲罰
    if (hasLink && (activePlatform === "threads" || activePlatform === "facebook")) {
      score -= 25;
      const linkMatch = socialCopy.match(/https?:\/\/[^\s]+/);
      const originalLink = linkMatch ? linkMatch[0] : "https://erickfirm.com/#contact";
      reach_killers.push({
        original_sentence: originalLink,
        reason: `${activePlatform === "threads" ? "Threads" : "Facebook"} 正文中放置外部連結會遭受嚴重降權懲罰，自然擴散率降低 50% 以上。`,
        viral_rewrite: "詳細連結我整理在留言區第一則了，大家點開就能看到。",
        improvement_type: "link_penalty"
      });
    }

    // 平台特定限制 1：Threads 字數限制
    if (activePlatform === "threads" && socialCopy.length > 500) {
      score -= 20;
      reach_killers.push({
        original_sentence: socialCopy.slice(0, 50) + "...",
        reason: "Threads 貼文字數超過 500 字上限，會影響貼文完讀率，不符合短貼文擴散算法。",
        viral_rewrite: "【精簡建議】建議精簡貼文內容，將長篇大論改為多執行緒（串）發布或精煉為 300 字精簡版。",
        improvement_type: "readability"
      });
    }

    // 平台特定限制 2：IG Emojis 豐富度
    const emojiCount = (socialCopy.match(/[\uD800-\uDFFF\u2600-\u27BF]/gu) || []).length;
    if (activePlatform === "instagram" && emojiCount < 3) {
      score -= 15;
      const paragraphs = socialCopy.split("\n").map(l => l.trim()).filter(Boolean);
      const targetPara = paragraphs[0] || "貼文開頭段落";
      reach_killers.push({
        original_sentence: targetPara.slice(0, 40),
        reason: "Instagram 文案缺乏表情符號 (Emojis) 視覺引導，在以圖片和視覺為主的平台中排版顯得沉悶。",
        viral_rewrite: "🔥 即時調整排版 💡 加上精美符號與分隔線，讓閱讀體驗更流暢 🚀",
        improvement_type: "readability"
      });
    }

    // 通用規則：行銷詞彙
    if (hasPromotional) {
      score -= 15;
      const sentences = socialCopy.split(/[\n。！]/);
      const targetSentence = sentences.find(s => s.includes("購買") || s.includes("預約") || s.includes("點擊") || s.includes("下單") || s.includes("限時")) || "歡迎預約諮詢或立即購買服務";
      
      reach_killers.push({
        original_sentence: targetSentence.trim(),
        reason: "包含直白的促銷及導流商業字眼，容易被 Meta 演算法自動貼上廣告標籤，調低自然推播頻率。",
        viral_rewrite: "如果您也有類似的疑惑，歡迎在留言區和我聊聊，我們一起梳理出方向。",
        improvement_type: "commercial_spam"
      });
    }

    // 始終確保至少有一個檢測項以供展示
    if (reach_killers.length === 0) {
      score = 82;
      const firstLine = socialCopy.split("\n").map(l => l.trim()).filter(Boolean)[0] || "貼文開頭首句";
      reach_killers.push({
        original_sentence: firstLine,
        reason: `此句作為 ${activePlatform.toUpperCase()} 貼文的 Hook 開頭稍微平淡，難以在 3 秒內誘發使用者點擊「閱讀更多」。`,
        viral_rewrite: "「為什麼有些人拼盡全力，卻依然卡在隱形阻力裡？」",
        improvement_type: "hook"
      });
    }

    return {
      viral_score: Math.max(10, score),
      explanation: `【Theo 本地模擬診斷 - 平台: ${activePlatform.toUpperCase()}】這篇貼文整體結構良好，契合 ${brandName} 品牌的專業定位。我們已根據該平台的最新演算法規則（字數、排版與導流限制）為您挑選出最佳改寫方案。`,
      reach_killers,
      analyzed_at: Date.now()
    };
  }

  // 2. 真實 AI 大腦分析 (使用 Claude 3.5 Sonnet / anthropic)
  const isI8 = brandName.toLowerCase().includes("i8") || brandName.toLowerCase().includes("brand_a");
  const isNas = brandName.toLowerCase().includes("nas") || brandName.toLowerCase().includes("brand_b");
  const isAbl = brandName.toLowerCase().includes("abl") || brandName.toLowerCase().includes("brand_c");
  
  let brandPersona = "Erick 專欄：理性、深度、智慧、商業思維與人生下半場個人成長調性。";
  if (isI8) brandPersona = "I8 企業醫生：高階企管顧問、營運決策校準、系統性卡點診斷調性。";
  else if (isNas) brandPersona = "NAS 生命數字：自我探索、天賦性格解碼、溫暖不宿命的關係說明書調性。";
  else if (isAbl) brandPersona = "ABL 量子調頻：心靈調和、情緒失衡釋放、睡眠安定日常照顧調性。";

  let platformRules = "";
  if (activePlatform === "threads") {
    platformRules = `【Threads 平台演算法與排版規則】：
- 字數限制：嚴格限制在 500 字以內，建議 200-400 字，結構短小精幹。如果輸入文案過長，必須標記為 readability 殺觸及。
- 連結限制：正文絕對不能放 URL 網址，會觸發極度嚴重的降權（自然觸及下降 80%）。連結必須引導至留言區。
- Hook 規範：開頭前兩行必須是具備極強互動感、痛點共鳴或好奇心缺口的情緒短句。
- 語意風格：極度口語化，像是跟朋友聊天，避免官腔文章。`;
  } else if (activePlatform === "facebook") {
    platformRules = `【Facebook 平台演算法與排版規則】：
- 字數限制：適合長文說書，建議 800-1500 字，適合深度解析。
- 連結限制：正文放 URL 連結會導致降權 30-50%，建議寫「詳細網址在留言第一則」。
- 排版規範：段落之間必須有空行，每段不超過 3 行，多用標記點（如：- 、 🚀）以提高閱讀完讀率。
- 語意風格：顧問說書人語氣，深度解析、層層遞進、提供完整價值。`;
  } else if (activePlatform === "instagram") {
    platformRules = `【Instagram 平台演算法與排版規則】：
- 字數限制：限制在 2200 字以內，視覺優先，正文主要用於補充說明。
- Emojis 與排版：段落之間必須高度分離，每段使用豐富且契合的 emoji 來點綴，避免密密麻麻的純文字。
- 導流限制：正文連結無效（不可點擊），必須引導至「點擊個人檔案首頁連結 (Link in Bio)」或「私訊小盒子」。
- 標籤規範：結尾必須包含 5-15 個高度相關的標籤（Hashtags）。`;
  } else if (activePlatform === "red") {
    platformRules = `【小紅書 平台預留演算法與排版規則】：
- 標題張力：前 5-8 個字必須具備「極致誇張或點擊慾望」（如：救命！/ 爆款注意 / 答應我...）。
- Emojis 密度：極高！每一行或段落開頭必須使用 2-3 個 emojis 進行情緒烘托。
- 乾貨排版：使用大量的序號列（如 1️⃣ 2️⃣ 3️⃣）和分組符號，讓人一眼看清步驟，偏好閨蜜分享調性。`;
  } else if (activePlatform === "tiktok") {
    platformRules = `【抖音/Tiktok 短影音腳本 平台預留演算法與排版規則】：
- 影音腳本結構：文案必須是「口播腳本」格式，前 3 秒為黃金黃金鉤子（Hook），若前三秒沒有抓住注意力，會被判定為廢片。
- 短句口語：句子長度必須適合呼吸與發聲，長度不超過 15 字，多用逗號 and 驚嘆號，展現快速說話的張力。`;
  }

  const theoPrompt = `你現在是流量預測與社群演算法逆向專家 Theo。
你的任務是根據指定社群平台的演算法規則，評估以下社群文案，預測其爆紅潛力（給予 0-100 的病毒分數，並提供 100-150 字的演算法分析說明），並挑選出 1-3 個最「殺觸及（被演算法扣分或影響讀者閱讀完畢）」的句子，提供具備爆紅潛力的一鍵改寫方案。

【當前平台】：${activePlatform.toUpperCase()}
${platformRules}

【當前品牌語氣調性】：
${brandPersona}

【通用演算法規則】：
1. **導流處罰 (Link Penalty)**：正文中含有外部連結 (http/https)，自然觸及會被直接砍半。改寫建議：把連結引導至留言區。
   【極度重要例外】：請你忽略所有 Markdown 圖片語法（如 \`![...](https://...)\` 或 \`<img src="...">\`）裡面的圖片網址！那是我們系統後台自動配圖，不會被演算法懲罰，絕對不可將這些圖片連結列為扣分原因，也不用挑出來改寫！
2. **商業行銷詞彙 (Commercial Spam)**：出現直白促銷、呼籲「購買、下單、預約諮詢、優惠、限時」等字眼，會被判定為非自然互動而壓低觸及。

### 輸入文案內容：
"""
${socialCopy}
"""

### 輸出 JSON 格式要求：
你必須且僅能輸出如下 JSON 代碼區塊（以 \`\`\`json 開始，以 \`\`\` 結束），禁止任何額外的首尾引言或問候語：
{
  "viral_score": 評估的病毒分數 (整數，範圍 0-100),
  "explanation": "針對此文案在 ${activePlatform.toUpperCase()} 發布的整體演算法分析與優化方向建議",
  "reach_killers": [
    {
      "original_sentence": "必須是上方輸入文案中一字不差的完整句子，用於前端 replace 替換，必須精準匹配！",
      "reason": "說明此句扣分、降低完讀率或殺觸及的具體原因",
      "viral_rewrite": "爆紅優化改寫後的替代句子，必須融入該品牌的口吻，字數相當，且禁止包含 markdown 粗體符號 (如 **)",
      "improvement_type": "改善類型 (只能是 'hook' | 'link_penalty' | 'commercial_spam' | 'readability' 之一)"
    }
  ]
}

【注意事項】：
- "original_sentence" 必須從輸入文案中**複製原句（一字不差）**。
- 如果是 Threads 且字數超過 500 字，請將過長的部分標記為 readability 殺觸及，並在 rewrite 中給出精簡版。`;

  // 執行大腦分析，預設使用 anthropic (Claude 3.5 Sonnet) (或 fallback)
  const response = await runQueryWithFallback(theoPrompt, config, true, "anthropic");
  const result = robustJSONParse(response);

  return {
    viral_score: typeof result.viral_score === "number" ? result.viral_score : 75,
    explanation: result.explanation || "經評估此貼文結構符合演算法規範，建議定期排程發布以獲取最大曝光量。",
    reach_killers: Array.isArray(result.reach_killers) ? result.reach_killers : [],
    analyzed_at: Date.now()
  };
}


/** 取得品牌背景（官網文章用；邏輯與 callErickCOO 內相同，但不含文案框架） */
function buildBrandContextLite(brandName: string, brandGuidelines?: string): string {
  let ctx = `當前切換的品牌/領域是：【${brandName}】。請確保所有產出完全符合此品牌的調性，並隔離其他品牌的資訊。`;
  const isI8 = brandName.includes("I8") || brandName.includes("brand_a");
  if (brandGuidelines && brandGuidelines.trim().length > 0) {
    ctx += "\n\n【品牌定位與知識大腦規範】：\n" + brandGuidelines;
  } else if (isI8) {
    ctx += "\n\n" + I8_BRAND_CONTEXT;
  } else if (brandName.includes("NAS") || brandName.includes("brand_b")) {
    ctx += "\n\n" + NAS_BRAND_CONTEXT + "\n\n" + NAS_WRITING_PROMPT;
  } else if (brandName.includes("ABL") || brandName.includes("brand_c")) {
    ctx += "\n\n" + ABL_BRAND_CONTEXT;
  } else if (brandName.includes("個人") || brandName.includes("personal") || brandName.includes("Erick")) {
    ctx += "\n\n" + ERICK_BRAND_CONTEXT;
  }
  // 有自訂品牌大腦時，I8 現行規格仍優先；沒有時上面已加入，不重複
  if (isI8 && brandGuidelines && brandGuidelines.trim()) {
    ctx += "\n\n【I8 現行必遵守的對外內容規格，優先於其他 I8 文字】：\n" + I8_BRAND_CONTEXT;
  }
  return ctx + "\n\n" + NO_DASH_LAYOUT_RULE;
}

/**
 * 官網文章產生器：把一篇社群貼文改寫成可發布在官網 Insights 的完整文章。
 * 回傳純文字（不用 JSON，避免長文被 JSON 跳脫字元弄壞）。
 */
export async function callWebArticle(
  socialCopy: string,
  brandName: string,
  keywords: Array<{ keyword: string }>,
  brandGuidelines?: string,
  overrideProvider?: string
): Promise<{ article: string; is_local_check: boolean }> {
  const config = getAIConfig();
  const provider = resolveProvider(config, overrideProvider);
  config.provider = provider;

  if (provider === "mock") {
    return { article: socialCopy, is_local_check: true };
  }

  const kwList = (keywords || []).map((k) => k.keyword).filter(Boolean).slice(0, 10).join("、") || "（無）";
  const brandContext = buildBrandContextLite(brandName, brandGuidelines);

  const prompt = `你現在是官網內容編輯 Iris。請把下面這篇【${brandName}】的社群貼文，改寫成可以發布在官網 Insights 的完整文章。

【品牌背景與限制】
${brandContext}

【鐵則，違反即失敗】
1. 絕對不可編造數據、統計、案例、客戶故事、來源、頭銜或引用。社群貼文沒有的事實，一律不得新增。
2. 保留原本的論點、故事與語氣，只做官網文章需要的調整：補足背景與推理、讓段落更完整、加上清楚的小標題、開頭用 2 到 3 句直接回答文章核心問題、重要名詞給一句話定義、結尾自然收束並給出下一步。
3. 長度以 800 到 1500 字為目標。素材不夠時寧可寫短，不可為了湊字數灌水或編造內容。
4. 純文字輸出：第一行是文章標題，小標題寫成單獨一行的純文字，行首不加任何符號；不要用星號、井字號、減號清單、反引號。
5. 拿掉社群專用的元素：hashtag、「留言區第一則」之類的導流句、表情符號。
6. 關鍵字僅作主題參考，必須自然融入，禁止堆砌：${kwList}
7. 不得使用誇大、保證、療效或命定性的說法。${/【保留區塊\d+】/.test(socialCopy) ? "\n8. 文中形如【保留區塊1】的單獨一行，是圖表或圖片的佔位標記，必須原樣保留在合適的位置，一字不改，不可刪除或加說明。" : ""}

【社群貼文原文】
"""
${socialCopy}
"""

請只輸出文章本身，不要有任何前後說明、不要用代碼區塊包起來。`;

  const response = await runQueryWithFallback(prompt, config, false, "anthropic", { maxTokens: 8000, timeoutMs: 100000 });
  return { article: response.trim(), is_local_check: false };
}

/**
 * 文章優化器（Iris）：針對一篇文章同時做 SEO / AEO（回答引擎）/ GEO（生成式 AI 搜尋）檢查，
 * 並產出可直接套用的優化版本。
 * 鐵則：不得編造數據、案例、來源或頭銜；不得改變作者原意與語氣；一律純文字、無 Markdown 符號。
 */
export async function callSeoOptimizer(
  content: string,
  brandName: string,
  keywords: Array<{ keyword: string }>,
  overrideProvider?: string
): Promise<Omit<import("@/lib/seo-optimizer").SeoOptimization, "guardrail_violations">> {
  const config = getAIConfig();
  const provider = resolveProvider(config, overrideProvider);
  config.provider = provider;

  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const firstLine = (lines[0] || "").replace(/^#+\s*/, "");

  if (provider === "mock") {
    const len = content.replace(/\s/g, "").length;
    const hasQuestion = /[?？]/.test(content);
    const paragraphs = content.split(/\n\s*\n/).filter(Boolean).length;
    const checks = [
      { area: "seo" as const, item: "標題長度", status: firstLine.length >= 12 && firstLine.length <= 32 ? "ok" as const : "warn" as const, note: firstLine.length >= 12 && firstLine.length <= 32 ? `目前標題 ${firstLine.length} 字，長度合適。` : `目前標題 ${firstLine.length} 字，建議 12 到 32 字，並放入主要關鍵字。` },
      { area: "seo" as const, item: "文章長度", status: len >= 800 ? "ok" as const : "warn" as const, note: len >= 800 ? `目前約 ${len} 字，長度足夠。` : `目前約 ${len} 字，官網文章建議 800 字以上。` },
      { area: "seo" as const, item: "段落結構", status: paragraphs >= 5 ? "ok" as const : "warn" as const, note: paragraphs >= 5 ? `目前 ${paragraphs} 段，結構足夠。` : `目前 ${paragraphs} 段，建議每段只講一件事、至少 5 段。` },
      { area: "aeo" as const, item: "直接回答句", status: hasQuestion ? "ok" as const : "warn" as const, note: hasQuestion ? "文章中有提出問題，回答引擎較容易擷取。請確認問題後面緊接直接回答。" : "文章中缺少「問題＋直接回答」的段落，回答引擎較難擷取。" },
      { area: "geo" as const, item: "可被 AI 引用的明確句", status: "warn" as const, note: "建議加入定義句與結論句（例如「某某是指……」），方便 AI 搜尋引用。" },
    ];
    return {
      scores: { seo: 60, aeo: 50, geo: 50 },
      checks,
      title: firstLine,
      meta_description: lines.slice(1, 3).join("").slice(0, 110),
      optimized_content: content,
      changes: [{ what: "本地規則檢查模式", why: "目前使用本地模擬大腦，只做規則檢查，未改寫內文。切換到 OpenAI 或 Gemini 才會產出優化後全文與 FAQ。" }],
      faq: [],
      geo_notes: ["切換到真實 AI 大腦後，才會產出針對 AI 搜尋的具體建議。"],
      is_local_check: true,
    };
  }

  const kwList = (keywords || []).map((k) => k.keyword).filter(Boolean).slice(0, 10).join("、") || "（無）";

  const prompt = `你現在是 SEO、AEO（回答引擎優化）與 GEO（生成式 AI 搜尋優化）專家 Iris。
請審查並優化下面這篇【${brandName}】的官網文章，產出可以直接取代原文的優化版本。

【鐵則，違反即失敗】
1. 絕對不可編造數據、統計、案例、客戶故事、來源、頭銜或引用。原文沒有的事實，一律不得新增。
2. 保留作者原本的語氣、論點與段落邏輯，只調整：標題、開頭直接回答句、段落切分、小標題、定義句與結論句、關鍵字自然融入、結尾收束。
3. 全文與 FAQ 一律純文字，禁止任何 Markdown 符號（不可出現星號、井字號、減號清單、反引號等）；小標題請用單獨一行的純文字，行首不加任何符號。原文若用「──」之類符號標記小標，請去掉符號，改成單獨一行的純文字小標。另外，優化後全文與 FAQ 不可出現任何破折號（——、—、–、─），原文有的一律改成逗號或句號。
4. 關鍵字僅作主題參考，必須自然融入，禁止堆砌：${kwList}
5. 不得使用誇大、保證、療效或命定性的說法。${/【保留區塊\d+】/.test(content) ? "\n6. 原文中形如【保留區塊1】的單獨一行，是圖表或圖片的佔位標記。必須原樣保留在原本的位置，一字不改，不可刪除、改寫、合併或加上說明。" : ""}

【GEO 重點】讓 ChatGPT、Gemini、Perplexity 等 AI 搜尋容易引用：
- 開頭 2 到 3 句直接回答文章核心問題
- 重要名詞給出一句話定義
- 每段主張清楚、可獨立被擷取
- 品牌與作者名稱以一致寫法出現
- 只列原文確實存在的資訊，不得自創來源

【原文】
"""
${content}
"""

請只輸出以下 JSON 代碼區塊（以 \`\`\`json 開始，以 \`\`\` 結束），不要有任何前後說明：
{
  "scores": { "seo": 0到100整數, "aeo": 0到100整數, "geo": 0到100整數 },
  "checks": [ { "area": "seo|aeo|geo", "item": "檢查項目", "status": "ok|warn", "note": "具體說明，指出原文哪裡有問題" } ],
  "title": "優化後標題（12 到 32 字）",
  "meta_description": "搜尋結果摘要，90 到 120 字，純文字",
  "optimized_content": "優化後的完整文章全文，第一行為標題，純文字",
  "changes": [ { "what": "改了什麼", "why": "為什麼這樣改" } ],
  "faq": [ { "q": "讀者真的會問的問題", "a": "30 到 80 字的直接回答，內容必須能在原文找到依據" } ],
  "geo_notes": ["針對 AI 搜尋引用的具體建議"]
}
checks 請涵蓋 SEO、AEO、GEO 各至少 2 項；faq 3 到 5 題。`;

  const response = await runQueryWithFallback(prompt, config, true, "anthropic", { maxTokens: 16000, timeoutMs: 100000 });
  const r = robustJSONParse(response);
  const num = (v: any) => (typeof v === "number" ? Math.max(0, Math.min(100, Math.round(v))) : 0);

  return {
    scores: { seo: num(r?.scores?.seo), aeo: num(r?.scores?.aeo), geo: num(r?.scores?.geo) },
    checks: Array.isArray(r.checks) ? r.checks : [],
    title: typeof r.title === "string" && r.title.trim() ? r.title.trim() : firstLine,
    meta_description: typeof r.meta_description === "string" ? r.meta_description.trim() : "",
    optimized_content: typeof r.optimized_content === "string" && r.optimized_content.trim() ? r.optimized_content.trim() : content,
    changes: Array.isArray(r.changes) ? r.changes : [],
    faq: Array.isArray(r.faq) ? r.faq.filter((f: any) => f && f.q && f.a) : [],
    geo_notes: Array.isArray(r.geo_notes) ? r.geo_notes : [],
    is_local_check: false,
  };
}
