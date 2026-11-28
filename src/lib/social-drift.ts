// 社群改寫走樣檢查：把長文改寫成 Threads 與 IG 版本時，
// 一、不得加入原文沒有的行動呼籲（私訊我們、Link in Bio、首頁連結、主題標籤之類）；
// 二、不得加入原文沒有的禁用字（卡住、撐、扛、療癒、頻率、改善、保證、示意聲明、跨篇預告……）；
// 三、不得刪掉原文的關鍵段落（關鍵句 ➤ ❝ ❞、收尾那一段、「這幾天留意」那一段）。
//
// 2026-11-27 實例（艾伯林牙齒那篇）：
// IG 改寫加了「歡迎私訊我們，或點擊首頁連結 Link in Bio」與 14 個主題標籤，還加了「硬撐」；
// Threads 改寫把「承擔」換成「撐」，多了「卡住」「扛不動」「撐不住」，刪掉了關鍵句與收尾。
// 純函式，主工作區的改寫（/api/chat 的 adapt）與自動流水線的改寫（deriveVersions）共用。

import { findCtas } from "@/data/skills/recipe-genres";

export interface DriftIssue { kind: "cta" | "word" | "dropped"; message: string }

/** 原文沒有、改寫卻多出來就算走樣的字 */
export const DRIFT_WORDS = [
  "卡住", "撐", "扛", "療癒", "療效", "治療", "改善", "保證", "頻率", "能量", "靈性", "調頻", "調和",
  "故事情境為示意", "以上為虛構", "下一篇", "下次再聊", "下集",
];

const count = (text: string, word: string): number => String(text || "").split(word).length - 1;

/** 去掉標點、空白、表情符號，只留中英數字，用來比對段落是否保留 */
function normalize(text: string): string {
  return String(text || "").replace(/[^\p{Script=Han}A-Za-z0-9]/gu, "");
}

function bigrams(text: string): Set<string> {
  const t = normalize(text);
  const set = new Set<string>();
  for (let i = 0; i < t.length - 1; i += 1) set.add(t.slice(i, i + 2));
  return set;
}

/** 這一段在改寫裡保留了多少（字詞兩兩一組的重疊比例，0 到 1） */
export function retention(paragraph: string, adapted: string): number {
  const source = bigrams(paragraph);
  if (!source.size) return 1;
  const target = bigrams(adapted);
  let hit = 0;
  for (const gram of source) if (target.has(gram)) hit += 1;
  return hit / source.size;
}

const paragraphsOf = (text: string): string[] => String(text || "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

/** 原文的關鍵段落：關鍵句（➤ ❝ ❞）、「這幾天留意」那一段、最後一段 */
export function keyParagraphs(original: string): string[] {
  const paras = paragraphsOf(original).filter((p) => normalize(p).length >= 6);
  const keys = new Set<string>();
  for (const p of paras) {
    if (/❝|➤/.test(p)) keys.add(p);
    if (/這幾天(?:留意|試|觀察|看看|注意)/.test(p)) keys.add(p);
  }
  if (paras.length > 1) keys.add(paras[paras.length - 1]);
  return [...keys];
}

/** 關鍵段落保留門檻：重疊比例低於這個值就當作被刪掉或改掉了 */
export const KEY_RETENTION_MIN = 0.5;
/** IG 沒有字數壓力，整體段落至少要保留這個比例 */
export const IG_COVERAGE_MIN = 0.7;

export function checkSocialDrift(original: string, adapted: string, platform: "threads" | "instagram"): DriftIssue[] {
  const source = String(original || "");
  const out = String(adapted || "");
  const issues: DriftIssue[] = [];

  // 一、行動呼籲：原文完全沒有行動呼籲時，改寫一個都不能加；原文有的話，改寫保留同類的不算走樣
  // 唯一允許的換法：原文是「連結放留言區」，IG 連結不能點，改成「留言關鍵字，我私訊給你」（同一個指路，換平台說法）
  const sourceCtas = new Set(findCtas(source));
  if (sourceCtas.has("留言區連結")) sourceCtas.add("私訊");
  const addedCtas = findCtas(out).filter((label) => !sourceCtas.has(label));
  if (addedCtas.length) issues.push({ kind: "cta", message: `加了原文沒有的行動呼籲：${addedCtas.join("、")}` });
  const tags = out.match(/#[^\s#]+/g) || [];
  const sourceTags = source.match(/#[^\s#]+/g) || [];
  if (tags.length > sourceTags.length) issues.push({ kind: "cta", message: `加了原文沒有的主題標籤 ${tags.length - sourceTags.length} 個（例如 ${tags.slice(0, 3).join(" ")}）` });

  // 二、禁用字：改寫比原文多出來
  const added = DRIFT_WORDS.filter((word) => count(out, word) > count(source, word)).map((word) => `「${word}」`);
  if (added.length) issues.push({ kind: "word", message: `加了原文沒有的字：${added.join("、")}` });

  // 三、關鍵段落
  const dropped = keyParagraphs(source).filter((p) => retention(p, out) < KEY_RETENTION_MIN);
  if (dropped.length) issues.push({ kind: "dropped", message: `刪掉或改掉了原文的關鍵段落：${dropped.map((p) => `「${p.replace(/\s+/g, " ").slice(0, 30)}」`).join("、")}` });
  if (platform === "instagram") {
    const paras = paragraphsOf(source).filter((p) => normalize(p).length >= 10);
    if (paras.length >= 3) {
      const kept = paras.filter((p) => retention(p, out) >= KEY_RETENTION_MIN).length;
      const ratio = kept / paras.length;
      if (ratio < IG_COVERAGE_MIN) issues.push({ kind: "dropped", message: `IG 沒有字數壓力，卻只保留了原文 ${kept}/${paras.length} 段，請保留原文的段落與故事` });
    }
  }
  return issues;
}

/** 給模型的修改要求：把走樣的地方講清楚，重寫一次 */
export function driftFeedback(issues: DriftIssue[]): string {
  if (!issues.length) return "";
  return [
    "【修改要求，不是原文】上一版和原文走樣了，請照原文重寫：",
    ...issues.map((issue, i) => `${i + 1}. ${issue.message}`),
    "原文沒有的行動呼籲、主題標籤、詞彙都不要加；原文的關鍵句與收尾要保留原意與原本的用字。",
  ].join("\n");
}
