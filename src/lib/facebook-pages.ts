export interface FacebookPageConfig {
  id: string; // "fb_i8", "fb_nas", "fb_abl", "fb_erick"
  brandId: string; // "brand_a_i8", "brand_b_nas", "brand_c_abl", "personal_brand"
  brandKey: "i8" | "nas" | "abl" | "erick";
  name: string;
  pageName: string;
  category: string;
  description: string;
  badge: string;
  colorClass: string;
  borderClass: string;
  bgClass: string;
  activeBorderClass: string;
  activeBgClass: string;
  textClass: string;
}

export const FACEBOOK_PAGES: FacebookPageConfig[] = [
  {
    id: "fb_i8",
    brandId: "brand_a_i8",
    brandKey: "i8",
    name: "I8 (Initial 8 CO.)",
    pageName: "I8 企業關鍵因素與決策校準",
    category: "企業決策 / 組織承載力",
    description: "協助企業主看見影響經營結果的關鍵因素",
    badge: "I8 粉專",
    colorClass: "text-indigo-400",
    borderClass: "border-indigo-500/30",
    bgClass: "bg-indigo-500/10",
    activeBorderClass: "border-indigo-500",
    activeBgClass: "bg-indigo-500/20 text-indigo-200",
    textClass: "text-indigo-400",
  },
  {
    id: "fb_nas",
    brandId: "brand_b_nas",
    brandKey: "nas",
    name: "NAS (平衡空間)",
    pageName: "NAS 平衡空間生命數字",
    category: "生命數字 / 關係探索",
    description: "透過生命數字認識自己、理解關係與人生節奏",
    badge: "NAS 粉專",
    colorClass: "text-purple-400",
    borderClass: "border-purple-500/30",
    bgClass: "bg-purple-500/10",
    activeBorderClass: "border-purple-500",
    activeBgClass: "bg-purple-500/20 text-purple-200",
    textClass: "text-purple-400",
  },
  {
    id: "fb_abl",
    brandId: "brand_c_abl",
    brandKey: "abl",
    name: "ABL (量子調頻)",
    pageName: "ABL 信息場狀態分析與調和",
    category: "狀態調和 / 能量調頻",
    description: "協助個人穩定情緒、校準狀態，走出反覆卡住的模式",
    badge: "ABL 粉專",
    colorClass: "text-cyan-400",
    borderClass: "border-cyan-500/30",
    bgClass: "bg-cyan-500/10",
    activeBorderClass: "border-cyan-500",
    activeBgClass: "bg-cyan-500/20 text-cyan-200",
    textClass: "text-cyan-400",
  },
  {
    id: "fb_erick",
    brandId: "personal_brand",
    brandKey: "erick",
    name: "Erick 個人品牌",
    pageName: "Erick 事業與人生關鍵因素諮詢",
    category: "主理人 IP / 戰略諮詢",
    description: "事業與人生關鍵因素諮詢與頂層策略",
    badge: "Erick 粉專",
    colorClass: "text-amber-400",
    borderClass: "border-amber-500/30",
    bgClass: "bg-amber-500/10",
    activeBorderClass: "border-amber-500",
    activeBgClass: "bg-amber-500/20 text-amber-200",
    textClass: "text-amber-400",
  },
];

export function getDefaultFacebookPage(brandId: string): FacebookPageConfig {
  const normalized = (brandId || "").toLowerCase();
  if (normalized.includes("nas") || normalized.includes("brand_b")) {
    return FACEBOOK_PAGES.find((p) => p.id === "fb_nas") || FACEBOOK_PAGES[1];
  }
  if (normalized.includes("abl") || normalized.includes("brand_c")) {
    return FACEBOOK_PAGES.find((p) => p.id === "fb_abl") || FACEBOOK_PAGES[2];
  }
  if (normalized.includes("erick") || normalized.includes("personal")) {
    return FACEBOOK_PAGES.find((p) => p.id === "fb_erick") || FACEBOOK_PAGES[3];
  }
  return FACEBOOK_PAGES.find((p) => p.id === "fb_i8") || FACEBOOK_PAGES[0];
}

export function getFacebookPageById(id: string): FacebookPageConfig | undefined {
  return FACEBOOK_PAGES.find((p) => p.id === id);
}

export function getFacebookPagesByIds(ids: string[]): FacebookPageConfig[] {
  return FACEBOOK_PAGES.filter((p) => ids.includes(p.id));
}
