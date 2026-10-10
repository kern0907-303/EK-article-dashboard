"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BRANDS } from "@/components/BrandSelector";
import { DERIVATIVE_PLATFORM_ORDER } from "@/lib/derivatives-core.mjs";
import CardPanel from "@/components/CardPanel";

type ParentArticle = { id: string; brandId: string; brandName: string; sourcePlatform: string; content: string };
type Catalog = { specs: any[]; rules: any[]; posts: any[] };

function readParents(): ParentArticle[] {
  const found: ParentArticle[] = [];
  try {
    for (const brand of BRANDS) {
      const raw = localStorage.getItem(`ai_team_dashboard_workspace_${brand.id}`);
      if (!raw) continue;
      const data = JSON.parse(raw);
      const variants = [
        ["social_copy", "社群貼文"], ["social_copy_threads", "Threads 文案"], ["social_copy_facebook", "Facebook 文案"], ["social_copy_instagram", "Instagram 文案"],
      ] as const;
      for (const [field, sourcePlatform] of variants) {
        const content = typeof data[field] === "string" ? data[field].trim() : "";
        if (!content || /生成中|生成失敗|請在左側/.test(content)) continue;
        found.push({ id: `${brand.id}:${field}:${found.length}`, brandId: brand.id, brandName: brand.name, sourcePlatform, content });
      }
    }
  } catch {
    return found;
  }
  return found;
}

async function requestJSON(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

export default function DerivativesWorkspace() {
  const [parents, setParents] = useState<ParentArticle[]>([]);
  const [parentId, setParentId] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([...DERIVATIVE_PLATFORM_ORDER]);
  const [provider, setProvider] = useState("openai");
  const [catalog, setCatalog] = useState<Catalog>({ specs: [], rules: [], posts: [] });
  const [activePlatform, setActivePlatform] = useState("Threads");
  const [activeLanguage, setActiveLanguage] = useState("zh-TW");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [draftContent, setDraftContent] = useState<Record<string, string>>({});
  const [settingsDrafts, setSettingsDrafts] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    const nextParents = readParents();
    setParents(nextParents);
    setParentId((current) => current || nextParents[0]?.id || "");
    const result = await requestJSON("/api/derivatives", { cache: "no-store" });
    setCatalog({ specs: result.specs || [], rules: result.rules || [], posts: result.posts || [] });
  }, []);

  useEffect(() => {
    void refresh().catch((reason) => setError(reason instanceof Error ? reason.message : "讀取衍生設定失敗"));
    try { setProvider(localStorage.getItem("ai_provider_override") || "openai"); } catch {}
  }, [refresh]);

  const parent = parents.find((item) => item.id === parentId);
  const visiblePosts = useMemo(() => catalog.posts.filter((post) => post.platform === activePlatform && post.language_version === activeLanguage), [catalog.posts, activePlatform, activeLanguage]);

  const togglePlatform = (platform: string) => setSelectedPlatforms((current) => current.includes(platform) ? current.filter((item) => item !== platform) : [...current, platform]);

  const generate = async (platforms = selectedPlatforms) => {
    if (!parent) { setError("先選一篇已保存的社群貼文作為母文章。"); return; }
    if (!platforms.length) { setError("至少勾選一個平台。"); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await requestJSON("/api/derivatives", { method: "POST", body: JSON.stringify({
        parent: { brandId: parent.brandId, brandName: parent.brandName, sourcePlatform: parent.sourcePlatform, content: parent.content }, platforms, provider,
      }) });
      await refresh();
      setNotice(`已保存 ${result.created?.length || 0} 份衍生草稿。未呼叫任何發佈或排程流程。${(result.skipped || []).map((item: any) => ` ${item.platform}：${item.reason}`).join("")}${(result.failures || []).map((item: any) => ` ${item.platform} ${item.language_version} 失敗：${item.error}`).join("")}`);
      if (result.created?.length) { setActivePlatform(result.created[0].platform); setActiveLanguage(result.created[0].language_version); }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "產生衍生稿失敗");
    } finally { setBusy(false); }
  };

  const saveContent = async (post: any, action = "save") => {
    setBusy(true); setError("");
    try {
      await requestJSON("/api/derivatives", { method: "PATCH", body: JSON.stringify({ id: post.id, content: draftContent[post.id] ?? post.content, action, humanConfirmed: action === "make-available" }) });
      await refresh(); setNotice(action === "make-available" ? "已依目前檢查結果標記為可用。" : "衍生草稿已保存。");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "保存衍生稿失敗"); }
    finally { setBusy(false); }
  };

  const saveSettings = async (table: "spec" | "rule", row: any) => {
    const key = `${table}:${row.id}`;
    try {
      const values = JSON.parse(settingsDrafts[key] || "{}");
      await requestJSON("/api/derivatives", { method: "PATCH", body: JSON.stringify({ action: table === "spec" ? "save-spec" : "save-rule", id: row.id, values }) });
      await refresh(); setNotice("設定已更新，來源與人工確認狀態仍如實保留。");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "設定格式錯誤"); }
  };

  return <main className="min-h-screen bg-slate-950 text-slate-100">
    <header className="border-b border-slate-800 bg-slate-900/60 px-5 py-4">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <div><h1 className="text-xl font-bold">多平台衍生</h1><p className="mt-1 text-xs text-slate-400">只讀取既有社群貼文，衍生稿只存草稿，不會排程或發布。</p></div>
        <Link href="/" className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300">返回首頁</Link>
      </div>
    </header>
    <div className="mx-auto grid max-w-7xl gap-5 p-5 lg:grid-cols-[360px_1fr]">
      <aside className="space-y-5">
        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h2 className="font-semibold">選擇母文章</h2>
          <p className="mt-1 text-xs text-slate-400">母文章來自此瀏覽器的品牌社群貼文 LocalStorage。此頁不會回寫母文章。</p>
          <select value={parentId} onChange={(event) => setParentId(event.target.value)} className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm">
            {parents.map((item) => <option key={item.id} value={item.id}>{item.brandName}，{item.sourcePlatform}，{item.content.slice(0, 38)}</option>)}
          </select>
          {parent && <div className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-3 text-xs text-slate-300">{parent.content}</div>}
          {!parents.length && <p className="mt-3 text-sm text-amber-200">目前這個瀏覽器沒有讀到已保存的社群貼文。</p>}
          <label className="mt-4 block text-xs text-slate-400">生成供應商
            <select value={provider} onChange={(event) => setProvider(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-slate-100">
              <option value="openai">OpenAI（伺服器金鑰）</option><option value="anthropic">Anthropic（伺服器金鑰）</option><option value="gemini">Gemini（伺服器金鑰）</option>
            </select>
          </label>
        </section>
        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h2 className="font-semibold">產出平台</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">{DERIVATIVE_PLATFORM_ORDER.map((platform) => <label key={platform} className="flex items-center gap-2 rounded-lg bg-slate-950 p-2 text-sm"><input type="checkbox" checked={selectedPlatforms.includes(platform)} onChange={() => togglePlatform(platform)} />{platform}</label>)}</div>
          <Button variant="primary" disabled={busy || !parent} onClick={() => void generate()} className="mt-4 w-full">{busy ? "處理中…" : "一鍵產生草稿"}</Button>
        </section>
        <section className="rounded-xl border border-amber-900/50 bg-amber-950/20 p-4 text-xs leading-5 text-amber-100">
          <h2 className="font-semibold">科普頻道提醒</h2>
          小紅書與抖音只在心理或行為主題下產稿；命理、運勢、玄學、能量等母文會被跳過。科學依據只接受知識庫來源，未能驗證時保留【需補：科學依據】並阻擋可用狀態。
        </section>
      </aside>

      <section className="min-w-0 space-y-5">
        {(error || notice) && <div className={`rounded-lg border p-3 text-sm ${error ? "border-rose-800 bg-rose-950/40 text-rose-200" : "border-emerald-800 bg-emerald-950/30 text-emerald-200"}`}>{error || notice}</div>}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h2 className="font-semibold">草稿與檢查</h2>
          <div className="mt-3 flex flex-wrap gap-2">{DERIVATIVE_PLATFORM_ORDER.map((platform) => <button key={platform} onClick={() => setActivePlatform(platform)} className={`rounded-lg px-3 py-2 text-sm ${activePlatform === platform ? "bg-cyan-300 text-slate-950" : "bg-slate-950 text-slate-300"}`}>{platform}</button>)}</div>
          {(activePlatform === "小紅書" || activePlatform === "抖音") && <div className="mt-3 flex gap-2"><Button variant="ghost" size="sm" active={activeLanguage === "zh-TW"} onClick={() => setActiveLanguage("zh-TW")}>繁體</Button><Button variant="ghost" size="sm" active={activeLanguage === "zh-CN"} onClick={() => setActiveLanguage("zh-CN")}>简体</Button></div>}
          <div className="mt-4 space-y-4">{visiblePosts.map((post) => <article key={post.id} className="rounded-lg border border-slate-800 bg-slate-950 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs"><span className="font-semibold text-cyan-200">{post.format}，{post.language_version}，狀態：{post.status}</span><span className="text-slate-500">提示詞版本 {post.prompt_version}，模型 {post.model_version}</span></div>
            <textarea value={draftContent[post.id] ?? post.content} onChange={(event) => setDraftContent((items) => ({ ...items, [post.id]: event.target.value }))} className="min-h-64 w-full rounded-lg border border-slate-800 bg-slate-900 p-3 text-sm leading-6" />
            {post.check_results?.blockers?.length > 0 && <div className="mt-3 rounded bg-rose-950/40 p-3 text-sm text-rose-200"><p className="font-semibold">不可標為可用</p><ul className="list-inside list-disc">{post.check_results.blockers.map((item: string) => <li key={item}>{item}</li>)}</ul></div>}
            {post.check_results?.sensitive_matches?.length > 0 && <div className="mt-3 rounded bg-amber-950/40 p-3 text-sm text-amber-100">敏感詞命中：{post.check_results.sensitive_matches.map((item: any) => `${item.term}（${item.category}）`).join("、")}。來源：{[...new Set<string>(post.check_results.sensitive_matches.flatMap((item: any): string[] => Array.isArray(item.source_urls) ? item.source_urls : []))].map((url: string) => <a key={url} href={url} target="_blank" rel="noreferrer" className="ml-2 underline">規則來源</a>)}</div>}
            {post.check_results?.warnings?.length > 0 && <p className="mt-3 text-sm text-amber-200">長度／張數提醒：{post.check_results.warnings.join("；")}</p>}
            {post.platform === "IG" && <CardPanel post={post} onUpdated={() => void refresh()} />}
            <div className="mt-3 flex flex-wrap gap-2"><Button variant="primary" size="sm" disabled={busy} onClick={() => void saveContent(post)}>保存編輯</Button><Button variant="secondary" size="sm" disabled={busy || !parent} onClick={() => void generate([post.platform])}>重新產生此平台</Button><Button variant="secondary" size="sm" disabled={busy || post.status === "available"} onClick={() => { if (window.confirm("請確認已人工檢視平台紅線與來源。確認後此稿會標為可用，但仍只保存在草稿表，不會發佈。")) void saveContent(post, "make-available"); }}>人工確認後標為可用</Button></div>
          </article>)}
          {!visiblePosts.length && <p className="rounded-lg bg-slate-950 p-6 text-sm text-slate-400">此平台／語言目前沒有草稿。選擇母文章後即可產生。</p>}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h2 className="font-semibold">平台規格（資料狀態以欄位為準）</h2>
          <p className="mt-1 text-xs text-slate-400">無直接官方來源支持的欄位保留待人工確認；未核實的資料不會被當成已確定規範。</p>
          <div className="mt-3 space-y-2">{catalog.specs.map((row) => <details key={row.id} className="rounded-lg bg-slate-950 p-3"><summary className="cursor-pointer text-sm">{row.platform}，{row.format}，{row.status === "verified" ? "已查證" : "待人工確認"}</summary><pre className="mt-2 overflow-auto whitespace-pre-wrap text-xs text-slate-400">{JSON.stringify({文字上限: row.max_text_length ?? "待確認", 標題上限: row.title_max_length ?? "待確認", 圖片比例: row.image_aspect_ratios, 圖片尺寸: row.image_dimensions || "待確認", 輪播上限: row.carousel_max ?? "待確認", 標籤建議: row.hashtag_guidance, 影片長度: row.video_duration || "待確認", 影片比例: row.video_aspect_ratios, 檔案大小: row.max_file_size || "待確認", AI標註: row.ai_label_requirement, 欄位狀態: row.field_status, 來源: row.source_urls, 查證日期: row.checked_at, 備註: row.notes}, null, 2)}</pre><textarea value={settingsDrafts[`spec:${row.id}`] ?? JSON.stringify(row, null, 2)} onChange={(event) => setSettingsDrafts((items) => ({ ...items, [`spec:${row.id}`]: event.target.value }))} className="mt-2 min-h-40 w-full rounded bg-slate-900 p-2 font-mono text-xs" /><Button variant="secondary" size="sm" onClick={() => void saveSettings("spec", row)} className="mt-2">儲存規格修改</Button></details>)}</div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h2 className="font-semibold">平台內容紅線（全部待人工確認）</h2>
          <p className="mt-1 text-xs text-slate-400">這些保守詞表是攔截設定，不是平台政策或法律結論。命中時不得自動換同義詞。</p>
          <div className="mt-3 space-y-2">{catalog.rules.map((row) => <details key={row.id} className="rounded-lg bg-slate-950 p-3"><summary className="cursor-pointer text-sm">{row.platform}，{row.category}，{row.language_version}，待人工確認</summary><p className="mt-2 text-xs text-slate-400">命中詞：{(row.blocked_terms || []).join("、")}</p><p className="mt-1 text-xs text-slate-400">來源：{(row.source_urls || []).join("，") || "未提供官方來源"}</p><textarea value={settingsDrafts[`rule:${row.id}`] ?? JSON.stringify(row, null, 2)} onChange={(event) => setSettingsDrafts((items) => ({ ...items, [`rule:${row.id}`]: event.target.value }))} className="mt-2 min-h-36 w-full rounded bg-slate-900 p-2 font-mono text-xs" /><Button variant="secondary" size="sm" onClick={() => void saveSettings("rule", row)} className="mt-2">儲存紅線修改</Button></details>)}</div>
        </div>
      </section>
    </div>
  </main>;
}
