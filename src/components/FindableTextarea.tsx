"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { countWords, findAll } from "@/lib/text-find";

interface Props {
  value: string;
  onChange: (next: string) => void;
  /** 系統點名的紅線詞；會列成可點的按鈕，點了直接跳到文章裡的位置 */
  words?: string[];
  rows?: number;
  disabled?: boolean;
}

/** 讓 textarea 把指定位置捲到可視範圍中間：用同樣樣式的隱形鏡像量出該位置的高度。 */
function scrollToIndex(area: HTMLTextAreaElement, index: number) {
  const style = window.getComputedStyle(area);
  const mirror = document.createElement("div");
  for (const prop of ["fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "wordSpacing", "textIndent", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "borderTopWidth", "borderRightWidth", "borderLeftWidth", "boxSizing", "whiteSpace", "wordBreak", "overflowWrap"] as const) {
    (mirror.style as unknown as Record<string, string>)[prop] = style[prop];
  }
  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.top = "0";
  mirror.style.left = "-9999px";
  mirror.style.width = `${area.clientWidth}px`;
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.overflowWrap = "break-word";
  mirror.textContent = area.value.slice(0, index);
  const marker = document.createElement("span");
  marker.textContent = "x";
  mirror.appendChild(marker);
  document.body.appendChild(mirror);
  const top = marker.offsetTop;
  document.body.removeChild(mirror);
  area.scrollTop = Math.max(0, top - area.clientHeight / 3);
}

export default function FindableTextarea({ value, onChange, words = [], rows = 16, disabled }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(-1);
  const matches = useMemo(() => findAll(value, query), [value, query]);
  const wordCounts = useMemo(() => countWords(value, words), [value, words]);

  const jump = useCallback((start: number, length: number) => {
    const area = ref.current;
    if (!area) return;
    area.focus();
    area.setSelectionRange(start, start + length);
    scrollToIndex(area, start);
  }, []);

  const go = (list: number[], length: number, next: number) => {
    if (!list.length) return;
    const at = ((next % list.length) + list.length) % list.length;
    setCursor(at);
    jump(list[at], length);
  };

  const pickWord = (word: string) => {
    setQuery(word);
    const list = findAll(value, word);
    if (!list.length) { setCursor(-1); return; }
    // 同一個詞再按一次就跳到下一處
    const same = query.trim().toLowerCase() === word.toLowerCase();
    go(list, word.length, same ? cursor + 1 : 0);
  };

  return (
    <div className="flex flex-col gap-2">
      {wordCounts.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-rose-400/30 bg-rose-400/10 p-3">
          <span className="text-xs font-semibold text-rose-100">系統點名要改的詞，按一下跳到文章位置：</span>
          {wordCounts.map(({ word, count }) => (
            <button key={word} type="button" onClick={() => pickWord(word)} disabled={count === 0}
              className={`min-h-[36px] rounded-full border px-3 text-sm font-semibold ${count ? "border-rose-300 bg-rose-300 text-slate-950" : "border-white/20 bg-white/5 text-slate-400"}`}>
              {word}　{count ? `${count} 處` : "已改掉"}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input value={query} onChange={(event) => { setQuery(event.target.value); setCursor(-1); }}
          onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); go(matches, query.trim().length, cursor + (event.shiftKey ? -1 : 1)); } }}
          placeholder="在文章裡搜尋關鍵字，按 Enter 跳到下一處"
          className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-white/20 bg-slate-900 px-3 text-sm text-slate-100" aria-label="在文章裡搜尋" />
        <button type="button" onClick={() => go(matches, query.trim().length, cursor - 1)} disabled={!matches.length} className="min-h-[44px] rounded-lg border border-white/20 px-3 text-sm font-semibold disabled:opacity-40">上一處</button>
        <button type="button" onClick={() => go(matches, query.trim().length, cursor + 1)} disabled={!matches.length} className="min-h-[44px] rounded-lg border border-white/20 px-3 text-sm font-semibold disabled:opacity-40">下一處</button>
        <span className="text-xs text-slate-400">{query.trim() ? (matches.length ? `共 ${matches.length} 處${cursor >= 0 ? `，目前第 ${cursor + 1} 處` : ""}` : "文章裡找不到") : ""}</span>
      </div>
      <textarea ref={ref} value={value} onChange={(event) => onChange(event.target.value)} rows={rows} disabled={disabled}
        className="w-full rounded-lg border border-white/20 bg-slate-900 p-3 text-sm leading-7 text-slate-100 selection:bg-amber-300 selection:text-slate-950" aria-label="文章內容" />
      <div className="text-xs text-slate-400">{value.length} 字</div>
    </div>
  );
}
