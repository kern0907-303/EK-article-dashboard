"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Kind = "review" | "manual" | "failed" | "blocked";
interface Item {
  key: string; kind: Kind; brand: string; platform: string; scheduledAt: string | null; reason: string; text: string; full: string; advice: string;
  source: "job" | "fb_queue" | "social_queue"; refId: string; jobId: string | null;
  canEdit: boolean; canRetry: boolean; retryRisk: string | null; canMarkDone: boolean; canCancel: boolean;
}

const KINDS: { id: Kind; label: string; hint: string; tone: string }[] = [
  { id: "review", label: "待審稿", hint: "看過點頭就好", tone: "border-amber-400/40 bg-amber-400/10 text-amber-100" },
  { id: "manual", label: "要手動處理", hint: "系統做不到，你來", tone: "border-indigo-400/40 bg-indigo-400/10 text-indigo-100" },
  { id: "failed", label: "發佈失敗", hint: "看原因後重試", tone: "border-rose-400/40 bg-rose-400/10 text-rose-100" },
  { id: "blocked", label: "品管擋下", hint: "改文案才能放行", tone: "border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-100" },
];
const BRANDS = [{ id: "all", label: "全部品牌" }, { id: "nas", label: "NAS" }, { id: "abl", label: "ABL" }, { id: "i8", label: "I8" }, { id: "erick", label: "Erick" }];
const PLATFORMS = ["全部平台", "FB", "官網", "IG", "Threads"];
const BRAND_NAME: Record<string, string> = { nas: "NAS", abl: "ABL", i8: "I8", erick: "Erick" };

function whenText(iso: string | null) {
  if (!iso) return "未排時間";
  const d = new Date(new Date(iso).getTime() + 8 * 3600 * 1000);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}
const chip = (on: boolean) => `min-h-[44px] rounded-full border px-4 text-sm font-semibold ${on ? "border-white bg-white text-slate-950" : "border-white/20 bg-white/5 text-slate-200 hover:bg-white/10"}`;

export default function NeedsAttentionPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<Kind | "all">("all");
  const [brand, setBrand] = useState("all");
  const [platform, setPlatform] = useState("全部平台");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/needs-attention", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "讀取失敗");
      setItems(data.items || []);
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "讀取失敗"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => items.filter((i) => (kind === "all" || i.kind === kind) && (brand === "all" || i.brand === brand) && (platform === "全部平台" || i.platform === platform)), [items, kind, brand, platform]);
  const selected = visible.find((i) => i.key === selectedKey) || null;
  const count = (k: Kind) => items.filter((i) => i.kind === k).length;

  const call = async (url: string, method: string, body: unknown, done: string) => {
    setBusy(true); setNotice("");
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.violations ? `${data.error}：${data.violations.join("、")}` : data.error || "操作失敗");
      setNotice(done); setEditing(false); setSelectedKey(null);
      await load();
    } catch (e) { setNotice(e instanceof Error ? e.message : "操作失敗"); }
    finally { setBusy(false); }
  };

  const markDone = (i: Item) => call("/api/needs-attention", "POST", { action: "mark_done", source: "job", id: i.refId }, "已標記處理，這則離開清單。");
  const retry = (i: Item) => {
    if (i.retryRisk && !window.confirm(i.retryRisk)) return;
    return call("/api/needs-attention", "POST", { action: "retry", source: i.source, id: i.refId }, "已重新排入，約 6 分鐘後派發。");
  };
  const saveEdit = (i: Item) => call("/api/auto-pipeline", "PATCH", { id: i.refId, action: "edit", content: draft }, "文案已儲存並通過品管。");
  const cancel = (i: Item) => {
    if (!window.confirm("確定取消這則排程？")) return;
    return call("/api/auto-pipeline", "PATCH", { id: i.refId, action: "cancel" }, "已取消。");
  };

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">待處理中心</h1>
            <p className="mt-1 text-sm text-slate-400">不分品牌、不分平台，所有需要你點頭或動手的貼文集中在這裡。</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => void load()} className="min-h-[44px] rounded-lg border border-white/20 bg-white/5 px-4 text-sm font-semibold hover:bg-white/10">重新整理</button>
            <Link href="/auto-pipeline" className="inline-flex min-h-[44px] items-center rounded-lg border border-amber-400/40 bg-amber-400/10 px-4 text-sm font-semibold text-amber-100">自動流水線</Link>
            <Link href="/" className="inline-flex min-h-[44px] items-center rounded-lg border border-white/20 bg-white/5 px-4 text-sm font-semibold">回主工作區</Link>
          </div>
        </header>

        {error && <div className="rounded-lg border border-rose-400/40 bg-rose-400/10 p-3 text-sm text-rose-100">讀取失敗：{error}</div>}
        {notice && <div role="status" className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 p-3 text-sm text-emerald-100">{notice}</div>}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {KINDS.map((k) => (
            <button key={k.id} onClick={() => setKind(kind === k.id ? "all" : k.id)} aria-pressed={kind === k.id}
              className={`flex min-h-[44px] flex-col items-start gap-1 rounded-xl border p-4 text-left ${k.tone} ${kind === k.id ? "ring-2 ring-white" : ""}`}>
              <span className="text-sm font-semibold">{k.label}</span>
              <span className="text-3xl font-bold leading-none">{count(k.id)}</span>
              <span className="text-xs opacity-80">{k.hint}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="flex flex-wrap items-center gap-2"><span className="text-xs text-slate-400">品牌</span>{BRANDS.map((b) => <button key={b.id} onClick={() => setBrand(b.id)} className={chip(brand === b.id)}>{b.label}</button>)}</div>
          <div className="flex flex-wrap items-center gap-2"><span className="text-xs text-slate-400">平台</span>{PLATFORMS.map((p) => <button key={p} onClick={() => setPlatform(p)} className={chip(platform === p)}>{p}</button>)}</div>
          <span className="ml-auto text-sm text-slate-400">顯示 {visible.length} 則，依發佈時間由近到遠</span>
        </div>

        <div className="flex flex-wrap items-start gap-5">
          <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-2">
            {loading && <div className="rounded-xl border border-white/10 p-8 text-center text-slate-400">讀取中…</div>}
            {!loading && visible.length === 0 && <div className="rounded-xl border border-dashed border-white/20 p-10 text-center text-slate-300">目前沒有待處理的貼文。</div>}
            {visible.map((i) => {
              const tone = KINDS.find((k) => k.id === i.kind)!;
              return (
                <button key={i.key} onClick={() => { setSelectedKey(i.key); setEditing(false); }}
                  className={`flex w-full items-center justify-between gap-4 rounded-xl border bg-white/5 p-4 text-left ${selected?.key === i.key ? "border-sky-400" : "border-white/10 hover:border-white/30"}`}>
                  <span className="flex min-w-0 flex-col gap-1.5">
                    <span className="flex flex-wrap items-center gap-2 text-xs font-bold">
                      <span className="rounded bg-white px-2 py-0.5 text-slate-950">{BRAND_NAME[i.brand] || i.brand}</span>
                      <span className="rounded border border-white/30 px-2 py-0.5">{i.platform}</span>
                      <span className={`rounded border px-2 py-0.5 ${tone.tone}`}>{tone.label}</span>
                    </span>
                    <span className="text-[15px] font-semibold">{i.reason}</span>
                    <span className="truncate text-xs text-slate-400">{i.text}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end text-xs text-slate-400"><span>預定發佈</span><span className="text-[15px] font-bold text-slate-100">{whenText(i.scheduledAt)}</span></span>
                </button>
              );
            })}
          </div>

          <aside className="flex min-w-0 flex-[1_1_340px] flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-5">
            {!selected && <p className="text-sm leading-7 text-slate-300">從左邊選一則，這裡會顯示完整內容、為什麼需要你處理，以及可以按的動作。</p>}
            {selected && (
              <>
                <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                  <span className="rounded bg-white px-2 py-0.5 text-slate-950">{BRAND_NAME[selected.brand] || selected.brand}</span>
                  <span className="rounded border border-white/30 px-2 py-0.5">{selected.platform}</span>
                  <span className="text-slate-400">預定 {whenText(selected.scheduledAt)}</span>
                </div>
                <h2 className="text-lg font-bold leading-snug">{selected.reason}</h2>
                {editing ? (
                  <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={14} className="w-full rounded-lg border border-white/20 bg-slate-900 p-3 text-sm leading-7 text-slate-100" />
                ) : (
                  <div className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-slate-900 p-3 text-sm leading-7">{selected.full || "（沒有內容）"}</div>
                )}
                <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-xs leading-6 text-amber-100">建議做法：{selected.advice}</div>
                <div className="flex flex-wrap gap-2">
                  {editing ? (
                    <>
                      <button disabled={busy} onClick={() => void saveEdit(selected)} className="min-h-[44px] rounded-lg bg-sky-500 px-4 text-sm font-semibold text-white disabled:opacity-50">儲存並重跑品管</button>
                      <button disabled={busy} onClick={() => setEditing(false)} className="min-h-[44px] rounded-lg border border-white/20 px-4 text-sm font-semibold">放棄修改</button>
                    </>
                  ) : (
                    <>
                      {selected.canMarkDone && <button disabled={busy} onClick={() => void markDone(selected)} className="min-h-[44px] rounded-lg bg-sky-500 px-4 text-sm font-semibold text-white disabled:opacity-50">{selected.kind === "review" ? "標記已審" : "我已處理"}</button>}
                      {selected.canRetry && <button disabled={busy} onClick={() => void retry(selected)} className="min-h-[44px] rounded-lg bg-sky-500 px-4 text-sm font-semibold text-white disabled:opacity-50">重試發佈</button>}
                      {selected.canEdit && <button disabled={busy} onClick={() => { setDraft(selected.full); setEditing(true); }} className="min-h-[44px] rounded-lg border border-white/20 px-4 text-sm font-semibold">修改文案</button>}
                      {selected.full && <button onClick={() => { void navigator.clipboard?.writeText(selected.full); setNotice("已複製文案。"); }} className="min-h-[44px] rounded-lg border border-white/20 px-4 text-sm font-semibold">複製文案</button>}
                      {selected.canCancel && <button disabled={busy} onClick={() => void cancel(selected)} className="min-h-[44px] rounded-lg border border-rose-400/40 px-4 text-sm font-semibold text-rose-200 disabled:opacity-50">取消這則</button>}
                    </>
                  )}
                </div>
              </>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
