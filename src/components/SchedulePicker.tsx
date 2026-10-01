"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

/**
 * 排程時間選擇器：月曆點日期 + 滾輪選時、分。
 * value / onChange 沿用 "YYYY-MM-DDTHH:mm"（瀏覽器當地時間）格式，
 * 與原本 datetime-local 輸入框相容，呼叫端的轉換與驗證邏輯不用改。
 */

const p2 = (n: number) => String(n).padStart(2, "0");
const toValue = (d: Date) =>
  `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
const WEEK = ["日", "一", "二", "三", "四", "五", "六"];
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

interface Props {
  value: string;
  onChange: (v: string) => void;
  /** 最早可選時間（含），預設現在 + 5 分鐘 */
  min?: Date;
  /** 最晚可選日期，預設 30 天後 */
  max?: Date;
  accentClass?: string;
}

export default function SchedulePicker({ value, onChange, min, max, accentClass = "bg-indigo-600" }: Props) {
  const minDate = useMemo(() => min ?? new Date(Date.now() + 5 * 60 * 1000), [min]);
  const maxDate = useMemo(() => max ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), [max]);

  const selected = value ? new Date(value) : null;
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<Date>(() => new Date((selected ?? minDate).getFullYear(), (selected ?? minDate).getMonth(), 1));
  const hourRef = useRef<HTMLDivElement>(null);
  const minuteRef = useRef<HTMLDivElement>(null);

  // 打開時把已選的時、分捲到可見位置
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      hourRef.current?.querySelector<HTMLElement>('[data-sel="1"]')?.scrollIntoView({ block: "center" });
      minuteRef.current?.querySelector<HTMLElement>('[data-sel="1"]')?.scrollIntoView({ block: "center" });
    }, 0);
    return () => clearTimeout(t);
  }, [open, value]);

  const cells = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const total = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    const arr: (Date | null)[] = Array(first.getDay()).fill(null);
    for (let d = 1; d <= total; d++) arr.push(new Date(view.getFullYear(), view.getMonth(), d));
    return arr;
  }, [view]);

  const dayDisabled = (d: Date) => d < startOfDay(minDate) || d > maxDate;

  /** 選了日期後，時間若早於最早可選時間，自動校正到最早可選時間 */
  const pickDay = (d: Date) => {
    const base = selected ?? minDate;
    let next = new Date(d.getFullYear(), d.getMonth(), d.getDate(), base.getHours(), base.getMinutes());
    if (next < minDate) {
      next = new Date(minDate);
      next.setMinutes(Math.ceil(next.getMinutes() / 5) * 5, 0, 0);
    }
    onChange(toValue(next));
  };

  const pickTime = (h: number, m: number) => {
    const base = selected ?? minDate;
    onChange(toValue(new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m)));
  };

  const timeDisabled = (h: number, m: number) => {
    const base = selected ?? minDate;
    return new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m) < minDate;
  };

  const label = selected
    ? `${selected.getMonth() + 1}/${selected.getDate()}（${WEEK[selected.getDay()]}）${p2(selected.getHours())}:${p2(selected.getMinutes())}`
    : "選擇日期與時間";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-[10px] text-slate-200 cursor-pointer px-1 py-0.5"
      >
        <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
        <span className={selected ? "font-bold" : "text-slate-400"}>{label}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-2 z-50 w-[300px] rounded-xl border border-slate-700 bg-slate-950 shadow-2xl p-3 space-y-3">
            {/* 月曆 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <button
                  type="button"
                  onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
                  className="p-1 rounded hover:bg-slate-800 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-300" />
                </button>
                <span className="text-xs font-bold text-slate-100">
                  {view.getFullYear()} 年 {view.getMonth() + 1} 月
                </span>
                <button
                  type="button"
                  onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
                  className="p-1 rounded hover:bg-slate-800 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </button>
              </div>
              <div className="grid grid-cols-7 text-center text-[10px] text-slate-500 mb-1">
                {WEEK.map((w) => (
                  <span key={w}>{w}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-y-1 text-center">
                {cells.map((d, i) =>
                  d ? (
                    <button
                      key={i}
                      type="button"
                      disabled={dayDisabled(d)}
                      onClick={() => pickDay(d)}
                      className={`mx-auto w-8 h-8 rounded-full text-[11px] transition ${
                        selected && sameDay(d, selected)
                          ? `${accentClass} text-white font-bold`
                          : sameDay(d, new Date())
                          ? "border border-slate-500 text-slate-100 hover:bg-slate-800"
                          : "text-slate-200 hover:bg-slate-800"
                      } disabled:text-slate-700 disabled:hover:bg-transparent disabled:cursor-not-allowed cursor-pointer`}
                    >
                      {d.getDate()}
                    </button>
                  ) : (
                    <span key={i} />
                  )
                )}
              </div>
            </div>

            {/* 滾輪時間 */}
            <div className="border-t border-slate-800 pt-3">
              <div className="text-[10px] text-slate-500 mb-1.5">時間（台北時間，上下滾動選擇）</div>
              <div className="flex items-center justify-center gap-2">
                <div ref={hourRef} className="h-32 w-16 overflow-y-auto snap-y rounded-lg border border-slate-800 bg-slate-900/60 py-12">
                  {Array.from({ length: 24 }, (_, h) => {
                    const sel = selected?.getHours() === h;
                    const dis = !selected ? false : timeDisabled(h, 55);
                    return (
                      <button
                        key={h}
                        type="button"
                        data-sel={sel ? "1" : undefined}
                        disabled={dis}
                        onClick={() => pickTime(h, selected ? selected.getMinutes() : 0)}
                        className={`snap-center block w-full h-7 text-sm ${
                          sel ? "text-white font-bold bg-slate-700" : "text-slate-300 hover:bg-slate-800"
                        } disabled:text-slate-700 disabled:hover:bg-transparent disabled:cursor-not-allowed cursor-pointer`}
                      >
                        {p2(h)}
                      </button>
                    );
                  })}
                </div>
                <span className="text-slate-400 font-bold">:</span>
                <div ref={minuteRef} className="h-32 w-16 overflow-y-auto snap-y rounded-lg border border-slate-800 bg-slate-900/60 py-12">
                  {MINUTES.map((m) => {
                    const sel = selected?.getMinutes() === m;
                    const dis = !selected ? false : timeDisabled(selected.getHours(), m);
                    return (
                      <button
                        key={m}
                        type="button"
                        data-sel={sel ? "1" : undefined}
                        disabled={dis}
                        onClick={() => pickTime(selected ? selected.getHours() : minDate.getHours(), m)}
                        className={`snap-center block w-full h-7 text-sm ${
                          sel ? "text-white font-bold bg-slate-700" : "text-slate-300 hover:bg-slate-800"
                        } disabled:text-slate-700 disabled:hover:bg-transparent disabled:cursor-not-allowed cursor-pointer`}
                      >
                        {p2(m)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-slate-400">
                {selected ? `將於 ${label} 發出` : "請先點選日期"}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={`px-3 py-1 rounded text-[10px] font-bold text-white ${accentClass} cursor-pointer`}
              >
                完成
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
