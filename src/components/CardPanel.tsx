"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";

type CardImage = { slide: number; url: string };

/** IG 衍生稿的圖卡區：按鈕生成、顯示縮圖、點開看原圖。不會自動生成，也不會排程或發佈。 */
export default function CardPanel({ post, onUpdated }: { post: any; onUpdated?: (row: any) => void }) {
  const [busy, setBusy] = useState<"" | "color" | "scene">("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [images, setImages] = useState<CardImage[] | null>(null);
  const shown: CardImage[] = images ?? (Array.isArray(post?.check_results?.card_images) ? post.check_results.card_images : []);

  const generate = async (background: "color" | "scene") => {
    setBusy(background); setError(""); setNote("");
    try {
      const response = await fetch("/api/derivatives/cards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: post.id, background }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      setImages(data.card_images || []);
      if (data.note) setNote(data.note);
      if (data.row) onUpdated?.(data.row);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "生成圖卡失敗");
    } finally { setBusy(""); }
  };

  return <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold text-slate-200">IG 圖卡（4:5，每張一句）</span>
      <Button size="sm" variant="secondary" loading={busy === "color"} disabled={!!busy} onClick={() => void generate("color")} title="品牌色底，不花生圖額度">{busy === "color" ? "生成中..." : shown.length ? "重新生成（品牌色底）" : "生成圖卡（品牌色底）"}</Button>
      <Button size="sm" variant="ghost" loading={busy === "scene"} disabled={!!busy} onClick={() => void generate("scene")} title="另外生成一張情境圖當底圖，會用到 OpenAI 額度，約需 1 分鐘">{busy === "scene" ? "生成中，約 1 分鐘..." : "加情境底圖重新生成"}</Button>
    </div>
    {error && <p className="mt-2 rounded bg-rose-950/40 p-2 text-xs text-rose-200">{error}</p>}
    {note && <p className="mt-2 rounded bg-amber-950/40 p-2 text-xs text-amber-100">{note}</p>}
    {shown.length > 0 && <>
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
        {shown.map((item) => <a key={item.slide} href={item.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border border-slate-700" title={`第 ${item.slide} 張，點開看原圖，長按或右鍵可儲存`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.url} alt={`圖卡第 ${item.slide} 張`} loading="lazy" className="aspect-[4/5] w-full object-cover" />
        </a>)}
      </div>
      <p className="mt-2 text-[11px] text-slate-400">點圖開啟原圖，電腦按右鍵、手機長按即可儲存。文字有要改，先改上面的稿再按重新生成。</p>
    </>}
  </div>;
}
