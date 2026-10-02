// 解析「每週品牌調研」產出的選題文字（Telegram 訊息，或 Google Sheet「選題情報」的 content_task 欄），
// 讓文體生成面板可以一鍵填入文體、漏斗層、主張與素材。純函式，不碰畫面。

import type { BrandKey, FunnelLevel, GenreId } from "@/data/skills/genres";

export interface PastedTopic {
  index: number;
  mode: string; // 二創／我的看法
  title: string;
  event: string;
  audienceVoice: string[];
  marketView: string;
  brandAngle: string;
  genre: GenreId | null;
  genreRaw: string;
  funnel: FunnelLevel | null;
  claim: string;
  needMaterial: string;
  sources: string;
}

export interface PastedBundle {
  brandKey: BrandKey | null;
  brandName: string;
  topics: PastedTopic[];
}

export function genreFromText(s: string): GenreId | null {
  if (s.includes("案例")) return "case";
  if (s.includes("拆解")) return "breakdown";
  if (s.includes("邀請")) return "invite";
  return null; // 回應文目前未開放，不自動帶入
}

export function funnelFromText(s: string): FunnelLevel | null {
  if (s.includes("冷")) return "cold";
  if (s.includes("溫")) return "warm";
  if (s.includes("熱")) return "hot";
  return null;
}

export function brandKeyFromText(s: string): BrandKey | null {
  const u = s.toUpperCase();
  if (u.includes("NAS")) return "nas";
  if (u.includes("ABL")) return "abl";
  if (u.includes("I8")) return "i8";
  if (u.includes("ERICK")) return "erick";
  return null;
}

/** 行首的表情符號、項目符號、全形空白（保留中文、英數與「『【（( 引號括號） */
const LEAD_SYMBOLS = /^[^一-龥A-Za-z0-9「『【（(“"]+/;

const LABELS = ["本週事件", "受眾原話", "市場常見說法", "我的角度", "建議", "主張", "需要你補的素材", "來源"];

function emptyTopic(index: number): PastedTopic {
  return {
    index, mode: "", title: "", event: "", audienceVoice: [], marketView: "", brandAngle: "",
    genre: null, genreRaw: "", funnel: null, claim: "", needMaterial: "", sources: "",
  };
}

/** 解析一個選題區塊（不含分隔線） */
function parseBlock(block: string, index: number): PastedTopic | null {
  const t = emptyTopic(index);
  const lines = block.split("\n");
  let current = ""; // 目前所在的【欄位】
  const bucket: Record<string, string[]> = {};
  const loose: string[] = []; // 沒有欄位標籤的行（含標題）

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("👀")) { current = "__ignore"; continue; }
    if (current === "__ignore") continue;
    // 新版訊息每行前面有表情符號，先去掉再比對
    const line = trimmed.replace(LEAD_SYMBOLS, "");
    if (!line) continue;
    const head = line.match(/^題目\s*\d+\s*[｜|]\s*(.+)$/);
    if (head) { t.mode = head[1].trim().replace(LEAD_SYMBOLS, ""); current = "__title"; continue; }
    const m = line.match(/^【([^】]+)】(.*)$/);
    if (m && LABELS.includes(m[1].trim())) {
      current = m[1].trim();
      bucket[current] = bucket[current] || [];
      if (m[2].trim()) bucket[current].push(m[2].trim());
      continue;
    }
    if (current === "__title" && !t.title) { t.title = line.trim(); continue; }
    if (current && current !== "__title") { (bucket[current] = bucket[current] || []).push(line.trim()); continue; }
    loose.push(line.trim());
  }

  if (!t.title && loose.length) t.title = loose[0];
  const j = (k: string) => (bucket[k] || []).join("\n").trim();
  t.event = j("本週事件");
  t.marketView = j("市場常見說法");
  t.brandAngle = j("我的角度");
  t.claim = j("主張");
  t.needMaterial = j("需要你補的素材");
  t.sources = j("來源");
  t.audienceVoice = (bucket["受眾原話"] || [])
    .map((s) => s.replace(/^[「『"]|[」』"]$/g, "").trim())
    .filter(Boolean);
  const advice = j("建議");
  if (advice) {
    const [g, f] = advice.split(/[｜|]/).map((s) => s.trim());
    t.genreRaw = g || "";
    t.genre = genreFromText(g || "");
    t.funnel = funnelFromText(f || "");
  }
  return t.claim || t.title ? t : null;
}

/** Google Sheet「選題情報」的 content_task 欄格式：【二創】文體：拆解｜漏斗：冷流量｜主張：…｜需補素材：… */
function parseContentTask(text: string): PastedTopic | null {
  const m = text.match(/文體[：:]\s*([^｜|\n]+)[｜|]\s*漏斗[：:]\s*([^｜|\n]+)[｜|]\s*主張[：:]\s*([^｜|\n]+)(?:[｜|]\s*需補素材[：:]\s*([\s\S]+))?/);
  if (!m) return null;
  const t = emptyTopic(1);
  const mode = text.match(/^\s*【([^】]+)】/);
  t.mode = mode ? mode[1] : "";
  t.genreRaw = m[1].trim();
  t.genre = genreFromText(m[1]);
  t.funnel = funnelFromText(m[2]);
  t.claim = m[3].trim();
  t.needMaterial = (m[4] || "").trim();
  t.title = t.claim;
  return t;
}

export function parsePastedTopics(input: string): PastedBundle {
  const text = (input || "").replace(/\r\n?/g, "\n").trim();
  const bundle: PastedBundle = { brandKey: null, brandName: "", topics: [] };
  if (!text) return bundle;

  const header = text.match(/本週品牌調研\s*[｜|]\s*([^\n（(]+)/);
  if (header) {
    bundle.brandName = header[1].trim();
    bundle.brandKey = brandKeyFromText(bundle.brandName);
  }

  // 以分隔線切段；有「題目 N｜」的段落才是選題
  const pieces = text.split(/\n[━─\-]{5,}\n?/);
  const blocks = pieces.filter((p) => /^[^\n一-龥]*題目\s*\d+\s*[｜|]/m.test(p));
  if (blocks.length > 0) {
    blocks.forEach((b, i) => {
      const parsed = parseBlock(b, i + 1);
      if (parsed) bundle.topics.push(parsed);
    });
    return bundle;
  }

  // 沒有分隔線但有多個「題目 N｜」
  const byHead = text.split(/\n(?=[^\n一-龥]*題目\s*\d+\s*[｜|])/).filter((p) => /^[^\n一-龥]*題目\s*\d+\s*[｜|]/.test(p.trim()));
  if (byHead.length > 0) {
    byHead.forEach((b, i) => {
      const parsed = parseBlock(b, i + 1);
      if (parsed) bundle.topics.push(parsed);
    });
    return bundle;
  }

  // 單一題目：直接複製一題（含【主張】等欄位）
  if (/【(主張|建議)】/.test(text)) {
    const parsed = parseBlock(text, 1);
    if (parsed) { bundle.topics.push(parsed); return bundle; }
  }

  // Sheet 的 content_task 欄
  const task = parseContentTask(text);
  if (task) bundle.topics.push(task);
  return bundle;
}

/** 依文體決定「素材」欄要預填什麼。案例文需要真實個案，系統不代填。 */
export function materialFor(t: PastedTopic, genre: GenreId): string {
  if (genre === "case" || genre === "invite") return "";
  const parts: string[] = [];
  if (t.audienceVoice[0]) parts.push(`讀者會說的那句話：${t.audienceVoice[0]}`);
  if (t.marketView) parts.push(`市場常見說法（要拆的誤解）：${t.marketView}`);
  if (t.event) parts.push(`本週事件（發文前請核對來源）：${t.event}`);
  if (t.brandAngle) parts.push(`我的角度：${t.brandAngle}`);
  return parts.join("\n");
}
