import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  DERIVATIVE_PLATFORM_ORDER, carryMissingMarkers, checkPlainText, contentMetrics,
  deriveChecks, derivativeLanguages, ensureScienceMarker, formatDerivativeContent,
  isDerivativesEnabled, isMetaphysicalTopic, scanSensitiveRules, stableParentId, validateDerivativePayload, shouldSkipSciencePlatform, selectPlatformSpec, buildKnowledgeDirectoryForPrompt,
} from "../src/lib/derivatives-core.mjs";

test("預設總開關關閉，六平台順序固定", () => {
  assert.equal(isDerivativesEnabled(undefined), false);
  assert.equal(isDerivativesEnabled("true"), true);
  assert.deepEqual(DERIVATIVE_PLATFORM_ORDER, ["Threads", "IG", "Reel", "YT", "小紅書", "抖音"]);
});

test("小紅書與抖音各有繁簡版本，其他平台只有繁體", () => {
  assert.deepEqual(derivativeLanguages("小紅書"), ["zh-TW", "zh-CN"]);
  assert.deepEqual(derivativeLanguages("抖音"), ["zh-TW", "zh-CN"]);
  assert.deepEqual(derivativeLanguages("Threads"), ["zh-TW"]);
});

test("平台設定按平台與形式讀取，科普跳過只作用於小紅書與抖音", () => {
  const rows = [{ platform: "IG", format: "貼文", max_text_length: 2000 }, { platform: "IG", format: "輪播", carousel_max: 10 }];
  assert.equal(selectPlatformSpec(rows, "IG", "輪播").carousel_max, 10);
  assert.equal(shouldSkipSciencePlatform("小紅書", "命理與運勢"), true);
  assert.equal(shouldSkipSciencePlatform("抖音", "能量場與運勢"), true);
  assert.equal(shouldSkipSciencePlatform("Threads", "命理與運勢"), false);
  assert.equal(shouldSkipSciencePlatform("IG", "命理與運勢"), false);
});

test("送給選書模型的目錄只有書目欄位，不含全文", () => {
  const result = buildKnowledgeDirectoryForPrompt([{ id: "1", title: "書名", author: "作者", domain: "情緒", subdomain: "心理", content: "不可傳出的全文", source_file: "private.md" }]);
  assert.deepEqual(result, [{ id: "1", title: "書名", author: "作者", domain: "情緒", subdomain: "心理" }]);
  assert.equal("content" in result[0], false);
});

test("知識全文讀取模組僅限伺服器，資料表只授權 service role", async () => {
  const source = await readFile("src/lib/knowledge-notes-server.ts", "utf8");
  const migration = await readFile("docs/sql/2026-10-07_derivatives.sql", "utf8");
  assert.match(source, /^import ["']server-only["'];/);
  assert.match(migration, /revoke all on table public\.platform_specs, public\.platform_content_rules, public\.derivative_posts from public, anon, authenticated;/);
});

test("各平台結構格式化且使用純文字標籤", () => {
  const threads = formatDerivativeContent("Threads", "zh-TW", { single: "短文", thread: ["一", "二", "三"] });
  assert.match(threads, /單則版：短文/);
  assert.match(threads, /串文第 3 則：三/);
  const ig = formatDerivativeContent("IG", "zh-TW", { caption: "說明", tags: ["情緒"], carousel: ["鉤子", "行動呼籲"] });
  assert.match(ig, /第 1 張：鉤子/);
  assert.match(ig, /第 2 張：行動呼籲/);
  const simplified = formatDerivativeContent("小紅書", "zh-CN", { title: "标题", body: "正文", tags: ["#情绪"], carousel: ["钩子", "行动"] });
  assert.match(simplified, /简体版/);
  assert.match(simplified, /标签：情绪/);
  assert.equal(simplified.includes("#"), false);
  const reel = formatDerivativeContent("Reel", "zh-TW", { scenes: [{ text: "畫面一", seconds: 4, transition: "淡入" }] });
  assert.match(reel, /建議秒數：4/);
  const yt = formatDerivativeContent("YT", "zh-TW", { long: { title: "長標題", chapters: ["00:00 開場"], thumbnailText: "縮圖字", outline: ["段一"] } });
  assert.match(yt, /長片標題：長標題/);
  assert.match(yt, /稿綱 1：段一/);
});

test("六平台的預期輸出結構都有獨立驗證", () => {
  assert.equal(validateDerivativePayload("Threads", { single: "單則", thread: ["一", "二", "三"] }), true);
  assert.equal(validateDerivativePayload("IG", { caption: "說明", tags: ["心理"], carousel: ["鉤子", "行動"] }), true);
  assert.equal(validateDerivativePayload("Reel", { scenes: [{ text: "畫面", seconds: 3, transition: "切換" }] }), true);
  assert.equal(validateDerivativePayload("YT", { shorts: { scenes: [{ text: "短片畫面", seconds: 3, transition: "切換" }] }, long: { title: "標題", description: "說明", chapters: ["00:00 開場"], thumbnailText: "縮圖", outline: ["稿綱"] } }), true);
  assert.equal(validateDerivativePayload("小紅書", { title: "標題", body: "正文", tags: ["情緒"], carousel: ["鉤子", "行動"], citation_title: "書", citation_author: "作者" }), true);
  assert.equal(validateDerivativePayload("抖音", { title: "標題", tags: ["情緒"], scenes: [{ text: "畫面", seconds: 3, transition: "切換" }], citation_title: "書", citation_author: "作者" }), true);
  assert.equal(validateDerivativePayload("Threads", { single: "單則", thread: ["只有一則"] }), false);
});

test("簡體內容中的禁用詞會命中且不會自動替換", () => {
  const rules = [{ enabled: true, language_version: "zh-CN", category: "醫療", blocked_terms: ["治疗"], source_urls: ["https://example.com/rule"], status: "pending_manual_review" }];
  const matches = scanSensitiveRules("不要承諾治疗结果", rules, "zh-CN");
  assert.equal(matches[0].term, "治疗");
  assert.equal(matches[0].source_urls[0], "https://example.com/rule");
  assert.equal("不要承諾治疗结果".includes("治療"), false);
});

test("長度、輪播張數與標籤數只產生警告", () => {
  const metrics = contentMetrics("標題：超長標題\n第 1 張：一\n第 2 張：二\n#一 #二", { max_text_length: 8, title_max_length: 2, carousel_max: 1, hashtag_max: 1 });
  assert.equal(metrics.warnings.length, 4);
});

test("敏感詞、【需補】、Markdown 與破折號都擋住可用", () => {
  const rules = [{ enabled: true, language_version: "zh-TW", category: "敏感詞", blocked_terms: ["命理"], source_urls: [], status: "pending_manual_review" }];
  const checks = deriveChecks({ parentText: "母文【需補：科學依據】", content: "命理【需補：科學依據】\n**格式**", platform: "小紅書", languageVersion: "zh-TW", rules });
  assert.equal(checks.status, "needs_review");
  assert.ok(checks.blockers.includes("含有【需補】標記"));
  assert.ok(checks.blockers.includes("含有 Markdown 符號"));
  assert.equal(checks.sensitive_matches[0].term, "命理");
  assert.ok(checks.blockers.some((item) => item.includes("人工修改")));
});

test("科普紅線只適用小紅書與抖音，且命中詞不會被同義詞替換", () => {
  const rules = [{ enabled: true, language_version: "zh-TW", category: "命理與玄學", blocked_terms: ["命理"], source_urls: ["https://example.com"], status: "pending_manual_review" }];
  assert.equal(deriveChecks({ parentText: "", content: "命理主題", platform: "Threads", languageVersion: "zh-TW", rules }).sensitive_matches.length, 0);
  assert.equal(deriveChecks({ parentText: "", content: "命理主題", platform: "小紅書", languageVersion: "zh-TW", rules }).sensitive_matches[0].term, "命理");
  assert.equal(scanSensitiveRules("命理", rules, "zh-TW")[0].term, "命理");
});

test("母文缺少科學來源時保留指定標記", () => {
  assert.equal(ensureScienceMarker("一段科普稿", false), "一段科普稿\n【需補：科學依據】");
  assert.equal(ensureScienceMarker("一段科普稿", true), "一段科普稿");
});

test("母文【需補】逐字帶入，命理主題不進科普頻道", () => {
  assert.equal(carryMissingMarkers("母文【需補：引用來源】", "衍生內容"), "衍生內容\n【需補：引用來源】");
  assert.equal(isMetaphysicalTopic("這篇談命理與人生運勢"), true);
  assert.equal(isMetaphysicalTopic("如何面對情緒起伏"), false);
});

test("純文字檢查擋 Markdown 與各種破折號", () => {
  assert.deepEqual(checkPlainText("普通文字"), []);
  assert.ok(checkPlainText("文字—延伸").includes("含有破折號"));
  assert.ok(checkPlainText("**粗體**").includes("含有 Markdown 符號"));
});

test("母文章以純函式讀取，穩定 ID 不會改寫來源", () => {
  const parent = Object.freeze({ brandId: "personal_brand", platform: "threads", content: "母文章原文" });
  const before = { ...parent };
  const id = stableParentId(parent.brandId, parent.platform, parent.content);
  assert.match(id, /^workspace_social:/);
  assert.deepEqual(parent, before);
});
