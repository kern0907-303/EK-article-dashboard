"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import CardPanel from "@/components/CardPanel";
import { BRANDS } from "@/components/BrandSelector";
import { igCaptionWithTags, parseThreadParts } from "@/lib/derivative-parts.mjs";

type Kind = "Threads" | "IG";

async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

/** Facebook 文案下方的兩顆一鍵改寫按鈕：Threads 串文、IG 圖文（含圖卡）。結果存成獨立衍生草稿，不會排程或發佈。 */
export default function QuickDerivatives({ brandId, content: rawContent }: { brandId: string; content: string }) {
  // 與「複製貼文」同一套清理：拿掉圖表程式碼與圖片標籤，只留純文案當母文章
  const content = rawContent.replace(/```mermaid[\s\S]*?```/g, "").replace(/!\[.*?\]\(.*?\)/g, "").replace(/\n{3,}/g, "\n\n").trim();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<Kind | "">("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [posts, setPosts] = useState<Partial<Record<Kind, any>>>({});

  useEffect(() => {
    let alive = true;
    fetch("/api/derivatives?summary=1", { cache: "no-store" }).then((r) => { if (alive) setEnabled(r.ok); }).catch(() => { if (alive) setEnabled(false); });
    return () => { alive = false; };
  }, []);

  // 母文換了，就清掉上一篇的改寫結果，避免對錯文章
  useEffect(() => { setPosts({}); setError(""); setNotice(""); }, [content, brandId]);

  if (!enabled) return null;
  const brand = BRANDS.find((item) => item.id === brandId);

  const run = async (kind: Kind) => {
    setBusy(kind); setError(""); setNotice("");
    try {
      let provider = "openai";
      try { provider = localStorage.getItem("ai_provider_override") || "openai"; } catch {}
      const response = await fetch("/api/derivatives", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        parent: { brandId, brandName: brand?.name || brandId, sourcePlatform: "Facebook 文案", content }, platforms: [kind], provider,
      }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      const row = (data.created || [])[0];
      if (!row) throw new Error((data.failures || [])[0]?.error || (data.skipped || [])[0]?.reason || "沒有產出草稿，請稍後再試。");
      setPosts((current) => ({ ...current, [kind]: row }));
      setNotice(`已存成獨立草稿（${kind}）。`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "改寫失敗");
    } finally { setBusy(""); }
  };

  const copy = async (label: string, text: string) => { setNotice((await copyText(text)) ? `已複製：${label}` : "複製失敗，請手動選取文字。"); };
  const threads = posts.Threads;
  const ig = posts.IG;

  return <div className="shrink-0 rounded-xl border border-slate-800/60 bg-slate-900/40 p-3">
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-bold text-slate-200">用這篇 Facebook 文案一鍵改寫</span>
      <Button size="sm" variant="secondary" loading={busy === "Threads"} disabled={!!busy} onClick={() => void run("Threads")}>{busy === "Threads" ? "改寫中..." : "改寫成 Threads 串文"}</Button>
      <Button size="sm" variant="secondary" loading={busy === "IG"} disabled={!!busy} onClick={() => void run("IG")}>{busy === "IG" ? "改寫中..." : "改寫成 IG 圖文"}</Button>
      <Link href="/derivatives" className="text-[11px] text-slate-400 underline">到多平台衍生頁編輯與重產</Link>
    </div>
    {error && <p className="mt-2 rounded bg-rose-950/40 p-2 text-xs text-rose-200">{error}</p>}
    {notice && !error && <p className="mt-2 rounded bg-emerald-950/30 p-2 text-xs text-emerald-200">{notice}</p>}

    {threads && <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950 p-3">
      <p className="mb-2 text-xs font-semibold text-cyan-200">Threads 串文，依序貼，每則一個貼文框</p>
      <div className="space-y-2">{parseThreadParts(threads.content).map((part) => <div key={part.label} className="rounded-md bg-slate-900 p-2">
        <div className="mb-1 flex items-center justify-between gap-2"><span className="text-[11px] font-semibold text-slate-300">{part.label}（{[...part.text].length} 字）</span><Button size="sm" variant="ghost" onClick={() => void copy(part.label, part.text)}>複製</Button></div>
        <p className="whitespace-pre-wrap text-xs leading-5 text-slate-200">{part.text}</p>
      </div>)}</div>
      {threads.check_results?.blockers?.length > 0 && <div className="mt-2 rounded bg-rose-950/40 p-2 text-xs text-rose-200"><p className="font-semibold">有阻擋項目，請先到多平台衍生頁修改</p><ul className="list-inside list-disc">{threads.check_results.blockers.map((item: string) => <li key={item}>{item}</li>)}</ul></div>}
    </div>}

    {ig && <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950 p-3">
      <div className="mb-2 flex items-center justify-between gap-2"><p className="text-xs font-semibold text-cyan-200">IG 說明文字與標籤</p><Button size="sm" variant="ghost" onClick={() => void copy("IG 說明文字與標籤", igCaptionWithTags(ig.content))}>複製說明與標籤</Button></div>
      <p className="whitespace-pre-wrap rounded-md bg-slate-900 p-2 text-xs leading-5 text-slate-200">{igCaptionWithTags(ig.content) || ig.content}</p>
      {ig.check_results?.blockers?.length > 0 && <div className="mt-2 rounded bg-rose-950/40 p-2 text-xs text-rose-200"><p className="font-semibold">有阻擋項目，請先到多平台衍生頁修改</p><ul className="list-inside list-disc">{ig.check_results.blockers.map((item: string) => <li key={item}>{item}</li>)}</ul></div>}
      <CardPanel post={ig} onUpdated={(row) => setPosts((current) => ({ ...current, IG: row }))} />
    </div>}
  </div>;
}
