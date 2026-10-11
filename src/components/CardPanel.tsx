"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { CARD_SIZES, DEFAULT_CARD_SIZE } from "@/lib/card-layout.mjs";
import { cancelComfyJob, comfyWaitText, runComfyJob, type ComfyProgress } from "@/lib/image-jobs-client";

type CardImage = { slide: number; url: string };

/** IG 衍生稿的圖卡區：按鈕生成、顯示縮圖、點開看原圖。不會自動生成，也不會排程或發佈。 */
export default function CardPanel({ post, onUpdated }: { post: any; onUpdated?: (row: any) => void }) {
  const [busy, setBusy] = useState<"" | "color" | "scene" | "comfy">("");
  const [sizeKey, setSizeKey] = useState<string>(DEFAULT_CARD_SIZE);
  const [progress, setProgress] = useState<ComfyProgress | null>(null);
  const [abort, setAbort] = useState<AbortController | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [images, setImages] = useState<CardImage[] | null>(null);
  const shown: CardImage[] = images ?? (Array.isArray(post?.check_results?.card_images) ? post.check_results.card_images : []);

  const generate = async (background: "color" | "scene" | "comfy") => {
    setBusy(background); setError(""); setNote(""); setProgress(null);
    const controller = new AbortController();
    try {
      let jobId = "";
      if (background === "comfy") {
        setAbort(controller);
        const result = await runComfyJob({ brandId: post.parent_brand_id, sizeKey, purpose: "card" }, setProgress, controller.signal);
        jobId = result.jobId;
      }
      const response = await fetch("/api/derivatives/cards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: post.id, background, size: sizeKey, ...(jobId ? { jobId } : {}) }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      setImages(data.card_images || []);
      if (data.note) setNote(data.note);
      if (data.row) onUpdated?.(data.row);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "生成圖卡失敗");
    } finally { setBusy(""); setProgress(null); setAbort(null); }
  };

  const cancel = () => {
    if (progress?.jobId) void cancelComfyJob(progress.jobId);
    abort?.abort();
  };

  return <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold text-slate-200">圖卡（每張一句）</span>
      <select value={sizeKey} onChange={(e) => setSizeKey(e.target.value)} disabled={!!busy} className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200" aria-label="圖卡尺寸">
        {Object.entries(CARD_SIZES).map(([key, item]) => <option key={key} value={key}>{(item as { label: string }).label}</option>)}
      </select>
      <Button size="sm" variant="secondary" loading={busy === "color"} disabled={!!busy} onClick={() => void generate("color")} title="品牌色底，不花生圖額度">{busy === "color" ? "生成中..." : shown.length ? "重新生成（品牌色底）" : "生成圖卡（品牌色底）"}</Button>
      <Button size="sm" variant="ghost" loading={busy === "scene"} disabled={!!busy} onClick={() => void generate("scene")} title="另外生成一張情境圖當底圖，會用到 OpenAI 額度，約需 1 分鐘">{busy === "scene" ? "生成中，約 1 分鐘..." : "加情境底圖重新生成"}</Button>
      <Button size="sm" variant="ghost" loading={busy === "comfy"} disabled={!!busy} onClick={() => void generate("comfy")} title="用你 Mac mini 上的 ComfyUI 生底圖，免費；Mac mini 要開機">{busy === "comfy" ? "本機生成中..." : "本機 ComfyUI 底圖（免費）"}</Button>
      {busy === "comfy" && <Button size="sm" variant="ghost" onClick={cancel}>取消</Button>}
    </div>
    {busy === "comfy" && progress && <p className="mt-2 rounded bg-slate-800/60 p-2 text-xs text-slate-200">{comfyWaitText(progress)}</p>}
    {CARD_SIZES[sizeKey as keyof typeof CARD_SIZES] && !(CARD_SIZES[sizeKey as keyof typeof CARD_SIZES] as { official: boolean }).official && <p className="mt-2 text-[11px] text-amber-200/80">這個尺寸的上下留白是保守值（Meta 官方只給原則，沒有像素數字）。</p>}
    {error && <p className="mt-2 rounded bg-rose-950/40 p-2 text-xs text-rose-200">{error}</p>}
    {note && <p className="mt-2 rounded bg-amber-950/40 p-2 text-xs text-amber-100">{note}</p>}
    {shown.length > 0 && <>
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
        {shown.map((item) => <a key={item.slide} href={item.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border border-slate-700" title={`第 ${item.slide} 張，點開看原圖，長按或右鍵可儲存`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.url} alt={`圖卡第 ${item.slide} 張`} loading="lazy" className="w-full object-cover" />
        </a>)}
      </div>
      <p className="mt-2 text-[11px] text-slate-400">點圖開啟原圖，電腦按右鍵、手機長按即可儲存。文字有要改，先改上面的稿再按重新生成。</p>
    </>}
  </div>;
}
