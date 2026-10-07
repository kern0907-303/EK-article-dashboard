"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { pickAlign, clippingBounds, type PopoverAlign } from "@/lib/popover-align";
import { buildScheduleDateTime, DEFAULT_SCHEDULE_HOUR, DEFAULT_SCHEDULE_MINUTE } from "@/lib/schedule-time";
import {
  buildDayMarks,
  dayKey,
  describeDay,
  sameSlotHint,
  MARK_BRAND_COLOR,
  MARK_BRAND_LABEL,
  type MarkSource,
} from "@/lib/schedule-marks";

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
  /** 已排程的項目（所有品牌），用來在月曆上標示哪天已有預約發文 */
  items?: MarkSource[];
}

export default function SchedulePicker({ value, onChange, min, max, accentClass = "bg-indigo-600", items }: Props) {
  const minDate = useMemo(() => min ?? new Date(Date.now() + 5 * 60 * 1000), [min]);
  const maxDate = useMemo(() => max ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), [max]);

  const selected = value ? new Date(value) : null;
  const selectedHour = selected?.getHours() ?? DEFAULT_SCHEDULE_HOUR;
  const selectedMinute = selected?.getMinutes() ?? DEFAULT_SCHEDULE_MINUTE;
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [align, setAlign] = useState<PopoverAlign>("left");
  // 展開前先量位置：放不下就換邊，避免月曆被外層切掉
  const toggleOpen = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const b = clippingBounds(btnRef.current);
      setAlign(pickAlign(r.left, r.right, b.left, b.right, 300));
    }
    setOpen((o) => !o);
  };
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

  const marks = useMemo(() => buildDayMarks(items || []), [items]);
  const selectedMark = selected ? marks.get(dayKey(selected)) : undefined;
  const slotHint = sameSlotHint(selectedMark, selected);

  const dayDisabled = (d: Date) => d < startOfDay(minDate) || d > maxDate;

  /** 選了日期後，時間若早於最早可選時間，自動校正到最早可選時間 */
  const pickDay = (d: Date) => {
    const next = buildScheduleDateTime(d, selected, minDate);
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
    : `選擇日期與時間（預設 ${p2(DEFAULT_SCHEDULE_HOUR)}:${p2(DEFAULT_SCHEDULE_MINUTE)}）`;

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={toggleOpen}
        className="flex items-center gap-1.5 text-[10px] text-slate-200 cursor-pointer px-1 py-0.5"
      >
        <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
        <span className={selected ? "font-bold" : "text-slate-400"}>{label}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className={`absolute ${align === "right" ? "right-0" : "left-0"} top-full mt-2 z-50 w-[300px] max-w-[calc(100vw-1rem)] rounded-xl border border-slate-700 bg-slate-950 shadow-2xl p-3 space-y-3`}>
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
              <div className="grid grid-cols-7 gap-y-0 text-center">
                {cells.map((d, i) =>
                  d ? (
                    (() => {
                      const mk = marks.get(dayKey(d));
                      const tip = mk ? `${d.getMonth() + 1}/${d.getDate()} 已預約：${describeDay(mk)}` : undefined;
                      return (
                        <div key={i} className="flex flex-col items-center" title={tip}>
                          <button
                            type="button"
                            disabled={dayDisabled(d)}
                            onClick={() => pickDay(d)}
                            className={`mx-auto w-8 h-8 rounded-full text-[11px] transition ${
                              mk?.full ? "ring-1 ring-slate-100/80 " : ""
                            }${
                              selected && sameDay(d, selected)
                                ? `${accentClass} text-white font-bold`
                                : sameDay(d, new Date())
                                ? "border border-slate-500 text-slate-100 hover:bg-slate-800"
                                : "text-slate-200 hover:bg-slate-800"
                            } disabled:text-slate-700 disabled:hover:bg-transparent disabled:cursor-not-allowed cursor-pointer`}
                          >
                            {d.getDate()}
                          </button>
                          <div className="flex items-center justify-center gap-[3px] h-[10px] mt-[1px]">
                            {mk?.brands.map((b) => (
                              <span
                                key={b.brand}
                                className="inline-flex items-center justify-center rounded-full border border-white/30 text-[6px] leading-none font-bold text-white"
                                style={{
                                  backgroundColor: MARK_BRAND_COLOR[b.brand],
                                  width: b.count > 1 ? 9 : 6,
                                  height: b.count > 1 ? 9 : 6,
                                }}
                              >
                                {b.count > 1 ? b.count : ""}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <span key={i} />
                  )
                )}
              </div>
            </div>

            {/* 圖例與選到那天的預約清單 */}
            <div className="text-[10px] text-slate-400 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                {(["i8", "abl", "nas"] as const).map((b) => (
                  <span key={b} className="inline-flex items-center gap-1">
                    <span className="inline-block w-[6px] h-[6px] rounded-full border border-white/30" style={{ backgroundColor: MARK_BRAND_COLOR[b] }} />
                    {MARK_BRAND_LABEL[b]}
                  </span>
                ))}
                <span className="text-slate-500">圓點＝當天已有預約　外框＝四個品牌都有</span>
              </div>
              {selected && (
                <div className="text-slate-300">
                  {selectedMark ? `${selected.getMonth() + 1}/${selected.getDate()} 已預約：${describeDay(selectedMark)}` : `${selected.getMonth() + 1}/${selected.getDate()} 目前沒有預約`}
                </div>
              )}
              {slotHint && <div className="text-amber-400">{slotHint}</div>}
            </div>

            {/* 滾輪時間 */}
            <div className="border-t border-slate-800 pt-3">
              <div className="text-[10px] text-slate-500 mb-1.5">時間（台北時間，上下滾動選擇）</div>
              <div className="flex items-center justify-center gap-2">
                <div ref={hourRef} className="h-32 w-16 overflow-y-auto snap-y rounded-lg border border-slate-800 bg-slate-900/60 py-12">
                  {Array.from({ length: 24 }, (_, h) => {
                    const sel = selectedHour === h;
                    const dis = !selected ? false : timeDisabled(h, 55);
                    return (
                      <button
                        key={h}
                        type="button"
                        data-sel={sel ? "1" : undefined}
                        disabled={dis}
                        onClick={() => pickTime(h, selectedMinute)}
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
                    const sel = selectedMinute === m;
                    const dis = !selected ? false : timeDisabled(selected.getHours(), m);
                    return (
                      <button
                        key={m}
                        type="button"
                        data-sel={sel ? "1" : undefined}
                        disabled={dis}
                        onClick={() => pickTime(selectedHour, m)}
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
