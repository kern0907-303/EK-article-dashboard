// 各品牌看板與對話的初始種子資料。
// 原本位於 src/lib/firebase.ts，抽出以縮小資料層檔案體積。
import { I8_BRAND_CONTEXT } from "@/data/brands/i8";
import { NAS_BRAND_CONTEXT } from "@/data/brands/nas";
import { ABL_BRAND_CONTEXT } from "@/data/brands/abl";
import { ERICK_BRAND_CONTEXT } from "@/data/brands/erick";
import type { WorkspaceData, ChatMessage } from "@/lib/storage";

// Constant templates for initial data setup
export const DEFAULT_MOCK_WORKSPACE: Record<string, WorkspaceData> = {
  brand_a_i8: {
    brand_guidelines: I8_BRAND_CONTEXT,
    social_copy: `I8 核心主張

【企業卡住，不一定是努力不夠... 🚀】
你是否也常覺得「很多事都要自己扛，業績卡住卻找不出原因」？

為什麼你的公司需要「I8 決策校準」？
- 看見隱性阻力：找出團隊執行力不穩、決策反覆的「系統性卡點」。
- 校準成長方向：重塑老闆決策狀態、空間與經營目標的一致性。

#Initial8 #企業關鍵因素診斷 #決策校準 #團隊調和`,
    web_architecture: `- I8 品牌首頁
  - 關於 I8 (處理看不見的隱性阻力)
  - 核心顧問產品
    - I8 企業關鍵因素診斷 (入門診斷)
    - I8 企業決策校準顧問 (重大決策支持)
    - 企業搬遷與空間優化顧問 (專案空間校準)
    - 企業成長與調和陪跑計畫 (長期支持)
  - 預約諮詢 (90分鐘診斷)`,
    seo_keywords: [
      { keyword: "企業經營卡點", volume: "1,800", competition: "低", outline: "探討中小企業經營面臨瓶詢時的內在與外在隱性因素" },
      { keyword: "企業重大決策顧問", volume: "2,500", competition: "低", outline: "解析在搬遷、轉型、分家等關鍵節點如何進行決策校準" },
      { keyword: "老闆決策疲勞", volume: "850", competition: "低", outline: "分享創業者與高壓經理人如何透過狀態重整減輕決策內耗" },
      { keyword: "辦公室搬遷風水", volume: "3,200", competition: "中", outline: "從組織氣場與空間配置談辦公室搬遷的校準指引" }
    ],
    ad_data: [
      { label: "診斷諮詢預約數", value: "48 組", change: "+18.5%", isPositive: true },
      { label: "廣告點擊率 (CTR)", value: "4.82%", change: "+0.75%", isPositive: true },
      { label: "單次點擊成本 (CPC)", value: "$0.52", change: "-8.4%", isPositive: true },
      { label: "廣告總花費 (Spend)", value: "$850", change: "-5.0%", isPositive: true }
    ]
  },
  brand_b_nas: {
    brand_guidelines: NAS_BRAND_CONTEXT,
    social_copy: `你不是想太多，你只是對感受比較敏銳

在人際關係或工作裡，你是否也常因為別人的一個眼神，就在心裡糾結半天？
身邊的人常對你說：「你就是太敏感、想太多了啦。」

💡 其實，你不是奇怪，你只是有自己的生命節奏。
有些人的數字設定就是「高敏感、重感受」，這是你的天賦，不是缺點。

- 看見生命數字：理解你思考的慣性，以及在關係、溝通中的盲點。
- 找回個人力量：用符合自己節奏的方式努力，才不會越做越累。

生命數字不是為了限制你，而是協助你走回更適合自己的方向。

#平衡空間 #生命數字 #自我探索 #高敏感 #人生節奏`,
    web_architecture: `- NAS 平衡空間首頁
  - 30秒核心數字測驗 (免費體驗入口)
  - 人生方向校準解析 (個人生命數字解析)
  - 主力線上課程 (生命數字基礎班)
  - 主題工作坊 (關係/親子/事業應用篇)
  - 深度天賦陪跑 (天賦定位顧問計畫)
  - 聯絡諮詢`,
    seo_keywords: [
      { keyword: "生命數字天賦", volume: "8,900", competition: "中", outline: "拆解1-9主命數的核心特質與潛在天賦，引導讀者自我探索" },
      { keyword: "生命數字 1-9 性格", volume: "12,500", competition: "中", outline: "詳解各個數字在事業、溝通與壓力狀態下的代表行為特徵" },
      { keyword: "自我探索工具", volume: "4,500", competition: "低", outline: "比較生命數字、人類圖與星座，分析如何運用其解鎖迷惘" },
      { keyword: "流年運勢分析", volume: "15,200", competition: "高", outline: "介紹如何計算個人流年，並在適合的階段做適合的選擇與規劃" }
    ],
    ad_data: [
      { label: "免費解析測驗完成率", value: "72.4%", change: "+5.8%", isPositive: true },
      { label: "個人解析預約轉換率", value: "3.85%", change: "+0.45%", isPositive: true },
      { label: "廣告點擊成本 (CPC)", value: "$0.32", change: "-12.0%", isPositive: true },
      { label: "基礎課註冊人數 (本月)", value: "124 人", change: "+15.2%", isPositive: true }
    ]
  },
  brand_c_abl: {
    brand_guidelines: ABL_BRAND_CONTEXT,
    social_copy: `你不是不夠努力，而是你的狀態需要被重新支持與調和

為什麼明明看了那麼多書、學了那麼多道理，生活還是會反覆卡在相同的模式？
你常常感到緊繃、失眠，或是明明想要往前，卻總覺得有一股隱形的阻力拉住自己？

💡 其實，有些卡關並不是你做錯了什麼，而是你的能量已經「超載」了。
當內在狀態失衡，再多的行動與意志力，也只是在消耗所剩無幾的自己。

- 信息場解析：協助你看見情緒、關係與壓力背後，真正卡住的隱性阻力。
- 三個月調和支持：透過定期的頻率支持與顧問陪伴，讓自己慢慢回到清明、穩定與行動力。

調和不是強迫自己馬上變好，而是允許自己獲得重新安放的空間。

#艾伯林量子調頻 #個人狀態調和 #量子調和 #內在消耗 #生命狀態校準`,
    web_architecture: `- ABL 艾伯林調頻官網
  - 個人狀態燈號檢測 (內在消耗免費檢測入口)
  - 個人狀態分析 (個人信息場分析)
  - 核心調和計畫 (三個月信息場調和支持)
  - 專題調和支持 (情緒/睡眠/自我價值/財富支持)
  - 年度生命狀態校準計畫 (長期會員支持)
  - 聯絡諮詢`,
    seo_keywords: [
      { keyword: "量子調頻效果", volume: "5,400", competition: "中", outline: "科普信息場分析與量子頻率支持如何協助日常情緒調和" },
      { keyword: "內在消耗改善", volume: "2,100", competition: "低", outline: "分享如何從超載焦慮與內耗中，透過調頻重新回到穩定狀態" },
      { keyword: "高壓力情緒管理", volume: "6,800", competition: "中", outline: "為創業者與高壓決策者設計的內在狀態清理與放鬆指引" },
      { keyword: "睡眠品質差放鬆", volume: "12,500", competition: "高", outline: "探討失眠背後的潛意識阻力，以及如何透過能量調和進行改善" }
    ],
    ad_data: [
      { label: "狀態燈號檢測完成率", value: "68.2%", change: "+8.4%", isPositive: true },
      { label: "個人分析預約轉換率", value: "4.15%", change: "+0.65%", isPositive: true },
      { label: "廣告點擊成本 (CPC)", value: "$0.42", change: "-10.5%", isPositive: true },
      { label: "每月調和追蹤回饋率", value: "85.0%", change: "+12.0%", isPositive: true }
    ]
  },
  personal_brand: {
    brand_guidelines: ERICK_BRAND_CONTEXT,
    social_copy: `很多問題不是你不夠努力，而是你還沒看見關鍵因素

為什麼我們越努力，有時候反而覺得被困得越深？
在人生下半場、創業或面臨企業決策時，我們常陷入一種「外在不斷尋找方法、內在卻反覆內耗」的死胡同。

🔍 其實，你缺的往往不是方法，而是「看見關鍵」的視角。
核心價值不在於你學了多少工具，而在於你能否看清那些一直影響結果、卻被你忽略的隱性卡點。

- Erick 關鍵因素諮詢：一對一深度解析人生、關係與事業卡點，釐清下一步具體方向。
- 人生與事業校準陪跑：整合內在狀態與外在決策，陪伴你將理解真正落實為行動。

當人穩了，局才有機會重新打開。

#Erick觀點 #關鍵因素諮詢 #內外一致 #事業決策 #自我理解`,
    web_architecture: `- Erick 個人品牌門戶 (母系統)
  - 關鍵觀點 (Erick 觀點文章與人生洞察)
  - 核心諮詢 (Erick 關鍵因素諮詢入口)
  - 主題講座與讀書會 (關鍵因素讀書會 / 內外一致練習場)
  - 高階顧問陪跑 (個人/創業者/企業主人生與事業校準)
  - 旗下品牌導流
    - 品牌 A I8 (企業決策、團隊與成長顧問)
    - 品牌 B NAS (生命數字自我探索與關係理解)
    - 品牌 C ABL (信息場分析與狀態調和支持)`,
    seo_keywords: [
      { keyword: "Erick 關鍵因素諮詢", volume: "1,200", competition: "低", outline: "介紹Erick如何引導客戶找出公司與人生的重複卡點與模式" },
      { keyword: "人生事業卡關原因", volume: "3,500", competition: "低", outline: "解析表面的資源問題與內在心理阻力之間的拉扯關係" },
      { keyword: "創業者決策陪跑", volume: "1,800", competition: "低", outline: "探討高階諮詢在創業者定位、收費模式及承接成功上的應用" },
      { keyword: "承接成功與自我價值", volume: "2,400", competition: "低", outline: "分享如何突破『害怕成功』的潛意識限制，迎向更大格局" }
    ],
    ad_data: [
      { label: "一對一諮詢預約數", value: "24 組", change: "+15.0%", isPositive: true },
      { label: "讀書會/講座參與人數", value: "185 人", change: "+28.4%", isPositive: true },
      { label: "旗下品牌分流轉換率", value: "12.5%", change: "+2.4%", isPositive: true },
      { label: "高階陪跑計畫詢問量", value: "8 件", change: "+33.3%", isPositive: true }
    ]
  }
};

export const DEFAULT_MOCK_CHATS: Record<string, ChatMessage[]> = {
  brand_a_i8: [
    {
      id: "welcome-brand-a",
      role: "assistant",
      content: "您好！我是您的團隊總指揮 Erick 營運長。目前為【品牌 A I8 (Initial 8 CO.)】顧問機構提供決策支持。\n\n我負責將您的營運目標進行拆解，並分派給右側的四位 AI 專家：\n* **Maya**（社群文案專家）\n* **Leon**（系統架構師）\n* **Iris**（SEO 專家）\n* **Jack**（廣告數據專家）\n\n請下達對【I8 品牌】的營運方針（例如：推廣『企業關鍵因素診斷』、規劃辦公室搬遷空間優化、或是撰寫針對中小企業主的痛點文案），我將為您指派並即時更新看板！",
      timestamp: Date.now()
    }
  ],
  brand_b_nas: [
    {
      id: "welcome-brand-b",
      role: "assistant",
      content: "您好！我是您的團隊總指揮 Erick 營運長。目前為【品牌 B NAS (平衡空間 noage space)】自我探索品牌服務。\n\n我負責協助您規劃推廣生命數字解析與課程，並指派右側的專家團隊：\n* **Maya**（暖心社群文案）\n* **Leon**（課程與測驗網頁架構）\n* **Iris**（大眾自我探索 SEO 專家）\n* **Jack**（流量與課消廣告數據專家）\n\n請下達對【NAS 品牌】的營運指令（例如：針對親密關係推廣『感情數字小測驗』、規劃生命數字基礎課程的報名網頁架構、或是撰寫寫給高敏感族群的暖心粉專貼文），我將為您妥善分工！",
      timestamp: Date.now()
    }
  ],
  brand_c_abl: [
    {
      id: "welcome-brand-c",
      role: "assistant",
      content: "您好！我是您的團隊總指揮 Erick 營運長。目前為【品牌 C ABL (abliene 艾伯林量子調頻)】個人調和品牌提供決策支持。\n\n我負責協助您規劃推廣信息場分析與調頻支持產品，並指派右側的專家團隊進行實作：\n* **Maya**（深度陪伴感社群文案）\n* **Leon**（狀態檢測與調和網頁架構）\n* **Iris**（情緒身心與調頻 SEO 專家）\n* **Jack**（名單預約與轉換廣告數據專家）\n\n請下達對【ABL 品牌】的營運指令（例如：推廣『個人狀態燈號檢測』、規劃三個月調和計畫的宣傳網頁、或是撰寫針對高壓力失眠族群的深度調和貼文），我將隨時為您拆解派發！",
      timestamp: Date.now()
    }
  ],
  personal_brand: [
    {
      id: "welcome-personal",
      role: "assistant",
      content: "您好！我是您的團隊總指揮 Erick 營運長。目前為您的【個人品牌 (Erick)】提供思想主軸與決策支持。\n\n個人品牌是整個生態系統的「母品牌」，負責建立高信任度，並將流量精準導向：\n* **I8**（中小企業與高客單決策顧問）\n* **NAS**（生命數字與自我探索/流量入口）\n* **ABL**（個人情緒/睡眠/自我價值狀態量子調和）\n\n請下達對【Erick 個人品牌】的營運指令（例如：推廣『Erick 關鍵因素諮詢』、規劃『關鍵因素讀書會』大綱、或是撰寫寫給 35-55 歲正面臨人生轉折點受眾的深刻洞察文案），我將隨時為您安排拆解派發！",
      timestamp: Date.now()
    }
  ]
};
