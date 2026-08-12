# 名單、生圖、轉換路徑：實測結果與建議

日期：2026-08-12
調查範圍：Next.js 儀表板、Python Brand OS、n8n 雲端實例（64 條工作流）

---

## 一、名單在哪裡？找到了

**位置**：Google Sheet
`15AeFm73ATfDxlipIIakvy8DxvNxbo9xar5d-0vuHrvY` → 分頁「測驗名單」(gid `1491885726`)

**欄位**：`name` / `email` / `result_type` / `timestamp`，以 `email` 作為比對鍵（重複填寫會更新而非新增）

**捕捉路徑**：
```
網頁測驗（大腦當機診斷）
  → n8n webhook: timewaver-quiz-hook
  → 寫入 Google Sheet「測驗名單」
  → 分兩路：Telegram 通知你 ＋ 寄出測驗結果信
```
工作流：`大腦當機診斷 — 測驗結果自動寄信`（ID `Pf9g2mUaQWwgvWCB`，**啟用中**）

### 這代表什麼

好消息是你**已經有一套可運作的名單捕捉機制**，而且結構是對的：免費測驗當 lead magnet、以 email 換結果、自動寄信、即時通知。這正是「05 流量轉換企劃」該做的事。

問題有三個：

**第一，全站只有這一個捕捉點，而且只服務一條產品線。** 它掛在大腦當機診斷／TimeWaver 這條線上。NAS、I8、Erick 個人品牌**沒有任何名單捕捉機制**。依你的品牌規範，NAS 是「負責流量與市場教育的入口品牌」——入口品牌沒有名單捕捉，等於漏斗的入口是破的。

**第二，儀表板完全不知道這份名單存在。** Jack 從 Meta API 抓 `action_type === 'lead'` 算 CPA，那是廣告平台回報的數字；真實名單躺在 Google Sheet 裡，兩者沒有勾稽。你無法回答「這篇文章帶進幾個名單」。

**第三，名單進來之後沒有分流。** `result_type` 有記錄，但後續的 `睡前微調 7 天日更` 與 `TimeWaver 21-Day` 序列是另外觸發的，名單不會依 result_type 自動進入對應的培育序列。

### 建議

短期不要換工具。Google Sheet 作為名單存放處在你現在的量級完全夠用，而且 n8n 已經串好了。真正該補的是**覆蓋率**，不是儲存方式。

依你的品牌規範，信任漏斗是「陌生人 → NAS → Erick → ABL/I8」。所以優先順序應該是：

1. **NAS 的免費測驗**（品牌規範裡列的「生命數字小測、年度提醒、情緒測試」）——這是漏斗最上游，缺它等於整條漏斗沒有入口
2. **I8 的低摩擦入口**——「業務關鍵起診」NT$10,000+ 對陌生流量太重，中間需要一個免費的自評工具
3. **統一名單表結構**：現有的四欄不夠，建議加 `brand`（來源品牌）、`source`（哪個測驗／文章）、`stage`（漏斗階段）三欄，否則四個品牌的名單混在一起無法分流

**不建議**現在導入 CRM 或 email 服務。你的瓶頸是「只有一個入口」，不是「名單管不動」。等三到四個入口都跑起來、名單量上千再評估。

---

## 二、生圖：不是靠 n8n，而是根本沒有生圖

**這是本次調查最重要的發現。**

`ai-provider.ts:737-745` 花了一大段提示詞，要求 Maya 為每篇文章量身設計 DALL-E 3 生圖描述，還特別強調「強制隨機性」「必須是真人寫實攝影」「絕對禁止流程圖與插畫渲染」「確保每次產出 100% 完全不同」。

而 n8n 收到之後做了兩件事，把這段努力**完全丟棄**：

**第一，明確排除 filedn.com。** `Erick Dashboard Social Router` 的 `MapBrandToken` 節點有這段：

```js
if (!extractedUrl.includes('filedn.com') && !extractedUrl.includes('placeholder') ...) {
  imageUrl = extractedUrl;
}
```

Maya 產出的圖片網址正是 `https://filedn.com/your-id/...`，所以**必然落入排除條件**，一張都不會被採用。

**第二，改用罐頭圖池。** 實際發到 Facebook 的圖片，是用文章標題的 hash 值從**每個品牌 4–5 張固定的 Unsplash 圖片**裡挑一張：

| 品牌 | 圖片數 | 內容 |
|---|---|---|
| I8 | 5 張 | 商務／城市 |
| NAS | 5 張 | 星空／自然 |
| ABL | 5 張 | 湖水綠熱氣球、森林、迷霧山嵐、水面漣漪、茶與晨光 |
| Erick | 4 張 | 人物／旅程 |

**第三，Markdown 圖片標籤被整段刪除。** `cleanContent` 的 regex `.replace(/!\[.*?\]\(.*?\)/g, "")` 會把圖片標籤連同生圖描述一起移除。

### 結論

你的視覺流程實際上是：**每個品牌 4–5 張圖無限輪播**。ABL 發第 6 篇文章時，必定與前 5 篇之一撞圖。

而 Maya 每次生成都在為那段被丟棄的生圖描述付 token 費用。

### 建議

有兩條路，取決於你要的品質：

**路線 A（低成本，立刻可做）**：承認現況，把 Maya 的生圖提示詞整段移除，省下 token；同時把 Unsplash 圖池從 5 張擴充到每品牌 20–30 張，撞圖機率大幅下降。適合「圖片只是配襯，內容才是主角」的定位。

**路線 B（高成本，做對的事）**：在 n8n 補一個生圖節點——接收 Maya 的描述 → 呼叫生圖 API → 上傳到可公開存取的儲存 → 回填網址 → 再發 FB。這樣 Maya 那套精心設計的提示詞才真正生效。需要決定生圖服務與圖床。

我的看法：**先做 A，觀察三個月**。因為在名單漏斗只有一個入口的情況下，圖片獨特性不是當前瓶頸。等 05 補起來、流量真的進來了，再投資 B。

---

## 三、各品牌的轉換目標：現況與重新設計

### 現況

**已經有分品牌的意識，但只做了一半。** FB 首則留言的文案已依品牌區分：

| 品牌 | 留言文案 | 導向 |
|---|---|---|
| I8 | 閱讀完整文章與**動態分析圖表** | `erickfirm.com/insights/{id}` |
| NAS | 閱讀完整文章與**天賦定位地圖** | `erickfirm.com/insights/{id}` |
| ABL | 閱讀完整文章與**狀態調和指南** | `erickfirm.com/insights/{id}` |

文案分了，**目的地沒分**——三個品牌導到同一個 Insights 文章頁。

而 Leon 產出的 Landing Page，CTA 一律硬編碼 `https://erickfirm.com/#contact`（`ai-provider.ts:898`）。

### 依品牌規範與轉換原則的問題診斷

你的品牌規範定義了信任漏斗：**陌生人 → NAS（教育入口）→ 溫暖受眾 → Erick（高信任諮詢）→ ABL 或 I8（高單價服務）**。

同時規範強調「語言層」：第一層對陌生人，第二層對熟客，**混用會造成目標受眾流失**。

對照 Krug 的自明性原則與 Making Websites Win 的「單一轉換行動 × 訪客覺知階段」，現況有兩個結構性錯誤：

**錯誤一：所有品牌共用同一個 CTA，等於跳級。**
NAS 的受眾是「有興趣心理測驗、星座、命理」的陌生人，處在漏斗最上游。把他們導向「諮詢預約」，是要求一個剛認識你的人直接進行高承諾行動。依覺知階段理論，這一步的轉換率會極低，而且會流失掉本來可以先養成名單的人。

**錯誤二：文章頁沒有承接動作。**
三個品牌都導到 `/insights/{id}`。讀完文章之後呢？沒有下一步。這是漏斗上最大的漏水點——你花力氣把人從 FB 帶到官網，然後讓他離開。

### 建議的設計

核心原則：**每個品牌的 CTA 應該對應該品牌在漏斗中的位置，而不是統一導向成交。**

| 品牌 | 漏斗位置 | 訪客覺知階段 | 建議的單一轉換行動 | 落地頁 |
|---|---|---|---|---|
| **NAS** | 最上游入口 | 問題未意識 / 剛好奇 | **免費生命數字小測 → 換 email** | `/nas/quiz` |
| **ABL** | 中段 | 知道自己卡住，找方法 | **免費身體掃描／生命地圖偵測 → 換 email** | `/abl/check` |
| **I8** | 中段（B2B） | 知道公司有問題，找顧問 | **免費經營卡點自評 → 換 email + 公司資訊** | `/i8/diagnosis` |
| **Erick** | 承接層 | 已有信任，考慮合作 | **預約諮詢**（現有的 `#contact` 在這裡才正確） | `erickfirm.com/#contact` |

NAS、ABL、I8 三個品牌的目標**都是換 email，不是成交**。成交發生在 Erick 這一層。這才符合你自己定義的信任漏斗。

而且你**已經有現成的技術模式**可以複製——大腦當機診斷那條路徑（測驗頁 → webhook → Google Sheet → 自動寄信）完整可用，只要複製三份、改測驗內容與 result_type 即可。這是最低成本的做法。

### 程式碼層面該怎麼改

目前轉換目標散落在三個地方，硬編碼：
- `ai-provider.ts:898`（Leon 的 CTA）
- n8n `Post Link to First Comment`（FB 留言的連結與文案）
- 各品牌的 `*_BRAND_CONTEXT`

建議收攏成單一設定檔 `src/data/brands/conversion.ts`：

```ts
export interface BrandConversion {
  brandId: string;
  funnelStage: "entry" | "nurture" | "close";
  ctaLabel: string;        // 按鈕文字
  ctaUrl: string;          // 落地頁
  leadMagnet: string;      // 誘因描述，供 Leon 寫 CTA 區塊
  socialCommentText: string; // FB 首則留言文案
}
```

然後：Leon 的提示詞讀 `ctaUrl` 與 `leadMagnet` 而非硬編碼；n8n 從 Supabase 或 API 讀同一份設定，不要在 Code 節點裡再寫一次 if/else。**單一事實來源**，改一處全站生效。

---

## 四、安全事項（需要處理）

`Erick Dashboard Social Router` 工作流的 `Get Latest Article ID` 節點，把 **Supabase `service_role` JWT 明文寫死在 HTTP header 參數裡**（同時出現在 `apikey` 與 `Authorization` 兩處）。

這把金鑰：
- 繞過所有 Row Level Security，等同資料庫完整讀寫權限
- 效期到 2036 年
- 同時也明文存在 `.env.local`

建議在 n8n 改用 Credential 管理而非節點參數明文，並評估是否輪替該金鑰。若這條工作流曾被匯出、分享或截圖，應視為已外洩。

---

## 五、四題總結

| 問題 | 答案 |
|---|---|
| 名單有嗎？在哪？ | **有。** Google Sheet「測驗名單」，經 n8n `timewaver-quiz-hook` 寫入。但只有一個入口，且只服務 TimeWaver 線 |
| 生圖是靠 n8n 嗎？ | **不是，而且根本沒生圖。** n8n 明確排除 filedn.com，改用每品牌 4–5 張 Unsplash 罐頭圖輪播 |
| 各品牌轉換目標怎麼做？ | 三個子品牌應導向**免費工具換 email**，只有 Erick 導向諮詢。收攏成單一設定檔 |
| 兩套系統的問題怎麼修？ | 見 `SIX_ROLE_GAP_ANALYSIS.md`，第一優先是把 Guardrail 掛上產出路徑 |
