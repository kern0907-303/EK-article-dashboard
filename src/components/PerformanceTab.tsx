"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, ExternalLink, AlertTriangle, CheckCircle2 } from "lucide-react";
import { brandKeyFromId } from "@/data/skills/genres";
import { resolveEffectiveBrandId } from "@/lib/projects-store";
import type {
  SocialMetrics,
  SocialAccountDaily,
  SocialPost,
  SocialSyncLog,
} from "@/lib/social-metrics-server";

interface ApiOk {
  success: true;
  data: SocialMetrics;
  fetchedAt: number;
  cached: boolean;
  stale: boolean;
}
interface ApiFail {
  success: false;
  error: string;
}

type SortKey = "published_at" | "views" | "likes" | "comments";

const PLATFORM_NAME: Record<string, string> = {
  threads: "Threads",
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  red: "小紅書",
};

function platformKey(p: string | null): string {
  return (p || "").toLowerCase();
}
function platformName(p: string | null): string {
  const k = platformKey(p);
  return PLATFORM_NAME[k] || p || "其他";
}

/** 從 account_label（例如「Threads ABL / abliene358」）判斷屬於哪個品牌 */
function labelBrand(label: string | null): "abl" | "nas" | "i8" | null {
  const s = (label || "").toLowerCase();
  if (/\babl\b/.test(s)) return "abl";
  if (/\bnas\b/.test(s)) return "nas";
  if (/\bi8\b/.test(s)) return "i8";
  return null;
}

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("zh-TW");
}

function fmtDate(s: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s.slice(0, 10);
  return d.toLocaleDateString("zh-TW", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" });
}

function fmtDateTime(ms: number | string | null): string {
  if (ms === null) return "—";
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false });
}

export default function PerformanceTab({ brandId }: { brandId: string }) {
  const brandKey = useMemo(() => {
    const effective = resolveEffectiveBrandId(brandId);
    return effective ? brandKeyFromId(effective) : null;
  }, [brandId]);

  const [metrics, setMetrics] = useState<SocialMetrics | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("published_at");

  const fetchMetrics = useCallback(async (refresh: boolean) => {
    try {
      const res = await fetch(`/api/social-metrics${refresh ? "?refresh=1" : ""}`, { cache: "no-store" });
      const json = (await res.json()) as ApiOk | ApiFail;
      if (!json.success) {
        setError(json.error || `讀取失敗（${res.status}）`);
      } else {
        setMetrics(json.data);
        setFetchedAt(json.fetchedAt);
        setStale(json.stale);
        setError(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "讀取失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  const reload = useCallback(() => {
    setLoading(true);
    void fetchMetrics(true);
  }, [fetchMetrics]);

  useEffect(() => {
    // 首次載入：非同步取資料，state 在 await 之後才更新
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchMetrics(false);
  }, [fetchMetrics]);

  const mine = useMemo(() => {
    if (!metrics || !brandKey) return null;
    const daily = metrics.account_daily.filter((r) => labelBrand(r.account_label) === brandKey);
    const posts = metrics.posts.filter((r) => labelBrand(r.account_label) === brandKey);
    const logs = metrics.sync_log.filter(
      (r) => r.platform === "token_refresh" || daily.some((d) => d.account_id && d.account_id === r.account_id)
    );
    return { daily, posts, logs };
  }, [metrics, brandKey]);

  /** 每個帳號取最新一天，並附上前一筆做比較 */
  const accountCards = useMemo(() => {
    if (!mine) return [];
    const byAccount = new Map<string, SocialAccountDaily[]>();
    for (const r of mine.daily) {
      const k = `${platformKey(r.platform)}|${r.account_id}`;
      const arr = byAccount.get(k) || [];
      arr.push(r);
      byAccount.set(k, arr);
    }
    return Array.from(byAccount.values()).map((rows) => {
      rows.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      return { latest: rows[0], previous: rows[1] || null, rows };
    });
  }, [mine]);

  const platforms = useMemo(() => {
    if (!mine) return [] as string[];
    return Array.from(new Set(mine.posts.map((p) => platformKey(p.platform)))).filter(Boolean);
  }, [mine]);

  const posts = useMemo(() => {
    if (!mine) return [] as SocialPost[];
    const list = mine.posts.filter((p) => platformFilter === "all" || platformKey(p.platform) === platformFilter);
    const val = (p: SocialPost): number | string => {
      if (sortKey === "published_at") return p.published_at || "";
      return p[sortKey] ?? -1;
    };
    return [...list].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      if (typeof x === "string" && typeof y === "string") return y.localeCompare(x);
      return (y as number) - (x as number);
    });
  }, [mine, platformFilter, sortKey]);

  const recentLogs: SocialSyncLog[] = useMemo(() => {
    if (!mine) return [];
    return [...mine.logs].sort((a, b) => (b.run_at || "").localeCompare(a.run_at || "")).slice(0, 6);
  }, [mine]);

  const header = (
    <div className="flex items-center justify-between gap-3 mb-5">
      <div>
        <h3 className="text-sm font-bold text-slate-100">社群成效</h3>
        <p className="text-[11px] text-slate-500 mt-0.5">
          資料由 n8n 每 3 天自動同步一次
          {fetchedAt ? `；頁面資料更新於 ${fmtDateTime(fetchedAt)}` : ""}
          {stale ? "（目前連不上資料出口，顯示的是先前的快取）" : ""}
        </p>
      </div>
      <button
        onClick={reload}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800/80 text-slate-200 hover:bg-slate-700/80 disabled:opacity-50 cursor-pointer"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        重新整理
      </button>
    </div>
  );

  if (loading && !metrics) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-xs gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> 讀取成效資料中…
      </div>
    );
  }

  if (error && !metrics) {
    return (
      <div>
        {header}
        <div className="flex items-start gap-2 p-4 rounded-xl border border-rose-500/30 bg-rose-500/5 text-xs text-rose-200">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold mb-1">無法取得成效資料</div>
            <div className="text-rose-300/80">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  if (!brandKey || brandKey === "erick" || !mine) {
    return (
      <div>
        {header}
        <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/40 text-xs text-slate-400 leading-relaxed">
          Erick 個人品牌的社群帳號尚未串接，目前沒有成效資料。請切換到 ABL、NAS 或 I8 查看。
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}
      {error && (
        <div className="text-[11px] text-amber-300 bg-amber-500/5 border border-amber-500/30 rounded-lg px-3 py-2">
          重新整理失敗：{error}（先顯示舊資料）
        </div>
      )}

      {/* 帳號卡片 */}
      <section>
        <h4 className="text-xs font-bold text-slate-300 mb-2">帳號概況</h4>
        {accountCards.length === 0 ? (
          <div className="text-xs text-slate-500">這個品牌還沒有任何帳號資料。</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {accountCards.map(({ latest, previous }) => {
              const diff =
                previous && latest.followers !== null && previous.followers !== null
                  ? latest.followers - previous.followers
                  : null;
              return (
                <div
                  key={`${latest.platform}|${latest.account_id}`}
                  className="p-4 rounded-xl border border-slate-800 bg-slate-900/50"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-100">{platformName(latest.platform)}</span>
                    <span className="text-[10px] text-slate-500">資料日 {latest.date || "—"}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">{latest.account_label}</div>
                  <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                    <div>
                      <div className="text-base font-bold text-slate-100">{fmt(latest.followers)}</div>
                      <div className="text-[10px] text-slate-500">
                        追蹤者{diff !== null && diff !== 0 ? `（${diff > 0 ? "+" : ""}${diff}）` : ""}
                      </div>
                    </div>
                    <div>
                      <div className="text-base font-bold text-slate-100">{fmt(latest.views_day)}</div>
                      <div className="text-[10px] text-slate-500">當日瀏覽</div>
                    </div>
                    <div>
                      <div className="text-base font-bold text-slate-100">{fmt(latest.reach_day)}</div>
                      <div className="text-[10px] text-slate-500">當日觸及</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 近期每日 */}
      {mine.daily.length > 0 && (
        <section>
          <h4 className="text-xs font-bold text-slate-300 mb-2">近期每日數據</h4>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-[11px] text-slate-300">
              <thead className="bg-slate-900/70 text-slate-500">
                <tr>
                  <th className="text-left px-3 py-2">日期</th>
                  <th className="text-left px-3 py-2">平台／帳號</th>
                  <th className="text-right px-3 py-2">追蹤者</th>
                  <th className="text-right px-3 py-2">瀏覽</th>
                  <th className="text-right px-3 py-2">觸及</th>
                </tr>
              </thead>
              <tbody>
                {[...mine.daily]
                  .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
                  .slice(0, 15)
                  .map((r, i) => (
                    <tr key={i} className="border-t border-slate-800/70">
                      <td className="px-3 py-1.5">{r.date || "—"}</td>
                      <td className="px-3 py-1.5">{r.account_label || platformName(r.platform)}</td>
                      <td className="px-3 py-1.5 text-right">{fmt(r.followers)}</td>
                      <td className="px-3 py-1.5 text-right">{fmt(r.views_day)}</td>
                      <td className="px-3 py-1.5 text-right">{fmt(r.reach_day)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 貼文列表 */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h4 className="text-xs font-bold text-slate-300">貼文成效（{posts.length}）</h4>
          <div className="flex items-center gap-2 text-[11px]">
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-200"
            >
              <option value="all">全部平台</option>
              {platforms.map((p) => (
                <option key={p} value={p}>
                  {platformName(p)}
                </option>
              ))}
            </select>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-200"
            >
              <option value="published_at">依發佈時間</option>
              <option value="views">依瀏覽</option>
              <option value="likes">依按讚</option>
              <option value="comments">依留言</option>
            </select>
          </div>
        </div>
        {posts.length === 0 ? (
          <div className="text-xs text-slate-500">沒有符合的貼文。</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-[11px] text-slate-300">
              <thead className="bg-slate-900/70 text-slate-500">
                <tr>
                  <th className="text-left px-3 py-2">發佈</th>
                  <th className="text-left px-3 py-2">平台</th>
                  <th className="text-left px-3 py-2">內容</th>
                  <th className="text-right px-3 py-2">瀏覽</th>
                  <th className="text-right px-3 py-2">讚</th>
                  <th className="text-right px-3 py-2">留言</th>
                  <th className="text-right px-3 py-2">分享</th>
                  <th className="text-right px-3 py-2">收藏</th>
                  <th className="text-right px-3 py-2">觸及</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {posts.map((p) => (
                  <tr key={`${p.platform}|${p.post_id}`} className="border-t border-slate-800/70 align-top">
                    <td className="px-3 py-1.5 whitespace-nowrap">{fmtDate(p.published_at)}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{platformName(p.platform)}</td>
                    <td className="px-3 py-1.5 max-w-[320px] truncate" title={p.text_preview || ""}>
                      {p.text_preview || "（無文字）"}
                    </td>
                    <td className="px-3 py-1.5 text-right">{fmt(p.views)}</td>
                    <td className="px-3 py-1.5 text-right">{fmt(p.likes)}</td>
                    <td className="px-3 py-1.5 text-right">{fmt(p.comments)}</td>
                    <td className="px-3 py-1.5 text-right">{fmt(p.shares)}</td>
                    <td className="px-3 py-1.5 text-right">{fmt(p.saves)}</td>
                    <td className="px-3 py-1.5 text-right">{fmt(p.reach)}</td>
                    <td className="px-3 py-1.5">
                      {p.url && (
                        <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:text-sky-300">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[10px] text-slate-600 mt-1.5">
          「—」代表平台沒有提供該數字（例如 Threads 不提供觸及與收藏、IG 貼文不提供瀏覽），不是 0。
        </p>
      </section>

      {/* 同步狀態 */}
      <section>
        <h4 className="text-xs font-bold text-slate-300 mb-2">最近同步紀錄</h4>
        {recentLogs.length === 0 ? (
          <div className="text-xs text-slate-500">尚無紀錄。</div>
        ) : (
          <ul className="space-y-1">
            {recentLogs.map((l, i) => {
              const ok = (l.status || "").toLowerCase() === "ok" || (l.status || "").toLowerCase() === "success";
              return (
                <li key={i} className="flex items-center gap-2 text-[11px] text-slate-400">
                  {ok ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  )}
                  <span className="whitespace-nowrap">{fmtDateTime(l.run_at)}</span>
                  <span>{platformName(l.platform) === "其他" ? l.platform : platformName(l.platform)}</span>
                  <span>寫入 {fmt(l.rows_written)} 筆</span>
                  {!ok && l.error_message && <span className="text-amber-300/80 truncate">{l.error_message}</span>}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
