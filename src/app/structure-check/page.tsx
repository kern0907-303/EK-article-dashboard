"use client";

// 對照檢視：把一篇文章和它用的流量結構並排，逐步看有沒有照源頭的寫法寫，
// 同時檢查「像但不模仿」與流量筆法。初期用來校準：確定生成的文章真的照結構走，再放手給自動流水線。

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import {
  FAMILY_LABEL, FAMILY_SHORT, FAMILY_SOURCE, FLOW_ANTI_IMITATION, FLOW_SHARED_CRAFT, FLOW_STRUCTURE_LIST,
  FLOW_STRUCTURES, checkFlowRules, type FlowCheckResult, type FlowFamily, type FlowRuleIssue,
} from "@/data/skills/flow-structures";
import { readStructureCheckHandoff } from "@/lib/structure-check-client";

const HIT_STYLE: Record<string, { label: string; tone: string }> = {
  yes: { label: "做到", tone: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200" },
  partial: { label: "部分", tone: "border-amber-400/40 bg-amber-400/10 text-amber-200" },
  no: { label: "沒做到", tone: "border-rose-400/40 bg-rose-400/10 text-rose-200" },
};
const RULE_STYLE: Record<FlowRuleIssue["level"], string> = {
  block: "text-rose-300",
  warn: "text-amber-200",
  ok: "text-emerald-300",
};
const RULE_ICON: Record<FlowRuleIssue["level"], string> = { block: "✗", warn: "△", ok: "✓" };
const FAMILIES: FlowFamily[] = ["jemmy", "domy", "chiukaun"];

/** 首屏標題逐字浮現 */
function AnimatedTitle({ text }: { text: string }) {
  return (
    <h1 className="text-xl font-extrabold text-slate-50 sm:text-2xl" style={{ textWrap: "balance" }} aria-label={text}>
      {Array.from(text).map((ch, i) => (
        <span key={i} aria-hidden className="inline-block animate-[ek-char-in_0.5s_ease-out_both]" style={{ animationDelay: `${i * 45}ms` }}>
          {ch === " " ? " " : ch}
        </span>
      ))}
    </h1>
  );
}

export default function StructureCheckPage() {
  const [text, setText] = useState("");
  const [structureId, setStructureId] = useState("J1");
  const [from, setFrom] = useState("");
  const [result, setResult] = useState<FlowCheckResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [libraryFamily, setLibraryFamily] = useState<FlowFamily>("jemmy");

  // 從主工作區或流水線帶過來的文章（localStorage 只有瀏覽器有，所以等掛載後再讀）
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const handoff = readStructureCheckHandoff();
      if (!handoff) return;
      setText(handoff.text);
      if (handoff.structureId && FLOW_STRUCTURES[handoff.structureId]) setStructureId(handoff.structureId);
      setFrom(handoff.from || "");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const structure = FLOW_STRUCTURES[structureId];
  // 程式規則即時算，不用等 AI
  const liveRules = useMemo(() => (text.trim() ? checkFlowRules(text, structureId) : []), [text, structureId]);
  const rules = result?.rules || liveRules;

  async function runCheck() {
    if (!text.trim()) { setError("請先貼上要檢查的文章。"); return; }
    setBusy(true); setError(""); setResult(null);
    try {
      let aiProvider = "";
      try { aiProvider = localStorage.getItem("ai_provider_override") || ""; } catch {}
      const res = await fetch("/api/structure-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, structureId, aiProvider }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `檢查失敗（${res.status}）`);
      setResult(data.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "檢查失敗");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-dvh bg-slate-950 px-4 py-6 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <AnimatedTitle text="對照檢視：這篇有沒有照流量結構寫" />
            <p className="text-sm text-slate-400" style={{ textWrap: "pretty" }}>左邊是源頭的寫法，右邊是這篇文章怎麼寫。目標是結構像、句子不像。</p>
          </div>
          <Link href="/" className="inline-flex min-h-[44px] items-center rounded-lg border border-white/20 px-4 text-sm font-semibold text-slate-100 transition active:scale-95 hover:bg-white/10">回主工作區</Link>
        </div>

        <section className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <label className="block text-xs font-bold text-slate-400">要對照的結構</label>
            <select
              value={structureId}
              onChange={(e) => { setStructureId(e.target.value); setResult(null); }}
              className="h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm"
            >
              {FAMILIES.map((family) => (
                <optgroup key={family} label={FAMILY_SHORT[family]}>
                  {FLOW_STRUCTURE_LIST.filter((s) => s.family === family).map((s) => (
                    <option key={s.id} value={s.id}>{s.id} {s.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            {structure && (
              <div className="space-y-2 text-sm">
                <p className="text-xs text-slate-500">{FAMILY_LABEL[structure.family]}｜來源：{FAMILY_SOURCE[structure.family]}</p>
                <p><b className="text-slate-300">用途：</b>{structure.use}</p>
                <p><b className="text-slate-300">源頭寫法：</b>{structure.sourceMove}</p>
                <p><b className="text-slate-300">艾瑞克版本：</b>{structure.erickTwist}</p>
                {structure.limits && <p className="text-amber-200"><b>限制：</b>{structure.limits}</p>}
                <p className="text-xs text-slate-500">建議 {structure.length[0]} 到 {structure.length[1]} 字</p>
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-400">文章{from ? `（從${from}帶來）` : ""}</label>
              <span className="text-xs text-slate-500">{text.replace(/\s+/g, "").length} 字</span>
            </div>
            <textarea
              value={text}
              onChange={(e) => { setText(e.target.value); setResult(null); }}
              rows={14}
              placeholder="貼上要檢查的文章，或從主工作區、自動流水線按「對照檢視」帶過來。"
              className="w-full rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm leading-relaxed"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" loading={busy} onClick={() => void runCheck()} className="active:scale-95">逐步對照</Button>
              <span className="text-xs text-slate-500">程式規則會即時更新；逐步對照由 AI 判定，大約二十秒。</span>
            </div>
            {error && <p className="text-sm text-rose-300">{error}</p>}
          </div>
        </section>

        {(rules.length > 0 || result) && (
          <section className="grid gap-4 lg:grid-cols-3">
            {(["流量筆法", "像但不模仿", "紅線"] as const).map((area) => (
              <div key={area} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                <h2 className="mb-2 text-sm font-bold text-slate-200">{area}</h2>
                {rules.filter((r) => r.area === area).map((r, i) => (
                  <p key={i} className={`mb-1 text-sm ${RULE_STYLE[r.level]}`}>{RULE_ICON[r.level]} {r.message}</p>
                ))}
                {area === "像但不模仿" && result && (
                  <p className={`mt-2 text-sm ${result.imitation.level === "high" ? "text-rose-300" : "text-emerald-300"}`}>
                    {result.imitation.level === "high" ? "✗ AI 判定：太像在模仿。" : "✓ AI 判定：只借了結構。"}{result.imitation.note}
                  </p>
                )}
                {rules.filter((r) => r.area === area).length === 0 && !(area === "像但不模仿" && result) && <p className="text-sm text-emerald-300">✓ 沒有問題</p>}
              </div>
            ))}
          </section>
        )}

        {result && structure && (
          <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold text-slate-100">逐步對照：{structure.id} {structure.name}</h2>
              <span className={`rounded-full border px-3 py-1 text-sm font-bold ${result.score >= 80 ? HIT_STYLE.yes.tone : result.score >= 50 ? HIT_STYLE.partial.tone : HIT_STYLE.no.tone}`}>
                符合度 {result.aiAvailable ? `${result.score} 分` : "AI 未回應"}
              </span>
            </div>
            {result.thesis && (
              <p className="text-sm"><b className="text-slate-300">這篇的唯一論點：</b>{result.thesis}{result.thesisNote ? <span className="text-amber-200">（{result.thesisNote}）</span> : null}</p>
            )}
            <div className="divide-y divide-slate-800">
              {structure.checkpoints.map((c, i) => {
                const r = result.checkpoints.find((x) => x.id === c.id);
                const hit = HIT_STYLE[r?.hit || "no"];
                return (
                  <div key={c.id} className="grid gap-2 py-3 md:grid-cols-[1fr_1.3fr_auto] md:items-start">
                    <div>
                      <p className="text-sm font-bold text-slate-200">{i + 1}. {c.label}</p>
                      <p className="text-xs text-slate-500">源頭寫法：{c.look}</p>
                    </div>
                    <div className="text-sm">
                      {r?.evidence ? <p className="rounded-lg border border-slate-800 bg-slate-950 p-2 text-slate-200">「{r.evidence}」</p> : <p className="text-slate-500">文章裡找不到對應的句子</p>}
                      {r?.note && <p className="mt-1 text-xs text-slate-400">{r.note}</p>}
                    </div>
                    <span className={`justify-self-start rounded-full border px-3 py-1 text-xs font-bold ${hit.tone}`}>{hit.label}</span>
                  </div>
                );
              })}
            </div>
            {result.fixes.length > 0 && (
              <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 text-sm text-sky-100">
                <b>先改這幾點</b>
                {result.fixes.map((f, i) => <p key={i} className="mt-1">{i + 1}. {f}</p>)}
              </div>
            )}
          </section>
        )}

        <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
          <h2 className="text-base font-bold text-slate-100">源頭寫法總覽（22 型）</h2>
          <div className="flex flex-wrap gap-2">
            {FAMILIES.map((family) => (
              <button
                key={family}
                type="button"
                onClick={() => setLibraryFamily(family)}
                className={`min-h-[44px] rounded-full border px-4 text-sm font-semibold transition active:scale-95 ${libraryFamily === family ? "border-white bg-white text-slate-950" : "border-white/20 bg-white/5 text-slate-200 hover:bg-white/10"}`}
              >
                {FAMILY_SHORT[family]}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500">{FAMILY_LABEL[libraryFamily]}｜來源：{FAMILY_SOURCE[libraryFamily]}</p>
          <div className="grid gap-3 md:grid-cols-2">
            {FLOW_STRUCTURE_LIST.filter((s) => s.family === libraryFamily).map((s) => (
              <div key={s.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <b className="text-slate-100">{s.id} {s.name}</b>
                  <button type="button" onClick={() => { setStructureId(s.id); setResult(null); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 transition active:scale-95 hover:bg-slate-800">用這型對照</button>
                </div>
                <p className="mt-1 text-slate-400">{s.use}</p>
                <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-xs text-slate-300">
                  {s.checkpoints.map((c) => <li key={c.id}>{c.label}</li>)}
                </ol>
                <p className="mt-2 text-xs text-slate-500">適用：{s.brands.map((b) => ({ nas: "平衡空間", abl: "艾伯林量子調頻", i8: "初八企業顧問", erick: "艾瑞克個人" })[b]).join("、")}{s.firstPersonReal ? "｜需要你的真實經歷" : ""}{s.needsCitation ? "｜需要查證過的書" : ""}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-slate-800 p-3 text-sm">
              <b className="text-slate-200">三家共通的流量筆法</b>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-slate-400">{FLOW_SHARED_CRAFT.map((line) => <li key={line}>{line}</li>)}</ul>
            </div>
            <div className="rounded-xl border border-slate-800 p-3 text-sm">
              <b className="text-slate-200">像但不模仿</b>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-slate-400">{FLOW_ANTI_IMITATION.map((line) => <li key={line}>{line}</li>)}</ul>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
