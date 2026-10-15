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
    social_copy: `企業最怕的不是問題出現，而是一直處理錯問題。

當同一件事反覆溝通、決策總回到老闆手上，或跨部門合作總在最後一刻失速，先別急著把責任放在某一個人身上。

可以先盤點：角色權責是否清楚？決策需要的資訊是否到位？目前的優先順序是否被所有人理解？

#企業醫生 #決策校準 #組織協作 #經營流程 #管理節奏`,
    web_architecture: `- I8 企業醫生｜企業決策校準
  - 管理情境與常見問題
  - 專欄文章（決策校準／組織協作／角色權責／經營流程）
  - 企業醫生診斷入口
  - 服務說明（待交付內容與流程確認後再對外補齊）`,
    seo_keywords: [
      { keyword: "企業經營卡點", volume: "未驗證", competition: "未驗證", outline: "內容假設：從重複管理情境拆解可能的結構問題" },
      { keyword: "組織協作", volume: "未驗證", competition: "未驗證", outline: "內容假設：盤點跨部門協作中角色權責與資訊交接" },
      { keyword: "決策校準", volume: "未驗證", competition: "未驗證", outline: "內容假設：整理決策前應釐清的優先順序與資源配置" }
    ],
    ad_data: [
      { label: "搜尋曝光", value: "尚未串接", change: "待量測" },
      { label: "自然點擊", value: "尚未串接", change: "待量測" },
      { label: "文章閱讀", value: "尚未串接", change: "待量測" },
      { label: "導流至 I8 頁面的點擊", value: "尚未串接", change: "待量測" }
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
    web_architecture: `- 平衡空間首頁
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
    social_copy: `照顧完所有人,輪到自己,什麼都不剩。
這些角色,是你認可、也願意扛的。只是最近,身體開始有了訊號。
身體的訊號,請讓醫師陪你確認它在說什麼。我陪你看的,是你這個人怎麼運作,這些你願意扛的角色,是怎麼一層一層疊上來的。我看的不是零件,是整個人。`,
    web_architecture: `- 艾伯林量子調頻官網
  - 角色盤點
  - 負荷來源整理
  - 選擇性的頻率支持(自願、可退費、放在最後一層)
  - 主題支持
  - 你自己的檢視
  - 聯絡諮詢`,
    seo_keywords: [
      { keyword: "量子調頻效果", volume: "5,400", competition: "中", outline: "整理角色負荷與日常情緒感受" },
      { keyword: "內在消耗整理", volume: "2,100", competition: "低", outline: "分享如何從日常角色與負荷來源開始整理" },
      { keyword: "高壓力情緒管理", volume: "6,800", competition: "中", outline: "整理高壓決策者的工作角色與日常負荷" },
      { keyword: "睡眠品質差放鬆", volume: "12,500", competition: "高", outline: "探討生活角色與工作壓力如何影響日常休息感受" }
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

- Erick 關鍵因素諮詢：整理人生、關係與事業脈絡，提供你自己的檢視。
- 人生與事業陪跑：從角色盤點與負荷來源整理開始，提供你自己的檢視。

回到你自己的檢視，從目前站的位置開始整理。

#Erick觀點 #關鍵因素諮詢 #內外一致 #事業決策 #自我理解`,
    web_architecture: `- Erick 個人品牌門戶 (母系統)
  - 關鍵觀點 (Erick 觀點文章與人生洞察)
  - 核心諮詢 (Erick 關鍵因素諮詢入口)
  - 主題講座與讀書會 (關鍵因素讀書會 / 內外一致練習場)
  - 高階顧問陪跑 (個人/創業者/企業主人生與事業校準)
  - 旗下品牌導流
    - 品牌 A I8 (企業決策、團隊與成長顧問)
    - 品牌 B NAS (生命數字自我探索與關係理解)
    - 品牌 C ABL (角色盤點、負荷來源整理與選擇性的頻率支持)`,
    seo_keywords: [
      { keyword: "Erick 關鍵因素諮詢", volume: "1,200", competition: "低", outline: "介紹Erick如何引導客戶找出公司與人生的重複卡點與模式" },
      { keyword: "人生事業卡關原因", volume: "3,500", competition: "低", outline: "解析表面的資源問題與內在心理阻力之間的拉扯關係" },
      { keyword: "創業者決策陪跑", volume: "1,800", competition: "低", outline: "探討高階諮詢在創業者定位、收費模式及承接成功上的應用" },
      { keyword: "承接成功與自我價值", volume: "2,400", competition: "低", outline: "整理面對成功時的顧慮與自我價值觀察" }
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
      content: "您好！我是您的團隊總指揮 Erick 營運長。目前為【品牌 A 初八企業顧問】顧問機構提供決策支持。\n\n我負責將您的營運目標進行拆解，並分派給右側的四位 AI 專家：\n* **Maya**（社群文案專家）\n* **Leon**（系統架構師）\n* **Iris**（SEO 專家）\n* **Jack**（廣告數據專家）\n\n請下達對【I8 品牌】的營運方針（例如：推廣『企業關鍵因素診斷』、規劃辦公室搬遷空間優化、或是撰寫針對中小企業主的痛點文案），我將為您指派並即時更新看板！",
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
