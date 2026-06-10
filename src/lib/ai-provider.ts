import { ChatMessage } from "./firebase";

// Erick COO Router System Prompt (OpenAI)
export const ERICK_SYSTEM_PROMPT = `你是一個人工智慧團隊總指揮「Erick 營運長」(COO)。
你負責將使用者的戰略指令或營運目標進行邏輯拆解，並指派任務給右側的四位 AI 專家。你必須為他們生成具體的「子提示詞」(Sub-prompts)：
1. **Maya** (社群行銷專家，產出「社群文案」)
2. **Leon** (系統架構師，產出「網頁架構」)
3. **Iris** (SEO 專家，產出「SEO關鍵字」)
4. **Jack** (廣告數據分析師，產出「廣告數據」)

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

/**
 * 核心 AI 雙模型協作調度路由
 */
export async function callErickCOO(
  history: ChatMessage[],
  brandName: string,
  overrideProvider?: string
): Promise<AIServiceResponse> {
  const config = getAIConfig();
  const provider = overrideProvider || config.provider;
  
  if (provider === "mock") {
    return parseCOOOutput(await callMockCOO(history[history.length - 1]?.content || "", brandName));
  }

  let brandContext = `當前切換的品牌/領域是：【${brandName}】。請確保所有對話與產出完全符合此品牌的調性，並隔離其他品牌的資訊。`;

  if (brandName.includes("I8")) {
    brandContext += `\n\n【品牌 A I8 (Initial 8 CO.) 核心定位與知識大腦】：
- 一句話定位：I8 協助企業主看見影響經營結果的關鍵因素，校準決策、團隊與成長方向。
- 更白話版本：I8 是協助企業主處理「看不見但一直影響結果」的隱性系統性卡點顧問服務。例如：業績卡住、團隊執行力不穩、老闆一直很累、決策反覆等。
- 三大核心產品組：
  1. 入門診斷：【I8 企業關鍵因素診斷】或稱【企業經營卡點盤點】(90分鐘 NT$8,000~15,000 / 含報告 NT$50,000~80,000)。
  2. 決策顧問：【I8 企業決策校準】或稱【企業主重大決策顧問】(適合搬遷、展店、轉型、拆夥、重大招募等，單次 NT$20,000~50,000)。
  3. 空間校準：【企業搬遷與空間優化顧問】或稱【I8 企業空間校準】(確保配置與經營目標、團隊一致)。
  4. 陪跑計畫：【三個月/六個月企業成長校準計畫】(結合診斷、陪跑與信息場調和，三個月 NT$150,000~300,000)。
- 核心受眾：中小企業主（5-50人，有瓶頸且身心累，需結構性梳理）、創業者與個人品牌主理人（定位/定價/成交反覆不定）、以及面臨搬遷或展店擴張的公司。
- 品牌語氣：
  1. 穩定且專業：不玄學化問題，而是協助老闆看清。如「企業經營最怕的不是問題出現，而是一直處理錯問題。」
  2. 精準、有洞察：使用「關鍵因素」、「決策校準」、「組織承載力」、「隱性阻力」、「系統性問題」等商業洞察詞彙。
  3. 避開敏感靈性詞彙：第一層文案及內容避免出現「能量場、顯化、靈魂、宇宙、療癒、清理、磁場、神祕」等字眼。
  4. 不恐嚇、不誇大：以「當目標、團隊節奏與決策失去一致性，營運就容易反覆消耗」代替恐嚇。
- 核心主張：企業卡住，不一定是努力不夠，而是還沒看見真正影響結果的關鍵因素。`;
  } else if (brandName.includes("NAS")) {
    brandContext += `\n\n【品牌 B NAS (平衡空間 noage space) 核心定位與知識大腦】：
- 一句話定位：NAS 協助你透過生命數字認識自己、理解關係與人生節奏，找到更適合自己的方向。
- 更白話版本：NAS 是一個幫助人看懂自己、看懂關係、看懂人生階段的生命數字自我探索品牌，為了解決天賦、迷惘、關係衝突（伴侶、親子、家人）及階段選擇等問題。
- 五大核心產品組：
  1. 流量產品：【生命數字入門測驗】或稱【你的生命數字人格小解析】(主命數、天賦特質測驗等免費體驗入口)。
  2. 入門產品：【生命數字個人解析】或稱【人生方向校準解析】(包含主命數、性格優缺點與盲點、當前流年階段與建議；90分鐘 NT$3,500~5,000)。
  3. 主力課程：【生命數字基礎班】或稱【看懂自己的人生數字課】(主命數1~9、生日數、流年、關係互動基礎)。
  4. 主題工作坊：關係篇（用生命數字看懂親密關係）、親子篇（用生命數字看懂孩子）、事業篇（工作定位與事業節奏）、流年篇（年度規劃課）。
  5. 深度陪跑：【生命數字人生陪跑計畫】或稱【天賦定位顧問計畫】(針對轉職/創業/人生重定位每月顧問追蹤陪跑)。
- 核心受眾：想自我探索的女性（25-55歲，迷惘、懷疑自己者）、關係卡住的人（感情委屈、自責或溝通障礙者）、父母與教育者（想理解孩子天賦與節奏者）、專業服務者（教練/顧問/塔羅師等想增加實用諮詢工具者）。
- 品牌語氣：
  1. 溫慢與陪伴：親近溫暖，使用陪伴語言。如「你不是想太多，你只是對感受比較敏銳...」
  2. 清楚與白話：避免玄學神秘化，講得有結構。如「數字是幫助你理解思考慣性與行動模式，而不是限制你。」
  3. 有共鳴與貼近：從日常生活痛點切入。
  4. 絕對不宿命：不使用「命定、注定、改命、開運、絕對準、破解命運、這個數字就是不好」等玄學或恐嚇詞彙。
- 核心主張：生命數字不是限制你的人生，而是幫助你看懂自己，走回更適合自己的方向。`;
  } else if (brandName.includes("ABL")) {
    brandContext += `\n\n【品牌 C ABL (abliene 艾伯林量子調頻) 核心定位與知識大腦】：
- 一句話定位：ABL 透過信息場分析與頻率支持，協助個人穩定情緒、校準狀態，走出反覆卡住的生命模式。
- 更白話版本：ABL 是協助人從焦慮、停滯、混亂與內在消耗中，重新回到穩定與清明狀態 the 個人調和品牌，主要解決情緒卡住、睡眠不穩、關係反覆、工作壓力、人生模糊、身心壓力等生命卡點問題。
- 五大核心產品組：
  1. 流量產品：【個人狀態燈號檢測】或稱【內在消耗檢測】/【人生卡關狀態檢測】(免費讓受眾意識到目前情緒/壓力亮燈狀態的自評測驗)。
  2. 入門產品：【個人信息場狀態分析】或稱【ABL 個人狀態分析】/【信息場關鍵因素分析】(個人現況、情緒/關係/工作卡點分析，60分鐘 NT$3,000~5,000 / 90分鐘 NT$5,000~8,000)。
  3. 核心產品：【三個月狀態調和計畫】或稱【生命狀態校準計畫】(初始分析+目標設定+信息場支持+顧問陪跑，三個月 NT$18,000~80,000+)。
  4. 主題支持：特定狀態支持如【ABL 情緒穩定支持】、【ABL 關係調和支持】、【ABL 睡眠放鬆支持】、【ABL 自我價值支持】、【ABL 財富承接支持】。
  5. 長期支持：【ABL 年度信息場支持】或稱【年度生命狀態校準計畫】(年度主題設定、每季狀態檢視、每月頻率支持與追蹤)。
- 核心受眾：高壓力女性（30-55歲，長期超載，焦慮失眠，想照顧自己）、人生卡關者（工作/關係/價值反覆卡住）、助人工作者（諮詢師/教練/心靈工作者避免個案承接消耗）、創業者與個人品牌經營者（有卡點不敢成交、不敢收費或定價、害怕承接成功者）。
- 品牌語氣：
  1. 深度陪伴感：溫柔但不軟弱（指出真正問題，如「你不是沒有努力，而是你已經用撐住的方式活太久了」）、深刻但不神祕（不講玄學、如「情緒是壓抑下來的訊號」）、穩定且安全（如「調和不是馬上變好，而是慢慢回到比較穩的狀態」）、有洞察但不批判。
  2. 避開敏感靈性詞彙：第一層內容避免使用「治療、療效、保證改善、治癒、疾病根治、替代醫療、靈魂清洗、消業障、改命、立刻翻轉、百分百有效」。安全說法如「協助穩定狀態」、「提供信息場支持」、「陪伴整理卡點」。
- 核心主張：你不是不夠努力，而是你的狀態需要被重新支持與調和。`;
  } else if (brandName.includes("個人") || brandName.includes("personal") || brandName.includes("Erick")) {
    brandContext += `\n\n【個人品牌 Erick 核心定位與知識大腦】：
- 一句話定位：我協助個人與企業看見影響結果的關鍵因素，從自我理解、狀態調和到事業決策，找到更清楚的方向。
- 更白話版本：我做的事情，是幫助人看見「為什麼事情會卡住」，再協助他找到下一步該怎麼調整。核心價值在於：你能看見別人看不見的關鍵。
- 四大核心產品組：
  1. 觀點內容：個人觀點內容（建立信任，如人生卡卡、成功承接、情緒壓力、創業觀察等）。
  2. 入門產品：【Erick 關鍵因素諮詢】或稱【個人方向校準諮詢】/【人生與事業卡點解析】(當前狀態盤點、卡點分析、適合的下一步及導流)。
  3. 影響力產品：【Erick 觀點講座】或稱【關鍵因素讀書會】/【內外一致練習場】(低價或免費，如「為什麼努力沒結果」、「看懂卡點」、「成功讓人害怕}」等)。
  4. 高階顧問：【Erick 個人顧問陪跑】或稱【人生與事業校準計畫】(針對個人/創業者/企業主深度整合定位、事業、決策與行動落地陪跑)。
- 核心受眾：35-55歲人生轉折者（想看清問題、突破模式）、創業者與個人品牌經營者（在曝光與承接成功間拉扯，內在跟不上策略）、企業主與高壓決策者（決策孤獨，團隊問題反覆，需更高視角）、以及已接觸自我探索需落地的實踐者。
- 品牌語氣：
  1. 深刻的洞察：說出客戶說不出的深刻洞見。如「很多人不是沒有方向，而是太習慣回應期待...」
  2. 被理解的溫度：同理人的不易。如「你不是不想改變，而是過去改變太痛，光是想到重新開始就累了。」
  3. 清晰的結構：有方法地梳理卡點。如「先看表面問題，再看重複模式，最後找出最小有效調整。」
  4. 鮮明的立場：有觀點、不討好。如「我不認為所有問題都要靠努力解決，有時努力只會困在錯誤的方向。」
  5. 避開敏感詞彙：不要一開始被工具綁住（如「專做調頻/TimeWaver老師/改命/開運」等字眼），走成熟的高客單與企業主路線。
- 核心主張：很多問題不是你不夠努力，而是你還沒看見真正影響結果的關鍵因素。`;
  }

  // 1. Erick 總指揮 (OpenAI)
  const systemMessage = {
    role: "system",
    content: `${ERICK_SYSTEM_PROMPT}\n\n${brandContext}`
  };

  const formattedMessages = [
    systemMessage,
    ...history.map(msg => ({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.content
    }))
  ];

  let erickOutput = "";
  try {
    // 呼叫 OpenAI 進行任務拆解
    erickOutput = await callOpenAI(formattedMessages, config);
  } catch (error: any) {
    console.error("OpenAI call for Erick COO failed:", error);
    if (provider !== "mock") {
      throw new Error(`Erick COO (OpenAI) 呼叫失敗: ${error.message || error}`);
    }
    return parseCOOOutput(await callMockCOO(history[history.length - 1]?.content || "", brandName));
  }

  // 解析 Erick 的輸出以提取子提示詞
  const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
  const match = erickOutput.match(jsonRegex);
  let subPrompts: any = null;
  let cleanErickContent = erickOutput;

  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1].trim());
      subPrompts = parsed.sub_prompts;
      cleanErickContent = erickOutput.replace(jsonRegex, "").trim();
    } catch (e) {
      console.error("Failed to parse sub-prompts JSON from Erick response:", e);
    }
  }

  // 如果未能成功獲取 sub_prompts，則直接解析 Erick 回覆中的 dispatch JSON (相容舊格式)
  if (!subPrompts) {
    return parseCOOOutput(erickOutput);
  }

  // 2. 雙大腦併發調度 (Parallel API Calls)
  const mayaPrompt = subPrompts.maya || "請寫作一份社群行銷貼文";
  const irisPrompt = subPrompts.iris || "請規劃適當的 SEO 關鍵字與大綱";
  const leonPrompt = subPrompts.leon || "請規劃網頁的功能路由架構";
  const jackPrompt = subPrompts.jack || "請提供預估的廣告數據 ROAS、CPA 與轉換率指標";

  const geminiPrompt = `你現在是 Maya (社群行銷專家) 與 Iris (SEO 專家) 的共同大腦。
請根據以下指派的子提示詞，同時生成她們的成果，並以一個 JSON 物件回傳。

### 核心限制 (非常重要)：
1. **完全使用繁體中文(台灣)**：所有產出（特別是 Maya 的社群文案與文章）必須完全使用繁體中文，不可使用簡體字。
2. **極致長文且結構完整**：Maya 產出的文章/社群文案必須是「深度長篇大作」（字數至少 800 至 1500 字以上），絕對不能只有簡短的幾段或摘要。必須包含：
   - 吸引人的爆款標題
   - 引人入勝且引起共鳴的情境導言（痛點描寫）
   - 深入剖析的 3 大核心論點/卡點分析（每個論點都必須展開詳細論述、舉例說明與提供具體建議）
   - 具體可行、步驟化且細緻的實操行動指南/改善方案
   - 溫暖有溫度的結尾與強烈的行動呼籲（Call to Action）
   - 精選 5-8 個社群標籤（Hashtags）
   請確保內容豐滿、邏輯嚴密，提供給讀者極高的閱讀價值與洞察力，嚴禁簡短或敷衍的摘要。

### Maya 的任務指派 (社群文案)：
${mayaPrompt}

### Iris 的任務指派 (SEO關鍵字與大綱)：
${irisPrompt}

### 輸出 JSON 格式要求：
你必須且僅能輸出如下 JSON 代碼區塊（以 \`\`\`json 開始，以 \`\`\` 結束）：
{
  "social_copy": "Maya 產出的社群文案 Markdown 內容",
  "seo_keywords": [
    { "keyword": "關鍵字1", "volume": "月搜尋量", "competition": "高|中|低", "outline": "此關鍵字的文章大綱說明" }
  ]
}
請確保 JSON 格式完全正確，沒有任何額外的解釋文字。`;

  const openaiPrompt = `你現在是 Leon (系統架構師) 與 Jack (廣告數據分析師) 的共同大腦。
請根據以下指派的子提示詞，同時生成他們的成果，並以一個 JSON 物件回傳。

### Leon 的任務指派 (網頁架構)：
${leonPrompt}

### Jack 的任務指派 (廣告數據)：
${jackPrompt}

### 輸出 JSON 格式要求：
你必須且僅能輸出如下 JSON 代碼區塊（以 \`\`\`json 開始，以 \`\`\` 結束）：
{
  "web_architecture": "Leon 產出的網頁架構樹狀 Markdown 內容 (必須以 - 縮排列表渲染網站結構，例如：\\n- 首頁\\n  - 關於我們\\n    - 聯絡諮詢)",
  "ad_data": [
    { "label": "數據指標名稱 (如 廣告投資報酬率 (ROAS), 單次取得成本 (CPA), 預約轉換率 (CVR) 等)", "value": "數值 (如 5.2x, $12.5, 3.8%)", "change": "+/-百分比 (如 +12.5%, -4.2%)", "isPositive": true }
  ]
}
請確保 JSON 格式完全正確，沒有任何額外的解釋文字。`;

  let geminiResult: any = {};
  let openaiResult: any = {};

  try {
    const hasGeminiKey = !!(config.geminiApiKey || process.env.GEMINI_API_KEY);
    
    // 同時發起異步請求
    const geminiTask = hasGeminiKey
      ? callGemini([{ role: "user", content: geminiPrompt }], config)
      : callOpenAI([{ role: "user", content: geminiPrompt }], config);

    const [geminiResponse, openaiResponse] = await Promise.all([
      geminiTask,
      callOpenAI([{ role: "user", content: openaiPrompt }], config)
    ]);

    // 解析 Gemini 成果 (Maya & Iris)
    const geminiMatch = geminiResponse.match(jsonRegex);
    if (geminiMatch && geminiMatch[1]) {
      try {
        geminiResult = JSON.parse(geminiMatch[1].trim());
      } catch (e) {
        console.error("Failed to parse Gemini parallel response:", e);
      }
    } else {
      // 嘗試直接 parse 整體文字
      try {
        geminiResult = JSON.parse(geminiResponse.trim());
      } catch {}
    }

    // 解析 OpenAI 成果 (Leon & Jack)
    const openaiMatch = openaiResponse.match(jsonRegex);
    if (openaiMatch && openaiMatch[1]) {
      try {
        openaiResult = JSON.parse(openaiMatch[1].trim());
      } catch (e) {
        console.error("Failed to parse OpenAI parallel response:", e);
      }
    } else {
      // 嘗試直接 parse 整體文字
      try {
        openaiResult = JSON.parse(openaiResponse.trim());
      } catch {}
    }
  } catch (error: any) {
    console.error("Parallel AI calls failed:", error);
    if (provider !== "mock") {
      throw new Error(`AI 大腦平行呼叫失敗: ${error.message || error}`);
    }
    return parseCOOOutput(await callMockCOO(history[history.length - 1]?.content || "", brandName));
  }

  // 3. 完成四看板聯動：重新組裝成最終的 JSON
  const finalDispatch: any = {
    social_copy: geminiResult.social_copy || "",
    web_architecture: openaiResult.web_architecture || "",
    seo_keywords: geminiResult.seo_keywords || [],
    ad_data: openaiResult.ad_data || []
  };

  // 確保欄位齊全
  if (finalDispatch.seo_keywords && Array.isArray(finalDispatch.seo_keywords)) {
    finalDispatch.seo_keywords = finalDispatch.seo_keywords.map((kw: any) => ({
      keyword: kw.keyword || "",
      volume: kw.volume || "0",
      competition: kw.competition || "低",
      outline: kw.outline || ""
    }));
  }
  
  if (finalDispatch.ad_data && Array.isArray(finalDispatch.ad_data)) {
    finalDispatch.ad_data = finalDispatch.ad_data.map((ad: any) => ({
      label: ad.label || "",
      value: ad.value || "",
      change: ad.change || "0%",
      isPositive: ad.isPositive !== undefined ? ad.isPositive : !String(ad.change).startsWith("-")
    }));
  }

  return {
    content: cleanErickContent,
    dispatchData: finalDispatch
  };
}

// 1. OpenAI 實作
async function callOpenAI(messages: any[], config: AIProviderConfig): Promise<string> {
  if (!config.apiKey) throw new Error("Missing OPENAI_API_KEY");

  const keyPrefix = config.apiKey.substring(0, 10);
  console.log(`[OpenAI Call] Using key prefix: ${keyPrefix}... (length: ${config.apiKey.length})`);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model || "gpt-5.4-mini",
      messages: messages,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errText}`);
  }

  const json = await response.json();
  return json.choices?.[0]?.message?.content || "";
}

// 2. Gemini 實作
async function callGemini(messages: any[], config: AIProviderConfig): Promise<string> {
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

  const systemInstruction = messages.find(m => m.role === "system")?.content;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents,
      systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
      generationConfig: {
        temperature: 0.7
      }
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
    socialCopy = `# 為什麼老闆越忙，公司越長不大？

【企業卡住，不一定是努力不夠... 🚀】
你是否也常覺得「許多事都要自己扛，業績卡住卻找不出原因」？

### 🔍 你的公司面臨以下卡點嗎？
1. **業績卡在瓶頸**：花費了預算，客戶與轉換卻一直不穩定。
2. **團隊執行力不穩**：老闆下達了目標，團隊卻推不動，或反覆溝通無結論。
3. **決策疲勞與內耗**：面臨重大決策（搬遷、轉型、擴張），老闆一直很累、反覆猶豫。

這些問題의 背後，往往不是努力不夠，而是還沒看見影響結果的「隱性系統性卡點」。

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
    socialCopy = `# 你不是想太多，你只是對感受比較敏銳

在人際關係或工作裡，你是否也常因為別人的一個眼神，就在心裡糾結半天？
身邊的人常對你說：「你就是太敏感、想太多了啦。」

### 💡 其實，你不是奇怪，你只是有自己的生命節奏。
有些人的數字設定就是「高敏感、重感受」，這是你的天賦，不是缺點。

* **看見生命數字**：理解你思考的慣性，以及在關係、溝通中的盲點。
* **找回個人力量**：用符合自己節奏的方式努力，才不會越做越累。

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
    socialCopy = `# 你不是不夠努力，而是你的狀態需要被重新支持與調和

為什麼明明看了那麼多書、學了那麼多道理，生活還是會反覆卡在相同的模式？
你常常感到緊繃、失眠，或是明明想要往前，卻總覺得有一股隱形的阻力拉住自己？

### 💡 其實，有些卡關並不是你做錯了什麼，而是你的能量已經「超載」了。
當內在狀態失衡，再多的行動與意志力，也只是在消耗所剩無幾的自己。

* **信息場解析**：協助你看見情緒、關係與壓力背後，真正卡住的隱性阻力。
* **三個月調和支持**：透過定期的頻率支持與顧問陪伴，讓自己慢慢回到清明、穩定與行動力。

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
    socialCopy = `# 很多問題不是你不夠努力，而是你還沒看見關鍵因素

為什麼我們越努力，有時候反而覺得被困得越深？
在人生下半場、創業或面臨企業決策時，我們常陷入一種「外在不斷尋找方法、內在卻反覆內耗」的死胡同。

### 🔍 其實，你缺的往往不是方法，而是「看見關鍵」的視角。
核心價值不在於你學了多少工具，而在於你能否看清那些一直影響結果、卻被你忽略的隱性卡點。

* **Erick 關鍵因素諮詢**：一對一深度解析人生、關係與事業卡點，釐清下一步具體方向。
* **人生與事業校準陪跑**：整合內在狀態與外在決策，陪伴你將理解真正落實為行動。

當人穩了，局才有機會重新打開。

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

  try {
    const hasGeminiKey = !!(config.geminiApiKey || process.env.GEMINI_API_KEY);
    
    // 首選 Gemini 以獲取更好的 AEO/SEO 與 JSON 格式輸出，若無 Key 則降級 OpenAI
    const responseText = hasGeminiKey
      ? await callGemini([{ role: "user", content: prompt }], config)
      : await callOpenAI([{ role: "user", content: prompt }], config);

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
