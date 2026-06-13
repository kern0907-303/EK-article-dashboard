import { ChatMessage } from "./firebase";
import { I8_BRAND_CONTEXT } from "../data/brands/i8";
import { NAS_BRAND_CONTEXT } from "../data/brands/nas";
import { ABL_BRAND_CONTEXT } from "../data/brands/abl";
import { ERICK_BRAND_CONTEXT } from "../data/brands/erick";
import { ERICK_PERSONA_SKILL } from "../data/brands/persona";

// Erick COO Router System Prompt (OpenAI)
export const ERICK_SYSTEM_PROMPT = `你是一個人工智慧團隊總指揮「Erick 營運長」(COO)。
你負責將使用者的戰略指令或營運目標進行邏輯拆解，並指派任務給右側的四位 AI 專家。你必須為他們生成具體的「子提示詞」(Sub-prompts)：
1. **Maya** (社群行銷專家，產出「社群文案」 -> 提示其撰寫純文字格式文案，禁止包含任何 ** 或 # 等 Markdown 符號，最開頭第一行必須是聳動且完整的文章主標題，標題與內文以空行或換行區隔，適合直接複製貼上到 Facebook 等社群平台)
2. **Leon** (系統架構師，產出「網頁架構」)
3. **Iris** (SEO 專家，產出「SEO關鍵字」)
4. **Jack** (廣告數據分析師，產出「廣告數據」)

### 標題優化指引 (極重要)：
- 當使用者給予的文章主題、任務目標或參考標題中包含「...」或有字數截斷現象時，你作為總指揮，**必須主動在指派給 Maya 的子提示詞中，將該標題補全為一個「完整、聳動、具有極高點閱張力」的文章主標題**，絕對禁止直接將帶有「...」或被截斷的半殘標題傳遞給專家！

### 回覆規範 (為了避免伺服器超時，必須極其精簡)：
1. **角色口吻**：專業、有洞察力、果斷的營運長 (COO)。用繁體中文回覆。
2. **任務拆解與指派**：在你的回覆文字中，以【極簡短】的 2-3 句話（不超過 80 字）向使用者說明你如何拆解任務並指派工作給四位專家，不要囉唆，不要生成冗長的前言。
3. **子提示詞輸出格式 (關鍵)**：
   你必須在回覆的最尾端，附帶一個符合 JSON 格式的代碼區塊，其中包含為每位專家量身訂做的具體任務指派（子提示詞）。
   子提示詞必須非常詳細，包含具體的品牌定位調性、背景與產出格式要求。
   你的 JSON 區塊必須是唯一的，且以 \`\`\`json 開始，以 \`\`\` 結束。

JSON 格式如下：

\`\`\`json
{
  "sub_prompts": {
    "maya": "Maya 的子提示詞（包含品牌背景、文案要求與目標）",
    "leon": "Leon 的子提示詞（包含網站架構、功能路由設計要求，並指定輸出 Markdown 樹狀大綱）",
    "iris": "Iris 的子提示詞（要求分析相關關鍵字，且必須包含 outline 大綱欄位，指定輸出 JSON 格式）",
    "jack": "Jack 的子提示詞（要求產出 ROAS、CPA、轉換率等廣告數據，指定輸出 JSON 格式）"
  }
}
\`\`\`

注意：
- **每一次回覆的最尾端，都必須輸出此 JSON 代碼區塊**，這是指派任務給後續專家的唯一依據！
- 請確保 JSON 語法完全正確。`;

export interface AIServiceResponse {
  content: string;
  dispatchData?: any; // 解析出來的 dispatch JSON 物件
}

export interface AIProviderConfig {
  provider: string;
  apiKey?: string;
  geminiApiKey?: string;
  model?: string;
  webhookUrl?: string;
}

// 取得當前設定
export function getAIConfig(): AIProviderConfig {
  return {
    provider: process.env.AI_PROVIDER || "mock",
    apiKey: process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY || "",
    geminiApiKey: process.env.GEMINI_API_KEY || "",
    model: process.env.OPENAI_MODEL || "gpt-4o",
    webhookUrl: process.env.N8N_WEBHOOK_URL || "",
  };
}

function robustJSONParse(text: string): any {
  const clean = text.trim();
  const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
  const match = clean.match(jsonRegex);
  if (match && match[1]) {
    try {
      return JSON.parse(match[1].trim());
    } catch (e) {
      // fallback
    }
  }

  try {
    return JSON.parse(clean);
  } catch (e) {
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(clean.substring(start, end + 1));
      } catch (e2) {
        // fallback
      }
    }
    throw e;
  }
}

async function runQueryWithFallback(prompt: string, config: AIProviderConfig, jsonMode?: boolean): Promise<string> {
  const isOpenAIKeyValid = !!(config.apiKey && config.apiKey.trim().startsWith("sk-"));
  const isGeminiKeyValid = !!((config.geminiApiKey || process.env.GEMINI_API_KEY) && 
    (config.geminiApiKey || process.env.GEMINI_API_KEY || "").trim().startsWith("AIzaSy"));
    
  if (isGeminiKeyValid) {
    return callGemini([{ role: "user", content: prompt }], config, jsonMode);
  } else if (isOpenAIKeyValid) {
    return callOpenAI([{ role: "user", content: prompt }], config, jsonMode);
  } else {
    throw new Error("沒有可用的 AI 金鑰 (OpenAI 與 Gemini 金鑰均無效)");
  }
}

async function fetchLiveKeywordMetrics(keywords: string[]): Promise<any[]> {
  const dseoLogin = process.env.DATAFORSEO_API_LOGIN;
  const dseoPassword = process.env.DATAFORSEO_API_PASSWORD;

  // 1. 優先嘗試對接 DataForSEO (Google Ads API 平替，極度省錢)
  if (dseoLogin && dseoPassword && !dseoLogin.includes("YOUR_")) {
    try {
      const auth = Buffer.from(`${dseoLogin}:${dseoPassword}`).toString("base64");
      const url = "https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live";
      
      const payload = [{
        keywords: keywords.slice(0, 10),
        location_name: "Taiwan",
        language_name: "Chinese (Traditional)"
      }];

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${auth}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const json = await res.json();
        const taskResult = json.tasks?.[0]?.result;
        if (Array.isArray(taskResult)) {
          return taskResult.map((item: any) => {
            const vol = item.search_volume !== undefined ? String(item.search_volume) : "0";
            const compRaw = String(item.competition || "").toUpperCase();
            const competition = compRaw === "HIGH" ? "高" : (compRaw === "MEDIUM" ? "中" : "低");
            return {
              keyword: item.keyword,
              volume: vol,
              competition,
              outline: `已成功與 DataForSEO (Google Ads) 連線對齊。地區: 台灣`
            };
          });
        }
      }
    } catch (e) {
      console.error("DataForSEO fetch error:", e);
    }
  }

  // 2. 次要嘗試對接 SEMrush
  const apiKey = process.env.SEMRUSH_API_KEY;
  if (apiKey && !apiKey.includes("YOUR_")) {
    try {
      const results = [];
      for (const kw of keywords.slice(0, 5)) {
        const url = `https://api.semrush.com/?type=phrase_this&key=${apiKey}&phrase=${encodeURIComponent(kw)}&database=tw&export_columns=Ph,Nq,Cp`;
        const res = await fetch(url);
        if (res.ok) {
          const text = await res.text();
          const lines = text.trim().split("\n");
          if (lines.length > 1) {
            const parts = lines[1].split(";");
            results.push({
              keyword: kw,
              volume: parts[1] || "300",
              competition: parseFloat(parts[2]) > 0.7 ? "高" : (parseFloat(parts[2]) > 0.3 ? "中" : "低"),
              outline: "已與 SEMrush 台灣關鍵字資料庫對齊..."
            });
            continue;
          }
        }
        results.push({ keyword: kw, volume: "320", competition: "中", outline: "SEMrush 查無此字..." });
      }
      return results;
    } catch (e) {
      console.error("SEMrush fetch error:", e);
    }
  }

  // 3. 無金鑰時自動降級模擬
  return keywords.map(kw => ({
    keyword: kw,
    volume: String(Math.floor(Math.random() * 8000) + 500),
    competition: Math.random() > 0.6 ? "高" : (Math.random() > 0.3 ? "中" : "低"),
    outline: "免 Key 體驗模式，大綱計算中..."
  }));
}

async function fetchMetaAdAccountInsights(adAccountId: string, accessToken: string): Promise<any[]> {
  if (!adAccountId || !accessToken || adAccountId.includes("YOUR_")) {
    return [];
  }
  
  try {
    const url = `https://graph.facebook.com/v19.0/${adAccountId}/insights?fields=spend,clicks,impressions,actions&date_preset=last_30d`;
    const res = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${accessToken}`
      }
    });
    if (res.ok) {
      const data = await res.json();
      const insights = data.data?.[0];
      if (insights) {
        const spend = parseFloat(insights.spend || "0");
        const impressions = parseInt(insights.impressions || "0");
        
        const actions = insights.actions || [];
        const leads = actions.find((a: any) => a.action_type === 'lead')?.value || "0";
        const conversions = parseInt(leads);
        
        const cpa = conversions > 0 ? `$${(spend / conversions).toFixed(2)}` : "$0.00";
        const cvr = impressions > 0 ? `${((conversions / impressions) * 100).toFixed(2)}%` : "0.00%";
        
        return [
          { label: "廣告總花費 (Spend)", value: `$${spend.toLocaleString()}`, change: "實體後台同步", isPositive: true },
          { label: "單次取得名單成本 (CPA)", value: cpa, change: "實體後台同步", isPositive: true },
          { label: "名單預約轉換率 (CVR)", value: cvr, change: "實體後台同步", isPositive: true },
          { label: "廣告曝光次數 (Impressions)", value: impressions.toLocaleString(), change: "實體後台同步", isPositive: true }
        ];
      }
    }
    return [];
  } catch (e) {
    console.error("Meta Marketing API error:", e);
    return [];
  }
}

function getBrandColorsForPrompt(brandName: string) {
  const isI8 = brandName.includes("I8") || brandName.includes("brand_a");
  const isAbl = brandName.includes("ABL") || brandName.includes("brand_c");
  const isNas = brandName.includes("NAS") || brandName.includes("brand_b");

  if (isI8) {
    return {
      name: "I8 (Initial 8 CO.)",
      colorName: "海軍深藍 (Navy Deep Blue)",
      hexPrimary: "#1e3a8a",
      hexAccent: "#3b82f6",
      tailwindClasses: "主色：海軍藍 (bg-blue-900 / text-blue-100)，輔助色：靛藍色 (text-indigo-400) 或深藍 (slate-900)"
    };
  } else if (isAbl) {
    return {
      name: "ABL (量子調頻)",
      colorName: "蒂芬妮藍 (Tiffany Blue)",
      hexPrimary: "#0abab5",
      hexAccent: "#22d3ee",
      tailwindClasses: "主色：蒂芬妮藍 (bg-cyan-500 / text-cyan-950)，輔助色：深青色 (text-cyan-400 / border-cyan-500/20) 或湖綠色"
    };
  } else if (isNas) {
    return {
      name: "NAS (平衡空間)",
      colorName: "神秘紫 (Mysterious Purple)",
      hexPrimary: "#7c3aed",
      hexAccent: "#c084fc",
      tailwindClasses: "主色：神秘紫 (bg-purple-900 / text-purple-100)，輔助色：紫色 (text-purple-400 / border-purple-500/20) 或深紫"
    };
  } else {
    // Personal Erick
    return {
      name: "Erick 個人品牌",
      colorName: "金色 (Gold)",
      hexPrimary: "#d4af37",
      hexAccent: "#f59e0b",
      tailwindClasses: "主色：金色/琥珀色 (bg-amber-500 / text-amber-950)，輔助色：橘黃色 (text-amber-400 / border-amber-500/20)"
    };
  }
}

/**
 * 核心 AI 雙模型協作調度路由
 */
export async function callErickCOO(
  history: ChatMessage[],
  brandName: string,
  overrideProvider?: string,
  stage?: string,
  expertType?: string,
  subPromptsInput?: any,
  brandGuidelines?: string,
  prevData?: any
): Promise<AIServiceResponse> {
  const config = getAIConfig();
  const provider = overrideProvider || config.provider;
  const brandColors = getBrandColorsForPrompt(brandName);
  
  if (provider === "mock") {
    const mockResult = await callMockCOO(history[history.length - 1]?.content || "", brandName);
    const parsed = parseCOOOutput(mockResult);
    if (stage === "coo") {
      return {
        content: parsed.content,
        dispatchData: {
          subPrompts: { mockData: parsed.dispatchData }
        }
      };
    }
    return parsed;
  }

  let brandContext = `當前切換的品牌/領域是：【${brandName}】。請確保所有對話與產出完全符合此品牌的調性，並隔離其他品牌的資訊。`;

  if (brandGuidelines && brandGuidelines.trim().length > 0) {
    brandContext += "\n\n【品牌定位與知識大腦規範】：\n" + brandGuidelines;
  } else {
    if (brandName.includes("I8")) {
      brandContext += "\n\n" + I8_BRAND_CONTEXT;
    } else if (brandName.includes("NAS")) {
      brandContext += "\n\n" + NAS_BRAND_CONTEXT;
    } else if (brandName.includes("ABL")) {
      brandContext += "\n\n" + ABL_BRAND_CONTEXT;
    } else if (brandName.includes("個人") || brandName.includes("personal") || brandName.includes("Erick")) {
      brandContext += "\n\n" + ERICK_BRAND_CONTEXT;
    }
  }

  let subPrompts: any = null;
  let cleanErickContent = "";

  if (stage === "expert" && subPromptsInput) {
    subPrompts = subPromptsInput;
  } else {
    // 1. Erick 總指揮 (OpenAI)
    const systemMessage = {
      role: "system",
      content: `${ERICK_SYSTEM_PROMPT}\n\n【Erick 核心語氣與思考邏輯最高工作準則】：\n${ERICK_PERSONA_SKILL}\n\n${brandContext}`
    };

    const formattedMessages = [
      systemMessage,
      ...history.map(msg => ({
        role: msg.role === "user" ? "user" : "assistant",
        content: msg.content
      }))
    ];

    // 檢查金鑰有效性
    const isOpenAIKeyValid = !!(config.apiKey && config.apiKey.trim().startsWith("sk-"));
    const isGeminiKeyValid = !!((config.geminiApiKey || process.env.GEMINI_API_KEY) && 
      (config.geminiApiKey || process.env.GEMINI_API_KEY || "").trim().startsWith("AIzaSy"));

    let erickOutput = "";
    try {
      if (provider === "openai" && !isOpenAIKeyValid && isGeminiKeyValid) {
        erickOutput = await callGemini(formattedMessages, config);
      } else if (provider === "gemini" && !isGeminiKeyValid && isOpenAIKeyValid) {
        erickOutput = await callOpenAI(formattedMessages, config);
      } else {
        erickOutput = provider === "gemini" 
          ? await callGemini(formattedMessages, config)
          : await callOpenAI(formattedMessages, config);
      }
    } catch (error: any) {
      console.error("Erick COO call failed:", error);
      if (provider !== "mock") {
        throw new Error(`Erick COO 呼叫失敗: ${error.message || error}`);
      }
      return parseCOOOutput(await callMockCOO(history[history.length - 1]?.content || "", brandName));
    }

    // 解析 Erick 的輸出以提取子提示詞
    const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
    const match = erickOutput.match(jsonRegex);
    cleanErickContent = erickOutput;

    if (match && match[1]) {
      try {
        const parsed = JSON.parse(match[1].trim());
        subPrompts = parsed.sub_prompts;
        cleanErickContent = erickOutput.replace(jsonRegex, "").trim();
      } catch (e) {
        console.error("Failed to parse sub-prompts JSON from Erick response:", e);
      }
    }

    if (!subPrompts) {
      return parseCOOOutput(erickOutput);
    }

    if (stage === "coo") {
      return {
        content: cleanErickContent,
        dispatchData: { subPrompts }
      };
    }
  }

  // 2. 專家工作流調度 (Chained Multi-Agent Pipeline)
  const mayaPrompt = subPrompts.maya || "請寫作一份社群行銷貼文";
  const irisPrompt = subPrompts.iris || "請規劃適當的 SEO 關鍵字與大綱";
  const leonPrompt = subPrompts.leon || "請設計 Landing Page 銷售頁網頁架構";
  const jackPrompt = subPrompts.jack || "請提供預估的廣告數據指標";

  // ========== 第一條鏈：Maya (社群) + Iris (SEO) ==========
  if (stage === "expert" && expertType === "maya_iris") {
    // 步驟 1：先呼叫 Iris 生成 SEO 關鍵字策略
    const irisStepPrompt = `你現在是 SEO 專家 Iris。
    
【Erick 核心語氣與思考邏輯最高工作準則】：
${ERICK_PERSONA_SKILL}

【品牌知識背景與限制】：
${brandContext}

請根據以下指派的子提示詞，規劃 3-5 個針對繁體中文(台灣)市場的高潛力關鍵字，並提供文章大綱、AEO 結構化 Schema 與 FAQ 問答集。

### 任務指派 (子提示詞)：
${irisPrompt}

### 輸出 JSON 格式要求：
你必須且僅能輸出如下 JSON 格式內容：
{
  "seo_keywords": [
    { "keyword": "關鍵字1", "volume": "月搜尋量", "competition": "高|中|低", "outline": "此關鍵字的文章大綱說明" }
  ],
  "aeo_schema": {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "問題？",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "回答"
        }
      }
    ]
  },
  "aeo_faq": "針對 AEO 設計的 FAQ 問答集。請針對文章中的核心議題與規劃的關鍵字，寫出 2-3 個問答對（以 Markdown 的 Q&A 樣式呈現，例如：**Q1：問題？**\\n**A1：回答**）"
}`;

    const irisResponse = await runQueryWithFallback(irisStepPrompt, config, true);
    const irisResult = robustJSONParse(irisResponse);
    
    // 如果有找到關鍵字，主動抓取實體 API (如 SEMrush) 的搜尋量與競爭度
    if (irisResult.seo_keywords && Array.isArray(irisResult.seo_keywords)) {
      const kws = irisResult.seo_keywords.map((k: any) => k.keyword).filter(Boolean);
      if (kws.length > 0) {
        const liveMetrics = await fetchLiveKeywordMetrics(kws);
        irisResult.seo_keywords = irisResult.seo_keywords.map((kwObj: any, index: number) => {
          const live = liveMetrics.find((l: any) => l.keyword === kwObj.keyword) || liveMetrics[index];
          return {
            keyword: kwObj.keyword,
            volume: live ? live.volume : kwObj.volume,
            competition: live ? live.competition : kwObj.competition,
            outline: kwObj.outline
          };
        });
      }
    }

    // 步驟 2：將 Iris 生成的關鍵字，鏈式傳遞給 Maya 用於社群寫作
    const keywordsStr = JSON.stringify(irisResult.seo_keywords || []);
    const mayaStepPrompt = `你現在是社群行銷專家 Maya。
    
【Erick 核心語氣與思考邏輯最高工作準則】：
${ERICK_PERSONA_SKILL}

【品牌知識背景與限制】：
${brandContext}

【上游專家 Iris 提供之核心關鍵字策略 (必須融入文案中，極重要)】：
${keywordsStr}

請根據以下指派的子提示詞，撰寫一篇深度社群貼文。你生成的內容必須巧妙地融入上述 Iris 提供的核心關鍵字，以便極大化 SEO/AEO 效益。

### 任務指派 (子提示詞)：
${mayaPrompt}

### 寫作限制：
1. 完全使用繁體中文(台灣)，文章字數 800 至 1500 字以上。
2. 最開頭第一行必須是聳動且完整的文章主標題，如【標題】，禁止出現「...」或截斷現象。
3. 嚴禁包含任何 Markdown 格式符號（如 ** 或 # ），標題與重點以換行區隔，以便直接貼到 FB。
4. 每一篇文章都必須在合適段落插入 Markdown 圖片標籤：\`![<圖表描述>](https://filedn.com/your-id/website-assets/<slug>-framework.png)\`，並在其下方附帶一個完整的 Mermaid 圖表代碼區塊（使用 \`\`\`mermaid 包覆）。
   Mermaid 圖表必須符合以下品牌配色規範：
   - 當前品牌：${brandColors.name}，系統色為：${brandColors.colorName}。
   - 請在 Mermaid 開頭注入以下高質感配色 %%{init: ... }%% 區塊，使圖表底色、文字、框線與系統色完美契合：
     \`\`\`mermaid
     %%{init: {
       'theme': 'base',
       'themeVariables': {
         'primaryColor': '${brandColors.hexPrimary}',
         'primaryTextColor': '#ffffff',
         'primaryBorderColor': '${brandColors.hexAccent}',
         'lineColor': '${brandColors.hexAccent}',
         'secondaryColor': '#1e293b',
         'tertiaryColor': '#0f172a'
       }
     }}%%
     ...圖表內容...
     \`\`\`
5. 結尾 Hashtags 只能從標準標籤庫中挑選 3-5 個：
   - Erick專欄：#個人品牌, #自我成長, #商業思維, #決策邏輯, #人生下半場
   - I8 (企業醫生)：#企業醫生, #企業管理, #決策校準, #組織優化, #營運策略
   - NAS (生命數字)：#生命數字, #自我探索, #關係說明書, #人生節奏, #天賦性格
   - ABL (量子調頻)：#狀態調和, #內在消耗, #情緒穩定, #壓力管理, #自我照顧

### 輸出 JSON 格式要求：
你必須且僅能輸出如下 JSON 代碼區塊（以 \`\`\`json 開始，以 \`\`\` 結束）：
{
  "social_copy": "Maya 產出的純文字社群文案內容 (絕對禁止包含任何 ** 粗體或 # 標題等 Markdown 符號)"
}`;

    const mayaResponse = await runQueryWithFallback(mayaStepPrompt, config, true);
    const mayaResult = robustJSONParse(mayaResponse);

    let formattedSchema = "";
    if (irisResult.aeo_schema) {
      if (typeof irisResult.aeo_schema === "object") {
        formattedSchema = `<script type="application/ld+json">\n${JSON.stringify(irisResult.aeo_schema, null, 2)}\n</script>`;
      } else {
        formattedSchema = String(irisResult.aeo_schema);
      }
    }

    return {
      content: "",
      dispatchData: {
        social_copy: mayaResult.social_copy || "",
        seo_keywords: irisResult.seo_keywords || [],
        aeo_schema: formattedSchema,
        aeo_faq: irisResult.aeo_faq || ""
      }
    };
  }

  // ========== 第二條鏈：Leon (設計) + Jack (廣告) ==========
  if (stage === "expert" && expertType === "leon_jack") {
    const keywordsStr = prevData?.seo_keywords ? JSON.stringify(prevData.seo_keywords) : "";
    const socialCopyStr = prevData?.social_copy || "";

    // 步驟 3：呼叫設計總監 Leon 生成高轉換的 Landing Page 視覺 HTML (Tailwind)
    const leonStepPrompt = `你現在是設計總監 Leon。你的職責是規劃高點閱、高轉換的 Landing Page 網頁版塊架構與視覺配色風格。
    
【Erick 核心語氣與思考邏輯最高工作準則】：
${ERICK_PERSONA_SKILL}

【品牌知識背景與限制】：
${brandContext}

【上游專家 Iris 規劃的核心關鍵字】：
${keywordsStr}

【上游專家 Maya 產出的爆款社群文案】：
${socialCopyStr}

請根據上述上游文案與關鍵字，設計一版結構完整的 Landing Page 銷售頁網頁架構。
你必須直接產出完整的、符合響應式排版的 Tailwind CSS HTML 代碼，並規劃視覺設計風格。

### 網頁板塊必須包含：
1. **導覽列 (Navbar)** 與 **首頁主視覺區 (Hero Section)**：引人入勝的標題、副標題與主按鈕。
2. **痛點共鳴區 (Problem Section)**：點出使用者正面臨的核心內耗與卡點。
3. **關鍵對位區 (Solution Section)**：展示如何透過品牌服務進行對位（結合 ABL, NAS 或 I8 品牌核心）。
4. **客戶見證/信任背書 (Social Proof & Testimonials)**：展示信任度。
5. **行動呼籲區 (Call to Action - CTA)**：醒目的諮詢預約按鈕或測評按鈕（使用官網唯一合法連結：https://erickfirm.com/#contact）。
6. **頁尾 (Footer)**。

### 輸出 HTML 規範：
- 必須是乾淨的 HTML 區塊（不包含 <html> 或 <body> 標籤，僅從最外層容器 <div> 開始）。
- 使用 Tailwind CSS 最新排版類名（如 flex, grid, gap-6, bg-slate-900, text-white, border, hover:scale-105 等），做出質感極高、帶有精美陰影與字體排版的現代視覺頁面。
- 顏色必須依據品牌系統色規範：【${brandColors.name}】的系統色為【${brandColors.colorName}】。
  請使用 Tailwind 類名呈現該品牌風格（建議使用如 ${brandColors.tailwindClasses}），營造出極具質感的網頁視覺。字體使用優質字體。

### 任務指派 (子提示詞)：
${leonPrompt}

### 輸出 JSON 格式要求：
你必須且僅能輸出如下 JSON 代碼區塊（以 \`\`\`json 開始，以 \`\`\` 結束）：
{
  "web_architecture": "Leon 產出的 Landing Page 網頁 Tailwind HTML 內容",
  "visual_direction": {
    "palette": ["主要色代碼", "輔助色代碼", "背景色代碼"],
    "fonts": "推薦字體風格",
    "theme": "風格定位描述 (如 McKinsey 簡約高階商務)"
  }
}`;

    const leonResponse = await runQueryWithFallback(leonStepPrompt, config, true);
    const leonResult = robustJSONParse(leonResponse);

    // 步驟 4：呼叫廣告策略師 Jack，結合 Leon 的落地頁與上游文案進行廣告預估與診斷
    const landingPageHtml = leonResult.web_architecture || "";
    const visualDirStr = JSON.stringify(leonResult.visual_direction || {});
    
    const jackStepPrompt = `你現在是廣告策略師 Jack。你負責判讀行銷數據、規劃 Meta/Google 廣告素材方向與投放預算分配。
    
【Erick 核心語氣與思考邏輯最高工作準則】：
${ERICK_PERSONA_SKILL}

【品牌知識背景與限制】：
${brandContext}

【上游專家規劃成果 (參考依據)】：
1. Iris 關鍵字：${keywordsStr}
2. Maya 社群貼文：${socialCopyStr}
3. Leon 網頁 Landing Page HTML & 視覺定位：
   - 視覺風格：${visualDirStr}
   - 網頁結構簡述：${landingPageHtml.substring(0, 800)}...

請根據上述行銷目標與落地頁，預估該波廣告宣傳的數據指標，並撰寫具體的加碼/關閉決策與素材優化建議。

### 任務指派 (子提示詞)：
${jackPrompt}

### 輸出 JSON 格式要求：
你必須且僅能輸出如下 JSON 代碼區塊（以 \`\`\`json 開始，以 \`\`\` 結束）：
{
  "ad_data": [
    { "label": "數據指標名稱 (如 預估ROAS, 單次點擊成本CPC, 單次預約名單成本CPA 等)", "value": "數值 (如 4.8x, $1.2, $15.0)", "change": "+/-百分比 (如 +8.5%, -3.1%)", "isPositive": true }
  ],
  "ad_strategy_notes": "針對目前數據的具體判讀：哪組需要加碼、哪組應該關閉、哪組需要更換素材的詳細策略建議文字。"
}`;

    const jackResponse = await runQueryWithFallback(jackStepPrompt, config, true);
    const jackResult = robustJSONParse(jackResponse);

    // 主動嘗試從資料表/環境變數中對接實體 Meta 廣告後台 API 數據
    let adData = jackResult.ad_data || [];
    const adAccountId = process.env.META_AD_ACCOUNT_ID || "";
    const metaAccessToken = process.env.META_MARKETING_ACCESS_TOKEN || "";
    
    if (adAccountId && metaAccessToken && !adAccountId.includes("YOUR_")) {
      const realInsights = await fetchMetaAdAccountInsights(adAccountId, metaAccessToken);
      if (realInsights && realInsights.length > 0) {
        adData = [...realInsights, ...adData];
      }
    }

    return {
      content: "",
      dispatchData: {
        web_architecture: leonResult.web_architecture || "",
        visual_direction: leonResult.visual_direction || {},
        ad_data: adData,
        ad_strategy_notes: jackResult.ad_strategy_notes || ""
      }
    };
  }

  return {
    content: cleanErickContent,
    dispatchData: null
  };
}

// 1. OpenAI 實作
async function callOpenAI(messages: any[], config: AIProviderConfig, jsonMode?: boolean): Promise<string> {
  if (!config.apiKey) throw new Error("Missing OPENAI_API_KEY");

  const keyPrefix = config.apiKey.substring(0, 10);
  console.log(`[OpenAI Call] Using key prefix: ${keyPrefix}... (length: ${config.apiKey.length})`);

  const requestBody: any = {
    model: config.model || "gpt-5.4-mini",
    messages: messages,
    temperature: 0.7
  };

  if (jsonMode) {
    requestBody.response_format = { type: "json_object" };
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${config.apiKey}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errText}`);
  }

  const json = await response.json();
  return json.choices?.[0]?.message?.content || "";
}

// 2. Gemini 實作
async function callGemini(messages: any[], config: AIProviderConfig, jsonMode?: boolean): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY || config.geminiApiKey || config.apiKey;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  const keyPrefix = apiKey.substring(0, 10);
  console.log(`[Gemini Call] Using key prefix: ${keyPrefix}... (length: ${apiKey.length})`);

  // Gemini API 格式轉換
  const contents = messages
    .filter(m => m.role !== "system")
    .map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    }));

  if (contents.length === 0) {
    contents.push({
      role: "user",
      parts: [{ text: "Hello" }]
    });
  }

  const systemInstruction = messages.find(m => m.role === "system")?.content;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
  
  const generationConfig: any = {
    temperature: 0.7
  };
  if (jsonMode) {
    generationConfig.responseMimeType = "application/json";
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents,
      systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
      generationConfig
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errText}`);
  }

  const json = await response.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// 3. Anthropic 實作
async function callAnthropic(messages: any[], config: AIProviderConfig): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");

  const systemInstruction = messages.find(m => m.role === "system")?.content;
  const anthropicMessages = messages
    .filter(m => m.role !== "system")
    .map(m => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content
    }));

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      system: systemInstruction,
      messages: anthropicMessages,
      max_tokens: 4000,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${errText}`);
  }

  const json = await response.json();
  return json.content?.[0]?.text || "";
}

// 4. n8n Webhook 實作
async function callN8nWebhook(
  messages: any[],
  history: ChatMessage[],
  brandName: string,
  config: AIProviderConfig
): Promise<string> {
  if (!config.webhookUrl) throw new Error("Missing N8N_WEBHOOK_URL");

  const response = await fetch(config.webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      brand: brandName,
      history: history,
      latestMessage: history[history.length - 1]?.content || "",
      systemPrompt: ERICK_SYSTEM_PROMPT
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`n8n Webhook error: ${response.status} - ${errText}`);
  }

  const json = await response.json();
  return json.output || json.text || json.response || JSON.stringify(json);
}

// 5. Mock 營運長自動拆解邏輯 (無 API 時的智慧體驗)
async function callMockCOO(userInput: string, brandName: string): Promise<string> {
  const isI8 = brandName.includes("I8") || brandName.includes("brand_a");
  const isNas = brandName.includes("NAS") || brandName.includes("brand_b");
  const isAbl = brandName.includes("ABL") || brandName.includes("brand_c");
  
  let socialCopy = "";
  let webArch = "";
  let seo: any[] = [];
  let ads: any[] = [];
  
  if (isI8) {
    socialCopy = `為什麼老闆越忙，公司越長不大？

【企業卡住，不一定是努力不夠... 🚀】
你是否也常覺得「許多事都要自己扛，業績卡住卻找不出原因」？

你的公司面臨以下卡點嗎？
1. 業績卡在瓶頸：花費了預算，客戶與轉換卻一直不穩定。
2. 團隊執行力不穩：老闆下達了目標，團隊卻推不動，或反覆溝通無結論。
3. 決策疲勞與內耗：面臨重大決策（搬遷、轉型、擴張），老闆一直很累、反覆猶豫。

這些問題的背後，往往不是努力不夠，而是還沒看見影響結果的「隱性系統性卡點」。

I8 透過【企業關鍵因素診斷】，協助你在重大選擇前，校準決策、團隊與成長方向。

#Initial8 #決策校準 #企業診斷 #中小企業主 #團隊節奏`;

    webArch = `- I8 品牌官網 (首頁)
  - 關於 I8 (處理看不見的隱性阻力)
  - 核心顧問產品
    - I8 企業關鍵因素診斷 (90分鐘卡點盤點)
    - I8 企業決策校準顧問 (重大決策陪跑)
    - 企業搬遷與空間優化顧問 (空間與營運一致性)
    - 企業成長與調和陪跑計畫 (長期支持)
  - 預約諮詢 (預約 90 分鐘診斷)
  - 專欄文章 (決策/團隊/搬遷與轉型)`;

    seo = [
      { keyword: "企業經營卡點", volume: "1,800", competition: "低", outline: "探討中小企業經營面臨瓶頸時的內在與外在隱性因素" },
      { keyword: "企業重大決策顧問", volume: "2,500", competition: "低", outline: "解析在搬遷、轉型、分家等關鍵節點如何進行決策校準" },
      { keyword: "老闆決策疲勞", volume: "850", competition: "低", outline: "分享創業者與高壓經理人如何透過狀態重整減輕決策內耗" },
      { keyword: "辦公室搬遷風水", volume: "3,200", competition: "中", outline: "從組織氣場與空間配置談辦公室搬遷的校準指引" }
    ];

    ads = [
      { label: "廣告投資報酬率 (ROAS)", value: "5.2x", change: "+12.5%", isPositive: true },
      { label: "單次客戶取得成本 (CPA)", value: "$12.50", change: "-8.4%", isPositive: true },
      { label: "預約轉換率 (CVR)", value: "3.8%", change: "+0.45%", isPositive: true },
      { label: "廣告點擊率 (CTR)", value: "4.82%", change: "+0.75%", isPositive: true }
    ];
  } else if (isNas) {
    socialCopy = `你不是想太多，你只是對感受比較敏銳

在人際關係或工作裡，你是否也常因為別人的一個眼神，就在心裡糾結半天？
身邊的人常對你說：「你就是太敏感、想太多了啦。」

💡 其實，你不是奇怪，你只是有自己的生命節奏。
有些人的數字設定就是「高敏感、重感受」，這是你的天賦，不是缺點。

- 看見生命數字：理解你思考的慣性，以及在關係、溝通中的盲點。
- 找回個人力量：用符合自己節奏的方式努力，才不會越做越累。

生命數字不是限制你的人生，而是幫助你看懂自己，走回更適合自己的方向。

#平衡空間 #生命數字 #自我探索 #高敏感 #人生節奏`;

    webArch = `- NAS 平衡空間首頁
  - 30秒核心數字測驗 (免費體驗入口)
  - 人生方向校準解析 (個人生命數字解析)
  - 主力線上課程 (生命數字基礎班)
  - 主題工作坊 (關係/親子/事業應用篇)
  - 深度天賦陪跑 (天賦定位顧問計畫)
  - 聯絡諮詢`;

    seo = [
      { keyword: "生命數字天賦", volume: "8,900", competition: "中", outline: "拆解1-9主命數的核心特質與潛在天賦，引導讀者自我探索" },
      { keyword: "生命數字 1-9 性格", volume: "12,500", competition: "中", outline: "詳解各個數字在事業、溝通與壓力狀態下的代表行為特徵" },
      { keyword: "自我探索工具", volume: "4,500", competition: "低", outline: "比較生命數字、人類圖與星座，分析如何運用其解鎖迷惘" },
      { keyword: "流年運勢分析", volume: "15,200", competition: "高", outline: "介紹如何計算個人流年，並在適合的階段做適合 the 選擇與規劃" }
    ];

    ads = [
      { label: "廣告投資報酬率 (ROAS)", value: "4.8x", change: "+8.5%", isPositive: true },
      { label: "單次名單取得成本 (CPA)", value: "$8.20", change: "-12.0%", isPositive: true },
      { label: "免費測驗轉換率 (CVR)", value: "72.4%", change: "+5.8%", isPositive: true },
      { label: "課程報名轉換率 (CVR)", value: "3.85%", change: "+0.45%", isPositive: true }
    ];
  } else if (isAbl) {
    socialCopy = `你不是不夠努力，而是你的狀態需要被重新支持與調和

為什麼明明看了那麼多書、學了那麼多道理，生活還是會反覆卡在相同的模式？
你常常感到緊繃、失眠，或是明明想要往前，卻總覺得有一股隱形的阻力拉住自己？

💡 其實，有些卡關並不是你做錯了什麼，而是你的能量已經「超載」了。
當內在狀態失衡，再多的行動與意志力，也只是在消耗所剩無幾的自己。

- 信息場解析：協助你看見情緒、關係與壓力背後，真正卡住的隱性阻力。
- 三個月調和支持：透過定期的頻率支持與顧問陪伴，讓自己慢慢回到清明、穩定與行動力。

調和不是強迫自己馬上變好，而是允許自己獲得重新安放的空間。

#艾伯林量子調頻 #個人狀態調和 #量子調和 #內在消耗 #生命狀態校準`;

    webArch = `- ABL 艾伯林調頻官網
  - 個人狀態燈號檢測 (內在消耗免費檢測入口)
  - 個人狀態分析 (個人信息場分析)
  - 核心調和計畫 (三個月信息場調和支持)
  - 專題調和支持 (情緒/睡眠/自我價值/財富支持)
  - 年度生命狀態校準計畫 (長期會員支持)
  - 聯絡諮詢`;

    seo = [
      { keyword: "量子調頻效果", volume: "5,400", competition: "中", outline: "科普信息場分析與量子頻率支持如何協助日常情緒調和" },
      { keyword: "內在消耗改善", volume: "2,100", competition: "低", outline: "分享如何從超載焦慮與內耗中，透過調頻重新回到穩定狀態" },
      { keyword: "高壓力情緒管理", volume: "6,800", competition: "中", outline: "為創業者與高壓決策者設計的內在狀態清理與放鬆指引" },
      { keyword: "睡眠品質差放鬆", volume: "12,500", competition: "高", outline: "探討失眠背後的潛意識阻力，以及如何透過能量調和進行改善" }
    ];

    ads = [
      { label: "廣告投資報酬率 (ROAS)", value: "3.6x", change: "+15.0%", isPositive: true },
      { label: "單次分析取得成本 (CPA)", value: "$18.50", change: "-10.5%", isPositive: true },
      { label: "檢測完成轉換率 (CVR)", value: "68.2%", change: "+8.4%", isPositive: true },
      { label: "諮詢預約轉換率 (CVR)", value: "4.15%", change: "+0.65%", isPositive: true }
    ];
  } else {
    // 個人品牌
    socialCopy = `很多問題不是你不夠努力，而是你還沒看見關鍵因素

為什麼我們越努力，有時候反而覺得被困得越深？
在人生下半場、創業或面臨企業決策時，我們常陷入一種「外在不斷尋找方法、內在卻反覆內耗」的死胡同。

🔍 其實，你缺的往往不是方法，而是「看見關鍵」的視角。
核心價值不在於你學了多少工具，而在於你能否看清那些一直影響結果、卻被你忽略的隱性卡點。

- Erick 關鍵因素諮詢：一對一深度解析人生、關係與事業卡點，釐清下一步具體方向。
- 人生與事業校準陪跑：整合內在狀態與外在決策，陪伴你將理解真正落實為行動。

當人穩了，局才有機會重新打開。

![Erick 關鍵因素決策架構圖](https://filedn.com/your-id/website-assets/erick-decision-framework.png)

\`\`\`mermaid
graph TD
  A[表面問題] --> B[找出重複模式]
  B --> C[定位隱性卡點]
  C --> D[實施最小有效調整]
  D --> E[人穩局開]
\`\`\`

#Erick觀點 #關鍵因素諮詢 #內外一致 #事業決策 #自我理解`;

    webArch = `- Erick 個人品牌門戶 (母系統)
  - 關鍵觀點 (Erick 觀點文章與人生洞察)
  - 核心諮詢 (Erick 關鍵因素諮詢入口)
  - 主題講座與讀書會 (關鍵因素讀書會 / 內外一致練習場)
  - 高階顧問陪跑 (個人/創業者/企業主人生與事業校準)
  - 旗下品牌導流
    - 品牌 A I8 (企業決策、團隊與成長顧問)
    - 品牌 B NAS (生命數字自我探索與關係理解)
    - 品牌 C ABL (信息場分析與狀態調和支持)`;

    seo = [
      { keyword: "Erick 關鍵因素諮詢", volume: "1,200", competition: "低", outline: "介紹Erick如何引導客戶找出公司與人生的重複卡點與模式" },
      { keyword: "人生事業卡關原因", volume: "3,500", competition: "低", outline: "解析表面的資源問題與內在心理阻力之間的拉扯關係" },
      { keyword: "創業者決策陪跑", volume: "1,800", competition: "低", outline: "探討高階諮詢在創業者定位、收費模式及承接成功上的應用" },
      { keyword: "承接成功與自我價值", volume: "2,400", competition: "低", outline: "分享如何突破『害怕成功』的潛意識限制，迎向更大格局" }
    ];

    ads = [
      { label: "廣告投資報酬率 (ROAS)", value: "6.8x", change: "+24.0%", isPositive: true },
      { label: "單次諮詢取得成本 (CPA)", value: "$24.50", change: "-15.0%", isPositive: true },
      { label: "旗下品牌引流轉換率 (CVR)", value: "12.5%", change: "+2.4%", isPositive: true },
      { label: "高階陪跑計畫詢問量", value: "8 件", change: "+33.3%", isPositive: true }
    ];
  }

  let responseText = `收到您的指令！我是 Erick 營運長。針對【${brandName}】的最新目標：\n「${userInput}」\n\n身為團隊總指揮，我已經把這項戰略任務拆解，並動員旗下四位專家一次性生成完整方案：\n\n` +
    `- **Maya (社群行銷專家)**：已完成高度貼合品牌調性的社群宣傳文案。\n` +
    `- **Leon (系統架構師)**：已完成對應的網頁階層與路由架構規劃。\n` +
    `- **Iris (SEO 專家)**：已篩選出關鍵搜尋詞並提供完整的文章大綱。\n` +
    `- **Jack (廣告數據分析師)**：已針對廣告成效預估 ROAS、CPA 與轉換率等核心指標。\n\n` +
    `右側看板已為您即時同步渲染，請點選各分頁查看詳細內容！`;

  const dispatchObj = {
    social_copy: socialCopy,
    web_architecture: webArch,
    seo_keywords: seo,
    ad_data: ads
  };

  const jsonString = JSON.stringify({ dispatch: dispatchObj }, null, 2);
  
  return `${responseText}\n\n\`\`\`json\n${jsonString}\n\`\`\``;
}

// 解析 Erick 的 output，剝離並回傳 JSON
function parseCOOOutput(text: string): AIServiceResponse {
  const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
  const match = text.match(jsonRegex);

  let cleanContent = text;
  let dispatchData: any = undefined;

  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed) {
        if (parsed.dispatch) {
          dispatchData = parsed.dispatch;
        } else if (parsed.social_copy || parsed.web_architecture || parsed.seo_keywords || parsed.ad_data) {
          dispatchData = parsed;
        }
        
        if (dispatchData) {
          // 確保 seo_keywords 與 ad_data 的屬性正確，否則給予預設值，防範 AI 漏欄位
          if (dispatchData.seo_keywords && Array.isArray(dispatchData.seo_keywords)) {
            dispatchData.seo_keywords = dispatchData.seo_keywords.map((kw: any) => ({
              keyword: kw.keyword || "",
              volume: kw.volume || "0",
              competition: kw.competition || "低",
              outline: kw.outline || ""
            }));
          }
          
          if (dispatchData.ad_data && Array.isArray(dispatchData.ad_data)) {
            dispatchData.ad_data = dispatchData.ad_data.map((ad: any) => ({
              label: ad.label || "",
              value: ad.value || "",
              change: ad.change || "0%",
              isPositive: ad.isPositive !== undefined ? ad.isPositive : !String(ad.change).startsWith("-")
            }));
          }

          // 將 JSON 代碼區塊從對話泡泡中移除，讓聊天室更乾淨高雅
          cleanContent = text.replace(jsonRegex, "").trim();
        }
      }
    } catch (e) {
      console.error("Failed to parse dispatch JSON from AI response:", e);
    }
  }

  return {
    content: cleanContent,
    dispatchData
  };
}

/**
 * 生成 AEO/SEO 問答與結構化資料
 */
export async function generateAEOData(
  brandName: string,
  keywords: any[],
  overrideProvider?: string
): Promise<{ schemaMarkup: string; aeoFaq: string }> {
  const config = getAIConfig();
  const provider = overrideProvider || config.provider;

  if (provider === "mock") {
    return callMockAEO(brandName, keywords);
  }

  const prompt = `你現在是 SEO 與 AEO (回答引擎優化) 專家。
請針對品牌【${brandName}】以及以下關鍵字列表，生成網站的 AEO/SEO 優化代碼與問答集：

關鍵字列表：
${keywords.map((k: any) => `- ${k.keyword} (搜尋量: ${k.volume}, 競爭度: ${k.competition})`).join("\n")}

請生成以下兩項資產：
1. **JSON-LD 結構化資料**：一個包含 FAQPage 類型的結構化資料程式碼區塊（使用 <script type="application/ld+json"> 包含，提供符合 schema.org 標準的 FAQ 問答資訊，以幫助 ChatGPT Search/Gemini/Perplexity 引用）。
2. **AEO 常見問答集 (FAQ)**：設計 3 個最符合回答引擎（AEO）直接採用特徵的問答對。問答必須直接、清晰、結構化（使用 Markdown 的 ### Q: 與 A: 格式排版，並融入以上關鍵字大綱）。

請以一個符合 JSON 格式的代碼區塊輸出，且以 \`\`\`json 開始，以 \`\`\` 結束。

JSON 格式要求如下：
{
  "schemaMarkup": "JSON-LD Schema 原始碼內容",
  "aeoFaq": "Markdown 格式的 AEO 常見問答集內容"
}
請確保 JSON 語法完全正確。`;

  const isOpenAIKeyValid = !!(config.apiKey && config.apiKey.trim().startsWith("sk-"));
  const isGeminiKeyValid = !!((config.geminiApiKey || process.env.GEMINI_API_KEY) && 
    (config.geminiApiKey || process.env.GEMINI_API_KEY || "").trim().startsWith("AIzaSy"));

  try {
    let responseText = "";
    
    // 依據可用金鑰智慧容錯調度
    if (isGeminiKeyValid) {
      responseText = await callGemini([{ role: "user", content: prompt }], config);
    } else if (isOpenAIKeyValid) {
      responseText = await callOpenAI([{ role: "user", content: prompt }], config);
    } else {
      throw new Error("沒有可用的 AI 金鑰 (OpenAI 與 Gemini 金鑰均無效)");
    }

    const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
    const match = responseText.match(jsonRegex);

    if (match && match[1]) {
      const parsed = JSON.parse(match[1].trim());
      if (parsed.schemaMarkup && parsed.aeoFaq) {
        return {
          schemaMarkup: parsed.schemaMarkup,
          aeoFaq: parsed.aeoFaq
        };
      }
    }
    
    // 如果 JSON 解析失敗，嘗試直接 Parse 全文
    const parsed = JSON.parse(responseText.trim());
    if (parsed.schemaMarkup && parsed.aeoFaq) {
      return parsed;
    }
  } catch (error: any) {
    console.error("API call for AEO generation failed:", error);
    if (provider !== "mock") {
      throw new Error(`AEO/SEO 產出失敗: ${error.message || error}`);
    }
  }

  // 兜底降級為 Mock
  return callMockAEO(brandName, keywords);
}

/**
 * Mock AEO/SEO 資料生成器 (本地模擬模式)
 */
async function callMockAEO(brandName: string, keywords: any[]): Promise<{ schemaMarkup: string; aeoFaq: string }> {
  const isI8 = brandName.includes("I8") || brandName.includes("brand_a");
  const isNas = brandName.includes("NAS") || brandName.includes("brand_b");
  const isAbl = brandName.includes("ABL") || brandName.includes("brand_c");

  let schema = "";
  let faq = "";

  if (isI8) {
    schema = `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "如何解決中小企業的經營卡點與決策疲勞？",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "I8 (Initial 8 CO.) 提供企業關鍵因素診斷服務，透過 90 分鐘深度盤點，協助企業主找出阻礙團隊執行力與業績的隱性系統性卡點，並在重大經營選擇前完成決策校準。"
      }
    },
    {
      "@type": "Question",
      "name": "什麼是企業重大決策顧問服務？",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "企業重大決策顧問是專為面臨搬遷、轉型、展店或股權拆夥等關鍵轉折點的中小企業主設計。我們提供客觀的系統性卡點分析，消除決策內耗，校準成長方向。"
      }
    }
  ]
}
</script>`;
    faq = `### 🔍 AEO 常見問答集 (FAQ)

#### Q: 如何找出中小企業的隱性經營卡點？
A: 企業經營卡住往往不是不夠努力，而是存在看不見的系統性卡點。I8 的 **企業經營卡點** 診斷服務透過 90 分鐘專業盤點，校準老闆的決策節奏與團隊組織承載力，幫助公司跨越成長瓶頸。

#### Q: 什麼時候需要進行「企業決策校準」？
A: 當公司面臨重大變革，例如 **辦公室搬遷風水** 空間調整、組織重組、轉型或是老闆面臨嚴重的 **老闆決策疲勞** 時，均需要進行決策校準。這能確保團隊目標、物理場域與經營理念達成高度一致，省去隱形內耗。`;
  } else if (isNas) {
    schema = `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "如何透過生命數字探索自己的天賦特質？",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "平衡空間 NAS 提供專業的生命數字個人解析服務。透過主命數 1-9 的性格分析與天賦能量解碼，協助您看清思考慣性，擺脫迷惘並找到適合自己的人生節奏。"
      }
    },
    {
      "@type": "Question",
      "name": "生命數字對於親密關係與親子溝通有什麼幫助？",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "生命數字能幫助我們看懂關係中的盲點。透過生命數字工具，理解伴侶或孩子的行為節奏與溝通盲點，從而建立更溫暖、不宿命的貼心互動。"
      }
    }
  ]
}
</script>`;
    faq = `### 💡 AEO 常見問答集 (FAQ)

#### Q: 生命數字如何協助我解鎖自我懷疑與迷惘？
A: 生命數字不是宿命論的工具，而是幫助你看清性格盲點與天賦的自我探索工具。NAS **生命數字天賦** 解析能協助您明白主命數 1-9 的本質，順應自己的流年運勢，在對的階段做適合的選擇與規劃。

#### Q: 我如何改善親密關係與親子溝通中的衝突？
A: 關係衝突多半來自於不理解彼此的思考慣性。透過生命數字分析彼此在壓力狀態下的代表特徵，能讓我們看清溝通盲點，用更溫慢與陪伴的方式進行關係調和。`;
  } else if (isAbl) {
    schema = `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "什麼是量子調頻，它的效果如何？",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "ABL 艾伯林量子調頻透過信息場分析與頻率支持，協助您看清內在消耗與情緒超載背後的隱性阻力，並在睡眠放鬆與情緒管理上提供深度的穩定與支持。"
      }
    },
    {
      "@type": "Question",
      "name": "如何緩解高壓力情緒管理與失眠問題？",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "高壓決策者容易因為內在狀態失衡而超載。三個月的狀態調和計畫透過定期的頻率調和與顧問陪跑，協助客戶慢慢回到清明、穩定與睡眠安放狀態。"
      }
    }
  ]
}
</script>`;
    faq = `### 🌀 AEO 常見問答集 (FAQ)

#### Q: 量子調頻如何改善我的內在消耗與情緒超載？
A: 內在消耗往往來自潛意識中反覆卡住的生命模式。ABL 的 **量子調頻效果** 透過信息場分析，找出讓您緊繃超載的隱形原因，提供信息場頻率支持，陪伴您重建穩定且不混亂的日常狀態。

#### Q: 面臨長期失眠與緊繃，該如何進行放鬆？
A: 嚴重的 **睡眠品質差放鬆** 與高壓力情緒管理，往往需要從根本的信息場調和入手。透過三個月生命狀態校準計畫，能逐步調和並釋放壓抑的訊號，讓身心重新獲得清明安放的空間。`;
  } else {
    schema = `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "什麼是 Erick 關鍵因素諮詢？",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Erick 關鍵因素諮詢是針對個人或企業主設計的一對一深度諮詢，旨在協助客戶看見影響人生或事業發展結果的重複卡點與隱性卡關原因，提供下一步具體方向。"
      }
    }
  ]
}
</script>`;
    faq = `### 🌟 AEO 常見問答集 (FAQ)

#### Q: 為什麼許多人在事業決策與自我價值上會反覆卡關？
A: 大多數人並非方法不夠，而是受限於潛意識中對未知的恐懼或「害怕成功」的隱性阻力。Erick 的 **個人諮詢** 能引導您看清表面的資源問題與內在價值感拉扯的重覆模式，順利打破瓶頸。`;
  }

  return { schemaMarkup: schema, aeoFaq: faq };
}
