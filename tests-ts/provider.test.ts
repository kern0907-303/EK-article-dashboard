import { resolveProvider, getAIConfig } from "../src/lib/ai-provider";
let pass = 0, fail = 0;
const t = (name: string, cond: boolean) => { cond ? pass++ : fail++; console.log(`${cond ? "✓" : "✗"} ${name}`); };

let c = getAIConfig(); const base = c.model;
t("純 openai 不改模型", resolveProvider(c, "openai") === "openai" && c.model === base);
c = getAIConfig();
t("openai:gpt-6.1-sol 拆出廠商與模型", resolveProvider(c, "openai:gpt-6.1-sol") === "openai" && c.model === "gpt-6.1-sol");
c = getAIConfig();
t("openai:gpt-6-luna", resolveProvider(c, "openai:gpt-6-luna") === "openai" && c.model === "gpt-6-luna");
c = getAIConfig();
t("不合法的模型名稱被忽略", resolveProvider(c, "openai:bad model;x") === "openai" && c.model === base);
c = getAIConfig();
t("其他廠商不受影響", resolveProvider(c, "gemini") === "gemini" && c.model === base);
c = getAIConfig();
t("沒指定時用環境預設", resolveProvider(c, undefined) === c.provider);
console.log(`\n結果: ${pass} 通過 / ${fail} 失敗`);
process.exit(fail ? 1 : 0);
