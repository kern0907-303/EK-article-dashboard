"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import FindableTextarea from "@/components/FindableTextarea";
import { extractRedlineWords } from "@/lib/text-find";

type Kind = "review" | "manual" | "failed" | "blocked";
interface Item {
  key: string; kind: Kind; brand: string; platform: string; scheduledAt: string | null; reason: string; text: string; full: string; advice: string;
  source: "job" | "fb_queue" | "social_queue"; refId: string; jobId: string | null;
  derivativePlatform?: "website" | "instagram" | "threads";
  canEdit: boolean; queued?: boolean; canRetry: boolean; retryRisk: string | null; canMarkDone: boolean; canCancel: boolean; canDismiss: boolean;
  stalePlatforms: DerivativePlatform[];
}
type DerivativePlatform = "website" | "instagram" | "threads";
const DERIVATIVE_LABEL: Record<DerivativePlatform, string> = { website: "官網文章", instagram: "IG 輪播", threads: "Threads" };
interface SyncRow { platform: DerivativePlatform; state: "waiting" | "running" | "done" | "failed"; message: string }

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
  const [whenLocal, setWhenLocal] = useState("");
  const [alsoOthers, setAlsoOthers] = useState(true);
  const [force, setForce] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [serverWords, setServerWords] = useState<string[]>([]);
  const [rewriteNote, setRewriteNote] = useState("");
  const [rewriteTitle, setRewriteTitle] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const [rewriteInfo, setRewriteInfo] = useState<{ afterTitle: string; titleKept: boolean; allowTitle: boolean; notes: string[] } | null>(null);
  const [stale, setStale] = useState<DerivativePlatform[]>([]);
  const [syncRows, setSyncRows] = useState<SyncRow[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [cardUrl, setCardUrl] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
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
  const dismiss = (i: Item) => {
    if (i.derivativePlatform) {
      if (!window.confirm("移除這項失敗提醒？只會隱藏提醒，原錯誤紀錄與 FB 貼文都會保留。")) return;
      return call("/api/needs-attention", "POST", { action: "dismiss_derived", source: "job", id: i.refId, platform: i.derivativePlatform }, "已移除這項提醒，原錯誤紀錄保留。");
    }
    if (!window.confirm("放棄這則？它會標記為已取消，不會再發佈，記錄保留。")) return;
    return call("/api/needs-attention", "POST", { action: "dismiss", source: i.source, id: i.refId }, "已放棄這則。");
  };
  const toLocalInput = (iso: string | null) => {
    const base = iso && new Date(iso).getTime() > Date.now() + 35 * 60 * 1000 ? new Date(iso).getTime() : Date.now() + 60 * 60 * 1000;
    return new Date(base + 8 * 3600 * 1000).toISOString().slice(0, 16);
  };
  const select = (i: Item) => {
    setSelectedKey(i.key); setEditing(i.canEdit); setDraft(i.full); setWhenLocal(toLocalInput(i.scheduledAt));
    setProblems([]); setServerWords([]); setForce(false); setNotice("");
    setRewriteNote(""); setRewriteTitle(false); setRewriteInfo(null); setSyncRows([]); setCardUrl(""); setStale(i.stalePlatforms || []);
  };

  /**
   * 一鍵重寫：題目與論點不變，只換掉故事與舉例。
   * 重寫完不會自動同步其他平台，先讓他讀過內容，確認之後再按同步。
   */
  const rewriteOne = async (i: Item) => {
    if (!i.jobId) return;
    setRewriting(true); setNotice(""); setProblems([]); setRewriteInfo(null); setSyncRows([]);
    try {
      const res = await fetch("/api/auto-pipeline/rewrite-examples", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: i.jobId, note: rewriteNote, allowTitle: rewriteTitle }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "重寫失敗");
      const after = String(data.after || "");
      setRewriteInfo({
        afterTitle: String(data.afterTitle || ""), titleKept: data.titleKept !== false,
        allowTitle: data.allowTitle === true, notes: Array.isArray(data.notes) ? data.notes : [],
      });
      setStale(Array.isArray(data.stalePlatforms) ? data.stalePlatforms : []);
      setNotice(String(data.message || "已重寫。"));
      // 重新載入清單，否則左邊那一列還是舊內容，點回這一則會看到舊版，像是什麼都沒改
      await load();
      setDraft(after);
    } catch (e) { setNotice(e instanceof Error ? e.message : "重寫失敗"); }
    finally { setRewriting(false); }
  };

  /**
   * 確認內容之後，把其他平台一個一個換成新主稿寫出來的版本。
   * 刻意一次只打一個平台，不同時跑，哪一個失敗都看得出來，也不會四個平台一起燒。
   */
  const syncDerivatives = async (i: Item) => {
    if (!i.jobId || !stale.length) return;
    setSyncing(true); setNotice("");
    const rows: SyncRow[] = stale.map((platform) => ({ platform, state: "waiting", message: "" }));
    setSyncRows([...rows]);
    for (let n = 0; n < rows.length; n++) {
      rows[n] = { ...rows[n], state: "running", message: "重寫中…" };
      setSyncRows([...rows]);
      try {
        const res = await fetch("/api/auto-pipeline/reoptimize", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ platform: rows[n].platform, jobId: i.jobId, dryRun: false, limit: 1 }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `失敗（${res.status}）`);
        const skipped = Array.isArray(data.skipped) && data.skipped.length ? String(data.skipped[0].reason || "") : "";
        if (data.processed) rows[n] = { ...rows[n], state: "done", message: "已換成新版" };
        else rows[n] = { ...rows[n], state: "failed", message: skipped || "沒有可同步的項目" };
      } catch (e) { rows[n] = { ...rows[n], state: "failed", message: e instanceof Error ? e.message.slice(0, 120) : "失敗" }; }
      setSyncRows([...rows]);
    }
    const left = rows.filter((row) => row.state !== "done").map((row) => DERIVATIVE_LABEL[row.platform]);
    setStale(rows.filter((row) => row.state !== "done").map((row) => row.platform));
    setNotice(left.length ? `還有沒換成功的：${left.join("、")}。原內容保留，可以再按一次同步。` : "官網、IG、Threads 都已經換成新版。");
    setSyncing(false);
    await load();
  };
  /** 儲存文案。schedule 為 true 時，同一個動作把還沒排程的任務排進發佈佇列。 */
  const saveEdit = async (i: Item, schedule: boolean) => {
    setBusy(true); setNotice(""); setProblems([]);
    try {
      const body: Record<string, unknown> = { id: i.refId, action: "edit", content: draft, force };
      if (schedule) { body.schedule = true; body.scheduledAt = new Date(`${whenLocal}:00+08:00`).toISOString(); }
      const res = await fetch("/api/auto-pipeline", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const violations: string[] = Array.isArray(data.violations) ? data.violations : [];
        setProblems(violations.length ? violations : [data.error || "儲存失敗"]);
        setServerWords(extractRedlineWords([...violations, String(data.error || "")]));
        throw new Error(violations.length ? "還有要修改的地方，已列在上方" : data.error || "儲存失敗");
      }
      if (schedule && data.scheduled) {
        if (alsoOthers) {
          setNotice("FB 已排程。正在生成官網文章、IG 輪播與 Threads，約 2 分鐘，請不要關閉這個頁面…");
          try {
            const other = await fetch("/api/auto-pipeline/backfill", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: 1, queueId: data.queueId }) });
            const otherData = await other.json().catch(() => ({}));
            setNotice(other.ok ? `已儲存並排程發佈。${otherData.processed ? `其他平台：${otherData.done?.[0]?.step || "完成"}` : "其他平台之後可到「多平台衍生」頁補生成。"}` : `FB 已排程，但其他平台沒生成成功（${otherData.error || other.status}），可到「多平台衍生」頁按「生成」。`);
          } catch { setNotice("FB 已排程，但其他平台沒生成成功，可到「多平台衍生」頁按「生成」。"); }
        } else setNotice("已儲存並排程發佈。");
      } else setNotice(schedule ? "已儲存。" : "文案已儲存並通過品管。");
      setEditing(false); setSelectedKey(null);
      await load();
    } catch (e) { setNotice(e instanceof Error ? e.message : "儲存失敗"); }
    finally { setBusy(false); }
  };
  /** 重做標題圖卡。圖卡上印的是第一行，標題改了就要重畫。不呼叫 AI。 */
  const remakeCard = async (i: Item) => {
    setBusy(true); setNotice(""); setCardUrl("");
    try {
      const res = await fetch("/api/auto-pipeline", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: i.refId, action: "remake_card" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "圖卡重做失敗");
      setCardUrl(String(data.imageUrl || ""));
      setNotice(`圖卡已用現在的標題重做：${String(data.title || "")}`);
    } catch (e) { setNotice(e instanceof Error ? e.message : "圖卡重做失敗"); }
    finally { setBusy(false); }
  };

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
            <button onClick={() => void load()} disabled={loading} className="min-h-[44px] rounded-lg border border-white/20 bg-white/5 px-4 text-sm font-semibold hover:bg-white/10 disabled:opacity-50">{loading ? "核對中…" : "重新整理"}</button>
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
                <button key={i.key} onClick={() => select(i)}
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
                <div className="flex flex-wrap gap-2 rounded-lg border border-white/10 bg-slate-900/70 p-2" aria-label="這則的操作">
                  {selected.derivativePlatform && selected.jobId && <Link href={`/derivatives?jobId=${encodeURIComponent(selected.jobId)}`} className="inline-flex min-h-[44px] items-center rounded-lg bg-sky-500 px-4 text-sm font-semibold text-white">前往衍生頁處理{selected.platform}</Link>}
                  {selected.canEdit && selected.source === "job" && !selected.queued && selected.kind !== "review" && (
                    <button disabled={busy || !draft.trim()} onClick={() => void saveEdit(selected, true)} className="min-h-[48px] rounded-lg bg-emerald-500 px-5 text-base font-bold text-slate-950 disabled:opacity-50">{busy ? "處理中…" : "儲存並排程發佈"}</button>
                  )}
                  {selected.canEdit && selected.source === "job" && selected.jobId && (
                    <button disabled={busy || rewriting || syncing} onClick={() => void rewriteOne(selected)} className="min-h-[48px] rounded-lg bg-violet-500 px-5 text-base font-bold text-white disabled:opacity-50">{rewriting ? "重寫中，約 1 分鐘…" : "一鍵重寫（換例子）"}</button>
                  )}
                  {selected.canEdit && <button disabled={busy || !draft.trim()} onClick={() => void saveEdit(selected, false)} className={`min-h-[48px] rounded-lg px-4 text-sm font-semibold disabled:opacity-50 ${selected.queued || selected.kind === "review" ? "bg-sky-500 text-white" : "border border-white/20"}`}>{selected.queued || selected.kind === "review" ? "儲存修改（排程文案同步更新）" : "只儲存，先不發佈"}</button>}
                  {selected.canMarkDone && <button disabled={busy} onClick={() => void markDone(selected)} className="min-h-[44px] rounded-lg border border-white/20 px-4 text-sm font-semibold disabled:opacity-50">{selected.kind === "review" ? "標記已審" : "我已處理"}</button>}
                  {selected.canRetry && <button disabled={busy} onClick={() => void retry(selected)} className="min-h-[44px] rounded-lg bg-sky-500 px-4 text-sm font-semibold text-white disabled:opacity-50">重試發佈</button>}
                  {selected.canDismiss && <button disabled={busy} onClick={() => void dismiss(selected)} className="min-h-[44px] rounded-lg border border-rose-400/40 px-4 text-sm font-semibold text-rose-200 disabled:opacity-50">{selected.derivativePlatform ? "移除這項失敗提醒" : "放棄這則"}</button>}
                  {selected.source === "job" && selected.queued && (
                    <button disabled={busy || rewriting || syncing} onClick={() => void remakeCard(selected)} className="min-h-[44px] rounded-lg border border-white/20 px-4 text-sm font-semibold disabled:opacity-50" title="圖卡上印的是文章第一行，標題改了要重畫。不花 AI 額度">重做標題圖卡</button>
                  )}
                  {selected.canCancel && <button disabled={busy} onClick={() => void cancel(selected)} className="min-h-[44px] rounded-lg border border-rose-400/40 px-4 text-sm font-semibold text-rose-200 disabled:opacity-50">取消這則</button>}
                </div>
                {selected.canEdit && selected.source === "job" && selected.jobId && (
                  <div className="flex flex-col gap-2 rounded-lg border border-violet-400/30 bg-violet-400/10 p-3 text-sm">
                    <label className="flex flex-col gap-1 text-xs text-violet-100">
                      哪裡不妥、哪一段看不懂（可留空，寫了會照著改）
                      <textarea value={rewriteNote} onChange={(e) => setRewriteNote(e.target.value)} rows={2} disabled={rewriting}
                        placeholder="例如：第二段那個開會的例子看不懂，換成一個一個人在家裡的場景" className="rounded-lg border border-white/20 bg-slate-900 p-2 text-sm text-slate-100" />
                    </label>
                    <label className="flex items-start gap-2 text-sm text-violet-50">
                      <input type="checkbox" checked={rewriteTitle} onChange={(e) => setRewriteTitle(e.target.checked)} disabled={rewriting} className="mt-1" />
                      <span>標題也要重寫（論點不變。看不懂的那一行是標題本身時勾這個，不勾會鎖住標題）</span>
                    </label>
                    <p className="text-xs leading-6 text-violet-100/80">{rewriteTitle ? "會連標題一起換。新標題必須用文章裡真的寫出來的場景，一次讀完要懂，不可以兩個否定詞。" : "只換故事與舉例，標題、論點、段落順序與結尾都不動。"}新版沒通過品管或引用查證就不會存，原稿保留。</p>
                  </div>
                )}
                {rewriteInfo && (
                  <div className="rounded-lg border border-violet-400/40 bg-violet-400/10 p-3 text-sm text-violet-50">
                    <b>已重寫，新版已經在下面的編輯框裡。</b>
                    <p className="mt-1 text-xs leading-6">標題：{rewriteInfo.titleKept ? "沒有改動" : rewriteInfo.allowTitle ? `已換成「${rewriteInfo.afterTitle}」` : `模型想改，已換回原標題（${rewriteInfo.afterTitle}）`}</p>
                    {rewriteInfo.notes.length > 0 && <ul className="mt-1 list-inside list-disc space-y-1 text-xs">{rewriteInfo.notes.map((n, k) => <li key={k}>{n}</li>)}</ul>}
                    <p className="mt-2 text-xs leading-6">讀過沒問題就按下面的同步，其他平台才會跟著換。只想再改幾個字就直接改編輯框，然後按「儲存修改」。</p>
                  </div>
                )}
                {selected.jobId && stale.length > 0 && (
                  <div className="flex flex-col gap-2 rounded-lg border border-sky-400/40 bg-sky-400/10 p-3 text-sm text-sky-50">
                    <b>其他平台還是舊內容：{stale.map((p) => DERIVATIVE_LABEL[p]).join("、")}</b>
                    <p className="text-xs leading-6">確認上面的內容沒問題之後按這個按鈕。一次換一個平台，依序跑完，哪一個失敗都會列出來。</p>
                    <button disabled={syncing || rewriting || busy} onClick={() => void syncDerivatives(selected)} className="min-h-[48px] rounded-lg bg-sky-500 px-5 text-base font-bold text-white disabled:opacity-50">{syncing ? "同步中，請不要關閉這個頁面…" : "確認內容，同步其他平台"}</button>
                  </div>
                )}
                {syncRows.length > 0 && (
                  <ul className="flex flex-col gap-1 rounded-lg border border-white/10 bg-slate-900 p-3 text-xs">
                    {syncRows.map((row) => (
                      <li key={row.platform} className="flex items-center justify-between gap-3">
                        <span className="font-semibold">{DERIVATIVE_LABEL[row.platform]}</span>
                        <span className={row.state === "done" ? "text-emerald-300" : row.state === "failed" ? "text-rose-300" : "text-slate-300"}>
                          {row.state === "waiting" ? "等待中" : row.state === "running" ? "重寫中…" : row.message}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {cardUrl && (
                  <figure className="flex flex-col gap-1 rounded-lg border border-emerald-400/40 bg-emerald-400/10 p-2">
                    <img src={cardUrl} alt="重做後的標題圖卡" className="w-full rounded" />
                    <figcaption className="text-xs text-emerald-100">這是會跟著貼文發出去的圖卡。</figcaption>
                  </figure>
                )}
                {selected.canEdit && <h3 className="text-sm font-semibold text-sky-200">修改文案</h3>}
                {selected.canEdit ? (
                  <FindableTextarea value={draft} onChange={setDraft} words={[...new Set([...extractRedlineWords([selected.reason]), ...serverWords])]} rows={16} disabled={busy} />
                ) : (
                  <div className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-slate-900 p-3 text-sm leading-7">{selected.full || "（沒有內容）"}</div>
                )}
                {problems.length > 0 && (
                  <div className="rounded-lg border border-rose-400/40 bg-rose-400/10 p-3 text-sm text-rose-100">
                    <b>還要改這些才能儲存：</b>
                    <ul className="mt-1 list-inside list-disc space-y-1">{problems.map((p, n) => <li key={n}>{p}</li>)}</ul>
                    <label className="mt-2 flex items-center gap-2 text-xs text-rose-100"><input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />這些詞我確認可以用，略過可略過的提醒詞（醫療宣稱類不能略過）</label>
                  </div>
                )}
                <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-xs leading-6 text-amber-100">建議做法：{selected.advice}</div>
                {selected.canEdit && selected.source === "job" && !selected.queued && selected.kind !== "review" && (
                  <div className="flex flex-col gap-2 rounded-lg border border-white/10 bg-slate-900/60 p-3 text-sm">
                    <label className="flex flex-wrap items-center gap-2">發佈時間（台北時間）<input type="datetime-local" value={whenLocal} onChange={(e) => setWhenLocal(e.target.value)} className="min-h-[44px] rounded-lg border border-white/20 bg-slate-900 px-3 text-slate-100" /></label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={alsoOthers} onChange={(e) => setAlsoOthers(e.target.checked)} />排程後同時生成官網文章、IG 輪播、Threads（約 2 分鐘）</label>
                  </div>
                )}
                {selected.full && <button onClick={() => { void navigator.clipboard?.writeText(draft || selected.full); setNotice("已複製文案。"); }} className="min-h-[44px] rounded-lg border border-white/20 px-4 text-sm font-semibold">複製文案</button>}
              </>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
