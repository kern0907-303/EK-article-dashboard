"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Calendar, RefreshCw } from "lucide-react";
import Button from "@/components/ui/Button";

type Status = "pending" | "sending" | "sent" | "failed" | "cancelled";

interface SocialQueueItem {
  id: string;
  platform: "threads" | "instagram";
  brand: "i8" | "nas" | "abl";
  content: string;
  image_url: string | null;
  scheduled_at: string;
  status: Status;
  post_url: string | null;
  error: string | null;
}

const STATUS_LABEL: Record<Status, { text: string; cls: string }> = {
  pending: { text: "待發送", cls: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  sending: { text: "發送中", cls: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  sent: { text: "已發出", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  failed: { text: "失敗", cls: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
  cancelled: { text: "已取消", cls: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
};

const formatTaipei = (iso: string) =>
  new Date(iso).toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

const firstLine = (content: string) =>
  (content.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0) || "").replace(/[#*_]/g, "").trim();

/**
 * Threads / Instagram 的排程清單：只顯示目前品牌與平台的項目，
 * 切換平台頁籤時內容跟著換。refreshKey 變動時重新讀取（例如剛建立排程）。
 */
export default function SocialQueuePanel({
  brandId,
  platform,
  refreshKey,
}: {
  brandId: string;
  platform: "threads" | "instagram";
  refreshKey: number;
}) {
  const [items, setItems] = useState<SocialQueueItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/social-queue?brandId=${encodeURIComponent(brandId)}&platform=${platform}&limit=20`, { cache: "no-store" });
      const json = await res.json();
      if (json.success) {
        setItems(json.data as SocialQueueItem[]);
        setError(null);
      } else {
        setItems([]);
        setError(json.error || "讀取排程失敗");
      }
    } catch {
      setError("讀取排程失敗");
    }
  }, [brandId, platform]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load, refreshKey]);

  const refresh = async () => {
    setIsLoading(true);
    await load();
    setIsLoading(false);
  };

  const cancel = async (id: string) => {
    if (!window.confirm("確定要取消這筆排程嗎？")) return;
    try {
      const res = await fetch("/api/social-queue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "cancel" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "取消失敗");
      await load();
    } catch (e) {
      alert(`❌ 取消排程失敗：${e instanceof Error ? e.message : "請稍後再試"}`);
    }
  };

  const pendingCount = items.filter((i) => i.status === "pending").length;

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/30">
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-300">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          排程清單
          <span className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-500 font-semibold">待發送 {pendingCount} 筆</span>
        </div>
        <Button size="sm" variant="ghost" loading={isLoading} onClick={refresh} icon={<RefreshCw className="w-3.5 h-3.5" />}>
          重新整理
        </Button>
      </div>
      {error && <p className="px-3 pb-2 text-[11px] text-rose-300">{error}</p>}
      {!error && items.length === 0 && <p className="px-3 pb-3 text-[11px] text-slate-500">目前沒有排程。</p>}
      {items.length > 0 && (
        <ul className="divide-y divide-slate-800/70 border-t border-slate-800/70">
          {items.map((item) => {
            const st = STATUS_LABEL[item.status];
            return (
              <li key={item.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-[11px]">
                <span className={`px-1.5 py-0.5 rounded border font-bold ${st.cls}`}>{st.text}</span>
                <span className="text-slate-400 shrink-0">{formatTaipei(item.scheduled_at)}</span>
                <span className="flex-1 min-w-[8rem] truncate text-slate-300">{firstLine(item.content)}</span>
                {item.status === "sent" && item.post_url && (
                  <a href={item.post_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 underline">
                    查看貼文
                  </a>
                )}
                {item.status === "failed" && item.error && <span className="text-rose-300 truncate max-w-[16rem]" title={item.error}>{item.error}</span>}
                {item.status === "pending" && (
                  <Button size="sm" variant="danger" onClick={() => cancel(item.id)}>
                    取消
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
