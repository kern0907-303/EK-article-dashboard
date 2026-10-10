export const DERIVATIVE_PLATFORM_ORDER = ["Threads", "IG", "Reel", "YT", "小紅書", "抖音"];
export const SCIENCE_CHANNELS = ["小紅書", "抖音"];
export const DERIVATIVE_PROMPT_VERSION = "derivatives-v1";

const DASHES = /[\u002d\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/u;
const MARKDOWN = /(?:[#*`>|]|^\s*[-+]\s|\[[^\]]+\]\([^)]*\)|_{1,2})/m;
const METAPHYSICS_TERMS = ["命理", "算命", "占卜", "運勢", "运势", "八字", "星座預測", "星座预测", "風水", "风水", "玄學", "玄学", "通靈", "通灵", "改運", "改运", "開運", "开运", "轉運", "转运", "靈性", "灵性", "靈魂", "灵魂", "能量場", "能量场", "信息場", "信息场", "調頻", "调频", "生命靈數", "生命灵数"];

export function isDerivativesEnabled(value = process.env.DERIVATIVES_ENABLED) {
  return value === "true";
}

export function derivativeLanguages(platform) {
  return SCIENCE_CHANNELS.includes(platform) ? ["zh-TW", "zh-CN"] : ["zh-TW"];
}

export function isScienceChannel(platform) {
  return SCIENCE_CHANNELS.includes(platform);
}

export function shouldSkipSciencePlatform(platform, parentText = "") {
  return isScienceChannel(platform) && isMetaphysicalTopic(parentText);
}

export function selectPlatformSpec(specs = [], platform, format) {
  return specs.find((item) => item.platform === platform && item.format === format) || specs.find((item) => item.platform === platform) || {};
}

export function buildKnowledgeDirectoryForPrompt(directory = []) {
  return directory.map(({ id, title, author, domain, subdomain }) => ({ id, title, author, domain, subdomain }));
}

export function isMetaphysicalTopic(text = "") {
  return METAPHYSICS_TERMS.some((term) => text.includes(term));
}

export function getMissingMarkers(text = "") {
  return [...new Set(text.match(/【需補[^】]*】/g) || [])];
}

export function ensureScienceMarker(content, hasAllowedSource) {
  const marker = "【需補：科學依據】";
  if (hasAllowedSource || content.includes(marker)) return content;
  return `${content.trim()}\n${marker}`;
}

export function carryMissingMarkers(parentText, derivativeText) {
  const result = derivativeText.trim();
  const missing = getMissingMarkers(parentText).filter((marker) => !result.includes(marker));
  return missing.length ? `${result}\n${missing.join("\n")}` : result;
}

export function checkPlainText(text = "") {
  const violations = [];
  if (DASHES.test(text)) violations.push("含有破折號");
  if (MARKDOWN.test(text)) violations.push("含有 Markdown 符號");
  return violations;
}

export function scanSensitiveRules(text, rules = [], languageVersion = "zh-TW") {
  const matched = [];
  for (const rule of rules) {
    if (!rule.enabled || rule.language_version !== languageVersion) continue;
    for (const term of rule.blocked_terms || []) {
      if (term && text.includes(term)) matched.push({ term, category: rule.category, source_urls: rule.source_urls || [], status: rule.status, block_available: rule.block_available !== false });
    }
  }
  return matched;
}

export function contentMetrics(content, spec = {}) {
  const text = typeof content === "string" ? content : JSON.stringify(content ?? "");
  const slides = [...text.matchAll(/(?:第\s*\d+\s*[張张]|第\s*\d+\s*幕|畫面\s*\d+|画面\s*\d+)/g)].length;
  const hashtags = [...text.matchAll(/#[^\s#]+/g)].length;
  const tagLine = text.match(/(?:標籤|标签|話題標籤|话题标签)\s*[：:]\s*([^\n]+)/)?.[1] || "";
  const tagCount = hashtags || (tagLine ? tagLine.split(/[、,，\s]+/).filter(Boolean).length : 0);
  const warnings = [];
  if (Number.isFinite(spec.max_text_length) && [...text].length > spec.max_text_length) warnings.push(`文字長度 ${[...text].length}，上限 ${spec.max_text_length}`);
  if (Number.isFinite(spec.title_max_length)) {
    const title = text.match(/(?:標題|標題文字|長片標題|标题|标题文字|长片标题)\s*[：:]\s*([^\n]+)/)?.[1] || "";
    if ([...title].length > spec.title_max_length) warnings.push(`標題長度 ${[...title].length}，上限 ${spec.title_max_length}`);
  }
  if (Number.isFinite(spec.carousel_max) && slides > spec.carousel_max) warnings.push(`張數 ${slides}，上限 ${spec.carousel_max}`);
  if (Number.isFinite(spec.hashtag_max) && tagCount > spec.hashtag_max) warnings.push(`標籤數 ${tagCount}，建議不超過 ${spec.hashtag_max}`);
  return { character_count: [...text].length, slide_count: slides, hashtag_count: tagCount, warnings };
}

export function validateDerivativePayload(platform, payload = {}) {
  const string = (value) => typeof value === "string" && value.trim().length > 0;
  const optionalString = (value) => typeof value === "string";
  const array = (value, min = 1) => Array.isArray(value) && value.length >= min && value.every(string);
  const scenes = (value) => Array.isArray(value) && value.length > 0 && value.every((scene) => scene && string(scene.text) && Number.isFinite(Number(scene.seconds)) && string(scene.transition));
  if (platform === "Threads") return string(payload.single) && array(payload.thread, 3) && payload.thread.length <= 5;
  if (platform === "IG") return string(payload.caption) && array(payload.tags, 1) && array(payload.carousel, 2);
  if (platform === "Reel") return scenes(payload.scenes);
  if (platform === "YT") return !!payload.shorts && scenes(payload.shorts.scenes) && !!payload.long && string(payload.long.title) && string(payload.long.description) && array(payload.long.chapters) && string(payload.long.thumbnailText) && array(payload.long.outline);
  if (platform === "小紅書") return string(payload.title) && string(payload.body) && array(payload.tags, 1) && array(payload.carousel, 2) && optionalString(payload.citation_title) && optionalString(payload.citation_author);
  if (platform === "抖音") return string(payload.title) && array(payload.tags, 1) && scenes(payload.scenes) && optionalString(payload.citation_title) && optionalString(payload.citation_author);
  return false;
}

export function formatDerivativeContent(platform, languageVersion, payload = {}) {
  const lines = [];
  const labels = languageVersion === "zh-CN"
    ? { single: "单条版", thread: "串文第", caption: "说明文字", tags: "标签", slide: "第", scene: "画面", seconds: "建议秒数", transition: "转场", title: "标题", body: "正文", longTitle: "长片标题", longDescription: "长片说明", chapter: "章节", thumbnail: "缩略图文字", outline: "稿纲", short: "Shorts 动态图文脚本", reel: "动态图片脚本", dynamic: "动态图片画面" }
    : { single: "單則版", thread: "串文第", caption: "說明文字", tags: "標籤", slide: "第", scene: "畫面", seconds: "建議秒數", transition: "轉場", title: "標題", body: "正文", longTitle: "長片標題", longDescription: "長片說明", chapter: "章節", thumbnail: "縮圖文字", outline: "稿綱", short: "Shorts 動態圖文腳本", reel: "動態圖文腳本", dynamic: "動態圖文畫面" };
  const add = (label, value) => {
    if (value == null || value === "") return;
    if (/標籤|标签/.test(label) && Array.isArray(value)) value = value.map((tag) => String(tag).replace(/^#+\s*/, ""));
    lines.push(`${label}：${Array.isArray(value) ? value.join("、") : value}`);
  };
  if (platform === "Threads") {
    add(labels.single, payload.single);
    if (Array.isArray(payload.thread)) payload.thread.forEach((item, index) => add(`${labels.thread} ${index + 1} 則`, item));
  } else if (platform === "IG") {
    add(labels.caption, payload.caption);
    add(labels.tags, payload.tags);
    if (Array.isArray(payload.carousel)) payload.carousel.forEach((item, index) => add(`${labels.slide} ${index + 1} 張`, item));
  } else if (platform === "Reel" || (platform === "YT" && payload.scenes)) {
    addScenes(lines, platform === "Reel" ? labels.reel : labels.short, payload.scenes, labels);
  } else if (platform === "YT") {
    if (payload.shorts) addScenes(lines, labels.short, payload.shorts.scenes, labels);
    const long = payload.long || {};
    add(labels.longTitle, long.title);
    add(labels.longDescription, long.description);
    if (Array.isArray(long.chapters)) long.chapters.forEach((item, index) => add(`${labels.chapter} ${index + 1}`, item));
    add(labels.thumbnail, long.thumbnailText);
    if (Array.isArray(long.outline)) long.outline.forEach((item, index) => add(`${labels.outline} ${index + 1}`, item));
  } else if (platform === "小紅書") {
    add(labels.title, payload.title);
    add(labels.body, payload.body);
    add(labels.tags, payload.tags);
    if (Array.isArray(payload.carousel)) payload.carousel.forEach((item, index) => add(`${labels.slide} ${index + 1} 張`, item));
  } else if (platform === "抖音") {
    add(labels.title, payload.title);
    add(languageVersion === "zh-CN" ? "话题标签" : "話題標籤", payload.tags);
    addScenes(lines, labels.dynamic, payload.scenes, labels);
  }
  if (languageVersion === "zh-CN") lines.unshift("简体版");
  return lines.join("\n").trim();
}

function addScenes(lines, title, scenes, labels) {
  if (!Array.isArray(scenes)) return;
  lines.push(`${title}：`);
  scenes.forEach((scene, index) => {
    lines.push(`${labels.scene} ${index + 1}：${scene.text || ""}`);
    if (scene.seconds != null) lines.push(`${labels.seconds}：${scene.seconds}`);
    if (scene.transition) lines.push(`${labels.transition}：${scene.transition}`);
  });
}

export function deriveChecks({ parentText, content, platform, languageVersion, rules = [], spec = {}, existingGuardrailPassed = true, humanConfirmed = false, extraBlockers = [] }) {
  const requiredMarkers = getMissingMarkers(parentText);
  const carriedMarkers = requiredMarkers.filter((marker) => content.includes(marker));
  const plainTextViolations = checkPlainText(content);
  const sensitiveMatches = isScienceChannel(platform) ? scanSensitiveRules(content, rules, languageVersion) : [];
  const metrics = contentMetrics(content, spec);
  const blockers = [];
  if (!existingGuardrailPassed) blockers.push("既有品牌禁用詞檢查未通過");
  for (const item of extraBlockers) if (item && !blockers.includes(item)) blockers.push(item);
  if (requiredMarkers.length !== carriedMarkers.length) blockers.push("母文章的【需補】標記未完整帶入");
  if (content.includes("【需補")) blockers.push("含有【需補】標記");
  if (plainTextViolations.length) blockers.push(...plainTextViolations);
  if (sensitiveMatches.some((item) => item.block_available)) blockers.push("命中待人工確認的平台紅線詞，須人工修改後才能放行");
  return { metrics, plain_text_violations: plainTextViolations, required_markers: requiredMarkers, carried_markers: carriedMarkers, sensitive_matches: sensitiveMatches, warnings: metrics.warnings, blockers, status: blockers.length ? "needs_review" : "draft" };
}

export function stableParentId(brandId, platform, content) {
  let hash = 2166136261;
  const source = `${brandId}\u0000${platform}\u0000${content}`;
  for (let i = 0; i < source.length; i += 1) hash = Math.imul(hash ^ source.charCodeAt(i), 16777619);
  return `workspace_social:${brandId}:${platform}:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
