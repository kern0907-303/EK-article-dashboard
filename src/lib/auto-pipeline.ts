export type PipelineBrand = "nas" | "abl" | "i8" | "erick";
export type BatchSource = "manual" | "file" | "research";
export type PipelineStatus = "pending" | "generating" | "optimizing" | "scheduled" | "manual" | "failed" | "cancelled";

export interface PipelineEntry {
  brandId: PipelineBrand | null;
  scheduledAt: string | null;
  prompt: string;
  warning: string[];
}

export const AUTO_PIPELINE_ENABLED = process.env.AUTO_PIPELINE_ENABLED === "true";
export const PIPELINE_MAX_BATCH_SIZE = 12;
export const PIPELINE_MIN_LEAD_MS = 30 * 60 * 1000;

const BRAND_ALIASES: Record<string, PipelineBrand> = {
  nas: "nas", "生命數字": "nas", "平衡空間": "nas",
  abl: "abl", "信息場調和": "abl", "量子調頻": "abl",
  i8: "i8", "企業顧問": "i8", "initial 8": "i8",
  erick: "erick", "個人品牌": "erick",
};

export function parseBrandLine(value: string): PipelineBrand | null {
  return BRAND_ALIASES[value.trim().toLowerCase()] || null;
}

function parseLocalDate(value: string): string | null {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match;
  const [year, month, day, hour, minute] = [y, mo, d, h, mi].map(Number);
  const local = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (local.getUTCFullYear() !== year || local.getUTCMonth() + 1 !== month || local.getUTCDate() !== day || hour > 23 || minute > 59) return null;
  return new Date(local.getTime() - 8 * 60 * 60 * 1000).toISOString();
}

export function parsePipelineBatch(text: string, source: BatchSource = "manual"): { entries: PipelineEntry[]; error?: string } {
  const chunks = text.split(/^\s*=====$\s*$/m).map((part) => part.trim()).filter(Boolean);
  if (chunks.length > PIPELINE_MAX_BATCH_SIZE) return { entries: [], error: `單批最多 ${PIPELINE_MAX_BATCH_SIZE} 篇，目前 ${chunks.length} 篇。` };
  const entries = chunks.map((chunk) => {
    const lines = chunk.split(/\r?\n/);
    let brandId: PipelineBrand | null = null;
    let scheduledAt: string | null = null;
    const warning: string[] = [];
    let cursor = 0;
    const brand = lines[0]?.match(/^品牌\s*[：:]\s*(.+)$/);
    if (brand) {
      brandId = parseBrandLine(brand[1]);
      cursor = 1;
      if (!brandId) warning.push("品牌名稱無法辨識");
    } else warning.push("缺少品牌");
    const date = lines[cursor]?.match(/^日期\s*[：:]\s*(.+)$/);
    if (date) {
      scheduledAt = parseLocalDate(date[1]);
      cursor += 1;
      if (!scheduledAt) warning.push("日期格式需為 YYYY-MM-DD HH:mm");
    } else warning.push("缺少日期");
    const prompt = lines.slice(cursor).join("\n").trim();
    if (!prompt) warning.push("缺少提示詞");
    return { brandId, scheduledAt, prompt, warning };
  });
  if (source !== "research" && entries.length === 0) return { entries, error: "請貼上至少一篇，篇與篇之間以單獨一行 ===== 分隔。" };
  return { entries };
}

export function applyDateRule(
  entries: PipelineEntry[],
  startDate: string,
  weekdays: number[],
  time: string,
): PipelineEntry[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{2}:\d{2}$/.test(time) || weekdays.length === 0) return entries;
  const [year, month, dateOfMonth] = startDate.split("-").map(Number);
  let day = new Date(Date.UTC(year, month - 1, dateOfMonth, 12));
  const next = entries.map((entry) => {
    if (entry.scheduledAt) return entry;
    while (!weekdays.includes(day.getUTCDay())) day = new Date(day.getTime() + 86400000);
    const date = `${day.getUTCFullYear()}-${String(day.getUTCMonth() + 1).padStart(2, "0")}-${String(day.getUTCDate()).padStart(2, "0")}`;
    const scheduledAt = parseLocalDate(`${date} ${time}`);
    day = new Date(day.getTime() + 86400000);
    return { ...entry, scheduledAt };
  });
  return next;
}

export interface PipelineStepResult { content: string; articleId?: string | null; queueId?: string | null }

export interface PipelineDependencies {
  generate(entry: PipelineEntry): Promise<string>;
  optimize(content: string, entry: PipelineEntry): Promise<string>;
  check(content: string, entry: PipelineEntry): { blocked: boolean; reason?: string };
  schedule(content: string, entry: PipelineEntry): Promise<PipelineStepResult>;
  notifyOnce(messages: string[]): Promise<void>;
}

/** 可注入依賴的序列執行器，正式 route 與整合測試共用。 */
export async function runPipelineSequentially(entries: PipelineEntry[], deps: PipelineDependencies) {
  const results: Array<{ index: number; status: PipelineStatus; content?: string; error?: string }> = [];
  const notifications: string[] = [];
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    let content = "";
    let status: PipelineStatus = "pending";
    try {
      content = await withSingleRetry(() => deps.generate(entry));
      status = "optimizing";
      content = await withSingleRetry(() => deps.optimize(content, entry));
      const check = deps.check(content, entry);
      if (check.blocked) {
        status = "manual";
        notifications.push(`第 ${index + 1} 篇需人工處理：${check.reason || "檢查未通過"}`);
        results.push({ index, status, content });
        continue;
      }
      if (!isSafeToSchedule(entry.scheduledAt)) {
        status = "manual";
        notifications.push(`第 ${index + 1} 篇需人工處理：預定時間不足 30 分鐘或未設定`);
        results.push({ index, status, content });
        continue;
      }
      await withSingleRetry(() => deps.schedule(content, entry));
      status = "scheduled";
      results.push({ index, status, content });
    } catch (error) {
      status = "failed";
      const message = error instanceof Error ? error.message : String(error);
      notifications.push(`第 ${index + 1} 篇失敗：${message}`);
      results.push({ index, status, content: content || undefined, error: message });
    }
  }
  if (notifications.length) await deps.notifyOnce(notifications);
  return results;
}

async function withSingleRetry<T>(action: () => Promise<T>): Promise<T> {
  try { return await action(); }
  catch (firstError) {
    try { return await action(); }
    catch (secondError) {
      const reason = secondError instanceof Error ? secondError.message : String(secondError);
      throw new Error(reason || (firstError instanceof Error ? firstError.message : String(firstError)));
    }
  }
}

export function isSafeToSchedule(scheduledAt: string | null, now = Date.now()): boolean {
  if (!scheduledAt) return false;
  const lead = new Date(scheduledAt).getTime() - now;
  return Number.isFinite(lead) && lead >= PIPELINE_MIN_LEAD_MS;
}

export function scheduleContractAllowed(source: string, articleId: unknown): boolean {
  return source === "auto_pipeline" ? articleId === null || articleId === undefined || String(articleId).trim() === "" : typeof articleId === "string" && articleId.trim().length > 0;
}

export function shouldPostFirstComment(articleId: string | null): boolean {
  return typeof articleId === "string" && articleId.trim().length > 0;
}

export function shouldDispatchQueueRow(row: { is_test?: boolean | null; status?: string; scheduled_at?: string }, now = Date.now()): boolean {
  return row.status === "pending" && row.is_test !== true && (!row.scheduled_at || new Date(row.scheduled_at).getTime() <= now);
}

export function shouldCancelQueueRow(row: { source?: string | null; status?: string }): boolean {
  return row.source === "auto_pipeline" && row.status === "pending";
}

export function buildAutoPipelineQueueRecord(input: {
  brand_id: PipelineBrand; target_pages: string[]; content: string; scheduled_at: string; is_test?: boolean;
}) {
  return {
    ...input,
    image_url: null,
    article_id: null,
    source: "auto_pipeline" as const,
    is_test: input.is_test === true,
    status: "pending" as const,
    results: [],
    test_mode: false,
  };
}

export function executorPlan(row: { article_id: string | null; source?: string; is_test?: boolean; status?: string }) {
  if (row.status !== "sending" || row.is_test === true) return { publishPhoto: false, postFirstComment: false };
  return { publishPhoto: true, postFirstComment: shouldPostFirstComment(row.article_id) };
}

export function cancelOwnedPipelineRows<T extends { source?: string | null; status?: string }>(rows: T[]): T[] {
  return rows.filter(shouldCancelQueueRow);
}

export function isAutoPipelineEnabled(value: string | undefined = process.env.AUTO_PIPELINE_ENABLED): boolean {
  return value === "true";
}
