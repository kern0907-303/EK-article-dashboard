# 新規則怎麼併進現有規則

抽出來的規則不會直接進系統。每一條先分成三類，第三類一定要人判斷。

## 一、新增

現有規則沒有講過這件事。直接加進對應的檔案，帶上出處。

對應關係：

| scope | 併進哪個檔 |
|---|---|
| title | `src/data/skills/title-styles.ts`（新句型）或 `title-amplifiers.ts`（加強手法） |
| opening | `src/data/skills/opening-styles.ts` |
| subhead | `src/data/skills/subhead-rules.ts` |
| structure | `src/data/skills/genres.ts` |
| ad_only | 不併，只留在 json 裡 |

## 二、強化

現有規則已經講過同一件事，但新來源講得更具體、或附了測試數據。

做法：換掉規則文字，**保留兩個出處**，新的放前面。附測試數據的來源優先於沒有數據的。

## 三、衝突

兩個來源對同一件事給出相反的指示。**不可以自動決定，一定要列出來給艾瑞克判斷。**

判斷時先問一個問題：**兩邊的讀者是不是同一種人？**

不是同一種人，就分通路，兩邊都留。例如小標那一次：

- Sugarman 說段落小標主要是視覺節奏，可以跟內文無關（他的讀者是被鉤進來、一路往下讀的廣告讀者）
- Nielsen Norman Group 說小標必須精確描述底下內容（他們的讀者在掃讀，可能永遠不讀內文）

結論是分成 `facebook` 與 `website` 兩套，不是二選一。

是同一種人才需要擇一。擇一時的順序：

1. 附實際測試數據的贏沒有數據的
2. 比較新、比較貼近現在平台生態的贏比較舊的
3. 艾瑞克自己的品牌設定贏任何書（例如書上說可以用免責聲明，但品牌規範禁止，就聽品牌規範）

## 四、併完要做的

1. 每條規則都要有 `source`，格式見 `src/data/skills/rule-source.ts`
2. 新書要在 `rule-source.ts` 的 `BOOKS` 裡登記
3. 更新 `coverage.md`
4. 調高 `src/lib/auto-generate.ts` 的 `RULES_VERSION`，已排程的文章才會被列為待重寫
5. 補測試：新規則至少要有一條測試鎖住它的存在與出處
