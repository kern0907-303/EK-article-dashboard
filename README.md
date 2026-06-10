# AI 團隊決策大腦 - 營運主控台 (AI Team Dashboard)

本專案為全新重做、高質感的 AI 團隊管理後台。前端基於 **Next.js 15+**、**Tailwind CSS (v4)** 與 **TypeScript** 建置，資料庫則採用 **Firebase Firestore** 即時同步系統，並設有完備的本地 **LocalStorage** 備份降級機制。

本主控台旨在打造一個「總指揮 - 專家團隊」的自動化派發工作流，支援多品牌/領域的資料庫級隔離，並預留外部自動化工具（如 n8n Webhook）的接口。

---

## 🌟 核心架構與功能

### 1. 三欄式高階指揮介面 (3-Column Layout)
* **左欄：品牌切換與 Erick 營運長檔案 (Brand & Profile)**
  * **BrandSelector**：下拉選單提供 4 個品牌的即時切換（**品牌 A I8**、**品牌 B NAS**、**品牌 C ABL**、**個人品牌**）。
  - **Erick 營運長卡片**：顯示其作為「團隊總指揮」的資訊及旗下指揮的 4 名 AI 專家頭銜。
* **中欄：核心對話室 (Chat Room)**
  * 與 Erick 營運長直接進行營運、企劃指令溝通。
  * 支援打字中動畫（Thinking status）與對話清除。
* **右欄：專家工作看板 (Workspace Board)**
  * 區分四個 Tabs，展示對應專家的即時成果：
    1. **Maya (社群文案)**：高質感 Markdown 編輯與預覽介面。
    2. **Leon (網頁架構)**：結構化層級大綱編輯器。預覽區會**自動解析空格縮排**，動態渲染出包含「資料夾」與「檔案」圖示的網站樹狀圖。
    3. **Iris (SEO關鍵字)**：動態數據表格。提供關鍵字、搜尋量與競爭度（高/中/低），支援即時新增和刪除關鍵字。
    4. **Jack (廣告數據)**：KPI 指標卡片。以亮麗卡片展示點擊率 (CTR)、轉化率 (CVR) 等，支援點擊直接 inline 修改，即時同步。

### 2. Erick 營運長「JSON 任務分派與看板聯動」機制
* **總指揮任務拆解**：當您在中間 ChatRoom 輸入一句營運目標（如「*我想為 NAS 品牌寫一篇社群宣傳貼文，並規劃首頁架構與預估點擊率*」），Erick 會拆解任務並宣布派發給對應的專家。
* **JSON 指令輸出**：Erick 會在回覆的最尾端附帶一個格式化的 JSON 程式碼區塊（包含 `social_copy`, `web_architecture`, `seo_keywords`, `ad_data` 等鍵值）。
* **自動攔截與渲染**：前端 `ChatBox` 會自動攔截並**從對話氣泡中剝離隱藏**該 JSON，隨後將其存入資料庫；右側看板因訂閱了相同的資料庫路徑，會**立即無縫重新渲染**對應的文案、網頁架構與廣告數據。

### 3. 多品牌隔離機制 (Firestore Data Isolation)
* 切換左側選單的品牌時，全站（ChatRoom 與右側 4 個看板）會立即執行 **Unsubscribe & Re-subscribe**。
* 所有 Firestore 存取路徑皆為 `/users/{userId}/brands/{brandId}/...`，確保各個品牌之對話歷史與看板內容完全獨立、互不混淆。

### 4. 模組化 AI 驅動大腦與 n8n Webhook 預留
在 `src/lib/ai-provider.ts` 中封裝了統一的大腦接口，您可以修改 `.env.local` 中的 `AI_PROVIDER` 設定：
* `mock` (預設)：本地智慧模擬，會分析您的輸入關鍵字，智慧分派給右側專家對應的成果，免 API 金鑰即可高速展示。
* `openai`：呼叫 OpenAI GPT-4o-mini / GPT-4o 驅動 Erick。
* `gemini`：呼叫 Google Gemini 1.5 系列。
* `anthropic`：呼叫 Anthropic Claude 3.5 系列。
* `n8n`：**一鍵發送至您的外部 n8n Webhook**，傳入品牌、對話歷史與 System Prompt，完美預留單元 7 的自動化 Agent 流程。

---

## 🚀 快速開始

### 1. 安裝與啟動
進入專案目錄，安裝依賴並啟動開發伺服器：
```bash
cd "/Volumes/4T/Frontend Dashboard"
npm run dev
```
啟動後打開瀏覽器訪問 [http://localhost:3000](http://localhost:3000) 即可使用。

### 2. 配置環境變數
複製環境變數範本並重新命名：
```bash
cp .env.local.example .env.local
```
在 `.env.local` 中：
* 若想使用實體 OpenAI 大腦，將 `AI_PROVIDER` 改為 `openai`，並填入 `OPENAI_API_KEY`。
* 若想使用實體 Firebase Firestore，填入 `NEXT_PUBLIC_FIREBASE_*` 憑證。留空則自動啟用極速 LocalStorage 即時響應模擬。
* 若想串接 n8n 自動化流程，將 `AI_PROVIDER` 改為 `n8n`，並填入 `N8N_WEBHOOK_URL`。
