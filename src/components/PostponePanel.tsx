"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";

const BRANDS = [
  { id: "", name: "全部品牌" }, { id: "nas", name: "平衡空間" }, { id: "abl", name: "艾伯林量子調頻" }, { id: "i8", name: "初八企業顧問" }, { id: "erick", name: "艾瑞克個人" },
];
const DAY_OPTIONS = [1, 2, 3, 5, 7, 10, 14, 21, 30];

interface Item { jobId: string; brandName: string; title: string; before: string; after: string; social: number }
interface Result { dryRun: boolean; days: number; count: number; items: Item[]; skipped?: Array<{ title: string; reason: string }> }

const todayTaipei = (): string => new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);

/** 整批往後延發佈：先試算看前後對照，確認後才真的改時間 */
export default function PostponePanel({ onDone }: { onDone?: () => void }) {
  const [brandId, setBrandId] = useState("");
  const [fromDate, setFromDate] = useState(todayTaipei());
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState<"" | "preview" | "apply">("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");

  const run = async (dryRun: boolean) => {
    setBusy(dryRun ? "preview" : "apply");
    setError("");
    try {
      const res = await fetch("/api/auto-pipeline/postpone", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, fromDate, days, dryRun }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "延後失敗"); setResult(null); return; }
      setResult(data);
      if (!dryRun) onDone?.();
    } catch {
      setError("連線失敗，請再按一次");
    } finally {
      setBusy("");
    }
  };

  const reset = () => setResult(null);

  return <section className="rounded-2xl border border-sky-500/30 bg-sky-500/5 p-4 sm:p-6 space-y-3">
    <div>
      <h2 className="font-semibold">往後延發佈</h2>
      <p className="mt-1 text-xs text-slate-400">要讓檔期時，把還沒發的文章整批往後挪。FB、IG、Threads 一起延，彼此的間隔不變，文章內容不會動。官網文章已經上架，不受影響。</p>
    </div>
    <div className="flex flex-wrap items-end gap-3 text-sm">
      <label className="text-slate-300">品牌<select value={brandId} onChange={(e) => { setBrandId(e.target.value); reset(); }} className="mt-1 block rounded border border-slate-700 bg-slate-950 px-2 py-1">{BRANDS.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>
      <label className="text-slate-300">從這一天以後的文章<input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); reset(); }} className="mt-1 block rounded border border-slate-700 bg-slate-950 px-2 py-1" /></label>
      <label className="text-slate-300">往後延<select value={days} onChange={(e) => { setDays(Number(e.target.value)); reset(); }} className="mt-1 block rounded border border-slate-700 bg-slate-950 px-2 py-1">{DAY_OPTIONS.map((day) => <option key={day} value={day}>{day} 天</option>)}</select></label>
      <Button variant="secondary" size="sm" disabled={!!busy} onClick={() => void run(true)}>{busy === "preview" ? "試算中…" : "先試算，看延後前後"}</Button>
    </div>
    {error && <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-200">{error}</p>}
    {result && <div className="space-y-2">
      {result.dryRun
        ? <p className="text-xs text-sky-200">{result.count ? `會延後 ${result.count} 篇，每篇往後 ${result.days} 天。還沒改任何資料，確認沒問題再按下面的按鈕。` : "這個範圍裡沒有還沒發的文章。"}</p>
        : <p className="text-xs text-emerald-300">已延後 {result.count} 篇，每篇往後 {result.days} 天。下方總覽已重新整理。</p>}
      {result.items.length > 0 && <div className="max-h-72 overflow-auto rounded-lg border border-slate-800">
        <table className="w-full text-xs"><thead className="bg-slate-900 text-slate-400"><tr><th className="px-2 py-1 text-left">品牌</th><th className="px-2 py-1 text-left">文章</th><th className="px-2 py-1 text-left">原本</th><th className="px-2 py-1 text-left">延後後</th><th className="px-2 py-1 text-left">IG／Threads</th></tr></thead>
          <tbody>{result.items.map((item) => <tr key={item.jobId} className="border-t border-slate-800"><td className="px-2 py-1">{item.brandName}</td><td className="px-2 py-1">{item.title}</td><td className="px-2 py-1 text-slate-400">{item.before}</td><td className="px-2 py-1 text-sky-200">{item.after}</td><td className="px-2 py-1">{item.social ? `一起延 ${item.social} 則` : "無"}</td></tr>)}</tbody></table>
      </div>}
      {result.skipped && result.skipped.length > 0 && <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-200">{result.skipped.map((item, index) => <p key={index}>{item.title}：{item.reason}</p>)}</div>}
      {result.dryRun && result.count > 0 && <Button variant="primary" size="sm" disabled={!!busy} onClick={() => void run(false)}>{busy === "apply" ? "延後中…" : `確認延後這 ${result.count} 篇`}</Button>}
    </div>}
  </section>;
}
