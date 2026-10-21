"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface Row { id: string; brand: string; title: string; scheduledAt: string | null; jobStatus: string; fb: { state: string }; website: { state: string }; instagram: { state: string }; threads: { state: string }; }
interface Plat { exists: boolean; status: string; title?: string; text: string; scheduledAt: string | null; slides?: number; error?: string | null; limit?: number; queueRowId?: string }
interface Detail { jobId: string; brand: string; scheduledAt: string | null; fbQueueId: string | null; fb: Plat; website: Plat; instagram: Plat; threads: Plat }

const BRAND_NAME: Record<string, string> = { nas: "NAS", abl: "ABL", i8: "I8", erick: "Erick" };
const STATUS_TEXT: Record<string, string> = { pending: "排程中", sending: "發送中", sent: "已發佈", failed: "失敗", published: "已上線", draft: "草稿", none: "尚無草稿", partial: "部分失敗" };
const TAIPEI = 8 * 3600 * 1000;
function when(iso: string | null) {
  if (!iso) return "未排時間";
  const d = new Date(new Date(iso).getTime() + TAIPEI);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** 多平台衍生：從自動流水線直接選 FB 主稿，四個平台並排看。不依賴 LocalStorage 匯入。 */
export default function PipelineDerivatives() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const loadRows = useCallback(async () => {
    try {
      const res = await fetch("/api/pipeline-timeline", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "讀取失敗");
      setRows((data.rows || []).filter((row: Row) => row.brand !== "erick")); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "讀取失敗"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void loadRows(); }, [loadRows]);

  const loadDetail = useCallback(async (id: string) => {
    setSelected(id); setDetailLoading(true); setDetail(null);
    try {
      const res = await fetch(`/api/pipeline-timeline/detail?id=${encodeURIComponent(id)}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "讀取失敗");
      setDetail(data.detail);
    } catch (e) { setNotice(e instanceof Error ? e.message : "讀取失敗"); }
    finally { setDetailLoading(false); }
  }, []);

  const missing = (row: Row) => [row.website, row.instagram, row.threads].some((cell) => cell.state === "none");
  const visible = useMemo(() => rows.filter((row) => !onlyMissing || missing(row)), [rows, onlyMissing]);

  const fillMissing = async () => {
    if (!detail?.fbQueueId) return;
    if (!window.confirm("要為這一篇補做官網文章、IG 輪播與 Threads 嗎？會真的產生並排程，約需 2 分鐘。")) return;
    setBusy(true); setNotice("補齊中，約 2 分鐘，請不要關閉這個頁面…");
    try {
      const res = await fetch("/api/auto-pipeline/backfill", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: 1, queueId: detail.fbQueueId }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "補齊失敗");
      setNotice(data.processed ? `完成：${data.done?.[0]?.step || ""}` : "這一篇不符合補齊條件（可能已有草稿，或發佈時間太近）。");
      await loadDetail(detail.jobId); await loadRows();
    } catch (e) { setNotice(e instanceof Error ? e.message : "補齊失敗"); }
    finally { setBusy(false); }
  };
  const cancelSocial = async (plat: Plat) => {
    if (!plat.queueRowId || !window.confirm("確定取消這個平台的排程？")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/social-queue", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: plat.queueRowId, action: "cancel" }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "取消失敗");
      setNotice("已取消。"); if (detail) await loadDetail(detail.jobId); await loadRows();
    } catch (e) { setNotice(e instanceof Error ? e.message : "取消失敗"); }
    finally { setBusy(false); }
  };

  const col = (name: string, plat: Plat, canCancel: boolean) => {
    const over = plat.limit && plat.text.length > plat.limit;
    const tone = !plat.exists ? "border-dashed border-white/30" : plat.status === "failed" || over ? "border-2 border-rose-400" : plat.status === "sent" || plat.status === "published" ? "border-emerald-400/50" : "border-white/20";
    return (
      <div className={`flex min-w-0 flex-col gap-2 rounded-xl border bg-white/5 p-3 ${tone}`}>
        <div className="flex items-center justify-between gap-2"><b className="text-sm">{name}</b><span className="rounded border border-white/30 px-2 py-0.5 text-xs font-semibold">{STATUS_TEXT[plat.status] || plat.status}</span></div>
        {plat.title && <div className="text-xs font-semibold text-slate-200">{plat.title}</div>}
        {plat.exists ? (
          <>
            <div className="max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-900 p-2 text-xs leading-6 text-slate-200">{plat.text || "（沒有內容）"}</div>
            <div className="text-xs text-slate-400">{when(plat.scheduledAt)}　{plat.text.length} 字{plat.limit ? ` / 上限 ${plat.limit}` : ""}{plat.slides ? `　${plat.slides} 張圖` : ""}</div>
            {over && <div className="text-xs font-bold text-rose-300">超過字數上限</div>}
            {plat.error && <div className="text-xs font-semibold text-rose-300">{plat.error}</div>}
            {canCancel && plat.status === "pending" && <button disabled={busy} onClick={() => void cancelSocial(plat)} className="min-h-[44px] rounded-lg border border-rose-400/40 text-sm font-semibold text-rose-200 disabled:opacity-50">取消這個平台</button>}
          </>
        ) : <div className="text-sm text-slate-400">還沒有這個平台的草稿。</div>}
      </div>
    );
  };

  const needFill = detail ? [detail.website, detail.instagram, detail.threads].some((p) => !p.exists) : false;

  return (
    <section className="mx-auto mb-8 max-w-6xl space-y-4 rounded-2xl border border-cyan-400/30 bg-slate-900/60 p-4 text-slate-100 sm:p-6" aria-label="從自動流水線選主稿">
      <div>
        <h2 className="text-lg font-bold">從自動流水線選主稿</h2>
        <p className="mt-1 text-sm text-slate-400">1 選一篇 FB 主稿，2 四個平台並排看，3 看排程時間。不必先匯入；要貼外部文章請用下方的進階區。</p>
      </div>
      {notice && <div role="status" className="rounded-lg border border-white/20 bg-white/5 p-3 text-sm">{notice}</div>}
      {error && <div className="rounded-lg border border-rose-400/40 bg-rose-400/10 p-3 text-sm text-rose-100">讀取失敗：{error}</div>}

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-2 lg:max-w-sm">
          <div className="flex gap-2">
            <button onClick={() => setOnlyMissing(false)} className={`min-h-[44px] rounded-full border px-4 text-sm font-semibold ${!onlyMissing ? "border-white bg-white text-slate-950" : "border-white/20 bg-white/5"}`}>全部</button>
            <button onClick={() => setOnlyMissing(true)} className={`min-h-[44px] rounded-full border px-4 text-sm font-semibold ${onlyMissing ? "border-white bg-white text-slate-950" : "border-white/20 bg-white/5"}`}>只看缺草稿的</button>
          </div>
          {loading && <p className="p-4 text-sm text-slate-400">讀取中…</p>}
          {!loading && visible.length === 0 && <p className="rounded-lg border border-dashed border-white/20 p-4 text-sm text-slate-300">沒有符合的主稿。</p>}
          <div className="flex max-h-[560px] flex-col gap-2 overflow-auto pr-1">
            {visible.map((row) => (
              <button key={row.id} onClick={() => void loadDetail(row.id)} className={`flex flex-col gap-1 rounded-xl border bg-white/5 p-3 text-left ${selected === row.id ? "border-sky-400" : "border-white/10 hover:border-white/30"}`}>
                <span className="flex items-center gap-2 text-xs"><span className="rounded bg-white px-2 py-0.5 font-bold text-slate-950">{BRAND_NAME[row.brand] || row.brand}</span><span className="text-slate-400">{when(row.scheduledAt)}</span></span>
                <span className="text-sm font-semibold">{row.title}</span>
                {missing(row) ? <span className="text-xs font-semibold text-amber-300">缺：{[row.website.state === "none" && "官網", row.instagram.state === "none" && "IG", row.threads.state === "none" && "Threads"].filter(Boolean).join("、")}</span> : <span className="text-xs font-semibold text-emerald-300">四個平台齊全</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-3">
          {!selected && <p className="rounded-xl border border-dashed border-white/20 p-8 text-center text-sm text-slate-300">從左邊選一篇，這裡會並排顯示它在四個平台的內容與排程時間。</p>}
          {detailLoading && <p className="p-6 text-center text-sm text-slate-400">讀取中…</p>}
          {detail && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {col("FB 主稿", detail.fb, false)}
                {col("官網文章", detail.website, false)}
                {col("IG 輪播", detail.instagram, true)}
                {col("Threads", detail.threads, true)}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-sm text-slate-300">排程時間：FB {when(detail.fb.scheduledAt)}，官網 與 FB 同步，IG {when(detail.instagram.scheduledAt)}，Threads {when(detail.threads.scheduledAt)}。</div>
                {needFill && detail.fbQueueId && <button disabled={busy} onClick={() => void fillMissing()} className="min-h-[44px] rounded-lg bg-sky-500 px-4 text-sm font-semibold text-white disabled:opacity-50">補齊缺的草稿</button>}
              </div>
              {needFill && <p className="text-xs text-slate-400">「補齊缺的草稿」只適用 FB 已排程、而且官網、IG、Threads 都還沒有的主稿；只缺其中一個的，請用下方進階區手動處理。</p>}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
