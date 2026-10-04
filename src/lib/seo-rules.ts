// 官網文章的 SEO / AEO / GEO 規則評分（純程式，不呼叫 AI）。
// 同一篇文章每次分數一致；每條規則都能說出「扣在哪裡、為什麼」。
// 規則針對繁體中文設計（以字數而不是英文單字計算，不用 Flesch 這類英文易讀性公式）。
// 規則清單參考 Lighthouse SEO 稽核、Yoast 類文字分析與 GEO 檢查清單的概念，程式為自行撰寫。

export type RuleArea = "seo" | "aeo" | "geo";
export type RuleStatus = "ok" | "warn" | "fail";

export interface RuleResult {
  id: string;
  area: RuleArea;
  item: string;
  status: RuleStatus;
  /** 權重（分母） */
  weight: number;
  /** 實際得到的比例 0 到 1 */
  earned: number;
  note: string;
}

export interface RuleInput {
  /** 文章全文，第一行為標題 */
  content: string;
  /** 主要關鍵字（第一個視為主關鍵字） */
  keywords?: string[];
  /** 品牌可能出現的名稱，例如 ["I8","初八","企業醫生"] */
  brandAliases?: string[];
  /** 已有的問答集純文字（Q：／A： 成對） */
  faqText?: string;
  /** 已有的結構化資料（JSON-LD） */
  schemaText?: string;
}

export interface RuleReport {
  scores: { seo: number; aeo: number; geo: number };
  results: RuleResult[];
  /** 扣分最多的前三項說明 */
  topIssues: string[];
  stats: { chars: number; paragraphs: number; subheads: number; title: string };
  engine: "rules-v1";
}

const PLACEHOLDER_LINE = /^【保留區塊\d+】$/;
const SENT_END = /[。！？!?；;，,、：:]$/;

const len = (s: string) => s.replace(/\s/g, "").length;

/** 把文章拆成標題、正文段落、小標題（小標題＝單獨一行的短句，結尾沒有標點） */
export function parseArticle(content: string) {
  const raw = (content || "").replace(/\r/g, "");
  // 圖表與圖片區塊先拿掉並計數，避免程式碼影響字數與段落判斷
  let visuals = 0;
  const cleaned = raw
    .replace(/```[\s\S]*?```/g, () => { visuals++; return "\n"; })
    .replace(/^[ \t]*!\[[^\]\n]*\]\([^)\n]+\)[ \t]*$/gm, () => { visuals++; return ""; });
  const lines = cleaned.split("\n").map((l) => l.trim());
  const nonEmpty = lines.filter(Boolean);
  const title = (nonEmpty[0] || "").replace(/^#+\s*/, "");
  const placeholders = nonEmpty.filter((l) => PLACEHOLDER_LINE.test(l)).length;
  visuals += placeholders;

  const body = nonEmpty.slice(1).filter((l) => !PLACEHOLDER_LINE.test(l));
  const subheads: string[] = [];
  const paragraphs: string[] = [];
  for (const l of body) {
    const t = l.replace(/^#+\s*/, "");
    const isSub = (/^#+\s/.test(l) || (t.length >= 4 && t.length <= 28 && !SENT_END.test(t))) && !/^(Q|A)[：:]/.test(t) && !/^[・\-*•]\s?/.test(t);
    if (isSub) subheads.push(t);
    else paragraphs.push(l);
  }
  return { title, body, subheads, paragraphs, visuals };
}

function countOccur(text: string, kw: string): number {
  if (!kw) return 0;
  let n = 0;
  let i = 0;
  while ((i = text.indexOf(kw, i)) !== -1) { n++; i += kw.length; }
  return n;
}

const mk = (
  id: string, area: RuleArea, item: string, weight: number, earned: number, note: string
): RuleResult => ({
  id, area, item, weight, earned: Math.max(0, Math.min(1, earned)),
  status: earned >= 0.99 ? "ok" : earned >= 0.5 ? "warn" : "fail",
  note,
});

/** 在 [good, ok] 區間內給分：落在理想區間滿分，偏離越多越低 */
function band(v: number, idealMin: number, idealMax: number, hardMin: number, hardMax: number): number {
  if (v >= idealMin && v <= idealMax) return 1;
  if (v < idealMin) return v <= hardMin ? 0 : (v - hardMin) / (idealMin - hardMin);
  return v >= hardMax ? 0 : (hardMax - v) / (hardMax - idealMax);
}

const HYPE = /保證|絕對有效|一定會|100\s*%|立刻見效|保證有效|療效|根治|包治|治癒|穩賺/g;
const DEFINE = /是指|指的是|定義為|稱為|意思是|是一種|就是指/;
const DEFINE_G = new RegExp(DEFINE.source, "g");
const CONCLUDE = /總結|簡單來說|所以|因此|最後|換句話說|整體來說|一句話/;
const QUESTION_WORD = /[？?]|如何|為什麼|為何|什麼|怎麼|是否|哪些|該不該/;

export function scoreArticle(input: RuleInput): RuleReport {
  const { title, body, subheads, paragraphs, visuals } = parseArticle(input.content);
  const bodyText = body.join("\n");
  const chars = len(bodyText) + len(title);
  const kws = (input.keywords || []).map((k) => k.trim()).filter(Boolean);
  const main = kws[0] || "";
  const R: RuleResult[] = [];

  // ───────── SEO ─────────
  R.push(mk("title-len", "seo", "標題長度", 10, band(title.length, 14, 30, 6, 44),
    `標題 ${title.length} 字。搜尋結果大約顯示 30 字內，建議 14 到 30 字。`));

  if (main) {
    const inTitle = title.includes(main);
    R.push(mk("kw-title", "seo", "主關鍵字在標題", 10, inTitle ? 1 : 0,
      inTitle ? `標題含主關鍵字「${main}」。` : `標題沒有主關鍵字「${main}」，搜尋比對會變弱。`));
    const first = bodyText.replace(/\s/g, "").slice(0, 150);
    const inFirst = first.includes(main);
    R.push(mk("kw-lead", "seo", "主關鍵字在開頭 150 字", 8, inFirst ? 1 : 0,
      inFirst ? "開頭 150 字內有主關鍵字。" : `開頭 150 字沒有出現「${main}」，建議在第一段自然帶到。`));
    const occ = countOccur(bodyText, main) + countOccur(title, main);
    const density = chars > 0 ? (occ * main.length) / chars : 0;
    const pct = Math.round(density * 1000) / 10;
    R.push(mk("kw-density", "seo", "關鍵字密度", 6, band(density, 0.005, 0.03, 0, 0.06),
      `「${main}」出現 ${occ} 次，約占全文 ${pct}%。建議 0.5% 到 3%，太高會被視為堆砌。`));
  }

  R.push(mk("length", "seo", "文章長度", 12, band(chars, 1000, 4000, 300, 9000),
    `全文約 ${chars} 字。官網文章建議 1000 字以上；少於 300 字內容太薄。`));

  const wantSubs = Math.max(2, Math.floor(chars / 450));
  R.push(mk("subheads", "seo", "小標題數量", 10, Math.min(1, subheads.length / wantSubs),
    `有 ${subheads.length} 個小標題，依字數建議至少 ${wantSubs} 個。`));

  const avgPara = paragraphs.length ? Math.round(paragraphs.reduce((a, p) => a + len(p), 0) / paragraphs.length) : 0;
  const longParas = paragraphs.filter((p) => len(p) > 260).length;
  R.push(mk("para-len", "seo", "段落長度", 8,
    band(avgPara, 30, 130, 0, 260) * (longParas > 0 ? 0.7 : 1),
    `平均每段 ${avgPara} 字${longParas ? `，其中 ${longParas} 段超過 260 字，手機上會變成一大塊` : ""}。建議每段 130 字內、只講一件事。`));

  const lead = paragraphs[0] ? len(paragraphs[0]) : 0;
  R.push(mk("lead-len", "seo", "開頭摘要段", 6, band(lead, 50, 150, 10, 300),
    `第一段 ${lead} 字。第一段常被搜尋結果與 AI 拿來當摘要，建議 50 到 150 字。`));

  R.push(mk("visual", "seo", "圖片或圖表", 4, visuals > 0 ? 1 : 0,
    visuals > 0 ? `文章有 ${visuals} 個圖片或圖表。` : "文章沒有圖片或圖表，長文建議至少放一張並加上說明文字。"));

  const markdownLeft = /(^|\n)\s*(#{1,6}\s|\*\*|[-*]\s)/.test(bodyText) || /[—―─]/.test(`${title}\n${bodyText}`);
  R.push(mk("clean", "seo", "格式乾淨", 4, markdownLeft ? 0 : 1,
    markdownLeft ? "殘留 Markdown 符號或破折號，貼到 Facebook 或官網會顯示異常。" : "沒有殘留的 Markdown 符號與破折號。"));

  // ───────── AEO（回答引擎） ─────────
  const leadText = paragraphs.slice(0, 2).join("");
  const leadDefines = DEFINE.test(leadText);
  R.push(mk("direct-answer", "aeo", "開頭直接回答", 14, leadDefines ? 1 : 0.3,
    leadDefines ? "開頭兩段有定義或直接回答句。" : "開頭兩段沒有「某某是指……」這類直接回答句，回答引擎不容易擷取。"));

  const qSubs = subheads.filter((s) => QUESTION_WORD.test(s)).length;
  R.push(mk("q-subheads", "aeo", "問句式小標題", 10, Math.min(1, qSubs / 2),
    `有 ${qSubs} 個問句式小標題，建議至少 2 個，貼近讀者真的會搜的問題。`));

  const faqPairs = (input.faqText || "").split(/\n/).filter((l) => /^Q[：:]/.test(l.trim())).length;
  R.push(mk("faq", "aeo", "問答集（FAQ）", 14, Math.min(1, faqPairs / 3),
    faqPairs ? `問答集有 ${faqPairs} 題，建議 3 題以上。` : "還沒有問答集。可按下方「開始優化」由 AI 依文章內容產生，再由你決定要不要採用。"));

  const defCount = (bodyText.match(DEFINE_G) || []).length;
  R.push(mk("definitions", "aeo", "名詞定義句", 8, Math.min(1, defCount / 2),
    `文中有 ${defCount} 句定義句（是指、稱為……），建議至少 2 句。`));

  const listLines = body.filter((l) => /^([・\-*•]|\d+[.、)]|第[一二三四五六七八九十]+[，、：:])/.test(l)).length;
  R.push(mk("lists", "aeo", "條列或步驟", 6, listLines >= 3 ? 1 : listLines > 0 ? 0.6 : 0.3,
    listLines ? `有 ${listLines} 行條列。` : "沒有條列或步驟，AI 較難擷取清單型答案；適合的內容可考慮整理成 3 到 5 點。"));

  // ───────── GEO（生成式 AI 搜尋） ─────────
  const aliases = (input.brandAliases || []).filter(Boolean);
  const brandHits = aliases.reduce((a, b) => a + countOccur(input.content, b), 0);
  if (aliases.length) {
    R.push(mk("brand", "geo", "品牌或作者名稱出現", 8, brandHits >= 1 ? 1 : 0,
      brandHits ? `品牌名稱出現 ${brandHits} 次。` : `全文沒有出現品牌名稱（${aliases.slice(0, 3).join("、")}），AI 引用時無法標註來源。`));
  }

  const tail = bodyText.slice(Math.floor(bodyText.length * 0.8));
  R.push(mk("conclusion", "geo", "結尾有收束句", 8, CONCLUDE.test(tail) ? 1 : 0.4,
    CONCLUDE.test(tail) ? "結尾有收束或總結句。" : "結尾沒有明確的總結句，AI 摘要時抓不到結論。"));

  const quotable = paragraphs.filter((p) => len(p) >= 40 && len(p) <= 160).length;
  const quotableRatio = paragraphs.length ? quotable / paragraphs.length : 0;
  R.push(mk("quotable", "geo", "可獨立引用的段落", 8, Math.min(1, quotableRatio / 0.6),
    `${quotable} 段（占 ${Math.round(quotableRatio * 100)}%）長度適中、可單獨被引用。建議超過六成。`));

  const facts = (bodyText.match(/\d+(\.\d+)?|[一二兩三四五六七八九十百]+(種|個|步|層|項|點|成|倍|年|月|天)/g) || []).length;
  R.push(mk("facts", "geo", "具體數字或項目", 6, Math.min(1, facts / 3),
    `文中有 ${facts} 處具體數字或項目數。AI 偏好引用具體、可核對的說法（數字必須是真實資料，不可為了分數捏造）。`));

  const hasSchema = /"@type"/.test(input.schemaText || "");
  R.push(mk("schema", "geo", "結構化資料", 10, hasSchema ? 1 : 0,
    hasSchema ? "已有結構化資料（JSON-LD）。" : "尚未產生結構化資料。有問答集時按「開始優化」會一併產生。"));

  const hype = Array.from(new Set(input.content.match(HYPE) || []));
  R.push(mk("hype", "geo", "無誇大或保證用詞", 8, hype.length ? 0 : 1,
    hype.length ? `出現「${hype.join("、")}」，AI 與搜尋引擎都傾向降低這類內容的可信度，也有法規風險。` : "沒有誇大、保證或療效用詞。"));

  // ───────── 加總 ─────────
  const agg = (area: RuleArea) => {
    const rs = R.filter((r) => r.area === area);
    const w = rs.reduce((a, r) => a + r.weight, 0);
    const e = rs.reduce((a, r) => a + r.weight * r.earned, 0);
    return w ? Math.round((e / w) * 100) : 0;
  };

  const topIssues = [...R]
    .filter((r) => r.status !== "ok")
    .sort((a, b) => b.weight * (1 - b.earned) - a.weight * (1 - a.earned))
    .slice(0, 3)
    .map((r) => `${r.item}：${r.note}`);

  return {
    scores: { seo: agg("seo"), aeo: agg("aeo"), geo: agg("geo") },
    results: R,
    topIssues,
    stats: { chars, paragraphs: paragraphs.length, subheads: subheads.length, title },
    engine: "rules-v1",
  };
}

/** 品牌名稱 → GEO 規則用的別名清單 */
export function brandAliasesFor(brandName: string): string[] {
  const n = brandName || "";
  if (/I8|初八/i.test(n)) return ["I8", "初八", "企業醫生"];
  if (/NAS|平衡空間/i.test(n)) return ["NAS", "平衡空間", "艾瑞克"];
  if (/ABL|艾伯林|量子調頻/i.test(n)) return ["ABL", "艾伯林"];
  if (/Erick|艾瑞克/i.test(n)) return ["Erick", "艾瑞克"];
  return [];
}
