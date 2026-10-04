import { extractProtected, restoreProtected } from "../src/lib/protect-blocks";
import { stripMarkdown } from "../src/lib/plain-text";
let pass = 0, fail = 0;
const t = (name: string, cond: boolean) => { cond ? pass++ : fail++; console.log(`${cond ? "✓" : "✗"} ${name}`); };

const mer = "```mermaid\n%%{init: {'theme':'base'}}%%\ngraph TD\n  A --> B\n  B --- C\n```";
const orig = `標題\n\n第一段內容。\n\n${mer}\n\n第二段內容。\n\n![圖](https://example.com/a.png)\n\n結尾。`;
const p = extractProtected(orig);
t("抽出 2 個區塊", p.blocks.length === 2);
t("送給 AI 的文字不含反引號與圖片語法", !p.text.includes("```") && !p.text.includes("!["));
t("佔位標記各自單獨一行", /\n【保留區塊1】\n/.test(p.text) && /\n【保留區塊2】\n/.test(p.text));

// AI 原樣保留標記 → 完整還原
const kept = restoreProtected(stripMarkdown(p.text), p);
t("標記保留時完整還原 mermaid", kept.includes(mer));
t("標記保留時完整還原圖片", kept.includes("![圖](https://example.com/a.png)"));
t("mermaid 內容沒被 stripMarkdown 破壞", kept.includes("A --> B") && kept.includes("B --- C"));

// AI 刪掉標記 → 依相對位置補回，不會消失
const lost = restoreProtected("新標題\n\n改寫後第一段。\n\n改寫後第二段。\n\n改寫後結尾。", p);
t("標記被刪掉仍補回圖表", lost.includes(mer) && lost.includes("![圖]("));
t("補回的圖表不在最前面", !lost.startsWith("```") && lost.indexOf("新標題") === 0);

// 沒有區塊 → 原樣
const plain = extractProtected("只有文字。");
t("無區塊時不變", plain.blocks.length === 0 && restoreProtected("只有文字。", plain) === "只有文字。");
console.log(`\n結果: ${pass} 通過 / ${fail} 失敗`);
process.exit(fail ? 1 : 0);
