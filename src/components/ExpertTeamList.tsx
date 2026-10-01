"use client";

import React from "react";

/** 切換右側看板分頁的自訂事件（WorkspaceBoard 監聽） */
export const SWITCH_TAB_EVENT = "ek-switch-tab";

const EXPERTS: {
  name: string;
  role: string;
  tag: string;
  dot: string;
  tab: "social" | "architecture" | "seo" | "ads" | "theo";
  how: string;
}[] = [
  { name: "Maya", role: "社群行銷", tag: "文案發布", dot: "bg-rose-500", tab: "social", how: "寫貼文、改寫平台版本、發布與排程。對話框下指令後，結果在「社群文案」分頁。" },
  { name: "Theo", role: "流量預測", tag: "病毒分數", dot: "bg-amber-500", tab: "theo", how: "在「流量預測」分頁分析目前文案，給病毒分數與可一鍵套用的改寫。" },
  { name: "Leon", role: "系統架構", tag: "網頁路由", dot: "bg-sky-500", tab: "architecture", how: "規劃網站頁面與路由架構，結果在「網頁架構」分頁。" },
  { name: "Iris", role: "SEO 專家", tag: "關鍵字庫", dot: "bg-emerald-500", tab: "seo", how: "產出關鍵字與文章大綱，結果在「SEO關鍵字」分頁。" },
  { name: "Jack", role: "廣告數據", tag: "指標漏斗", dot: "bg-purple-500", tab: "ads", how: "計算廣告漏斗與預估成效，結果在「廣告數據」分頁。" },
];

export default function ExpertTeamList({ onPick }: { onPick?: () => void }) {
  const go = (tab: string) => {
    window.dispatchEvent(new CustomEvent(SWITCH_TAB_EVENT, { detail: tab }));
    onPick?.();
  };

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-slate-500 leading-snug">
        在中間對話框對 Erick 下指令，他派工給大家；點名字跳到分頁。
      </p>
      <ul className="space-y-0.5 text-xs">
        {EXPERTS.map((e) => (
          <li key={e.name}>
            <button
              type="button"
              onClick={() => go(e.tab)}
              title={e.how}
              className="w-full flex items-center justify-between text-slate-300 px-2 py-1.5 rounded-lg hover:bg-slate-800/60 transition cursor-pointer text-left"
            >
              <span className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${e.dot}`} />
                {e.name} ({e.role})
              </span>
              <span className="text-[10px] text-slate-500 font-semibold bg-slate-900 px-1.5 py-0.5 rounded">{e.tag}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
