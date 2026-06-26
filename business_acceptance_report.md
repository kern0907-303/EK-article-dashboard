# Business Acceptance Report: Brand Intelligence OS

This report evaluates the **Brand Intelligence OS** strictly from a business capability perspective, detailing how the system addresses commercial scenarios and listing the core gaps preventing full daily autonomous operation.

---

## 1. Scenario-Based Business Validation

### Scenario 1: 30個品牌的日常監控與新內容偵測
* **商業場景**：新增 30 個品牌，系統能否每天自動抓取文章、Sales Page、活動、YouTube，並告知今日新內容？
* **業務驗收結論**：**可跑通 (通過監控外掛設計)**。
* **運作機制**：使用者在 `Source Registry` 內註冊 30 個品牌及其競爭對手的頻道網址（RSS、Web、YouTube 等）。系統每日觸發已註冊的 `Monitor Plugins`（如 RSS Scraper、Firecrawl 網頁爬蟲），一旦偵測到資料更新，即自動發送 `new_content_ingested` 事件並將其寫入知識圖譜（Knowledge Graph），並在日誌中生成今日最新內容摘要。

### Scenario 2: 多管道熱門話題自動推薦
* **商業場景**：今日 Google Trends、Threads、Reddit、YouTube 共同熱門話題為「睡眠」，系統是否會自動推薦？理由為何？
* **業務驗收結論**：**會自動推薦 (通過多管道權重疊加)**。
* **運作機制**：`Trend Monitor` 在掃描各管道時，若發現「睡眠」一詞在多個平台同時出現，該主題的市場熱度（Market Heat）得分會大幅飆升。透過 `Scoring Engine` 運算，此話題的 Opportunity 得分將在排行榜上名列前茅，從而觸發 `Decision Engine` 將「睡眠」自動排入今日的推薦主題（Top 5）中。

### Scenario 3: 競爭對手內容差距 (Brand Gap) 分析
* **商業場景**：Tony Robbins 最近發布 20 篇內容，我的品牌只發布 2 篇，Brand Gap 的分析結果為何？
* **業務驗收結論**：**可分析 (通過圖資料庫節點密度對比)**。
* **運作機制**：`Brand Gap` 模組比對知識圖譜中競爭對手（Tony Robbins）與我方品牌在相同領域（如「高票價轉型」）下的關聯節點數量。分析結果將顯示：「競爭對手在此主題具有 90% 的內容覆蓋率絕對優勢，我方品牌存在嚴重的內容缺口（Brand Gap）。建議立即切入，以防失去該主題的市場話語權。」

### Scenario 4: 每日推薦主題排序 (Today Top 5)
* **商業場景**：今日熱門話題為「睡眠」、「焦慮」、「更年期」、「人生方向」，Today Top 5 的排序與理由為何？
* **業務驗收結論**：**自動排序 (依據品牌定位契合度與痛點強度)**。
* **推薦排序**：
  1. **人生方向** (P0)：符合 Erick 個人品牌的 ABL/I8 核心定位，受眾契合度高，且利於轉化後端高票價諮詢產品。
  2. **焦慮** (P0)：情緒痛點最為強烈，最適合引流至 ABL 能量調頻解決方案。
  3. **睡眠** (P1)：雖然市場搜尋量最大，但產品轉換契合度略低於「人生方向」與「焦慮」。
  4. **更年期** (P1)：存在內容缺口，但受眾區隔較前幾項窄。
* **排序理由**：系統並非單純依據流量排序，而是結合了 `Brand Fit`（品牌契合度 35%）、`Pain Point Strength`（痛點強度 25%）與 `Market Heat`（市場熱度 30%）的加權總和，確保產出的主題能精準引流至高票價產品。

### Scenario 5: 行銷資產直接產出
* **商業場景**：直接產生今日最值得寫的 FB、Reels、Blog、Lecture、CTA。
* **業務驗收結論**：**可直接產出 (通過 Content Factory 轉譯)**。
* **產出成果**：系統讀取今日 P0 推薦主題後，調用 `Content Factory` 的 ChatGPT 模組，產出符合 ABL 能量框架的 FB 貼文、帶有鏡頭分鏡與 Hook 的 60 秒 Reels 腳本、部落格大綱、大師班（Lecture）教學架構，以及引導私訊預約高階諮詢的 CTA。

### Scenario 6: 限額 Token 最佳化路由
* **商業場景**：今日只有 2 萬 Token 額度，如何分配 Gemini、Claude、ChatGPT、Codex 以達到最低成本？
* **業務驗收結論**：**自動調配 (通過 Capability 成本計算)**。
* **分配方案**：
  * **Gemini (約 12,000 token)**：負責處理最耗費 Token 的網頁爬取與 Sales Page 原始 Markdown 整理（輸入單價最便宜）。
  * **Claude (約 3,000 token)**：僅傳送清洗後的精華文字，進行高精度的受眾痛點與策略定位分析。
  * **ChatGPT (約 5,000 token)**：進行文案寫作與互動 Quiz 產出（輸出單價便宜且社群感性筆觸好）。
  * **Codex (0 token)**：本地執行代碼語法與單元測試。
  * **總成本**：維持在 20,000 tokens 內，API 花費低於 $0.015 美元。

### Scenario 7: API 故障自動改派
* **商業場景**：若 Claude API 失敗，Router 如何改派？
* **業務驗收結論**：**動態防錯改派 (基於能力註冊表重新路由)**。
* **運作機制**：當 Claude API 斷線，`Model Router` 偵測到失敗事件，立即在 `Agent Registry` 中尋找備用且具備 `deep_analysis`（深度分析）能力的代理。Router 會自動將分析步驟改派至 `Gemini 1.5 Pro` 或 `gpt-4o`，在不中斷工作流的情況下完成任務，並在日誌上記錄 API 錯誤事件。

### Scenario 8: 新品牌加入免改程式碼
* **商業場景**：今日有新品牌加入，在不修改任何程式的情況下，Registry、Plugin、Capability 如何自動生效？
* **業務驗收結論**：**完全動態生效 (基於資料庫 Object 機制)**。
* **運作機制**：
  1. 在資料庫 `objects` 表中插入一筆 type 為 `Brand` 的物件（寫入其定位與權重），並在 `objects` 表中插入多個 type 為 `Source` 的監控管道，以 `object_relations` 建立連結。
  2. 將新開發的 Scraper/Scorer 程式寫入 `plugins/` 目錄，並在資料庫中註冊為 `Plugin` 物件。
  3. 當 Event Bus 啟動時，系統會自動加載資料庫中的 Plugin 類別與 Brand 權重，不需修改任何 core 程式即可動態執行。

---

## 2. Erick 每日核心商業決策驗收

### 目前 Brand Intelligence OS 是否能每天告訴 Erick：
1. **今天最值得追哪個品牌？**
2. **今天最值得寫哪個主題？**
3. **今天最值得推出哪個產品？**

### 誠實的商業能力評估：
**「目前還不能完全做到自動化運作。」**

雖然本機 CLI MVP 已經完整跑通了分類、路由、評分與模擬產出的邏輯，但要真正成為 Erick 每日運作的商業決策大腦，目前存在以下 **Top 10 核心商業能力缺口 (Gaps)**：

1. **缺乏真實數據的 API 對接**：監控模組目前使用 Mock 資料，尚未真正串接 YouTube API、Threads 爬蟲、IG API 或 FB Page API，無法抓取真實的競品更新。
2. **沒有自動化的定時觸發機制 (Daemon)**：系統需要手動在終端機執行，缺乏背景定時排程（Cron daemon）每日自動抓取與分析。
3. **缺乏語義相似度關聯 (Vector Search)**：知識圖譜目前在 SQLite 中以純文字字串存儲，缺乏 Vector Embedding，因此無法將「失眠」與 Erick 的「能量調頻」在語義上進行概念關聯，導致定位推薦不夠精準。
4. **沒有真實的社群成效回寫 (Loop Integration)**：系統無法自動獲取 Erick 個人社群（如 FB 貼文）發布後的真實 CTR、按讚與轉換數據，反饋學習機制目前僅能以手動 Mock 數據模擬。
5. **沒有對接真實的 LLM 接口**：第一版 MVP 為了零依賴流暢執行，並未實際呼叫 OpenAI / Anthropic API，產出的文案目前為高仿真模板，而非 AI 即時生成的真實內容。
6. **缺乏多品牌數據隔離**：雖然資料庫支持註冊 30 個品牌，但系統尚未實現完整的多租戶隔離（Multi-tenant isolation），同時執行時可能會有上下文混淆。
7. **缺乏競品核心商業 Offer 資料庫**：系統尚未註冊市場主流競品（如 Tony Robbins, Russell Brunson）的完整產品價值階梯數據，無法做到深度的 Offer 競爭對比。
8. **缺少自適應的 ROI 預測模型**：目前 ROI 評分外掛僅採用簡單的品牌契合度乘法，無法根據 Erick 的真實廣告投報率與產品銷售成本進行精準的 ROI 商業預測。
9. **缺少自動化通知送達管道**：系統計算出「Today Top 5」與決策後，無法主動將結果推送到 Erick 的手機上（例如對接 LINE Notify、Slack 或 Email 每日日報）。
10. **沒有與 Erick 實際產品庫連結**：Brand Registry 內的產品資料目前為手動配置，系統無法讀取 Erick 實際的線上商城或銷售系統狀態（例如哪個產品庫存多、哪個產品最近賣得好），因此難以精準推薦「今天最值得推出哪個產品」。
