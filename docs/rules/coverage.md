# 文案書籍覆蓋地圖

書放在 `/Volumes/4T/EK_Knowledge_Library/書籍重整/行銷寫作/`。
這份表記錄每本書被讀進系統規則的程度，避免重複讀，也看得出還有多少沒吃。

更新時機：每次依 `MERGE.md` 併完規則就更新一次。

| 書 | 作者 | 狀態 | 已讀章節 | 產出 |
|---|---|---|---|---|
| Making Ads Pay | John Caples | 已讀一章 | Ten Ways to Write the First Paragraph | `opening-styles.ts` 開場九型 |
| Breakthrough Advertising | Eugene Schwartz | 已讀一章 | 第 4 章 38 Ways to Strengthen Your Headline | `title-amplifiers.ts` 強化十四式 |
| 文案訓練手冊 | Joseph Sugarman | 已讀兩節 | 第 4 章與第 18 章 Paragraph Headings | `subhead-rules.ts` 社群小標 |
| How to Make Your Advertising Make Money | John Caples | 部分 | 第 8 章（只取了標題長度與見證式兩條） | `title-styles.ts` 兩型的出處 |
| Scientific Advertising | Claude Hopkins | **未讀** | | |
| 我的廣告人生 | Claude Hopkins | **未讀** | | |
| The Boron Letters | Gary Halbert | **未讀** | | |
| How to Make Maximum Money in Minimum Time | Gary Halbert | **未讀** | | |
| The Ultimate Sales Letter | Dan Kennedy | **未讀** | | |
| Magnetic Marketing | Dan Kennedy | **未讀** | | 偏商業模式，不是寫作，優先度低 |
| Triggers | Joseph Sugarman | **未讀** | | 31 個心理誘因 |
| Tested Advertising Methods | John Caples | 已抽取 | 標題三分類、失敗標題特徵、第一段寫法、19 種文案類型 | `title-styles.ts` 三分類與權重、`copy-types.ts` 推薦十三種、`opening-styles.ts` 空泛開場禁用 |

## 已知還沒處理的大塊

- Schwartz《Breakthrough Advertising》第 2 章「意識五級」與第 3 章「市場成熟度五階段」。這兩章可以接到漏斗層（冷溫熱），目前漏斗層是自己定義的，沒有理論底。
- Caples《How to Make Your Advertising Make Money》第 8 章的 106 個賺錢標題，有測試數據，是補強標題型最好的材料。
- Sugarman 的 15 條公理與 31 個心理誘因。
- `src/data/skills/frameworks.ts` 裡那五套大師框架（Brunson、Kennedy、Sugarman、Ogilvy）自動流水線完全沒用到，要決定是接進去還是刪掉。

## 已刪除

- Advertising Secrets of the Written Word（Sugarman）：與《文案訓練手冊》是同一本書換書名，而且 OCR 損壞，2026-10-27 刪除。

## 2026-10-27 Tested Advertising Methods 抽取紀錄

來源：清洗後的 Knowledge Note，99 條核心論點、42 條關鍵概念、10 個單元，涵蓋全書 8400 行。
其中 83 條論點附有可執行的第一個動作。

抽進系統的三件事：

1. **標題三分類與權重** —— 自身利益、新聞、好奇心。Caples 指出自身利益最重要，好奇心單獨
   使用時效果最弱也最不穩定。八種標題型各歸一類，`pickTitleStyle` 依權重（3 / 2 / 1）挑選，
   好奇心型不禁用，只降低比例，維持句型變化。
2. **失敗標題特徵** —— 死板、過度聰明、無意義、負面，加上「標題必須獨立傳達訊息」與
   「具體數字提高可信度」。只寫進提示詞，**不做成品管阻擋**：這幾項沒辦法用機器可靠判斷，
   硬擋會誤殺。
3. **第一段必須延續標題的承諾** —— `BANNED_FIRST_SENTENCE` 補上空泛哲理開場
   （人生就是、這個世界、每個人都等），`buildOpeningDirective` 加上一行規則。

刻意沒抽的：19 種文案類型裡列為慎用的三種（卡片式、俏皮、幽默）與不推薦的三種
（詩意、矯飾、誇大）。艾瑞克的品牌文案本來就偏抒情，把那幾種寫成負面清單會把正常的
抒情句誤判成錯誤寫法。這是依 MERGE.md 的衝突流程由艾瑞克裁定的（2026-10-27，選 C）。
只收他明確推薦的 13 種，放在 `copy-types.ts`。

來源檔本身的 review gate 判定是 NEEDS_HUMAN（壞段 10.07%，人工確認範圍 5% 到 15%），
所以這本還不能進「生成核准」。上面三件事是從筆記層抽的，筆記層的 N 系列檢查已通過。

## 規則只能有一份

海巡的 `分組建提示` 節點原本把八種標題型與九種開場型硬寫在提示詞裡，等於第二份規則庫。
而生成端是 `readTitleStyleFromPrompt(prompt) || pickTitleStyle(...)`，**n8n 指定的優先**，
所以規則只改程式這邊的話，海巡來的題目完全吃不到。

2026-10-27 改成由 `/api/rules/styles` 吐出同一份規則，海巡每次執行先抓一次再組提示詞，
抓失敗退回節點內建的版本。之後新增規則只要改 `src/data/skills/`，海巡自動同步，不必再動 n8n。
