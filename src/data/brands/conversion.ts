// 各品牌的轉換設定（單一事實來源）
//
// 背景：轉換目標原本硬編碼散落在三處——ai-provider.ts 的 Leon 提示詞
// （一律 erickfirm.com/#contact）、n8n 的 FB 首則留言、以及各品牌的
// BRAND_CONTEXT。文案分了品牌，目的地卻沒分。
//
// 依品牌規範的信任漏斗「陌生人 → NAS（教育入口）→ Erick（高信任諮詢）
// → ABL / I8（高單價服務）」，三個子品牌的轉換目標應該是「換 email」，
// 成交發生在 Erick 這一層。把所有品牌都導向諮詢預約等於要求剛認識你的
// 陌生人做高承諾行動，會流失掉本來可以先養成名單的人。
//
// 詳見 docs/PIPELINE_FINDINGS_AND_PLAN.md。

/**
 * 單篇文章的流量溫度。海巡在每個題目上標破圈或建立信任，各約一半。
 *
 * 2026-10-30 改版（取代原本的 cold / warm）：NAS 的免費入口定成兩層，
 * 計算器 /nas/calculator/ 接超冷流量（零摩擦，輸入生日直接看結果），
 * 卡點五型自我檢查 /nas/quiz 接冷流量（8 題加 LINE 登入看詳細解析）。
 * 所以文章也照同一組名字分，不要再用「沒有標記就等於超冷」這種隱含規則，
 * 那個規則讓補標記變成會悄悄換掉入口的動作。
 *
 * supercold 破圈文章：讀者完全不認識作者，給摩擦最低的計算器。
 * cold       建立信任文章：讀者看過幾篇，願意多做 8 題換完整解析。
 */
export type TrafficFunnel = "supercold" | "cold";

/** 資料庫裡可能還有改版前寫進去的舊值 */
export type LegacyTrafficFunnel = TrafficFunnel | "warm";

/**
 * 從任務提示詞判讀分層。海巡寫進提示詞的是「本篇目標：破圈…」或「本篇目標：建立信任…」。
 * 判讀不出來就回 null，讓下游退回通用 CTA，不要亂猜一個。
 */
export function readFunnelFromPrompt(prompt: string): TrafficFunnel | null {
  const text = String(prompt || "");
  if (/本篇目標：破圈|超冷流量|冷流量/.test(text) && !/本篇目標：建立信任|溫流量/.test(text)) return "supercold";
  if (/本篇目標：建立信任|溫流量/.test(text)) return "cold";
  return null;
}

/**
 * 把資料庫裡的值正規化成現在這兩層。
 *
 * 刻意只處理 warm 這一個舊值：它過去代表「建立信任」，就是現在的 cold。
 * 舊的 cold（過去代表破圈）由資料庫一次性改成 supercold，不在這裡猜，
 * 否則同一個字串 cold 會有兩種意思，讀的人永遠分不出是哪一種。
 */
export function normalizeFunnel(value: unknown): TrafficFunnel | null {
  const text = String(value || "").trim();
  if (text === "supercold") return "supercold";
  if (text === "cold") return "cold";
  if (text === "warm") return "cold";
  return null;
}

/** 這一層的 FB 首則留言要把人帶去哪裡。NAS 以外的品牌沒有這兩個入口，回 null。 */
export function funnelEntryPath(funnel: TrafficFunnel | null): string | null {
  if (funnel === "supercold") return "/nas/calculator/";
  if (funnel === "cold") return "/nas/quiz";
  return null;
}

/** 品牌在信任漏斗中的位置，決定該用什麼強度的 CTA */
export type FunnelStage =
  | "entry"    // 入口：對陌生人，目標是換 email，不談成交
  | "nurture"  // 培育：已知道自己卡住，目標仍是換 email＋分眾
  | "close";   // 承接：已有信任，可以談合作

export interface BrandConversion {
  /** 前端品牌 ID */
  brandId: string;
  /** Supabase / n8n 使用的短名 */
  shortId: string;
  stage: FunnelStage;
  /** CTA 按鈕文字 */
  ctaLabel: string;
  /** 落地頁網址 */
  ctaUrl: string;
  /** 誘因描述，供 Leon 撰寫 CTA 區塊時參考 */
  leadMagnet: string;
  /** FB 首則留言的導流文案（不含網址） */
  socialCommentText: string;
}

export const BRAND_CONVERSIONS: Record<string, BrandConversion> = {
  brand_b_nas: {
    brandId: "brand_b_nas",
    shortId: "nas",
    stage: "entry",
    ctaLabel: "免費做生命數字小測",
    ctaUrl: "https://erickfirm.com/nas/quiz",
    leadMagnet:
      "三分鐘生命數字小測，看懂自己的天賦、盲點與當前生命階段。留下 email 即可收到完整解析。",
    socialCommentText: "閱讀完整文章與天賦定位地圖",
  },

  brand_c_abl: {
    brandId: "brand_c_abl",
    shortId: "abl",
    stage: "nurture",
    ctaLabel: "免費做角色盤點",
    ctaUrl: "https://erickfirm.com/abl/check",
    leadMagnet:
      "角色盤點表，陪你整理目前認可且願意承擔的角色與負荷來源。留下 email 即可收到個人化的整理建議。",
    socialCommentText: "閱讀完整文章與負荷來源整理指南",
  },

  brand_a_i8: {
    brandId: "brand_a_i8",
    shortId: "i8",
    stage: "nurture",
    ctaLabel: "做管理情境盤點",
    ctaUrl: "https://erickfirm.com/i8/diagnosis",
    leadMagnet:
      "管理情境盤點，協助整理目前反覆出現的協作、角色權責與決策節奏問題。留下 email 後可取得本次盤點摘要；這不是診斷報告或自動評分。",
    socialCommentText: "閱讀完整文章與管理情境盤點表",
  },

  personal_brand: {
    brandId: "personal_brand",
    shortId: "erick",
    stage: "close",
    // 只有母品牌走成交層，這也是原本 #contact 唯一正確的位置
    ctaLabel: "預約關鍵因素諮詢",
    ctaUrl: "https://erickfirm.com/#contact",
    leadMagnet:
      "一對一諮詢，先看清楚真正讓你卡住的關鍵因素，再決定下一步怎麼調整。",
    socialCommentText: "閱讀完整文章",
  },
};

/** 階段專案或未知品牌時的保底設定 */
const FALLBACK = BRAND_CONVERSIONS.personal_brand;

/** 依前端品牌 ID 取得轉換設定；階段專案（project_*）沿用母品牌設定 */
export function getBrandConversion(brandId: string): BrandConversion {
  return BRAND_CONVERSIONS[brandId] || FALLBACK;
}

/** 依 Supabase 短名（i8 / nas / abl / erick）取得轉換設定 */
export function getConversionByShortId(shortId: string): BrandConversion {
  return (
    Object.values(BRAND_CONVERSIONS).find((c) => c.shortId === shortId) || FALLBACK
  );
}
