import test from "node:test";
import assert from "node:assert/strict";
import { stripDiagramBlocks } from "../src/lib/plain-text";

const POST = "標題\n\n內文第一段。\n\n#生命數字 #自我探索";
const UNFENCED = `---mermaid---

%%{init: {
  'theme': 'base',
  'themeVariables': {
    'primaryColor': '#7c3aed'
  }
}}%%
flowchart TD
    A[同一個生命數字] --> B[人A：有意識地走過來]
    B --> D[沿途累積了真實的生命經驗]`;

test("沒有圖表的貼文不變", () => {
  assert.equal(stripDiagramBlocks(POST), POST);
});

test("移除沒有程式碼框的 ---mermaid--- 與圖表語法", () => {
  assert.equal(stripDiagramBlocks(`${POST}\n\n${UNFENCED}`), POST);
});

test("移除 ```mermaid 區塊，保留其他程式碼區塊", () => {
  assert.equal(stripDiagramBlocks(`${POST}\n\n\`\`\`mermaid\nflowchart TD\n  A --> B\n\`\`\``), POST);
  assert.match(stripDiagramBlocks("前\n\n```js\nconst a = 1;\n```\n\n後"), /const a = 1/);
});

test("一般內文含箭頭或破折號的句子不被誤刪", () => {
  const text = "從 A 到 B 的路很長。\n他說：先停下來再走。";
  assert.equal(stripDiagramBlocks(text), text);
});
