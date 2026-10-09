"use client";

import { LayoutDashboard, Menu, MessageSquare } from "lucide-react";

interface MobileBottomNavProps {
  activeTab: "chat" | "board";
  onChange: (tab: "chat" | "board") => void;
  onOpenMore: () => void;
}

export default function MobileBottomNav({ activeTab, onChange, onOpenMore }: MobileBottomNavProps) {
  return (
    <nav
      role="tablist"
      aria-label="主要功能"
      className="mobile-bottom-nav sm:hidden flex shrink-0 border-t border-slate-800/80 bg-slate-900/95 backdrop-blur-md pb-safe"
    >
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "chat"}
        onClick={() => onChange("chat")}
        className={`flex min-h-12 min-w-16 flex-1 flex-col items-center justify-center gap-0.5 px-2 py-1 text-[11px] font-semibold transition-colors ${activeTab === "chat" ? "text-amber-300" : "text-slate-400"}`}
      >
        <MessageSquare aria-hidden="true" className="h-5 w-5" />
        <span>對話</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "board"}
        onClick={() => onChange("board")}
        className={`flex min-h-12 min-w-16 flex-1 flex-col items-center justify-center gap-0.5 px-2 py-1 text-[11px] font-semibold transition-colors ${activeTab === "board" ? "text-amber-300" : "text-slate-400"}`}
      >
        <LayoutDashboard aria-hidden="true" className="h-5 w-5" />
        <span>看板</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={false}
        aria-haspopup="dialog"
        onClick={onOpenMore}
        className="flex min-h-12 min-w-16 flex-1 flex-col items-center justify-center gap-0.5 px-2 py-1 text-[11px] font-semibold text-slate-400 transition-colors"
      >
        <Menu aria-hidden="true" className="h-5 w-5" />
        <span>更多</span>
      </button>
    </nav>
  );
}
