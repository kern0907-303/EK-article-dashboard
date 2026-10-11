// 瀏覽器端：建立本機 ComfyUI 生圖工作並等待完成。只在使用者按下按鈕後才會輪詢，完成、失敗或取消就停。

export type ComfyProgress = { status: string; workerOnline: boolean; jobId: string };
export type ComfyResult = { jobId: string; url: string };

const POLL_MS = 4000;
const MAX_WAIT_MS = 20 * 60 * 1000;

export async function runComfyJob(
  input: { brandId: string; sizeKey: string; purpose: "card" | "article" },
  onProgress: (p: ComfyProgress) => void,
  signal?: AbortSignal,
): Promise<ComfyResult> {
  const created = await fetch("/api/image-jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), signal });
  const createdData = await created.json().catch(() => ({}));
  if (!created.ok || !createdData.job) throw new Error(createdData.error || `建立生圖工作失敗（HTTP ${created.status}）`);
  const jobId: string = createdData.job.id;
  onProgress({ status: createdData.job.status, workerOnline: Boolean(createdData.workerOnline), jobId });

  const started = Date.now();
  while (Date.now() - started < MAX_WAIT_MS) {
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    if (signal?.aborted) throw new Error("已取消");
    const res = await fetch(`/api/image-jobs?id=${encodeURIComponent(jobId)}`, { cache: "no-store", signal });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.job) throw new Error(data.error || `查詢進度失敗（HTTP ${res.status}）`);
    onProgress({ status: data.job.status, workerOnline: Boolean(data.workerOnline), jobId });
    if (data.job.status === "done" && data.job.result_url) return { jobId, url: data.job.result_url };
    if (data.job.status === "failed") throw new Error(data.job.error || "Mac mini 生圖失敗");
    if (data.job.status === "cancelled") throw new Error("已取消");
  }
  throw new Error("等待超過 20 分鐘，已停止等待。Mac mini 開機後仍會補做，可到工作表查看。");
}

export async function cancelComfyJob(jobId: string): Promise<void> {
  await fetch(`/api/image-jobs?id=${encodeURIComponent(jobId)}`, { method: "DELETE" }).catch(() => undefined);
}

/** 給畫面顯示的等待說明 */
export function comfyWaitText(p: ComfyProgress | null): string {
  if (!p) return "";
  if (p.status === "running") return "Mac mini 生成中，通常不到 1 分鐘…";
  if (!p.workerOnline) return "Mac mini 目前沒有回應（可能沒開機或程式沒開）。已排隊，開機後會自動補做，你也可以先取消，改用品牌色底。";
  return "已送給 Mac mini，等它領單…";
}
