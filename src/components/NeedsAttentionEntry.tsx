"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/** 主畫面右上角的「待處理」入口；讀取失敗時仍顯示入口，只是不帶數字。 */
export default function NeedsAttentionEntry() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    void fetch("/api/needs-attention", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((value) => { if (active && Array.isArray(value?.items)) setCount(value.items.length); })
      .catch(() => { if (active) setCount(null); });
    return () => { active = false; };
  }, []);
  const urgent = (count ?? 0) > 0;
  return (
    <Link href="/needs-attention" className={`rounded-lg border px-2.5 py-2 text-[10px] font-semibold sm:text-xs ${urgent ? "border-rose-400/50 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30" : "border-white/20 bg-white/5 text-slate-200 hover:bg-white/10"}`}>
      待處理{count !== null ? ` ${count}` : ""}
    </Link>
  );
}
