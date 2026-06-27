export interface CopywritingFramework {
  id: string;
  name: string;
  author: string;
  description: string;
  promptContext: string;
}

export const COPYWRITING_FRAMEWORKS: Record<string, CopywritingFramework> = {
  default: {
    id: "default",
    name: "預設 (無額外框架)",
    author: "Erick",
    description: "不套用額外的大師框架，使用 Erick 本人的核心策略與語氣。",
    promptContext: ""
  },
  funnel_architect: {
    id: "funnel_architect",
    name: "銷售漏斗與行銷架構 (Funnel Architect)",
    author: "Russell Brunson",
    description: "套用 Russell Brunson 的 Secrets 系列框架設計銷售漏斗、價值階梯與新機會。",
    promptContext: `【行銷框架切換：Russell Brunson 銷售漏斗與行銷架構】
請在撰寫文案或分析時，嚴格遵守以下核心原則：
1. 秘密公式 (The Secret Formula)：明確界定 Who(夢想客戶)、Where(聚集地)、Bait(誘餌)、Result(最終結果)。
2. 新機會 (New Opportunity)：絕不銷售「改善型產品」，提供一個取代舊方法的全新機會。
3. 價值階梯 (Value Ladder)：規劃從前端誘餌到後端高階服務的階梯路徑。
4. 頓悟橋樑故事 (Epiphany Bridge)：透過背景故事、遭遇阻礙(那堵牆)、頓悟新機會、執行計畫與內在轉變，引導受眾自行得出結論。
5. 一句話說服公式：「我知道你夢想著[目標]，你嘗試過[舊方法]但沒成功，那不是你的錯。讓我分享一個故事...」`
  },
  high_conversion: {
    id: "high_conversion",
    name: "高轉換銷售 (Direct Response)",
    author: "Dan Kennedy / Gary Halbert",
    description: "專注於直接回應、高轉換率的長短版銷售文案與行動呼籲。",
    promptContext: `【行銷框架切換：直接回應與高轉換銷售 (Direct Response)】
請在撰寫文案或分析時，嚴格遵守以下核心原則：
1. 終極目標是轉換 (Conversion)，不是為了娛樂。
2. PAS 公式：問題 (Problem) - 激化痛點 (Agitate) - 提供解決方案 (Solve)。
3. A-Pile vs B-Pile：文案必須看起來像個人信件般急迫且專屬，絕不能像垃圾廣告。
4. Star, Story, Solution：利用主角(Star)的故事引導出解決方案。
5. 必須包含：無法抗拒的報價 (Irresistible Offer)、風險反轉 (Guarantee) 以及強烈的急迫感與行動呼籲 (Urgency & CTA)。`
  },
  ad_psychology: {
    id: "ad_psychology",
    name: "廣告心理學 (Advertising Psychology)",
    author: "Joseph Sugarman / John Caples",
    description: "專注於心理觸發器、滑梯效應與抓住注意力的廣告文案。",
    promptContext: `【行銷框架切換：廣告心理學 (Advertising Psychology)】
請在撰寫文案或分析時，嚴格遵守以下核心原則：
1. 滑梯效應 (The Slippery Slide)：標題的目的是讓人看第一句話，第一句話的目的是讓人看第二句話。文案必須極度順暢。
2. 心理觸發器：大量運用好奇心 (Curiosity) 作為開頭的驅動力，並建立讀者的擁有感 (Involvement/Ownership)。
3. 誠實與承認缺陷：提早承認產品的小缺點，能建立絕對的信任感。
4. 標題決生死：標題必須訴諸讀者的自我利益 (Self-interest)、提供新資訊 (News) 或激發強烈好奇心。
5. 具體化 (Specifics) 且避免賣弄聰明：用具體的數據與畫面取代模糊的形容詞，清晰永遠勝過聰明。`
  },
  brand_architect: {
    id: "brand_architect",
    name: "品牌形象與故事 (Brand Storytelling)",
    author: "David Ogilvy",
    description: "以 David Ogilvy 為基礎，建立高質感、長期信任與品牌資產的文案。",
    promptContext: `【行銷框架切換：品牌形象 (Brand Storytelling)】
請在撰寫文案或分析時，嚴格遵守以下核心原則：
1. 品牌形象 (Brand Image)：每一次溝通都是在為品牌的長期形象與資產(Brand Equity)作貢獻。人們購買的是品牌的個性。
2. 尊重消費者：把受眾當作聰明的朋友，不要侮辱他們的智商。用豐富的「事實與資訊」來說服。
3. 大創意 (The Big Idea)：文案必須圍繞一個簡單、吸睛且能持續數十年的核心大創意。
4. 語氣質感 (Style and Tone)：語氣必須像是在跟朋友對話，有禮貌且高雅。不要使用空洞的形容詞，用豐富、有渲染力的語言結合硬實力事實。`
  }
};
