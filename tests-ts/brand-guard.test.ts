import { findTextMismatch, scanChatPayload, detectBrandSignals, describeMismatch } from "../src/lib/brand-guard";
let pass = 0, fail = 0;
const t = (name: string, cond: boolean) => { cond ? pass++ : fail++; console.log(`${cond ? "✓" : "✗"} ${name}`); };

t("I8 底下寫 NAS 生命數字 → 攔", findTextMismatch("幫我寫一篇 NAS 生命數字的貼文", "i8", "指令")?.found === "nas");
t("NAS 底下寫 I8 企業醫生 → 攔", findTextMismatch("I8 企業醫生診斷的案例", "nas", "指令")?.found === "i8");
t("ABL 底下寫量子調頻 → 不攔", findTextMismatch("ABL 量子調頻的狀態分析", "abl", "指令") === null);
t("兩個品牌都提到（導流、比較）→ 不攔", findTextMismatch("NAS 看自己，I8 看企業，兩者互補", "nas", "指令") === null);
t("沒提任何品牌 → 不攔", findTextMismatch("為什麼努力卻沒有結果", "i8", "指令") === null);
t("空字串 → 不攔", findTextMismatch("", "i8", "指令") === null);
t("NASA 不算 NAS", detectBrandSignals("NASA 登月").nas.length === 0);
t("中文夾英文的 NAS 要認得", detectBrandSignals("我的NAS很好用").nas.length === 1);
t("單獨出現 Erick 不算 Erick 個人品牌（作者名每個品牌都會出現）", detectBrandSignals("Erick 老師說").erick.length === 0);
t("ABL 底下提到 Erick 個人品牌 → 攔", findTextMismatch("請導向 Erick 個人品牌的諮詢", "abl", "指令")?.found === "erick");
t("提醒文字包含來源與兩個品牌名", (() => { const d = describeMismatch(findTextMismatch("NAS 生命數字", "i8", "主張")!); return d.includes("主張") && d.includes("NAS") && d.includes("I8"); })());

t("scan：最後一則使用者訊息錯置 → 攔並標示來源", scanChatPayload({ history: [{ role: "user", content: "你好" }, { role: "user", content: "寫 ABL 量子調頻文案" }] }, "i8")?.source === "你的指令");
t("scan：只看最後一則使用者訊息，舊訊息不算", scanChatPayload({ history: [{ role: "user", content: "寫 ABL 量子調頻文案" }, { role: "assistant", content: "好" }, { role: "user", content: "改短一點" }] }, "i8") === null);
t("scan：文體主張錯置", scanChatPayload({ genre: { settings: { claim: "NAS 生命數字讓你看懂自己", material: "" } } }, "i8")?.source === "主張");
t("scan：改寫原文錯置", scanChatPayload({ prevData: { social_copy: "平衡空間今天要談關係" } }, "abl")?.source === "要改寫的原文");
t("scan：舊品牌規範殘留 → 攔", scanChatPayload({ brandGuidelines: "【NAS 平衡空間 品牌規範】…" }, "i8")?.source === "品牌規範");
t("scan：規範後段提到其他品牌不算", scanChatPayload({ brandGuidelines: "【I8 企業醫生 規範】" + "x".repeat(700) + "NAS 生命數字" }, "i8") === null);
t("scan：什麼都沒有 → null", scanChatPayload({}, "nas") === null);
console.log(`\n結果: ${pass} 通過 / ${fail} 失敗`);
process.exit(fail ? 1 : 0);
