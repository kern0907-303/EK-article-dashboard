"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import { applyDateRule, parsePipelineBatch, PIPELINE_MAX_BATCH_SIZE, type BatchSource, type PipelineEntry } from "@/lib/auto-pipeline";
import { parsePastedTopics, materialFor } from "@/lib/topic-parse";
import { buildGenrePrompt, GENRES, type BrandKey, type FunnelLevel, type GenreId } from "@/data/skills/genres";
import { DEFAULT_SCHEDULE_TIME } from "@/lib/schedule-time";
import { useRouter } from "next/navigation";
import SchedulePicker from "@/components/SchedulePicker";
import PipelineTimeline from "@/components/PipelineTimeline";
import ReoptimizePanel from "@/components/ReoptimizePanel";
import PipelineBrainPicker from "@/components/PipelineBrainPicker";

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

const DERIVATIVE_BRAND_IDS: Record<string, string> = { nas: "brand_b_nas", abl: "brand_c_abl", i8: "brand_a_i8", erick: "personal_brand" };

export default function AutoPipelinePage() {
  const router = useRouter();
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
  // 文章框展開/收合：預設收合（5 行），展開後約 28 行；每篇各自控制，也可整批一起展開或收合
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
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
  // 還有任務在跑時，每 20 秒自動更新一次畫面（只讀資料庫，不會觸發 n8n）；全部結束就停止
  const hasActiveJobs = jobs.some((job) => ["pending", "generating", "optimizing"].includes(job.status));
  useEffect(() => {
    if (!hasActiveJobs) return;
    const timer = setInterval(() => { void fetchOverview(); }, 20_000);
    return () => clearInterval(timer);
  }, [hasActiveJobs]);
  // 日期選擇器的可選範圍：至少晚於現在 30 分鐘（流水線的安全間隔），最遠 60 天
  const pickerMin = useMemo(() => new Date(Date.now() + 30 * 60 * 1000), []);
  const pickerMax = useMemo(() => new Date(Date.now() + 120 * 24 * 60 * 60 * 1000), []);

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
        const genre = topic.genre && topic.genre !== "fan" && GENRES[topic.genre].enabled ? topic.genre : null;
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
      setEntries(withRule(next));
    } else {
      const result = parsePipelineBatch(text, source);
      setEntries(withRule(result.entries));
      if (result.error) setNotice(result.error);
    }
  };

  // 套用日期規則：只填還沒有日期的項目，並清掉「缺少日期」警示
  const withRule = (list: PipelineEntry[]) => (startDate && weekdays.length ? applyDateRule(list, startDate, weekdays, time) : list)
    .map((entry) => entry.scheduledAt ? { ...entry, warning: entry.warning.filter((item) => item !== "缺少日期") } : entry);
  const dayText = (iso: string | null) => iso ? new Date(iso).toLocaleDateString("zh-TW", { timeZone: "Asia/Taipei", month: "numeric", day: "numeric", weekday: "short" }) : "";
  const applyRule = () => {
    if (entries.length === 0) { setNotice("右邊還沒有預覽清單，請先按「產生預覽」。"); return; }
    if (!startDate) { setNotice("請先在日期規則選一個起始日期。"); return; }
    if (weekdays.length === 0) { setNotice("請至少勾選一個星期。"); return; }
    const next = withRule(entries);
    const filled = next.filter((entry, i) => entry.scheduledAt && entry.scheduledAt !== entries[i].scheduledAt).length;
    setEntries(next);
    const dated = next.filter((entry) => entry.scheduledAt);
    setNotice(filled ? `已把日期套用到 ${filled} 篇，從 ${dayText(dated[0].scheduledAt)} 到 ${dayText(dated[dated.length - 1].scheduledAt)}。已經有日期的項目不會被改。` : "沒有可套用的項目，所有項目都已經有日期。");
  };
  const updateEntry = (index: number, fields: Partial<PipelineEntry>) => setEntries((current) => current.map((entry, i) => {
    if (i !== index) return entry;
    const warning = fields.brandId ? entry.warning.filter((item) => item !== "缺少品牌") : entry.warning;
    return { ...entry, ...fields, warning };
  }));
  const confirmBatch = async () => {
    const problems = entries.flatMap((entry, i) => {
      const issues = [...entry.warning.filter((w) => w !== "缺少日期"), ...(!entry.brandId && !entry.warning.includes("缺少品牌") ? ["缺少品牌"] : []), ...(!entry.prompt?.trim() && !entry.warning.includes("缺少提示詞") ? ["缺少提示詞"] : [])];
      return issues.length ? [`第 ${i + 1} 篇：${issues.join("、")}`] : [];
    });
    if (problems.length) { setNotice(`無法建立，請先修正：${problems.join("；")}`); return; }
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
  const sendToMaya = (job: any, platform: "Threads" | "IG" | "Facebook") => {
    const content = (draftChanges[job.id] ?? job.draft_content ?? "").trim();
    if (!content) { setNotice("這篇還沒有文案內容，生成完成後才能改寫。"); return; }
    const brandId = DERIVATIVE_BRAND_IDS[job.brand_id] || "personal_brand";
    const field = platform === "Threads" ? "social_copy_threads" : platform === "Facebook" ? "social_copy_facebook" : "social_copy_instagram";
    const platformKey = platform === "Threads" ? "threads" : platform === "Facebook" ? "facebook" : "instagram";
    try {
      const key = `ai_team_dashboard_workspace_${brandId}`;
      const current = JSON.parse(localStorage.getItem(key) || "null") || { social_copy: "", web_architecture: "", seo_keywords: [], ad_data: [] };
      const existing = typeof current[field] === "string" ? current[field].trim() : "";
      if (existing && existing !== content && !window.confirm(`主工作區的「${platform === "Threads" ? "Threads" : platform === "Facebook" ? "Facebook" : "Instagram"}」分頁已經有一份文案，要用這篇取代嗎？`)) return;
      localStorage.setItem(key, JSON.stringify({ ...current, active_platform: platformKey, social_copy: content, [field]: content, suggested_schedule_at: job.scheduled_at || null }));
    } catch { setNotice("瀏覽器無法暫存文案，請改用複製貼上。"); return; }
    router.push(`/?brand=${brandId}&platform=${platformKey}&from=auto-pipeline`);
  };
  const action = async (payload: Record<string, string>) => {
    const res = await fetch("/api/auto-pipeline", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) { setNotice(data.error || "操作失敗"); return; }
    if (payload.action === "reviewed") setNotice("已標記已審。這只是你的記號，不會改變發文；沒標記也會照排程時間發出。");
    if (payload.action === "cancel") {
      const n = Array.isArray(data.cancelled) ? data.cancelled.length : 0;
      setNotice(`已取消 ${n} 篇。這些項目不會再生成或發出，記錄保留在清單中（狀態為「已取消」）。`);
    }
    await fetchOverview();
  };
  const saveDraft = async (id: string) => {
    const res = await fetch("/api/auto-pipeline", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action: "edit", content: draftChanges[id] }) });
    const data = await res.json();
    if (!res.ok) setNotice(data.error || "文案儲存失敗"); else { setNotice(jobs.find((job) => job.id === id)?.queue_id ? "文案已更新並標記為已審，排程列也已同步更新。" : "草稿已儲存，但 FB 尚未排程；請到多平台衍生頁完成排程。"); setDraftChanges((all) => { const next = { ...all }; delete next[id]; return next; }); await fetchOverview(); }
  };
  const toggleWeekday = (day: number) => setWeekdays((current) => current.includes(day) ? current.filter((x) => x !== day) : [...current, day].sort());

  if (enabled !== true) {
    return <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100"><section className="mx-auto max-w-2xl rounded-2xl border border-slate-800 bg-slate-900/60 p-6"><Link href="/" className="text-sm text-amber-300 hover:underline">← 回儀表板</Link><h1 className="mt-4 text-2xl font-bold">自動流水線</h1><p className="mt-3 text-sm text-slate-300">{enabled === null ? "正在確認功能狀態……" : "此功能目前已關閉。啟用 AUTO_PIPELINE_ENABLED 後，批次建立與總覽才會開放。"}</p></section></main>;
  }

  return <main className="min-h-screen bg-slate-950 text-slate-100 px-4 py-6 sm:px-8">
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div><Link href="/" className="text-sm text-amber-300 hover:underline">← 回儀表板</Link><h1 className="mt-3 text-2xl font-bold">自動流水線</h1><p className="mt-1 text-sm text-slate-400">預設關閉。確認批次後只處理社群文字（不會生成圖片，貼文配圖由發布流程決定），禁用詞或【需補】會停在人工處理，不會繞過檢查。</p></div>
        <span className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">未審也會依排程發佈</span>
      </header>
      {notice && <div role="status" className="rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm">{notice}</div>}
      <PipelineBrainPicker />
      <ReoptimizePanel />
      <PipelineTimeline />
      <section className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">建立批次預覽</h2><select value={source} onChange={(e) => { setSource(e.target.value as BatchSource); setResearch(e.target.value === "research"); }} className="rounded bg-slate-950 border border-slate-700 px-3 py-2 text-sm"><option value="manual">手動貼上</option><option value="file">檔案上傳</option><option value="research">品牌調研選題</option></select></div>
          <label className="block text-sm text-slate-300">貼上內容或調研結果（單批最多 {PIPELINE_MAX_BATCH_SIZE} 篇，用單獨一行 ===== 分隔）<textarea value={text} onChange={(e) => setText(e.target.value)} rows={9} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm" placeholder={'品牌：NAS\n日期：2026-11-01 10:10\n這篇貼文的提示詞\n=====\n品牌：ABL\n另一篇提示詞'} /></label>
          <label className="text-sm text-slate-300">上傳 .txt 檔<input type="file" accept=".txt,text/plain" onChange={(e) => void handleFile(e.target.files?.[0])} className="mt-2 block w-full text-xs" /></label>
          {research && topics.length > 0 && <div className="rounded-lg border border-slate-800 p-3"><p className="mb-2 text-sm">勾選要處理的選題</p>{topics.map((topic) => <label key={topic.index} className="flex gap-2 py-1 text-xs"><input type="checkbox" checked={selectedTopics.includes(topic.index)} onChange={(e) => setSelectedTopics((s) => e.target.checked ? [...s, topic.index] : s.filter((n) => n !== topic.index))} /><span>{topic.title || `選題 ${topic.index}`}　{topic.genreRaw}</span></label>)}</div>}
          <label className="block text-sm text-slate-300">所屬專案 ID（可留空）<input value={projectId} onChange={(e) => setProjectId(e.target.value)} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2" /></label>
          <div className="rounded-xl border border-slate-800 p-3 space-y-3"><p className="text-sm font-medium">日期規則（套用至未填日期的項目）</p><div className="text-xs text-slate-400">起始日期與時間（點日期，時間上下滾動選，預設 10:10）<div className="mt-1 rounded border border-slate-700 bg-slate-950 p-2"><SchedulePicker value={startDate ? `${startDate}T${time}` : ""} onChange={(v) => { setStartDate(v.slice(0, 10)); setTime(v.slice(11, 16)); }} min={pickerMin} max={pickerMax} accentClass="bg-amber-600" /></div></div><div className="flex flex-wrap gap-3 text-xs">{["日","一","二","三","四","五","六"].map((label, day) => <label key={day} className="flex items-center gap-1"><input type="checkbox" checked={weekdays.includes(day)} onChange={() => toggleWeekday(day)} />週{label}</label>)}</div><Button variant="secondary" onClick={applyRule}>套用日期規則</Button></div>
          <Button variant="primary" onClick={preview}>產生預覽</Button>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between"><h2 className="font-semibold">預覽清單</h2><span className="text-xs text-slate-400">{entries.length} / {PIPELINE_MAX_BATCH_SIZE} 篇（單批上限）</span></div>
          {entries.length === 0 ? <p className="text-sm text-slate-500">貼上內容並產生預覽後，可逐篇調整品牌與時間。</p> : <div className="space-y-3">{entries.map((entry, index) => <article key={index} className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 space-y-2"><div className="flex items-center justify-between"><strong className="text-sm">第 {index + 1} 篇</strong><Button variant="danger" size="sm" onClick={() => setEntries((list) => list.filter((_, i) => i !== index))}>移除</Button></div><div className="grid grid-cols-2 gap-2"><select value={entry.brandId || ""} onChange={(e) => updateEntry(index, { brandId: (e.target.value || null) as PipelineEntry["brandId"] })} className="rounded border border-slate-700 bg-slate-900 p-2 text-xs"><option value="">選品牌</option>{BRANDS.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select><div className="min-w-0 rounded border border-slate-700 bg-slate-900 p-2"><SchedulePicker value={asLocalValue(entry.scheduledAt)} onChange={(v) => updateEntry(index, { scheduledAt: fromLocalValue(v) })} min={pickerMin} max={pickerMax} accentClass="bg-amber-600" /></div></div><p className="text-xs text-slate-400">提示詞：{entry.prompt.slice(0, 40)}{entry.prompt.length > 40 ? "…" : ""}</p>{entry.warning.length > 0 && <p className="text-xs text-amber-300">缺漏警示：{entry.warning.join("、")}</p>}</article>)}</div>}
          <Button variant="primary" disabled={!entries.length || busy} onClick={() => void confirmBatch()}>確認並建立任務</Button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">批次與任務總覽</h2><Button variant="ghost" size="sm" onClick={() => void fetchOverview()}>重新整理</Button></div>
        <div className="space-y-4">{batches.map((batch) => <div key={batch.id} className="rounded-xl border border-slate-800 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><b>{batch.batch_no}</b><span className="ml-3 text-xs text-slate-400">{batch.source} · {batch.status}</span>{(() => { const list = jobs.filter((job) => job.batch_id === batch.id); const done = list.filter((job) => ["scheduled", "manual", "failed", "cancelled"].includes(job.status)).length; const pct = list.length ? Math.round((done / list.length) * 100) : 0; const running = list.find((job) => ["generating", "optimizing"].includes(job.status)); const idleMin = running?.updated_at ? Math.floor((Date.now() - new Date(running.updated_at).getTime()) / 60000) : 0; const stuck = !!running && idleMin >= 5; const allDone = list.length > 0 && done === list.length; return <div className="mt-2 min-w-[260px]"><div className="flex items-center justify-between text-xs"><span className={allDone ? "text-emerald-300" : "text-amber-300"}>{allDone ? `全部處理完畢（${list.length} 篇）` : `處理中 ${done} / ${list.length} 篇（${pct}%）`}</span></div><div className="mt-1 h-2 w-full overflow-hidden rounded bg-slate-800" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className={`h-full transition-all ${allDone ? "bg-emerald-400" : stuck ? "bg-red-400" : "bg-amber-400"}`} style={{ width: `${pct}%` }} /></div>{!allDone && <p className={`mt-1 text-xs ${stuck ? "text-red-300" : "text-slate-400"}`}>{running ? (stuck ? `第 ${list.indexOf(running) + 1} 篇已 ${idleMin} 分鐘沒有更新，可能卡住，建議取消該篇或整批後重建` : `正在${STATUS_LABEL[running.status]}第 ${list.indexOf(running) + 1} 篇（運行中，約 ${idleMin} 分鐘前更新），頁面每 20 秒自動刷新`) : "排程器每分鐘處理一篇，等待下一輪，頁面每 20 秒自動刷新"}</p>}</div>; })()}</div><div className="flex gap-2"><Button variant="secondary" size="sm" onClick={() => setExpanded((all) => { const next = { ...all }; jobs.filter((job) => job.batch_id === batch.id).forEach((job) => { next[job.id] = true; }); return next; })}>全部展開</Button><Button variant="secondary" size="sm" onClick={() => setExpanded((all) => { const next = { ...all }; jobs.filter((job) => job.batch_id === batch.id).forEach((job) => { next[job.id] = false; }); return next; })}>全部收合</Button><Button variant="danger" size="sm" onClick={() => void action({ batchId: batch.id, action: "cancel" })}>取消整批</Button></div></div><div className="mt-2 divide-y divide-slate-800">{jobs.filter((job) => job.batch_id === batch.id).map((job) => <div key={job.id} className="grid gap-2 py-3 text-xs md:grid-cols-[1fr_1fr_1fr_2fr_auto] md:items-center"><span>{BRANDS.find((brand) => brand.id === job.brand_id)?.name || job.brand_id}</span><span>{job.scheduled_at ? new Date(job.scheduled_at).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" }) : "未指定時間"}</span><span>{STATUS_LABEL[job.status] || job.status}</span><span>{job.status === "scheduled" && job.reviewed ? <b className="mr-1 text-emerald-300">已審 ✓</b> : null}{job.current_step}{job.error_reason ? `：${job.error_reason}` : ""}</span><span className="flex gap-2">{job.status === "scheduled" && !job.reviewed && <Button variant="secondary" size="sm" onClick={() => void action({ id: job.id, action: "reviewed" })}>標記已審</Button>}<Button variant="danger" size="sm" onClick={() => void action({ id: job.id, action: "cancel" })}>取消</Button></span><div className="md:col-span-5">{job.card_url ? <div className="mb-2 flex items-start gap-3 rounded-lg border border-slate-800 p-2"><a href={job.card_url} target="_blank" rel="noreferrer"><img src={job.card_url} alt="品牌圖卡預覽" className="h-24 rounded border border-slate-700" /></a><p className="text-xs text-slate-400">這是發 FB 時會附上的品牌圖卡（標題取自文案第一行），點圖可看大圖。要做 IG 或 Threads 的圖文與輪播，請按下方「帶去主工作區」。</p></div> : job.status === "scheduled" ? <p className="mb-2 text-xs text-slate-500">這篇沒有附品牌圖卡，發文時會用圖庫的圖。</p> : null}{Array.isArray(job.warnings) && job.warnings.some((w: string) => String(w).startsWith("發文前提醒")) ? <div className="mb-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-200"><b>發文前提醒（不在文章裡）</b>{job.warnings.filter((w: string) => String(w).startsWith("發文前提醒")).map((w: string, i: number) => <p key={i} className="mt-1">{String(w).replace(/^發文前提醒（不在文章裡）：/, "")}</p>)}</div> : null}<textarea value={draftChanges[job.id] ?? job.draft_content ?? ""} onChange={(e) => setDraftChanges((all) => ({ ...all, [job.id]: e.target.value }))} rows={expanded[job.id] ? 28 : 5} className="w-full rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs leading-relaxed" placeholder="生成或優化後的社群草稿" /><div className="mt-2 flex flex-wrap gap-2"><Button variant="secondary" size="sm" onClick={() => setExpanded((all) => ({ ...all, [job.id]: !all[job.id] }))}>{expanded[job.id] ? "收合文章" : "展開文章"}</Button><Button variant="secondary" size="sm" disabled={!draftChanges[job.id]} onClick={() => void saveDraft(job.id)}>保存修改並標記已審</Button><Button variant="secondary" size="sm" disabled={!(draftChanges[job.id] ?? job.draft_content)} onClick={() => sendToMaya(job, "Facebook")}>帶去主工作區（FB 原文，可做官網與 SEO）</Button><Button variant="secondary" size="sm" disabled={!(draftChanges[job.id] ?? job.draft_content)} onClick={() => sendToMaya(job, "Threads")}>帶去主工作區改寫成 Threads</Button><Button variant="secondary" size="sm" disabled={!(draftChanges[job.id] ?? job.draft_content)} onClick={() => sendToMaya(job, "IG")}>帶去主工作區改寫成 IG</Button></div></div></div>)}</div></div>)}{batches.length === 0 && <p className="text-sm text-slate-500">目前沒有批次。</p>}</div>
      </section>
    </div>
  </main>;
}
