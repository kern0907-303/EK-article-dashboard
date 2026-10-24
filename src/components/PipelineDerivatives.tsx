"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import FindableTextarea from "@/components/FindableTextarea";
import { extractRedlineWords } from "@/lib/text-find";

interface Row { id: string; brand: string; title: string; scheduledAt: string | null; jobStatus: string; fb: { state: string }; website: { state: string }; instagram: { state: string }; threads: { state: string }; }
interface Plat { exists: boolean; status: string; title?: string; text: string; scheduledAt: string | null; slides?: number; error?: string | null; limit?: number; queueRowId?: string }
interface Detail { jobId: string; brand: string; scheduledAt: string | null; jobStatus: string; jobError: string | null; fbQueueId: string | null; fb: Plat; website: Plat; instagram: Plat; threads: Plat }

const BRAND_NAME: Record<string, string> = { nas: "NAS", abl: "ABL", i8: "I8", erick: "Erick" };
const STATUS_TEXT: Record<string, string> = { pending: "排程中", sending: "發送中", sent: "已發佈", failed: "失敗", published: "已上線", draft: "草稿", none: "尚無草稿", partial: "部分失敗" };
const TAIPEI = 8 * 3600 * 1000;
function when(iso: string | null) {
  if (!iso) return "未排時間";
  const d = new Date(new Date(iso).getTime() + TAIPEI);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}
function scheduleInputValue(iso: string | null) {
  const planned = iso ? new Date(iso).getTime() : NaN;
  const time = Number.isFinite(planned) && planned > Date.now() + 40 * 60_000 ? planned : Date.now() + 60 * 60_000;
  return new Date(time + TAIPEI).toISOString().slice(0, 16);
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
  const [editing, setEditing] = useState<null | "fb" | "instagram" | "threads">(null);
  const [draft, setDraft] = useState("");
  const [problems, setProblems] = useState<string[]>([]);
  const [problemWords, setProblemWords] = useState<string[]>([]);
  const [scheduleLocal, setScheduleLocal] = useState("");
  const [scheduleOthers, setScheduleOthers] = useState(true);

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
    setSelected(id); setDetailLoading(true); setDetail(null); setEditing(null); setProblems([]);
    try {
      const res = await fetch(`/api/pipeline-timeline/detail?id=${encodeURIComponent(id)}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "讀取失敗");
      setDetail(data.detail);
      setScheduleLocal(scheduleInputValue(data.detail?.scheduledAt || null));
    } catch (e) { setNotice(e instanceof Error ? e.message : "讀取失敗"); }
    finally { setDetailLoading(false); }
  }, []);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("jobId");
    if (id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) void loadDetail(id);
  }, [loadDetail]);

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
  const generate = async (platform: "website" | "instagram" | "threads", label: string) => {
    if (!detail?.fbQueueId) return;
    const website = platform === "website";
    if (website ? !["pending", "sent"].includes(detail.fb.status) : detail.fb.status !== "pending") {
      setNotice(website ? "FB 排程已取消或失敗，無法從這篇生成官網文章。" : "FB 已非待發狀態，不能沿用過去的時間建立社群排程。");
      return;
    }
    if (website && detail.fb.status === "sent" && !window.confirm("將用這篇已發佈的 FB 主稿生成官網文章，通過品管後會立即上架。確定繼續？")) return;
    setBusy(true); setNotice(`正在生成${label}，約 1 到 2 分鐘，請不要關閉這個頁面…`);
    try {
      const res = await fetch("/api/auto-pipeline/backfill", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: 1, queueId: detail.fbQueueId, platforms: [platform] }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "生成失敗");
      const outcome = data.done?.[0]?.outcomes?.[platform];
      setNotice(data.message || (outcome && outcome.ok === false ? `${label}沒有生成成功：${outcome.error || "未知原因"}。內容會顯示在欄位裡，可以再按一次重試。` : `${label}已生成並排程。`));
      await loadDetail(detail.jobId); await loadRows();
    } catch (e) { setNotice(e instanceof Error ? e.message : "生成失敗"); }
    finally { setBusy(false); }
  };
  const scheduleFb = async () => {
    if (!detail || detail.fbQueueId || detail.jobStatus !== "manual") return;
    const scheduledAt = new Date(`${scheduleLocal}:00+08:00`);
    if (!Number.isFinite(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now() + 40 * 60_000) {
      setNotice("請選至少 40 分鐘後的 FB 發佈時間，才能接著生成其他平台。");
      return;
    }
    if (!window.confirm(`確定把 FB 主稿排到 ${scheduleLocal.replace("T", " ")} 發佈${scheduleOthers ? "，並接著生成官網、IG 與 Threads" : ""}嗎？`)) return;
    setBusy(true); setNotice("正在檢查文案並建立 FB 排程…"); setProblems([]);
    try {
      const content = editing === "fb" ? draft : detail.fb.text;
      const res = await fetch("/api/auto-pipeline", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: detail.jobId, action: "edit", content, schedule: true, scheduledAt: scheduledAt.toISOString() }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const violations: string[] = Array.isArray(data.violations) ? data.violations : [];
        setProblems(violations.length ? violations : [data.error || "FB 排程失敗"]);
        setProblemWords(extractRedlineWords([...violations, String(data.error || "")]));
        setDraft(content); setEditing("fb");
        throw new Error(violations.length ? "FB 文案仍有阻擋項目，請在下方編輯框修正後再排程。" : data.error || "FB 排程失敗");
      }
      if (!data.scheduled || !data.queueId) throw new Error("FB 狀態已變更，請重新整理後確認是否已排程；本次不會重複送出。");
      setEditing(null);
      setNotice("FB 已排程。" + (scheduleOthers ? "正在生成官網、IG 與 Threads，請不要關閉頁面…" : "現在可按各平台的生成按鈕。"));
      await loadDetail(detail.jobId); await loadRows();
      if (scheduleOthers) {
        try {
          const other = await fetch("/api/auto-pipeline/backfill", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: 1, queueId: data.queueId }) });
          const result = await other.json().catch(() => ({}));
          setNotice(other.ok && result.processed ? `FB 已排程；其他平台：${result.done?.[0]?.step || "已處理"}` : `FB 已排程，但其他平台尚未完成：${result.error || "請按各欄的生成按鈕重試"}`);
          await loadDetail(detail.jobId); await loadRows();
        } catch { setNotice("FB 已排程，但其他平台未完成；請按各欄的生成按鈕重試。"); }
      }
    } catch (e) { setNotice(e instanceof Error ? e.message : "FB 排程失敗"); }
    finally { setBusy(false); }
  };
  const startEdit = (which: "fb" | "instagram" | "threads") => {
    if (!detail) return;
    setEditing(which); setDraft(detail[which].text); setProblems([]); setProblemWords([]); setNotice("");
  };
  const saveEdit = async () => {
    if (!detail || !editing) return;
    setBusy(true); setProblems([]);
    try {
      const plat = detail[editing];
      const res = editing === "fb"
        ? await fetch("/api/auto-pipeline", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: detail.jobId, action: "edit", content: draft }) })
        : await fetch("/api/social-queue", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: plat.queueRowId, action: "edit", content: draft }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const violations: string[] = Array.isArray(data.violations) ? data.violations : [];
        setProblems(violations.length ? violations : [data.error || "儲存失敗"]);
        setProblemWords(extractRedlineWords([...violations, String(data.error || "")]));
        throw new Error("還有要修改的地方，已列在編輯框上方");
      }
      setNotice(editing === "fb" && !detail.fbQueueId ? "FB 草稿已儲存，但尚未排程；請按上方的排程按鈕。" : "已儲存，排程中的文案已同步更新。"); setEditing(null);
      await loadDetail(detail.jobId); await loadRows();
    } catch (e) { setNotice(e instanceof Error ? e.message : "儲存失敗"); }
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

  const col = (name: string, plat: Plat, canCancel: boolean, key: "fb" | "website" | "instagram" | "threads") => {
    const over = plat.limit && plat.text.length > plat.limit;
    const canGenerate = !!detail?.fbQueueId && (key === "website" ? ["pending", "sent"].includes(detail.fb.status) : detail?.fb.status === "pending");
    const tone = !plat.exists ? "border-dashed border-white/30" : plat.status === "failed" || over ? "border-2 border-rose-400" : plat.status === "sent" || plat.status === "published" ? "border-emerald-400/50" : "border-white/20";
    return (
      <div className={`flex min-w-0 flex-col gap-2 rounded-xl border bg-white/5 p-3 ${tone}`}>
        <div className="flex items-center justify-between gap-2"><b className="text-sm">{name}</b><span className="rounded border border-white/30 px-2 py-0.5 text-xs font-semibold">{STATUS_TEXT[plat.status] || plat.status}</span></div>
        {plat.title && <div className="text-xs font-semibold text-slate-200">{plat.title}</div>}
        {plat.exists ? (
          <>
            <div className="max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-900 p-2 text-xs leading-6 text-slate-200">{plat.text || "（沒有內容）"}</div>
            <div className="text-xs text-slate-400">{key === "fb" && !detail?.fbQueueId ? `預定 ${when(detail?.scheduledAt || null)}，尚未排程` : when(plat.scheduledAt)}　{plat.text.length} 字{plat.limit ? ` / 上限 ${plat.limit}` : ""}{plat.slides ? `　${plat.slides} 張圖` : ""}</div>
            {over && <div className="text-xs font-bold text-rose-300">超過字數上限</div>}
            {plat.error && <div className="text-xs font-semibold text-rose-300">{plat.error}</div>}
            {key !== "website" && (plat.status === "pending" || (key === "fb" && plat.status === "draft" && detail?.jobStatus === "manual")) && <button disabled={busy} onClick={() => startEdit(key)} className="min-h-[44px] rounded-lg border border-sky-400/50 text-sm font-semibold text-sky-200 disabled:opacity-50">編輯這個平台的文案</button>}
            {canCancel && plat.status === "pending" && <button disabled={busy} onClick={() => void cancelSocial(plat)} className="min-h-[44px] rounded-lg border border-rose-400/40 text-sm font-semibold text-rose-200 disabled:opacity-50">取消這個平台</button>}
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="text-sm text-slate-400">還沒有這個平台的草稿。</div>
            {plat.error && <div className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-2 text-xs leading-5 text-amber-100">上次沒生成成功的原因：{plat.error}</div>}
            {key !== "fb" && (
              <button disabled={busy || !canGenerate} onClick={() => void generate(key, name)} className="min-h-[44px] rounded-lg bg-sky-500 px-3 text-sm font-semibold text-white disabled:opacity-50">生成{name}</button>
            )}
            {key !== "fb" && !detail?.fbQueueId && <div className="text-xs text-slate-400">FB 還沒排程，先把 FB 排程後才能生成。</div>}
            {key !== "fb" && !!detail?.fbQueueId && !canGenerate && <div className="text-xs text-slate-400">{key === "website" ? "FB 排程已取消或失敗，不能生成官網文章。" : "FB 已非待發狀態，不能再沿用原時間建立社群排程。"}</div>}
            {key === "website" && detail?.fb.status === "sent" && canGenerate && <div className="text-xs text-amber-200">這篇 FB 已發佈；官網文章通過品管後會立即上架。</div>}
          </div>
        )}
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
                <span className="flex items-center gap-2 text-xs"><span className="rounded bg-white px-2 py-0.5 font-bold text-slate-950">{BRAND_NAME[row.brand] || row.brand}</span><span className="text-slate-400">{row.jobStatus === "scheduled" ? "排程" : "預定"} {when(row.scheduledAt)}</span></span>
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
              {!detail.fbQueueId && (
                <div className="space-y-3 rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm text-amber-100">
                  <p className="font-bold">FB 目前只有草稿，尚未進入發佈佇列。{detail.scheduledAt ? `原預定時間為 ${when(detail.scheduledAt)}。` : ""}</p>
                  {detail.jobError && <p>上次停下的原因：{detail.jobError}</p>}
                  {detail.jobStatus === "manual" && detail.fb.exists ? (
                    <>
                      <p>確認 FB 文案與時間後，這裡就能排程 FB，並接著生成其他平台。若品管擋下，會在下方顯示要修改的內容。</p>
                      <label className="flex flex-wrap items-center gap-2">FB 發佈時間（台北時間）<input type="datetime-local" value={scheduleLocal} onChange={(event) => setScheduleLocal(event.target.value)} className="min-h-[44px] rounded-lg border border-amber-400/40 bg-slate-900 px-3 text-white" /></label>
                      <label className="flex items-center gap-2"><input type="checkbox" checked={scheduleOthers} onChange={(event) => setScheduleOthers(event.target.checked)} />排程 FB 後，同時生成官網、IG 輪播與 Threads</label>
                      <button disabled={busy} onClick={() => void scheduleFb()} className="min-h-[48px] rounded-lg bg-amber-400 px-5 font-bold text-slate-950 disabled:opacity-50">{busy ? "處理中…" : scheduleOthers ? "排程 FB 並生成其他平台" : "只排程 FB"}</button>
                    </>
                  ) : <p>目前任務狀態為「{detail.jobStatus || "未知"}」，還不能排程；請先到自動流水線確認生成結果。</p>}
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {col("FB 主稿", detail.fb, false, "fb")}
                {col("官網文章", detail.website, false, "website")}
                {col("IG 輪播", detail.instagram, true, "instagram")}
                {col("Threads", detail.threads, true, "threads")}
              </div>
              {editing && (
                <div className="flex flex-col gap-3 rounded-xl border-2 border-sky-400/60 bg-slate-900 p-4">
                  <div className="text-base font-bold">正在編輯：{editing === "fb" ? "FB 主稿" : editing === "instagram" ? "IG 說明文字" : "Threads"}</div>
                  {editing === "fb" && !detail.fbQueueId && <p className="text-sm text-amber-200">修正後可直接按上方「排程 FB 並生成其他平台」，不必先儲存一次。</p>}
                  <p className="text-xs text-slate-400">{editing === "fb" && !detail.fbQueueId ? "若只想先保留修改，可按「只儲存 FB 草稿」；這不會建立排程。" : "改完按「儲存並更新排程」，排程裡的文案會跟著換，發佈時間不變。IG 的圖卡文字不在這裡改。"}</p>
                  {problems.length > 0 && (
                    <div className="rounded-lg border border-rose-400/40 bg-rose-400/10 p-3 text-sm text-rose-100">
                      <b>還要改這些才能儲存：</b>
                      <ul className="mt-1 list-inside list-disc space-y-1">{problems.map((p, n) => <li key={n}>{p}</li>)}</ul>
                    </div>
                  )}
                  <FindableTextarea value={draft} onChange={setDraft} words={problemWords} rows={14} disabled={busy} />
                  <div className="flex flex-wrap gap-2">
                    <button disabled={busy || !draft.trim()} onClick={() => void saveEdit()} className="min-h-[48px] rounded-lg bg-emerald-500 px-5 text-base font-bold text-slate-950 disabled:opacity-50">{busy ? "處理中…" : editing === "fb" && !detail.fbQueueId ? "只儲存 FB 草稿" : "儲存並更新排程"}</button>
                    <button disabled={busy} onClick={() => setEditing(null)} className="min-h-[48px] rounded-lg border border-white/20 px-4 text-sm font-semibold">不改了</button>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-sm text-slate-300">{detail.fbQueueId ? `排程時間：FB ${when(detail.fb.scheduledAt)}，官網與 FB 同步，IG ${when(detail.instagram.scheduledAt)}，Threads ${when(detail.threads.scheduledAt)}。` : `FB 尚未排程（原預定 ${when(detail.scheduledAt)}），因此其他平台尚不能從這篇生成。`}</div>
                {needFill && detail.fbQueueId && <button disabled={busy} onClick={() => void fillMissing()} className="min-h-[44px] rounded-lg bg-sky-500 px-4 text-sm font-semibold text-white disabled:opacity-50">補齊缺的草稿</button>}
              </div>
              {needFill && <p className="text-xs text-slate-400">「補齊缺的草稿」只適用 FB 已排程、而且官網、IG、Threads 都還沒有的主稿；只缺其中一個的，直接按那一欄的「生成」按鈕。</p>}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
