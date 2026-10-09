import { readFileSync } from "node:fs";
import { callErickCOO } from "../src/lib/ai-provider";
import { friendlyLeonError, hasUsableSocialCopy, isSocialCopyPlaceholder, LEON_GENERATION_OPTIONS } from "../src/lib/expert-routing";

let pass = 0;
let fail = 0;
const t = (name: string, condition: boolean) => {
  condition ? pass++ : fail++;
  console.log(`${condition ? "✓" : "✗"} ${name}`);
};

const source = (path: string) => readFileSync(path, "utf8");
const chatBox = source("src/components/ChatBox.tsx");
const workspace = source("src/components/WorkspaceBoard.tsx");
const provider = source("src/lib/ai-provider.ts");
const route = source("src/app/api/chat/route.ts");
const pipelineTick = source("src/app/api/auto-pipeline/tick/route.ts");

t("Leon 使用較大輸出上限與 120 秒逾時", LEON_GENERATION_OPTIONS.maxTokens >= 12000 && LEON_GENERATION_OPTIONS.timeoutMs === 120000);
t("空白社群文案不可生成網頁架構", !hasUsableSocialCopy("   "));
t("錯誤佔位社群文案不可生成網頁架構", !hasUsableSocialCopy("❌ Maya 生成失敗"));
t("一般社群文案可作為網頁架構依據", hasUsableSocialCopy("這是一篇足夠長的社群文案，會交給 Leon 作為網頁主題與內容的唯一來源。"));
t("短文案只要非空也可作為生成依據", hasUsableSocialCopy("短文案"));
t("社群文案錯誤字串可辨識為佔位", isSocialCopyPlaceholder("❌ Maya 失敗"));
t("Leon 長度截斷錯誤轉為友善訊息", friendlyLeonError("finish_reason=max_tokens") === "網頁內容過長被截斷，請再試一次");

t("ChatBox 不再自動呼叫 leon_jack", !chatBox.includes('expertType: "leon_jack"'));
t("ChatBox 自動流程單獨呼叫 Jack", chatBox.includes('expertType: "jack"') && chatBox.includes("await runJack(prevData)"));
t("新任務清空網頁架構，不寫 Leon 生成中佔位", chatBox.includes('web_architecture: ""') && !chatBox.includes("Leon 正在設計網頁功能路由架構"));
t("Maya/Iris 失敗只更新社群文案與 SEO，不覆蓋網頁架構", /social_copy:\s*`❌[^`]*`[\s\S]*?seo_keywords:/.test(chatBox) && !/social_copy:\s*`❌[^`]*`[\s\S]{0,250}web_architecture:/.test(chatBox));
t("Jack 失敗只更新廣告數據", /ad_data:\s*\[[\s\S]*?Jack 產出失敗/.test(chatBox) && !/Jack 產出失敗[\s\S]{0,180}web_architecture:/.test(chatBox));
t("手機專家失敗訊息指向看板分頁", chatBox.includes('請到「看板」分頁查看紅字錯誤訊息'));
t("專家失敗提示在完成時即時依 viewport 判斷", chatBox.includes('window.matchMedia("(max-width: 639px)").matches'));

t("API 對 leon 與 jack 各有獨立路由", provider.includes('expertType === "leon"') && provider.includes('expertType === "jack"'));
t("舊 leon_jack 路徑仍保留向下相容", provider.includes('expertType === "leon_jack"'));
t("Leon 分支傳遞 12000 tokens 與 120 秒設定", /expertType === "leon"[\s\S]*?LEON_GENERATION_OPTIONS/.test(provider));
t("各供應商使用共用 maxTokens 選項", provider.includes("requestBody.max_completion_tokens = opts.maxTokens") && provider.includes("generationConfig.maxOutputTokens = opts.maxTokens") && provider.includes("max_tokens: opts?.maxTokens || 4000"));
t("OpenAI 與 Gemini 逾時採用呼叫選項", (provider.match(/getTimeoutSignal\(opts\?\.timeoutMs \|\| 60000\)/g) || []).length >= 3);
t("Leon 提示詞最多五個區塊並以社群文案為唯一依據", provider.includes("最多 5 個主要區塊") && provider.includes("這是唯一內容依據"));
t("沒有文章時 API 在模型呼叫前回傳明確錯誤", route.indexOf('expertType === "leon"') < route.indexOf("await callErickCOO(") && route.includes("請先生成社群文案，再生成網頁架構。"));
t("需要來源文章的檢查可由共用 helper 使用", route.includes("hasUsableSocialCopy(prevData?.social_copy)"));

t("自動流水線仍只呼叫 Maya/Iris，未改走 Leon", pipelineTick.includes('"maya_iris"') && !pipelineTick.includes('"leon_jack"') && !pipelineTick.includes('"leon"'));
t("網頁架構空狀態提供需要時生成按鈕", workspace.includes("尚未生成網頁架構") && workspace.includes("生成網頁架構") && workspace.includes("需要時再生成"));
t("沒有社群文案時生成按鈕停用並提示", workspace.includes("disabled={!canGenerate || isGenerating}") && workspace.includes("請先生成社群文案"));
t("網頁架構提供生成經過秒數與取消", workspace.includes("已經過 {elapsedSeconds} 秒") && workspace.includes("cancelArchitectureGeneration"));
t("網頁架構生成失敗提供重試與錯誤原因", workspace.includes("網頁架構生成失敗") && workspace.includes("重試") && workspace.includes("{architectureError}"));
t("生成結果沿用 saveWorkspace 並可重新生成確認", workspace.includes("saveWorkspace(brandId, { web_architecture: html })") && workspace.includes("重新生成會取代目前的網頁架構"));
t("社群文案空白或錯誤時顯示明確原因", workspace.includes("社群文案生成失敗") && workspace.includes("社群文案尚未生成") && workspace.includes("重送指令"));
t("手機發布至官網按鈕至少 44px 且不收縮", workspace.includes("max-sm:min-h-11 max-sm:shrink-0"));

async function runMockEndpointContracts() {
  let missingArticleError = "";
  try {
    await callErickCOO([], "Erick 個人品牌", "mock", "expert", "leon", {}, "", { social_copy: "" });
  } catch (error) {
    missingArticleError = error instanceof Error ? error.message : String(error);
  }
  t("mock Leon 無文章時清楚拒絕且不回空結果", missingArticleError.includes("請先生成社群文案"));

  const leon = await callErickCOO([], "Erick 個人品牌", "mock", "expert", "leon", {}, "", {
    social_copy: "這是一篇足夠長的社群文案，作為 Landing Page 的主題依據，測試獨立生成契約。",
  });
  t("mock Leon 獨立呼叫只回傳網頁架構", typeof leon.dispatchData?.web_architecture === "string" && !("ad_data" in (leon.dispatchData || {})));

  const jack = await callErickCOO([], "Erick 個人品牌", "mock", "expert", "jack", {}, "", {});
  t("mock Jack 獨立呼叫只回傳廣告資料", Array.isArray(jack.dispatchData?.ad_data) && !("web_architecture" in (jack.dispatchData || {})));

  const envKeys = ["OPENAI_API_KEY", "GEMINI_API_KEY", "ANTHROPIC_API_KEY", "AI_PROVIDER"] as const;
  const priorEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  const priorFetch = globalThis.fetch;
  let requestBody: any = null;
  try {
    process.env.OPENAI_API_KEY = "sk-test-only";
    delete process.env.GEMINI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    process.env.AI_PROVIDER = "openai";
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"web_architecture":"<section>預覽</section>"}' }, finish_reason: "stop" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;
    const liveContract = await callErickCOO([], "Erick 個人品牌", "openai", "expert", "leon", {}, "", {
      social_copy: "這是一篇足夠長的社群文案，作為 Landing Page 的主題依據，測試實際輸出 token 上限。",
    });
    t("OpenAI Leon 呼叫實際送出 12000 max_completion_tokens", requestBody?.max_completion_tokens === 12000);
    t("OpenAI Leon 成功時回傳網頁架構", liveContract.dispatchData?.web_architecture === "<section>預覽</section>");
  } finally {
    globalThis.fetch = priorFetch;
    for (const key of envKeys) {
      if (priorEnv[key] === undefined) delete process.env[key];
      else process.env[key] = priorEnv[key];
    }
  }
}

runMockEndpointContracts().then(() => {
  console.log(`\n結果: ${pass} 通過 / ${fail} 失敗`);
  process.exit(fail ? 1 : 0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
