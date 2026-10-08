"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type PreviewRow = {
  row_key: string; file_name: string; title_en: string; author_en: string; title_zh: string;
  author_zh: string; zh_status: string; domain: string; classification: "insert" | "update" | "skip" | "problem";
  problems: string[]; warnings: string[];
};
type NoteRow = {
  id: string; domain: string; title: string; author: string; title_zh: string | null;
  title_zh_subtitle: string | null; author_zh: string | null; translator_zh: string | null;
  publisher_zh: string | null; zh_source_url: string | null; zh_status: string | null; import_batch_id: string | null;
};
type BatchRow = { batch_id: string; created_at: string; summary: Record<string, unknown>; undone_at: string | null };
const DOMAINS = [["", "全部領域"], ["business-strategy", "商業策略"], ["emotions-psychology", "情緒心理"], ["life-philosophy", "生命哲學"], ["shenxinling-planning", "身心靈規劃"]] as const;
const STATUSES = ["", "confirmed", "unverified", "no_zh_edition"] as const;
const LABELS: Record<string, string> = { insert: "新增", update: "更新", skip: "跳過", problem: "有問題" };
const EDIT_FIELDS = ["title_zh", "title_zh_subtitle", "author_zh", "translator_zh", "publisher_zh", "zh_source_url", "zh_status"] as const;

function makeForm(files: File[], overrides: Record<string, Record<string, string>>) {
  const form = new FormData();
  files.forEach((file) => form.append("files", file, file.name));
  form.set("overrides", JSON.stringify(overrides));
  return form;
}

export default function KnowledgeImportWorkspace() {
  const [tab, setTab] = useState<"import" | "overview">("import");
  const [files, setFiles] = useState<File[]>([]);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [batchId, setBatchId] = useState("");
  const [category, setCategory] = useState("all");
  const [ack, setAck] = useState(false);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [domainFilter, setDomainFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    const response = await fetch("/api/knowledge-import", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "讀取知識庫失敗。");
    setNotes(data.notes || []); setBatches(data.batches || []);
  }, []);
  useEffect(() => { void refresh().catch((error) => setNotice(error instanceof Error ? error.message : "讀取失敗。")); }, [refresh]);

  const visibleRows = useMemo(() => rows.filter((row) => category === "all" || (category === "warning" ? row.warnings.length > 0 : row.classification === category)), [rows, category]);
  const filteredNotes = useMemo(() => notes.filter((row) => (!domainFilter || row.domain === domainFilter) && (!statusFilter || row.zh_status === statusFilter)), [notes, domainFilter, statusFilter]);
  const selectedWarning = rows.some((row) => selected.includes(row.row_key) && row.warnings.length > 0);
  const overridesFor = (currentRows: PreviewRow[], currentEdits: Record<string, Record<string, string>>) => {
    const result = { ...currentEdits };
    currentRows.forEach((row) => {
      if (!result[row.row_key] && row.zh_status === "unverified") result[row.row_key] = { title_zh: row.title_zh, author_zh: row.author_zh, zh_status: row.zh_status };
    });
    return result;
  };

  const preview = async (sourceFiles = files, overrideValues = edits) => {
    if (!sourceFiles.length) { setNotice("請先選擇 .md 檔案。"); return; }
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/knowledge-import/preview", { method: "POST", body: makeForm(sourceFiles, overrideValues) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "預覽失敗。");
      const nextRows = data.rows as PreviewRow[];
      setRows(nextRows); setBatchId(data.batch_id); setAck(false);
      setSelected(nextRows.filter((row) => row.classification === "insert" || row.classification === "update").map((row) => row.row_key));
      setNotice("預覽完成，共 " + data.count + " 筆。新增 " + data.classifications.insert + "、更新 " + data.classifications.update + "、跳過 " + data.classifications.skip + "、有問題 " + data.classifications.problem + "。");
    } catch (error) { setNotice(error instanceof Error ? error.message : "預覽失敗。"); }
    finally { setBusy(false); }
  };
  const editPreview = (row: PreviewRow, field: "title_zh" | "author_zh" | "zh_status", value: string) => {
    setRows((current) => current.map((item) => item.row_key === row.row_key ? { ...item, [field]: value } : item));
    setEdits((current) => ({ ...current, [row.row_key]: { ...(current[row.row_key] || {}), [field]: value } }));
  };
  const commit = async () => {
    setBusy(true); setNotice("");
    try {
      const form = makeForm(files, overridesFor(rows, edits));
      form.set("batch_id", batchId); form.set("selected_row_keys", JSON.stringify(selected)); form.set("warnings_acknowledged", ack ? "true" : "false");
      const response = await fetch("/api/knowledge-import/commit", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "匯入失敗。");
      const summary = data.batch.summary || {};
      setNotice((data.idempotent ? "此批次已完成，未重複寫入。" : "匯入完成。") + "新增 " + (summary.inserted || 0) + "、更新 " + (summary.updated || 0) + "、跳過 " + (summary.skipped || 0) + "。");
      setFiles([]); setRows([]); setSelected([]); setEdits({}); setBatchId(""); await refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "匯入失敗。"); }
    finally { setBusy(false); }
  };
  const undo = async (batch: BatchRow) => {
    if (!window.confirm("確定撤銷 " + batch.batch_id + "？只會刪除此批新增的筆記並還原此批快照。")) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/knowledge-import/undo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ batch_id: batch.batch_id, confirm_batch_id: batch.batch_id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "撤銷失敗。");
      setNotice("批次 " + batch.batch_id + " 已撤銷。"); await refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "撤銷失敗。"); }
    finally { setBusy(false); }
  };
  const editNote = (note: NoteRow, field: typeof EDIT_FIELDS[number], value: string) => setEdits((current) => ({ ...current, [note.id]: { ...(current[note.id] || {}), [field]: value } }));
  const saveNote = async (note: NoteRow) => {
    const patch = edits[note.id];
    if (!patch) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/knowledge-import", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: note.id, ...patch }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "儲存失敗。");
      setNotice("已更新《" + (note.title_zh || note.title) + "》的中文書目欄位。");
      setEdits((current) => { const next = { ...current }; delete next[note.id]; return next; }); await refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "儲存失敗。"); }
    finally { setBusy(false); }
  };
  const categoryOptions = [
    ["all", "全部 " + rows.length], ["insert", "新增 " + rows.filter((r) => r.classification === "insert").length],
    ["update", "更新 " + rows.filter((r) => r.classification === "update").length], ["skip", "跳過 " + rows.filter((r) => r.classification === "skip").length],
    ["problem", "有問題 " + rows.filter((r) => r.problems.length).length], ["warning", "有警告 " + rows.filter((r) => r.warnings.length).length],
  ] as const;

  return <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-8"><div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><Link href="/" className="text-sm text-amber-300 hover:underline">← 回儀表板</Link><h1 className="mt-3 text-2xl font-bold">知識庫匯入</h1><p className="mt-1 text-sm text-slate-400">獨立管理 Markdown 筆記與中文書目。寫入由登入保護的伺服器端處理。</p></div>
      <div className="flex rounded-xl border border-slate-800 bg-slate-900 p-1"><button onClick={() => setTab("import")} className={"rounded-lg px-4 py-2 text-sm " + (tab === "import" ? "bg-amber-400 font-semibold text-slate-950" : "text-slate-300")}>匯入與批次</button><button onClick={() => setTab("overview")} className={"rounded-lg px-4 py-2 text-sm " + (tab === "overview" ? "bg-amber-400 font-semibold text-slate-950" : "text-slate-300")}>知識庫總覽</button></div>
    </header>
    {notice && <div role="status" className="rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm">{notice}</div>}
    {tab === "import" ? <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6"><h2 className="font-semibold">選擇 Markdown 檔案</h2><p className="mt-1 text-xs leading-5 text-slate-400">最多 50 個檔案，每個不超過 500 KB。資料區需為新版 13 欄或相容的舊版格式。</p>
        <div className="mt-4 flex flex-wrap items-center gap-3"><input type="file" accept=".md,text/markdown" multiple onChange={(event) => { setFiles(Array.from(event.target.files || [])); setRows([]); setEdits({}); }} className="max-w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-slate-100" /><button disabled={!files.length || busy} onClick={() => void preview()} className="rounded-lg bg-indigo-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40">{busy ? "處理中…" : "產生伺服器預覽"}</button><span className="text-xs text-slate-400">已選 {files.length} 個</span></div>
      </section>
      {rows.length > 0 && <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">預覽結果</h2><p className="mt-1 text-xs text-slate-400">批次編號：{batchId}。警告可匯入，但必須先確認；有問題的檔案不能匯入。</p></div><span className="rounded-lg bg-slate-950 px-3 py-2 text-xs text-slate-300">共 {rows.length} 筆</span></div>
        <div className="mt-4 flex flex-wrap gap-2">{categoryOptions.map(([value, label]) => <button key={value} onClick={() => setCategory(value)} className={"rounded-full border px-3 py-1.5 text-xs " + (category === value ? "border-indigo-400 bg-indigo-400/15 text-indigo-200" : "border-slate-700 text-slate-400")}>{label}</button>)}</div>
        <div className="mt-4 max-h-[65vh] overflow-auto rounded-xl border border-slate-800"><table className="min-w-[1100px] w-full border-collapse text-left text-xs"><thead className="sticky top-0 bg-slate-950 text-slate-400"><tr>{["匯入", "檔名", "書名（中／英）", "作者", "zh_status", "領域", "分類", "警告與問題"].map((label) => <th key={label} className="px-3 py-3 font-medium">{label}</th>)}</tr></thead>
          <tbody>{visibleRows.map((row) => <tr key={row.row_key} className="border-t border-slate-800 align-top">
            <td className="px-3 py-3"><input aria-label={"選擇 " + row.file_name} type="checkbox" disabled={row.problems.length > 0} checked={selected.includes(row.row_key)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, row.row_key] : current.filter((key) => key !== row.row_key))} /></td>
            <td className="max-w-44 break-all px-3 py-3 text-slate-300">{row.file_name}</td>
            <td className="min-w-64 px-3 py-3"><p className="font-medium text-slate-100">{row.title_zh || "（中文書名空白）"}</p><p className="mt-1 text-slate-500">{row.title_en || "（英文書名空白）"}</p>{row.zh_status === "unverified" && <>
              <input aria-label={"中文書名 " + row.file_name} value={row.title_zh} onChange={(event) => editPreview(row, "title_zh", event.target.value)} onBlur={() => void preview(files, overridesFor(rows, edits))} placeholder="補充中文書名" className="mt-2 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5" />
              <input aria-label={"中文作者 " + row.file_name} value={row.author_zh} onChange={(event) => editPreview(row, "author_zh", event.target.value)} onBlur={() => void preview(files, overridesFor(rows, edits))} placeholder="補充中文作者" className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5" />
            </>}</td>
            <td className="px-3 py-3"><span>{row.author_zh || "（中文作者空白）"}</span><p className="mt-1 text-slate-500">{row.author_en}</p></td>
            <td className="px-3 py-3">{row.zh_status === "unverified" ? <select value={row.zh_status} onChange={(event) => { const value = event.target.value; editPreview(row, "zh_status", value); void preview(files, { ...edits, [row.row_key]: { ...(edits[row.row_key] || {}), zh_status: value } }); }} className="rounded border border-slate-700 bg-slate-950 px-2 py-1"><option value="confirmed">confirmed</option><option value="unverified">unverified</option><option value="no_zh_edition">no_zh_edition</option></select> : row.zh_status}</td>
            <td className="px-3 py-3 text-slate-300">{DOMAINS.find(([id]) => id === row.domain)?.[1] || row.domain || "（缺少）"}</td>
            <td className="px-3 py-3"><span className={"rounded px-2 py-1 " + (row.problems.length ? "bg-rose-500/10 text-rose-300" : row.classification === "update" ? "bg-amber-500/10 text-amber-200" : "bg-emerald-500/10 text-emerald-200")}>{LABELS[row.problems.length ? "problem" : row.classification]}</span></td>
            <td className="max-w-96 px-3 py-3">{row.warnings.map((warning) => <p key={warning} className="mb-1 text-amber-300">警告：{warning}</p>)}{row.problems.map((problem) => <p key={problem} className="mb-1 text-rose-300">問題：{problem}</p>)}{!row.problems.length && !row.warnings.length && <span className="text-slate-600">無</span>}</td>
          </tr>)}</tbody></table>{!visibleRows.length && <p className="p-5 text-sm text-slate-500">此分類沒有資料。</p>}</div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4"><label className={"flex items-center gap-2 text-sm " + (selectedWarning ? "text-amber-200" : "text-slate-500")}><input type="checkbox" disabled={!selectedWarning} checked={ack} onChange={(event) => setAck(event.target.checked)} />我已看過所選資料的警告</label><button disabled={busy || !selected.length || (selectedWarning && !ack)} onClick={() => void commit()} className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40">{busy ? "匯入中…" : "確認匯入所選 " + selected.length + " 筆"}</button></div>
      </section>}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">最近 10 個批次</h2><p className="mt-1 text-xs text-slate-400">撤銷僅處理該批新增 ID 與更新前快照，不提供一般刪除。</p></div><button onClick={() => void refresh().catch((error) => setNotice(error instanceof Error ? error.message : "讀取失敗。"))} className="text-xs text-amber-300">重新整理</button></div>
        <div className="space-y-2">{batches.map((batch) => <article key={batch.batch_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 p-3"><div><strong className="text-sm">{batch.batch_id}</strong><p className="mt-1 text-xs text-slate-400">{new Date(batch.created_at).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })} · 新增 {String(batch.summary?.inserted ?? 0)} · 更新 {String(batch.summary?.updated ?? 0)} · 跳過 {String(batch.summary?.skipped ?? 0)} · {String(batch.summary?.status || "completed")}</p>{batch.undone_at && <p className="mt-1 text-xs text-slate-500">已撤銷於 {new Date(batch.undone_at).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}</p>}</div><button disabled={busy || Boolean(batch.undone_at)} onClick={() => void undo(batch)} className="rounded border border-rose-900 px-3 py-1.5 text-xs text-rose-300 disabled:opacity-40">{batch.undone_at ? "已撤銷" : "撤銷批次"}</button></article>)}{!batches.length && <p className="text-sm text-slate-500">目前沒有匯入批次。</p>}</div>
      </section>
    </div> : <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="font-semibold">知識庫總覽</h2><p className="mt-1 text-xs text-slate-400">共 {filteredNotes.length} 筆。只有 unverified 筆記可在此編輯中文書目。</p></div><div className="flex flex-wrap gap-2">
        <select value={domainFilter} onChange={(event) => setDomainFilter(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">{DOMAINS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">{STATUSES.map((value) => <option key={value} value={value}>{value || "全部狀態"}</option>)}</select>
      </div></div>
      <div className="mt-4 max-h-[72vh] overflow-auto rounded-xl border border-slate-800"><table className="min-w-[1200px] w-full border-collapse text-left text-xs"><thead className="sticky top-0 bg-slate-950 text-slate-400"><tr>{["書名（中／英）", "作者", "領域", "zh_status", "批次編號", "中文書目欄位編輯"].map((label) => <th key={label} className="px-3 py-3 font-medium">{label}</th>)}</tr></thead>
        <tbody>{filteredNotes.map((note) => { const values = { ...note, ...(edits[note.id] || {}) } as NoteRow; return <tr key={note.id} className="border-t border-slate-800 align-top">
          <td className="min-w-56 px-3 py-3"><p className="font-medium text-slate-100">{note.title_zh || "（中文書名空白）"}</p><p className="mt-1 text-slate-500">{note.title}</p></td>
          <td className="px-3 py-3"><p>{note.author_zh || "（中文作者空白）"}</p><p className="mt-1 text-slate-500">{note.author}</p></td><td className="px-3 py-3 text-slate-300">{DOMAINS.find(([id]) => id === note.domain)?.[1] || note.domain}</td>
          <td className="px-3 py-3">{note.zh_status || "unverified"}</td><td className="px-3 py-3 text-slate-400">{note.import_batch_id || "—"}</td>
          <td className="min-w-[520px] px-3 py-3">{note.zh_status === "unverified" ? <div className="grid grid-cols-2 gap-2">{EDIT_FIELDS.map((field) => field === "zh_status" ? <select key={field} aria-label={field + " " + note.title} value={values.zh_status || "unverified"} onChange={(event) => editNote(note, field, event.target.value)} className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5"><option value="confirmed">confirmed</option><option value="unverified">unverified</option><option value="no_zh_edition">no_zh_edition</option></select> : <input key={field} aria-label={field + " " + note.title} value={String(values[field] || "")} onChange={(event) => editNote(note, field, event.target.value)} placeholder={field} className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5" />)}<button disabled={busy || !edits[note.id]} onClick={() => void saveNote(note)} className="col-span-2 justify-self-start rounded border border-emerald-800 px-3 py-1.5 text-emerald-300 disabled:opacity-40">儲存中文欄位</button></div> : <span className="text-slate-600">唯讀</span>}</td>
        </tr>; })}</tbody></table>{!filteredNotes.length && <p className="p-5 text-sm text-slate-500">沒有符合條件的筆記。</p>}</div>
    </section>}
  </div></main>;
}
