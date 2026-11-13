import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseKnowledgeNoteBlocks } from "../src/components/KnowledgeNoteReader";
import { selectRelevantKnowledgeContent } from "../src/lib/knowledge-note-utils";

const v2 = `## 全書主線
一句話核心主張：本書整理人生轉折與住家方位的觀察。
主線敘述：全書從個人選擇延伸到日常空間。
章節邏輯鏈：
- [U0001] 中年轉折與人生第二條路 → 重新選擇。
- [U0002] 住家方位與睡眠 → 檢視房間配置。
關鍵概念：
- 主線概念：完整保留。

## 全書索引
- U0001、U0002

## 單元內容
### [U0001] 人生第二條路
#### 章旨與承接
本章談中年轉折，接續整理人生的第二條路。
#### 故事卡
##### 故事卡 1｜中年轉折與換跑道
讀者卡點：中年工作耗竭，正在思考人生第二條路的人。
故事完整內容第一句。故事完整內容第二句。STORY_CARD_END。
##### 故事卡 2｜一般工作日安排
讀者卡點：想了解日常行程安排的人。
不相關故事卡內容。UNRELATED_STORY_END。
#### 例子卡
##### 例子卡 1｜中年轉職的生活例子
例子完整內容第一句。EXAMPLE_CARD_END。
##### 例子卡 2｜一般會議流程
不相關例子卡內容。UNRELATED_EXAMPLE_END。
#### 圖示卡
##### 圖示卡｜人生第二條路的岔路圖
圖示卡完整內容。FIGURE_CARD_END。
##### 圖示卡｜一般會議流程圖
不相關圖示卡內容。UNRELATED_FIGURE_END。
#### 論點
##### 論點 1
中年重新選擇有其生活脈絡。POINT_END。
#### 佐證
##### 佐證 1
佐證只在其餘額度補入。EVIDENCE_END。

### [U0002] 住家方位與睡眠
#### 章旨與承接
本章整理住家方位與睡眠的關係，承接日常空間觀察。
#### 故事卡
##### 故事卡 1｜床頭方向與睡眠困擾
讀者卡點：睡眠不穩，想檢視住家方位與房間配置的人。
睡眠故事完整內容。SLEEP_STORY_END。
#### 圖示卡
##### 圖示卡｜臥室方位與睡眠示意圖
睡眠圖示卡完整內容。SLEEP_FIGURE_END。
#### 論點
##### 論點 1
住家方位與睡眠配置需一併檢視。SLEEP_POINT_END。
#### 佐證
##### 佐證 1
睡眠佐證內容。SLEEP_EVIDENCE_END。
`;

const unrelated = selectRelevantKnowledgeContent(v2, "咖啡沖煮與攝影");
assert.ok(unrelated.startsWith("## 全書主線"), "第二版全書主線必須優先帶入，即使主題無匹配章節");
assert.ok(unrelated.includes("本書整理人生轉折與住家方位的觀察。"));
assert.ok(!unrelated.includes("### [U0001]") && !unrelated.includes("### [U0002]"), "無主題匹配時不硬塞章節");

const midlife = selectRelevantKnowledgeContent(v2, "中年轉折與人生第二條路");
assert.ok(midlife.includes("### [U0001] 人生第二條路"), "依章旨與故事卡點選中中年轉折章");
assert.ok(!midlife.includes("### [U0002] 住家方位與睡眠"), "主題不相關的睡眠章不應入選");
assert.ok(midlife.includes("#### 章旨與承接") && midlife.includes("#### 故事卡"));
assert.ok(midlife.includes("STORY_CARD_END") && midlife.includes("EXAMPLE_CARD_END") && midlife.includes("FIGURE_CARD_END"), "故事、例子與圖示卡必須完整帶入");
assert.ok(!midlife.includes("UNRELATED_STORY_END") && !midlife.includes("UNRELATED_EXAMPLE_END") && !midlife.includes("UNRELATED_FIGURE_END"), "同章多張卡片時選最相關的一張");
assert.ok(midlife.includes("POINT_END") || midlife.includes("EVIDENCE_END"), "論點與佐證可在卡片後的剩餘額度內補入");

const sleep = selectRelevantKnowledgeContent(v2, "住家方位與睡眠");
assert.ok(sleep.includes("### [U0002] 住家方位與睡眠"), "依章旨、讀者卡點與圖示卡標題選中睡眠章");
assert.ok(sleep.includes("SLEEP_STORY_END") && sleep.includes("SLEEP_FIGURE_END"), "睡眠章的相關卡片需完整帶入");
assert.ok([...sleep].length <= 24_000, "第二版總選取上限為 24,000 字");

const longCard = v2.replace("故事完整內容第一句。故事完整內容第二句。STORY_CARD_END.", "故事內容。".repeat(4_000) + "STORY_CARD_END.");
const longCardExcerpt = selectRelevantKnowledgeContent(longCard, "中年轉折與人生第二條路");
assert.ok(longCardExcerpt.includes("STORY_CARD_END"), "卡片在上限內時不截斷卡片末尾");

const longMainline = v2.replace("- 主線概念：完整保留。", `- 主線概念：${"概念".repeat(5_000)}`);
const longMainlineExcerpt = selectRelevantKnowledgeContent(longMainline, "咖啡沖煮與攝影");
const retainedMainline = longMainlineExcerpt.split("\n\n### [U")[0];
assert.ok([...retainedMainline].length <= 8_000, "第二版全書主線最多 8,000 字");
assert.ok(retainedMainline.includes("一句話核心主張：") && retainedMainline.includes("本書整理人生轉折"));
assert.ok(retainedMainline.includes("主線敘述：") && retainedMainline.includes("章節邏輯鏈："), "主線超限時保留主張、敘述與章節邏輯鏈");

const oversizedCore = v2
  .replace("主線敘述：全書從個人選擇延伸到日常空間。", `主線敘述：${"主線敘述句。".repeat(3_000)}`)
  .replace("- [U0002] 住家方位與睡眠 → 檢視房間配置。", `${"- [U0002] 住家方位與睡眠 → 檢視房間配置。\n".repeat(1_000)}`);
const oversizedCoreOutput = selectRelevantKnowledgeContent(oversizedCore, "咖啡沖煮與攝影").split("\n\n### [U")[0];
assert.ok([...oversizedCoreOutput].length <= 8_000, "核心主線超限時仍維持 8,000 字上限");
assert.ok(oversizedCoreOutput.includes("一句話核心主張：") && oversizedCoreOutput.includes("主線敘述：") && oversizedCoreOutput.includes("章節邏輯鏈："));

const legacyV1 = [
  "## 全書索引\n索引甲。",
  "## 單元內容",
  "### [U0001] 第一單元\n第一單元全文。",
  "### [U0002] 第二單元\n第二單元全文。",
  "### [U0003] 第三單元\n第三單元全文。",
].join("\n\n");
assert.equal(
  selectRelevantKnowledgeContent(legacyV1, "一般主題"),
  ["## 全書索引\n索引甲。", "### [U0001] 第一單元\n第一單元全文。", "### [U0002] 第二單元\n第二單元全文。", "### [U0003] 第三單元\n第三單元全文。"].join("\n\n"),
  "第一版選取結果維持現行結構化筆記規則",
);

const readerBlocks = parseKnowledgeNoteBlocks("## 全書主線\n主線。\n### 章旨與承接\n章旨。\n#### 故事卡\n故事。\n##### 故事卡 1｜標題\n卡片。");
assert.deepEqual(readerBlocks.filter((block) => block.kind === "heading").map((block) => block.kind === "heading" ? [block.level, block.text] : []), [
  [2, "全書主線"], [3, "章旨與承接"], [4, "故事卡"], [5, "故事卡 1｜標題"],
], "匯入預覽與閱讀器必須解析第二版五層標題");

const workspace = readFileSync("src/components/KnowledgeImportWorkspace.tsx", "utf8");
const route = readFileSync("src/app/api/knowledge-import/route.ts", "utf8");
assert.ok(workspace.includes("閱讀 Markdown 預覽") && workspace.includes("閱讀已匯入全文"), "匯入預覽與已匯入閱讀器都使用層級標題呈現");
assert.ok(route.includes("isKnowledgeImportAuthorized(request)") && route.includes("content_id"), "全文閱讀仍需登入保護並由伺服器讀取");

console.log("knowledge-note-v2 測試通過");
