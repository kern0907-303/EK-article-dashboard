import { stripDashes, stripMarkdown } from "../../lib/plain-text";

export const STORY_ARGUMENT_FRAMEWORK_ID = "story_argument";
export const STORY_ARGUMENT_PROMPT_VERSION = "story-argument-v1";

export type StoryArgumentVersion = "empathy" | "full";

export interface StoryArgumentSelection {
  version: StoryArgumentVersion;
  thesis: string;
}

export interface StoryArgumentMeta extends StoryArgumentSelection {
  thesis: string;
  prompt_version: string;
  model_version?: string;
}

export const STORY_ARGUMENT_VERSION_OPTIONS: Array<{ id: StoryArgumentVersion; name: string }> = [
  { id: "empathy", name: "共情版" },
  { id: "full", name: "完整版" },
];

export const STORY_ARGUMENT_GENRE_NOTICE =
  "若同時使用文體生成，文體的段落骨架與限制優先；故事框架只補充單一論點、來源與純文字規則。";

export const STORY_ARGUMENT_FRAMEWORK = {
  id: STORY_ARGUMENT_FRAMEWORK_ID,
  name: "故事論點（單論點故事型）",
  author: "Erick",
  description: "以一個論點、具體場景與單一概念支撐文章；可選共情版或完整版。",
  promptContext: "",
};

export function getWritingFrameworkOptions<T extends { id: string }>(existing: T[]) {
  return [...existing, STORY_ARGUMENT_FRAMEWORK];
}

export function resolveStoryArgumentSelection(
  frameworkId: string,
  version: StoryArgumentVersion,
  thesis: string
): StoryArgumentSelection | undefined {
  if (frameworkId !== STORY_ARGUMENT_FRAMEWORK_ID) return undefined;
  return { version, thesis: thesis.trim() };
}

const SECTION_LABELS = ["切入現象", "故事", "論點支持", "解決方案"] as const;

export function getStoryArgumentSections(version: StoryArgumentVersion): string[] {
  return [...SECTION_LABELS.slice(0, version === "empathy" ? 3 : 4)];
}

export function buildStoryArgumentPrompt(
  selection: StoryArgumentSelection,
  options: { genreMode?: boolean } = {}
): string {
  const sections = getStoryArgumentSections(selection.version);
  const sectionRules = [
    "切入現象：先寫讀者當下的感受或處境，讓讀者覺得被理解，不給建議。",
    "故事：寫一個有場景細節的情境，轉折靠一句關鍵的話。優先使用使用者明確提供的品牌或專案故事素材；沒有素材時，用不涉及真人、沒有姓名的泛化場景，不得捏造具名個案或真實見證。",
    "論點支持：只用一個概念支持全文論點。不得憑記憶引用書籍、作者、研究或數據。使用者沒有在本次提示詞提供可核對來源時，必須保留【需補：引用來源】，並以一至兩句通用說明代替，不得編造出處。",
    "解決方案：提供與單一論點直接相關、可理解的做法，不延伸成第二個觀點。",
  ];
  const versionRule = selection.version === "empathy"
    ? "共情版只寫前三段，絕對不產出解決方案或第四段，結尾以陪伴與看見收束。"
    : "完整版必須依序寫完四段，包含解決方案。";
  const thesisRule = selection.thesis
    ? `使用者指定的一句話論點是：${selection.thesis}。全文只能支持這一個論點。`
    : "使用者沒有提供一句話論點。先擬定一句精簡論點放入 JSON 的 story_thesis 欄位；文章本體不得另加論點標籤或把論點欄位重複貼進發佈文案。";
  const genreRule = options.genreMode
    ? "【與文體同用】文體提示詞的段落骨架、漏斗層與格式限制優先。若文體與本框架的段落數或段落名稱衝突，遵守文體；仍須盡量維持單一論點、不得捏造來源及純文字要求。"
    : "";

  return [
    `【寫作框架：${STORY_ARGUMENT_FRAMEWORK.name}】`,
    `prompt_version: ${STORY_ARGUMENT_PROMPT_VERSION}`,
    "一篇文章只講一個論點。寫完後全文必須能用一句話複述，不得發散成多個觀點。",
    thesisRule,
    versionRule,
    "段落依序使用以下純文字段名，每段只承擔該段任務：",
    ...sections.map((label, index) => `${label}：${sectionRules[index]}`),
    "【品牌格式與事實】社群文案只輸出純文字，不得出現 Markdown 符號或任何破折號、橫線。停頓使用逗號或句號。遵守既有品牌規範與禁用詞，不得把一句話論點併入 social_copy 作為額外標籤。",
    genreRule,
    "【輸出格式】只輸出合法 JSON 物件，不要程式碼區塊或前後說明。story_thesis 是供介面展示的一句話論點，不屬於文章；social_copy 只放可編輯的文章正文。",
    '{ "story_thesis": "一句話論點", "social_copy": "依規則完成的純文字文章" }',
  ].filter(Boolean).join("\n\n");
}

/** 故事論點限定清理，不影響其他框架；論點只留在獨立 metadata，不混入文章正文。 */
export function normalizeStoryArgumentCopy(input: string, thesis = ""): string {
  const unfenced = input
    .replace(/```(?:[a-z]+)?\s*/gi, "")
    .replace(/```/g, "");
  const cleaned = stripDashes(stripMarkdown(unfenced));
  const lines = cleaned.split("\n");
  const first = lines[0]?.trim() || "";
  const normalizedThesis = thesis.trim();
  if (normalizedThesis && (first === normalizedThesis || first === `一句話論點：${normalizedThesis}`)) {
    lines.shift();
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
