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
    ctaLabel: "免費做狀態自我檢視",
    ctaUrl: "https://erickfirm.com/abl/check",
    leadMagnet:
      "狀態自我檢視表，幫你看清目前的內在消耗來自哪裡。留下 email 即可收到個人化的整理建議。",
    socialCommentText: "閱讀完整文章與狀態調和指南",
  },

  brand_a_i8: {
    brandId: "brand_a_i8",
    shortId: "i8",
    stage: "nurture",
    ctaLabel: "免費做經營卡點自評",
    ctaUrl: "https://erickfirm.com/i8/diagnosis",
    leadMagnet:
      "經營卡點自評，十題看出目前卡在定位、組織承載力還是決策節奏。留下 email 即可收到診斷結果。",
    socialCommentText: "閱讀完整文章與動態分析圖表",
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
