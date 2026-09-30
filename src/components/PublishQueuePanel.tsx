"use client";

import React, { useState } from "react";
import { Calendar, Loader2 } from "lucide-react";
import type { QueueItem, QueueStatus } from "@/lib/publish-queue";
import { getFacebookPageById } from "@/lib/facebook-pages";

const STATUS_LABEL: Record<QueueStatus, { text: string; cls: string }> = {
  pending: { text: "待發送", cls: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  sending: { text: "發送中", cls: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  sent: { text: "已發出", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  partial: { text: "部分成功", cls: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  failed: { text: "失敗", cls: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
  cancelled: { text: "已取消", cls: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
};

const formatTaipei = (iso: string) =>
  new Date(iso).toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

const firstLine = (content: string) =>
  (content.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0) || "").replace(/[#*_]/g, "").trim();

export default function PublishQueuePanel({
  items,
  enabled,
  error,
  isLoading,
  onRefresh,
  onCancel,
}: {
  items: QueueItem[];
  enabled: boolean;
  error: string | null;
  isLoading: boolean;
  onRefresh: () => void;
  onCancel: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const pendingCount = items.filter((i) => i.status === "pending").length;

  return (
    <div className="bg-slate-900/10 border border-slate-800/80 rounded-xl overflow-hidden backdrop-blur-md transition-all duration-300">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-900/30 hover:bg-slate-900/50 transition-colors text-left cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-200">📅 排程清單</span>
          <span className="text-[10px] text-slate-500 font-semibold bg-slate-900 px-1.5 py-0.5 rounded">
            待發送 {pendingCount} 筆
          </span>
          {!enabled && (
            <span className="text-[10px] text-amber-400 font-semibold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
              排程尚未啟用
            </span>
          )}
        </div>
        <span className="text-xs text-slate-500 font-bold">{expanded ? "收起 ▲" : "展開 ▼"}</span>
      </button>

      {expanded && (
        <div className="p-4 border-t border-slate-800/60 max-h-[320px] overflow-y-auto space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500">時間皆以台北時間顯示</span>
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="px-2 py-0.5 bg-slate-900 hover:bg-slate-850 text-slate-350 text-[10px] font-bold rounded border border-slate-800 transition cursor-pointer flex items-center gap-1"
            >
              {isLoading && <Loader2 className="w-3 h-3 animate-spin" />}
              重新整理
            </button>
          </div>

          {error && <p className="text-[11px] text-rose-400">{error}</p>}

          {items.length === 0 && !error ? (
            <p className="text-slate-500 italic text-xs text-center py-4">目前沒有排程紀錄。</p>
          ) : (
            items.map((item) => {
              const st = STATUS_LABEL[item.status] || STATUS_LABEL.pending;
              const failedResults = (item.results || []).filter((r) => !r.ok);
              return (
                <div
                  key={item.id}
                  className="flex flex-col gap-2 p-3 bg-slate-950/30 border border-slate-850 rounded-xl"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <h5 className="text-xs font-bold text-slate-200 line-clamp-1">
                        {firstLine(item.content) || "（無標題）"}
                      </h5>
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500 font-semibold">
                        <span className={`px-1.5 py-0.5 rounded border ${st.cls}`}>{st.text}</span>
                        {item.test_mode && (
                          <span className="px-1.5 py-0.5 rounded border bg-purple-500/10 text-purple-300 border-purple-500/20">
                            演練（不公開）
                          </span>
                        )}
                        <span>{formatTaipei(item.scheduled_at)}</span>
                        <span>
                          {item.target_pages.map((id) => getFacebookPageById(id)?.badge || id).join("、")}
                        </span>
                      </div>
                    </div>
                    {item.status === "pending" && (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm("確定要取消這筆排程嗎？")) onCancel(item.id);
                        }}
                        className="shrink-0 px-2.5 py-1 bg-slate-900 hover:bg-rose-500/10 text-slate-350 hover:text-rose-400 text-[10px] font-bold rounded-lg border border-slate-800 transition cursor-pointer"
                      >
                        取消
                      </button>
                    )}
                  </div>
                  {item.error && <p className="text-[10px] text-rose-400 break-words">{item.error}</p>}
                  {failedResults.length > 0 && (
                    <ul className="text-[10px] text-rose-400 space-y-0.5">
                      {failedResults.map((r) => (
                        <li key={r.pageId} className="break-words">
                          {getFacebookPageById(r.pageId)?.badge || r.pageId}：{r.error || "發送失敗"}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
