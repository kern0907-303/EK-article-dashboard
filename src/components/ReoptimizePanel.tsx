"use client";

import { useCallback, useState } from "react";

type Platform = "facebook" | "website" | "instagram" | "threads";
const PLATFORMS: Array<{ id: Platform; label: string }> = [
  { id: "facebook", label: "Facebook 主稿" },
  { id: "website", label: "官網文章" },
  { id: "instagram", label: "IG 輪播" },
  { id: "threads", label: "Threads" },
];

interface Item { jobId: string; brandName: string; scheduledAt: string; title: string; stale: boolean; blocked: string }
interface DoneItem { jobId: string; brandName: string; scheduledAt: string; before: string; after: string; notes: string[] }

const TAIPEI = 8 * 3600 * 1000;
function when(iso: string | null) {
  if (!iso) return "未排時間";
  const d = new Date(new Date(iso).getTime() + TAIPEI);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/**
 * 用目前這版規則重寫已排程但還沒發出去的內容。
 * 一次只做一個平台。先按「看看有幾篇要改」試算，確認後再分批執行。新稿沒通過品管就保留舊稿。
 */
export default function ReoptimizePanel() {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [items, setItems] = useState<Item[] | null>(null);
  const [staleCount, setStaleCount] = useState(0);
  const [rulesVersion, setRulesVersion] = useState("");
  const [done, setDone] = useState<DoneItem[]>([]);
  const [platform, setPlatform] = useState<Platform>("facebook");
  const [brand, setBrand] = useState("all");
  const [batch, setBatch] = useState(1);

  const label = PLATFORMS.find((p) => p.id === platform)!.label;

  const call = useCallback(async (dryRun: boolean, forPlatform: Platform) => {
    setBusy(true);
    setNotice(dryRun ? "正在試算…" : `正在重寫 ${batch} 篇${PLATFORMS.find((p) => p.id === forPlatform)!.label}，每篇約 1 到 2 分鐘，請不要關閉這個頁面…`);
    try {
      const res = await fetch("/api/auto-pipeline/reoptimize", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun, platform: forPlatform, limit: batch, ...(brand === "all" ? {} : { brand }) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "操作失敗");
      setRulesVersion(data.rulesVersion || "");
      if (dryRun) {
        setItems(data.items || []); setStaleCount(data.staleCount || 0);
        setNotice(data.note || "");
      } else {
        setDone(data.done || []);
        const failed = (data.skipped || []) as Array<{ reason: string }>;
        setNotice(`${data.processed} 篇已重寫，還有 ${data.remaining} 篇是舊規則。${failed.length ? `略過 ${failed.length} 篇：${failed.slice(0, 2).map((s) => s.reason).join("；")}` : ""}`);
        await call(true, forPlatform);
      }
    } catch (e) { setNotice(e instanceof Error ? e.message : "操作失敗"); }
    finally { setBusy(false); }
  }, [batch, brand]);

  const choosePlatform = (next: Platform) => {
    if (busy) return;
    setPlatform(next); setItems(null); setDone([]); setStaleCount(0); setNotice("");
  };

  return (
    <section className="mx-auto mb-6 max-w-6xl space-y-3 rounded-2xl border border-amber-400/30 bg-slate-900/60 p-4 text-slate-100 sm:p-6" aria-label="用最新規則重寫已排程內容">
      <div>
        <h2 className="text-lg font-bold">用最新規則重寫已排程的內容</h2>
        <p className="mt-1 text-sm text-slate-400">
          改了標題型、開場型或小標規則之後，已經排程的內容還是舊規則寫的。這裡可以分批重寫，不必等它們發完。
          一次只做一個平台。距離發佈不到 60 分鐘的不會被動到，新稿沒通過品管或品牌紅線會保留舊稿。
          官網、IG、Threads 是從 FB 主稿改寫出來的，所以要先把主稿重寫完，才能重寫它們。
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="選擇平台">
        {PLATFORMS.map((p) => (
          <button key={p.id} disabled={busy} onClick={() => choosePlatform(p.id)} aria-pressed={platform === p.id}
            className={`min-h-[44px] rounded-full border px-4 text-sm font-semibold disabled:opacity-50 ${platform === p.id ? "border-amber-300 bg-amber-300 text-slate-950" : "border-white/20 bg-white/5 hover:bg-white/10"}`}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
        <label className="flex items-center gap-2 text-sm">品牌
          <select value={brand} disabled={busy} onChange={(e) => { setBrand(e.target.value); setItems(null); setStaleCount(0); }} className="min-h-[44px] rounded-lg border border-white/20 bg-slate-900 px-3 text-slate-100">
            <option value="all">全部</option><option value="nas">平衡空間</option><option value="abl">艾伯林量子調頻</option><option value="i8">初八企業顧問</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">這次重寫幾篇
          <select value={batch} disabled={busy} onChange={(e) => setBatch(Number(e.target.value))} className="min-h-[44px] rounded-lg border border-white/20 bg-slate-900 px-3 text-slate-100">
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <button disabled={busy} onClick={() => void call(true, platform)} className="min-h-[44px] rounded-lg border border-white/20 px-4 text-sm font-semibold disabled:opacity-50">看看有幾篇要改</button>
        <button disabled={busy || staleCount === 0} onClick={() => void call(false, platform)} className="min-h-[44px] rounded-lg bg-amber-500 px-4 text-sm font-bold text-slate-950 disabled:opacity-40">
          {busy ? "處理中…" : `重寫 ${Math.min(batch, staleCount || batch)} 篇${label}`}
        </button>
        {rulesVersion && <span className="text-xs text-slate-400">目前規則版本：{rulesVersion}</span>}
      </div>

      {notice && <div role="status" className="rounded-lg border border-white/20 bg-white/5 p-3 text-sm">{notice}</div>}

      {done.length > 0 && (
        <div className="space-y-2 rounded-xl border border-emerald-400/40 bg-emerald-400/10 p-3">
          <b className="text-sm">這次改了這幾篇</b>
          {done.map((d) => (
            <div key={d.jobId} className="rounded-lg bg-slate-900/60 p-3 text-sm">
              <div className="text-xs text-slate-400">{d.brandName}　{when(d.scheduledAt)}</div>
              <div className="mt-1 text-slate-400 line-through">{d.before}</div>
              <div className="font-semibold text-emerald-200">{d.after}</div>
              {d.notes.length > 0 && <div className="mt-1 text-xs text-amber-200">{d.notes.join("；")}</div>}
            </div>
          ))}
        </div>
      )}

      {items && items.length > 0 && (
        <div className="max-h-72 overflow-auto rounded-xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-900 text-xs text-slate-400"><tr><th className="p-2">品牌</th><th className="p-2">發佈時間</th><th className="p-2">目前內容</th><th className="p-2">狀態</th></tr></thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.jobId} className="border-t border-white/10">
                  <td className="p-2 whitespace-nowrap">{item.brandName}</td>
                  <td className="p-2 whitespace-nowrap">{when(item.scheduledAt)}</td>
                  <td className="p-2">{item.title || "（沒有內容）"}</td>
                  <td className="p-2 whitespace-nowrap">
                    {item.blocked ? <span className="text-slate-400">{item.blocked}</span>
                      : item.stale ? <span className="font-semibold text-amber-300">舊規則</span>
                      : <span className="text-emerald-300">最新</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {items && items.length === 0 && <p className="rounded-lg border border-dashed border-white/20 p-4 text-sm text-slate-300">沒有符合條件的已排程{label}。</p>}
    </section>
  );
}
