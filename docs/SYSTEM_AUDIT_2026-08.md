# Frontend Dashboard 系統健檢報告

日期：2026-08-12
專案：`/Volumes/4T/Frontend Dashboard` → `kern0907-303/EK-article-dashboard`
現況：Next.js 16.2.7 / React 19 / Tailwind v4 / TypeScript，原始碼 7,323 行，磁碟佔用 2.4 GB

---

## 一、總覽：2.4 GB 之中只有 416 KB 是你的程式碼

| 項目 | 大小 | 性質 | 建議 |
|---|---|---|---|
| `.npm-cache/` | **931 MB** | 六月安裝時的殘留快取，執行期完全不讀 | 刪除 |
| `.next/dev/` | **887 MB** | Next 16 dev server 的 turbopack 中間產物，六月底至今未更新 | 刪除 |
| `node_modules/` | 615 MB | 依賴（其中 109 MB 是根本沒啟用的 Firebase） | 重裝並瘦身 |
| `.git/` | 4.9 MB | 正常 | 保留 |
| `src/` | 416 KB | 你的程式碼 | 重構 |
| `tsconfig.tsbuildinfo` | 110 KB | 增量編譯快取，已被 gitignore | 可刪 |

刪掉前兩項立刻釋放 **約 1.8 GB**，且不影響任何功能——`npm run dev` 會自行重建。

---

## 二、真正拖慢系統的四個問題

### 1. Firebase 全套被打包進前端，但從頭到尾沒啟用（最嚴重）

`.env.local` 裡六個 `NEXT_PUBLIC_FIREBASE_*` **全部是空值**。`src/lib/firebase.ts` 第 18 行的 `isFirebaseConfigured` 因此永遠為 `false`，`db` 永遠是 `null`，所有讀寫都走 LocalStorage 分支。

但問題在於：`firebase.ts` 第 1–2 行是**靜態 import**，而它被 `ChatBox.tsx`、`WorkspaceBoard.tsx`、`ProjectSelector.tsx` 這三個 `"use client"` 元件引用。也就是說 `@firebase` (75 MB) + `firebase` (34 MB) 的 SDK 會被完整 bundle 進 client JS，使用者每次開頁面都要下載一份**永遠不會執行**的 Firestore 程式碼。

這是目前首頁載入最大的單一拖累來源。

**處理方式（三選一）：**
- **A（推薦，最乾淨）**：既然實際資料層已經是 Supabase + LocalStorage，直接把 Firestore 分支整段移除，`npm uninstall firebase`。`firebase.ts` 可縮到約 350 行並改名為 `storage.ts`。
- **B（保留未來彈性）**：把 `initializeApp` / `getFirestore` 改成動態 `await import("firebase/firestore")`，只在 `isFirebaseConfigured === true` 時才載入。
- **C**：真的要用 Firestore，就把 `.env.local` 填滿。

### 2. `page.tsx` 每 2 秒輪詢 LocalStorage

```
src/app/page.tsx:43  const interval = setInterval(handleStorageChange, 2000);
```

這個 interval 永不停止，每 2 秒做一次 `localStorage.getItem` + `JSON.parse` + `setState`。因為 `setProjectsCache` 每次都收到一個**新的物件參考**，React 每 2 秒就把整棵樹 re-render 一次——包含 2,283 行的 `WorkspaceBoard`。閒置時 CPU 一直在轉，輸入框打字也會卡。

同一個 effect 已經註冊了 `window.addEventListener("storage", ...)`，輪詢是為了補「同分頁改動不觸發 storage 事件」的洞。正解是改成自訂事件：寫入端 `window.dispatchEvent(new Event("projects-updated"))`，讀取端監聽它，把 interval 整個拿掉。

### 3. `WorkspaceBoard.tsx` — 2,283 行、31 個 useState、0 個 useMemo/useCallback

全專案 **useMemo 與 useCallback 各為 0 次**。這代表：
- 每次 render 都重新建立所有事件處理函式
- Markdown 預覽、網站樹狀圖解析、關鍵字表格排序這類衍生運算，每次 render 都重跑一次
- 配合上面的 2 秒輪詢，等於每 2 秒重算一遍

建議依照四個專家 Tab 拆成 `MayaPanel` / `LeonPanel` / `IrisPanel` / `JackPanel` 四個子元件（每個約 400–500 行），用 `React.memo` 包起來，衍生資料一律 `useMemo`。這一步同時也是後續加功能時最重要的地基。

### 4. `ai-provider.ts` — 1,796 行單檔，30 處 `any`

一個檔案同時裝了：system prompt 常數、JSON 修復器、四家 LLM 呼叫、DataForSEO 抓取、Meta Ads 抓取、mock 模擬器、AEO 產生器、Theo 分析器。任何一處改動都要重新理解全檔。

建議切成 `src/lib/ai/`：`prompts.ts`、`json.ts`、`providers/{openai,gemini,anthropic,n8n,mock}.ts`、`agents/{erick,theo,aeo}.ts`、`integrations/{dataforseo,meta}.ts`。

---

## 三、確定沒在使用的資料（可直接清）

| 檔案 / 內容 | 判定 |
|---|---|
| `src/lib/google-sheets.ts` | **零引用**。全專案 grep `google-sheets` 只有它自己。50 行死碼 |
| `public/next.svg`、`vercel.svg`、`file.svg`、`globe.svg`、`window.svg` | Next.js 樣板殘留，`src/` 中零引用 |
| `netlify.toml` | 只有兩行 esbuild 設定，但實際部署在 Render（`render.yaml`）。兩套部署設定並存會誤導 |
| `.DS_Store`（根目錄、`src/`） | macOS 垃圾檔，已在 gitignore 但檔案還在 |
| `CLAUDE.md` | 只有 11 bytes，形同空檔 |
| `firebase.ts` 的 `DEFAULT_MOCK_WORKSPACE`（94–239 行）與 `DEFAULT_MOCK_CHATS`（240–300 行） | 約 205 行的假資料，被打包進 client bundle。應搬到 `src/data/seed/` 並考慮動態載入 |
| `firebase.ts` 的 Firestore 分支 | 見上方第 1 點，永不執行 |
| `.env.local` 的六個 Firebase 變數 | 全空值，且 `render.yaml` 根本沒宣告它們 |
| `tsconfig.tsbuildinfo` | 建置快取，可刪 |

---

## 四、資料/設定不一致（會在加功能時咬人）

1. **README 與現實嚴重脫節。** README 寫「資料庫採用 Firebase Firestore 即時同步」，實際是 Supabase + LocalStorage。README 也沒提到 Theo（流量預測）、AEO、Meta Ads、DataForSEO、專案模式（ProjectSelector）這些後來才加的功能。新加功能前應先更新，否則會依據錯誤的架構描述做決策。

2. **模型名稱疑似錯誤。** `ai-provider.ts` 預設 `gpt-5.4-mini`、`claude-sonnet-4-6`。這兩個字串不是有效的模型 ID，實際呼叫會直接 400。建議先跑一次真實呼叫確認，並把模型 ID 收攏成單一常數檔。

3. **`next.config.ts` 關掉了所有安全網。**
   ```
   eslint: { ignoreDuringBuilds: true }
   typescript: { ignoreBuildErrors: true }
   ```
   加上 `const nextConfig: any`，等於整個型別系統對建置無效。目前 `src/` 有 48 處 `any`。這是「先求上線」的權宜之計，但在強化功能前應該至少把 TypeScript 檢查打開——否則型別錯誤會在 Render 上以 500 的形式出現。

4. **`api/publish/route.ts` 硬編碼 n8n Webhook URL 作為 fallback**（第 18 行）。環境變數漏設時會靜默打到正式 webhook，難以察覺。應改為缺變數就回 500。

5. **`.env.local` 內含 6 組真實金鑰**（OpenAI、Anthropic、Gemini、Supabase service role、SEMrush、DataForSEO、Meta token）。已被 gitignore 保護，git 歷史也乾淨，但這顆外接硬碟上是明文。`SUPABASE_SERVICE_ROLE_KEY` 尤其危險，它繞過所有 RLS。

---

## 五、建議執行順序

**第一階段：清理（30 分鐘，零風險）**
1. `rm -rf .next .npm-cache tsconfig.tsbuildinfo` 並清掉 `.DS_Store` → 釋放 1.8 GB
2. 刪除 `src/lib/google-sheets.ts`、五個樣板 SVG、`netlify.toml`、`CLAUDE.md`
3. `.gitignore` 補上 `.next/dev/`

**第二階段：解除效能瓶頸（半天，中風險，需測試）**
4. 移除或改為動態載入 Firebase → client bundle 大幅縮小
5. 移除 `page.tsx` 的 2 秒輪詢，改自訂事件
6. `WorkspaceBoard` 補 `useMemo` / `useCallback`

**第三階段：為新功能鋪路（1–2 天）**
7. 拆 `WorkspaceBoard` 成四個 Panel 子元件
8. 拆 `ai-provider.ts` 成 `src/lib/ai/` 模組
9. 打開 TypeScript 建置檢查，逐步消滅 `any`
10. 重寫 README 對齊實況

**第四階段：安全**
11. 輪替 Supabase service role key，並把它移出前端可及範圍
12. 移除 `api/publish` 的硬編碼 webhook fallback

---

第二階段做完之前不建議加新功能——目前每加一個 Tab 就是往 2,283 行的檔案裡再塞一段，且會被同一個輪詢迴圈拖著跑。
