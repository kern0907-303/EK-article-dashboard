import {
  applyDateRule,
  parsePipelineBatch,
  scheduleContractAllowed,
  shouldCancelQueueRow,
  shouldDispatchQueueRow,
  runPipelineSequentially,
  isSafeToSchedule,
  shouldPostFirstComment,
  buildAutoPipelineQueueRecord,
  executorPlan,
  cancelOwnedPipelineRows,
  isAutoPipelineEnabled,
} from "../src/lib/auto-pipeline";

let pass = 0, fail = 0;
const t = (name: string, ok: boolean) => { ok ? pass++ : fail++; console.log(`${ok ? "✓" : "✗"} ${name}`); };
const parsed = parsePipelineBatch("品牌：NAS\n日期：2026-12-01 10:00\n第一篇提示詞\n=====\n品牌：ABL\n第二篇提示詞");
t("解析品牌、日期與提示詞", parsed.entries.length === 2 && parsed.entries[0].brandId === "nas" && parsed.entries[0].scheduledAt !== null && parsed.entries[1].brandId === "abl");
t("缺日期可以預覽並顯示警示", parsed.entries[1].scheduledAt === null && parsed.entries[1].warning.includes("缺少日期"));
t("缺品牌保留警示", parsePipelineBatch("日期：2026-12-01 10:00\n提示詞").entries[0].warning.includes("缺少品牌"));
t("超過 12 篇拒絕", parsePipelineBatch(Array.from({ length: 13 }, (_, i) => `品牌：NAS\n文案${i}`).join("\n=====\n")).error?.includes("最多 12 篇") === true);
const dated = applyDateRule(parsed.entries, "2026-10-07", [1, 3, 5], "10:30");
t("日期規則依指定星期遞增", !!dated[1].scheduledAt?.startsWith("2026-10-07T02:30") && dated[0].scheduledAt === parsed.entries[0].scheduledAt);
t("排程需至少 30 分鐘", isSafeToSchedule(new Date(Date.now() + 31 * 60_000).toISOString()) && !isSafeToSchedule(new Date(Date.now() + 29 * 60_000).toISOString()));
t("manual 仍強制 articleId", scheduleContractAllowed("manual", "article-1") && !scheduleContractAllowed("manual", null));
t("manual articleId 仍會產生第一則官網連結留言", shouldPostFirstComment("article-1"));
t("auto_pipeline 無 articleId 時略過第一則留言", !shouldPostFirstComment(null));
t("AUTO_PIPELINE_ENABLED 預設 false", !isAutoPipelineEnabled(undefined));
t("流水線可沒有 articleId", scheduleContractAllowed("auto_pipeline", null));
t("測試排程不進派發", !shouldDispatchQueueRow({ status: "pending", is_test: true }) && shouldDispatchQueueRow({ status: "pending", is_test: false }));
t("取消只允許流水線待發列", shouldCancelQueueRow({ source: "auto_pipeline", status: "pending" }) && !shouldCancelQueueRow({ source: "manual", status: "pending" }));

const run = async () => {
  const order: string[] = [];
  const runnerEntries = [parsed.entries[0], { ...parsed.entries[1], scheduledAt: new Date(Date.now() + 2 * 60 * 60_000).toISOString() }];
  let generationCalls = 0;
  let retryNotifications: string[][] = [];
  const results = await runPipelineSequentially(runnerEntries, {
    generate: async (_entry) => { order.push("generate"); generationCalls++; if (generationCalls === 1) throw new Error("temporary"); return "草稿內容"; },
    optimize: async (content) => { order.push("optimize"); return `${content} 已優化`; },
    check: () => ({ blocked: false }),
    schedule: async () => { order.push("schedule"); return { content: "", queueId: "q" }; },
    notifyOnce: async (messages) => { retryNotifications.push(messages); },
  });
  t("依序生成、優化、排程，重試一次後兩篇成功", results.every((r) => r.status === "scheduled") && generationCalls === 3 && order.join(",") === "generate,generate,optimize,schedule,generate,optimize,schedule");

  retryNotifications = [];
  let scheduled = false;
  const blocked = await runPipelineSequentially([parsed.entries[0]], {
    generate: async () => "草稿", optimize: async () => "含禁用詞", check: () => ({ blocked: true, reason: "禁用詞" }),
    schedule: async () => { scheduled = true; return { content: "" }; }, notifyOnce: async (messages) => { retryNotifications.push(messages); },
  });
  t("禁用詞阻擋不排程且通知合併呼叫一次", blocked[0].status === "manual" && !scheduled && retryNotifications.length === 1);

  let failures = 0;
  retryNotifications = [];
  const failed = await runPipelineSequentially(runnerEntries, {
    generate: async () => { failures++; throw new Error("實際生成錯誤"); }, optimize: async (x) => x, check: () => ({ blocked: false }), schedule: async () => ({ content: "" }),
    notifyOnce: async (messages) => { retryNotifications.push(messages); },
  });
  t("失敗重試一次且第二篇照跑、通知批次合併", failed.length === 2 && failures === 4 && failed.every((r) => r.status === "failed") && retryNotifications.length === 1 && retryNotifications[0].length === 2 && retryNotifications[0].every((message) => message.includes("實際生成錯誤")));
  // 模擬 Supabase 與執行器的整合，不建立任何網路請求或粉專副作用。
  const mockQueue: any[] = [];
  mockQueue.push(buildAutoPipelineQueueRecord({ brand_id: "nas", target_pages: ["fb_nas"], content: "測試草稿", scheduled_at: new Date(Date.now() + 60 * 86400000).toISOString() }));
  mockQueue.push({ article_id: "manual-article", source: "manual", status: "sending", is_test: false });
  const autoPlan = executorPlan({ ...mockQueue[0], status: "sending" });
  const manualPlan = executorPlan(mockQueue[1]);
  t("模擬資料庫接受無 article_id 的 auto_pipeline 排程", mockQueue[0].article_id === null && mockQueue[0].source === "auto_pipeline" && mockQueue[0].test_mode === false);
  t("模擬發文執行器發社群但略過空 article_id 留言", autoPlan.publishPhoto && !autoPlan.postFirstComment);
  t("模擬執行器 manual 行為保留粉專貼文與第一則留言", manualPlan.publishPhoto && manualPlan.postFirstComment);
  const cancelled = cancelOwnedPipelineRows(mockQueue);
  t("模擬取消只會撤回 auto_pipeline 自己的待發列", cancelled.length === 1 && cancelled[0].source === "auto_pipeline");
  t("is_test=true 的到期列不會進派發流程", !shouldDispatchQueueRow({ status: "pending", is_test: true, scheduled_at: new Date(Date.now() - 1000).toISOString() }));
  console.log(`\n結果: ${pass} 通過 / ${fail} 失敗`);
  process.exit(fail ? 1 : 0);
};
void run();
