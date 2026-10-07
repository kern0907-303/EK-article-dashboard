"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { applyDateRule, parsePipelineBatch, type BatchSource, type PipelineEntry } from "@/lib/auto-pipeline";
import { parsePastedTopics, materialFor } from "@/lib/topic-parse";
import { buildGenrePrompt, GENRES, type BrandKey, type FunnelLevel, type GenreId } from "@/data/skills/genres";
import { DEFAULT_SCHEDULE_TIME } from "@/lib/schedule-time";

const BRANDS = [
  { id: "nas", name: "NAS" }, { id: "abl", name: "ABL" }, { id: "i8", name: "I8" }, { id: "erick", name: "Erick" },
] as const;
const STATUS_LABEL: Record<string, string> = {
  pending: "待跑", generating: "生成中", optimizing: "優化中", scheduled: "已排程", manual: "待人工處理", failed: "失敗", cancelled: "已取消",
};

function asLocalValue(iso: string | null) {
  if (!iso) return "";
  const date = new Date(new Date(iso).getTime() + 8 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 16);
}
function fromLocalValue(value: string) { return value ? new Date(`${value}:00+08:00`).toISOString() : null; }

export default function AutoPipelinePage() {
  const [text, setText] = useState("");
  const [source, setSource] = useState<BatchSource>("manual");
  const [entries, setEntries] = useState<PipelineEntry[]>([]);
  const [research, setResearch] = useState(false);
  const [selectedTopics, setSelectedTopics] = useState<number[]>([]);
  const [startDate, setStartDate] = useState("");
  const [weekdays, setWeekdays] = useState<number[]>([1, 3, 5]);
  const [time, setTime] = useState(DEFAULT_SCHEDULE_TIME);
  const [projectId, setProjectId] = useState("");
  const [jobs, setJobs] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [draftChanges, setDraftChanges] = useState<Record<string, string>>({});
  const [enabled, setEnabled] = useState<boolean | null>(null);

  const topics = useMemo(() => research ? parsePastedTopics(text).topics : [], [research, text]);
  const fetchOverview = async () => {
    const res = await fetch("/api/auto-pipeline", { cache: "no-store" });
    const data = await res.json();
    setEnabled(res.ok && data.enabled === true);
    if (res.ok) { setJobs(data.jobs || []); setBatches(data.batches || []); }
    else setNotice(data.error || "讀取總覽失敗");
  };
  useEffect(() => { void fetchOverview(); }, []);

  const handleFile = async (file?: File) => {
    if (!file) return;
    setSource("file");
    setResearch(file.name.toLowerCase().endsWith(".txt") && text.includes("本週品牌調研"));
    setText(await file.text());
  };
  const preview = () => {
    setNotice("");
    if (research) {
      const bundle = parsePastedTopics(text);
      const chosen = bundle.topics.filter((t) => selectedTopics.includes(t.index));
      if (!bundle.brandKey || chosen.length === 0) { setNotice("請確認調研文字含品牌名稱，並至少勾選一個選題。"); return; }
      const next = chosen.map((topic) => {
        const genre = topic.genre && GENRES[topic.genre].enabled ? topic.genre : null;
        const warning = [...(!genre ? ["選題文體無法辨識或尚未啟用"] : []), "缺少日期"];
        const funnel = topic.funnel || "cold";
        const settings = genre ? {
          genre, funnel, claim: topic.claim || topic.title, material: materialFor(topic, genre), metaphor: "", length: "", cta: "",
        } : null;
        return {
          brandId: bundle.brandKey as PipelineEntry["brandId"], scheduledAt: null,
          prompt: settings ? buildGenrePrompt(bundle.brandKey as BrandKey, settings) : "",
          warning,
        };
      });
      setEntries(next);
    } else {
      const result = parsePipelineBatch(text, source);
      setEntries(result.entries);
      if (result.error) setNotice(result.error);
    }
  };

  const applyRule = () => setEntries((current) => applyDateRule(current, startDate, weekdays, time));
  const updateEntry = (index: number, fields: Partial<PipelineEntry>) => setEntries((current) => current.map((entry, i) => {
    if (i !== index) return entry;
    const warning = fields.brandId ? entry.warning.filter((item) => item !== "缺少品牌") : entry.warning;
    return { ...entry, ...fields, warning };
  }));
  const confirmBatch = async () => {
    setBusy(true); setNotice("");
    try {
      const res = await fetch("/api/auto-pipeline", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source, entries, projectId: projectId || null }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "建立任務失敗");
      setNotice(`已建立批次 ${data.batch.batch_no}，共 ${data.jobs.length} 篇。排程時間若有效，會依序生成、檢查後加入排程；未審也會照時間發出。`);
      setEntries([]); setText(""); await fetchOverview();
    } catch (error) { setNotice(error instanceof Error ? error.message : "建立任務失敗"); }
    finally { setBusy(false); }
  };
  const action = async (payload: Record<string, string>) => {
    const res = await fetch("/api/auto-pipeline", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) setNotice(data.error || "操作失敗"); else await fetchOverview();
  };
  const saveDraft = async (id: string) => {
    const res = await fetch("/api/auto-pipeline", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action: "edit", content: draftChanges[id] }) });
    const data = await res.json();
    if (!res.ok) setNotice(data.error || "文案儲存失敗"); else { setNotice("文案已更新並標記為已審；若仍在待發，排程列也已同步更新。"); setDraftChanges((all) => { const next = { ...all }; delete next[id]; return next; }); await fetchOverview(); }
  };
  const toggleWeekday = (day: number) => setWeekdays((current) => current.includes(day) ? current.filter((x) => x !== day) : [...current, day].sort());

  if (enabled !== true) {
    return <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100"><section className="mx-auto max-w-2xl rounded-2xl border border-slate-800 bg-slate-900/60 p-6"><Link href="/" className="text-sm text-amber-300 hover:underline">← 回儀表板</Link><h1 className="mt-4 text-2xl font-bold">自動流水線</h1><p className="mt-3 text-sm text-slate-300">{enabled === null ? "正在確認功能狀態……" : "此功能目前已關閉。啟用 AUTO_PIPELINE_ENABLED 後，批次建立與總覽才會開放。"}</p></section></main>;
  }

  return <main className="min-h-screen bg-slate-950 text-slate-100 px-4 py-6 sm:px-8">
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div><Link href="/" className="text-sm text-amber-300 hover:underline">← 回儀表板</Link><h1 className="mt-3 text-2xl font-bold">自動流水線</h1><p className="mt-1 text-sm text-slate-400">預設關閉。確認批次後只處理社群文，禁用詞或【需補】會停在人工處理，不會繞過檢查。</p></div>
        <span className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">未審也會依排程發佈</span>
      </header>
      {notice && <div role="status" className="rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm">{notice}</div>}
      <section className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">建立批次預覽</h2><select value={source} onChange={(e) => { setSource(e.target.value as BatchSource); setResearch(e.target.value === "research"); }} className="rounded bg-slate-950 border border-slate-700 px-3 py-2 text-sm"><option value="manual">手動貼上</option><option value="file">檔案上傳</option><option value="research">品牌調研選題</option></select></div>
          <label className="block text-sm text-slate-300">貼上內容或調研結果<textarea value={text} onChange={(e) => setText(e.target.value)} rows={9} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm" placeholder={'品牌：NAS\n日期：2026-11-01 10:10\n這篇貼文的提示詞\n=====\n品牌：ABL\n另一篇提示詞'} /></label>
          <label className="text-sm text-slate-300">上傳 .txt 檔<input type="file" accept=".txt,text/plain" onChange={(e) => void handleFile(e.target.files?.[0])} className="mt-2 block w-full text-xs" /></label>
          {research && topics.length > 0 && <div className="rounded-lg border border-slate-800 p-3"><p className="mb-2 text-sm">勾選要處理的選題</p>{topics.map((topic) => <label key={topic.index} className="flex gap-2 py-1 text-xs"><input type="checkbox" checked={selectedTopics.includes(topic.index)} onChange={(e) => setSelectedTopics((s) => e.target.checked ? [...s, topic.index] : s.filter((n) => n !== topic.index))} /><span>{topic.title || `選題 ${topic.index}`}　{topic.genreRaw}</span></label>)}</div>}
          <label className="block text-sm text-slate-300">所屬專案 ID（可留空）<input value={projectId} onChange={(e) => setProjectId(e.target.value)} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2" /></label>
          <div className="rounded-xl border border-slate-800 p-3 space-y-3"><p className="text-sm font-medium">日期規則（套用至未填日期的項目）</p><div className="grid gap-2 sm:grid-cols-2"><label className="text-xs text-slate-400">起始日期<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 p-2 text-slate-100" /></label><label className="text-xs text-slate-400">時間<input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 p-2 text-slate-100" /></label></div><div className="flex flex-wrap gap-3 text-xs">{["日","一","二","三","四","五","六"].map((label, day) => <label key={day} className="flex items-center gap-1"><input type="checkbox" checked={weekdays.includes(day)} onChange={() => toggleWeekday(day)} />週{label}</label>)}</div><button onClick={applyRule} className="rounded-lg border border-slate-700 px-3 py-2 text-xs hover:bg-slate-800">套用日期規則</button></div>
          <button onClick={preview} className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950">產生預覽</button>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between"><h2 className="font-semibold">預覽清單</h2><span className="text-xs text-slate-400">{entries.length} / 12 篇</span></div>
          {entries.length === 0 ? <p className="text-sm text-slate-500">貼上內容並產生預覽後，可逐篇調整品牌與時間。</p> : <div className="max-h-[60vh] space-y-3 overflow-auto">{entries.map((entry, index) => <article key={index} className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 space-y-2"><div className="flex items-center justify-between"><strong className="text-sm">第 {index + 1} 篇</strong><button onClick={() => setEntries((list) => list.filter((_, i) => i !== index))} className="text-xs text-rose-300">移除</button></div><div className="grid grid-cols-2 gap-2"><select value={entry.brandId || ""} onChange={(e) => updateEntry(index, { brandId: (e.target.value || null) as PipelineEntry["brandId"] })} className="rounded border border-slate-700 bg-slate-900 p-2 text-xs"><option value="">選品牌</option>{BRANDS.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select><input type="datetime-local" value={asLocalValue(entry.scheduledAt)} onChange={(e) => updateEntry(index, { scheduledAt: fromLocalValue(e.target.value) })} className="min-w-0 rounded border border-slate-700 bg-slate-900 p-2 text-xs" /></div><p className="text-xs text-slate-400">提示詞：{entry.prompt.slice(0, 40)}{entry.prompt.length > 40 ? "…" : ""}</p>{entry.warning.length > 0 && <p className="text-xs text-amber-300">缺漏警示：{entry.warning.join("、")}</p>}</article>)}</div>}
          <button disabled={!entries.length || busy} onClick={() => void confirmBatch()} className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-40">確認並建立任務</button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">批次與任務總覽</h2><button onClick={() => void fetchOverview()} className="text-xs text-amber-300">重新整理</button></div>
        <div className="space-y-4">{batches.map((batch) => <div key={batch.id} className="rounded-xl border border-slate-800 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><b>{batch.batch_no}</b><span className="ml-3 text-xs text-slate-400">{batch.source} · {batch.status}</span></div><button onClick={() => void action({ batchId: batch.id, action: "cancel" })} className="text-xs text-rose-300">取消整批</button></div><div className="mt-2 divide-y divide-slate-800">{jobs.filter((job) => job.batch_id === batch.id).map((job) => <div key={job.id} className="grid gap-2 py-3 text-xs md:grid-cols-[1fr_1fr_1fr_2fr_auto] md:items-center"><span>{BRANDS.find((brand) => brand.id === job.brand_id)?.name || job.brand_id}</span><span>{job.scheduled_at ? new Date(job.scheduled_at).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" }) : "未指定時間"}</span><span>{STATUS_LABEL[job.status] || job.status}</span><span>{job.current_step}{job.error_reason ? `：${job.error_reason}` : ""}</span><span className="flex gap-2">{job.status === "scheduled" && !job.reviewed && <button onClick={() => void action({ id: job.id, action: "reviewed" })} className="text-emerald-300">標記已審</button>}<button onClick={() => void action({ id: job.id, action: "cancel" })} className="text-rose-300">取消</button></span><div className="md:col-span-5"><textarea value={draftChanges[job.id] ?? job.draft_content ?? ""} onChange={(e) => setDraftChanges((all) => ({ ...all, [job.id]: e.target.value }))} rows={5} className="w-full rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs leading-relaxed" placeholder="生成或優化後的社群草稿" /><button disabled={!draftChanges[job.id]} onClick={() => void saveDraft(job.id)} className="mt-2 rounded border border-emerald-700 px-3 py-1.5 text-emerald-300 disabled:opacity-40">保存修改並標記已審</button></div></div>)}</div></div>)}{batches.length === 0 && <p className="text-sm text-slate-500">目前沒有批次。</p>}</div>
      </section>
    </div>
  </main>;
}
