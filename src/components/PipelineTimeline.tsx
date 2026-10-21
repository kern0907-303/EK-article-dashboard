"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type CellState = "sent" | "pending" | "failed" | "none" | "cancelled" | "na";
interface Cell { state: CellState; label: string; at: string | null }
interface Row {
  id: string; brand: string; title: string; scheduledAt: string | null; jobStatus: string; reviewed: boolean; note: string | null; needsYou: boolean;
  fb: Cell; website: Cell; instagram: Cell; threads: Cell;
}

const BRAND_NAME: Record<string, string> = { nas: "NAS", abl: "ABL", i8: "I8", erick: "Erick" };
const CELL_TONE: Record<CellState, string> = {
  sent: "border-emerald-400/40 bg-emerald-400/10 text-emerald-100",
  pending: "border-white/20 bg-white/5 text-slate-200",
  failed: "border-2 border-rose-400 bg-rose-400/15 text-rose-100",
  none: "border border-dashed border-white/30 bg-transparent text-slate-300",
  cancelled: "border-white/10 bg-white/5 text-slate-400 line-through",
  na: "border-white/10 bg-transparent text-slate-500",
};
const TAIPEI = 8 * 3600 * 1000;
const dayKey = (iso: string | null) => iso ? new Date(new Date(iso).getTime() + TAIPEI).toISOString().slice(0, 10) : "未排時間";

function dayLabel(key: string, todayKey: string, tomorrowKey: string) {
  if (key === "未排時間") return key;
  const d = new Date(`${key}T00:00:00Z`);
  const week = ["日", "一", "二", "三", "四", "五", "六"][d.getUTCDay()];
  const base = `${d.getUTCMonth() + 1}/${d.getUTCDate()}（週${week}）`;
  return key === todayKey ? `今天 ${base}` : key === tomorrowKey ? `明天 ${base}` : base;
}
function timeOf(iso: string | null) {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + TAIPEI);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export default function PipelineTimeline() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [showFar, setShowFar] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/pipeline-timeline", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "讀取失敗");
      setRows(data.rows || []); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "讀取失敗"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const now = Date.now();
  const todayKey = dayKey(new Date(now).toISOString());
  const tomorrowKey = dayKey(new Date(now + 24 * 3600 * 1000).toISOString());
  const farLimit = dayKey(new Date(now + 7 * 24 * 3600 * 1000).toISOString());

  const counts = useMemo(() => ({
    queued: rows.filter((r) => r.jobStatus === "pending").length,
    working: rows.filter((r) => ["generating", "optimizing"].includes(r.jobStatus)).length,
    scheduled: rows.filter((r) => r.jobStatus === "scheduled" && r.fb.state !== "sent").length,
    sent: rows.filter((r) => r.fb.state === "sent").length,
    needs: rows.filter((r) => r.needsYou).length,
  }), [rows]);

  const filtered = rows.filter((r) => !onlyProblems || r.needsYou);
  const near = filtered.filter((r) => dayKey(r.scheduledAt) <= farLimit);
  const far = filtered.filter((r) => dayKey(r.scheduledAt) > farLimit);
  const shown = showFar ? filtered : near;
  const groups = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of shown) map.set(dayKey(r.scheduledAt), [...(map.get(dayKey(r.scheduledAt)) || []), r]);
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [shown]);

  const stat = (label: string, value: number, alert = false) => (
    <div className="flex min-w-[110px] flex-1 flex-col gap-0.5 pr-4">
      <span className={`text-xs ${alert ? "font-bold text-rose-300" : "text-slate-400"}`}>{label}</span>
      <span className={`text-2xl font-bold ${alert && value > 0 ? "text-rose-300" : ""}`}>{value}</span>
    </div>
  );
  const cell = (name: string, c: Cell) => (
    <div className={`rounded-lg border px-2.5 py-2 text-xs leading-5 ${CELL_TONE[c.state]}`}><b>{name}</b><br />{c.label}</div>
  );

  return (
    <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6" aria-label="依日期總覽">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">依日期總覽</h2>
          <p className="text-xs text-slate-400">每篇一列，右邊四格是這篇在 FB、官網、IG、Threads 各自的狀態；紅框代表需要你。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/needs-attention" className={`inline-flex min-h-[44px] items-center rounded-lg px-4 text-sm font-bold ${counts.needs ? "bg-rose-600 text-white" : "border border-white/20 bg-white/5 text-slate-200"}`}>待處理 {counts.needs}（集中處理）</Link>
          <button onClick={() => void load()} className="min-h-[44px] rounded-lg border border-white/20 bg-white/5 px-4 text-sm font-semibold hover:bg-white/10">重新整理</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-y-2 rounded-xl border border-white/10 bg-slate-950/40 p-3">
        {stat("排隊中", counts.queued)}{stat("生成與品管中", counts.working)}{stat("已排程", counts.scheduled)}{stat("今天以來已發佈", counts.sent)}{stat("需要你處理", counts.needs, true)}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setOnlyProblems(false)} className={`min-h-[44px] rounded-full border px-4 text-sm font-semibold ${!onlyProblems ? "border-white bg-white text-slate-950" : "border-white/20 bg-white/5"}`}>全部</button>
        <button onClick={() => setOnlyProblems(true)} className={`min-h-[44px] rounded-full border px-4 text-sm font-semibold ${onlyProblems ? "border-white bg-white text-slate-950" : "border-white/20 bg-white/5"}`}>只看有問題的</button>
        <span className="ml-auto text-xs text-slate-400">顯示最近 36 小時之後的任務；一週以後的預設收合</span>
      </div>

      {error && <div className="rounded-lg border border-rose-400/40 bg-rose-400/10 p-3 text-sm text-rose-100">讀取失敗：{error}（下方原本的批次總覽不受影響）</div>}
      {loading && <p className="p-6 text-center text-sm text-slate-400">讀取中…</p>}
      {!loading && !error && groups.length === 0 && <p className="rounded-xl border border-dashed border-white/20 p-6 text-center text-sm text-slate-300">{onlyProblems ? "目前沒有需要你處理的排程。" : "近期沒有排程。"}</p>}

      <div className="space-y-2">
        {groups.map(([key, list]) => (
          <div key={key} className="space-y-2">
            <div className="pt-2 text-sm font-bold">{dayLabel(key, todayKey, tomorrowKey)}</div>
            {list.map((r) => (
              <div key={r.id} className={`flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl border bg-white/5 p-3 ${r.needsYou ? "border-2 border-rose-400/70" : "border-white/10"}`}>
                <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="rounded bg-white px-2 py-0.5 font-bold text-slate-950">{BRAND_NAME[r.brand] || r.brand}</span>
                    <span className="text-slate-400">{timeOf(r.scheduledAt)} FB 主稿</span>
                  </div>
                  <div className="truncate text-sm font-semibold">{r.title}</div>
                  {r.note && <div className="text-xs font-semibold text-rose-300">{r.note}</div>}
                </div>
                <div className="grid flex-[1_1_380px] grid-cols-2 gap-2 sm:grid-cols-4">
                  {cell("FB", r.fb)}{cell("官網", r.website)}{cell("IG", r.instagram)}{cell("Threads", r.threads)}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {far.length > 0 && (
        <button onClick={() => setShowFar(!showFar)} className="min-h-[44px] w-full rounded-lg border border-white/20 bg-white/5 text-sm font-semibold hover:bg-white/10">
          {showFar ? "收合一週以後的排程" : `展開一週以後的 ${far.length} 篇`}
        </button>
      )}
    </section>
  );
}
