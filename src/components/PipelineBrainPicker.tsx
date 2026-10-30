"use client";

import { useEffect, useState } from "react";
import { PIPELINE_PROVIDER_OPTIONS } from "@/lib/ai-setting-core.mjs";

/**
 * 自動發文用哪個模型。
 *
 * 跟首頁右上角那個「AI 大腦」不是同一件事：那個只存在這台瀏覽器裡，
 * 只影響你自己按下去的生成。這裡存在資料庫，每晚自動發文會讀它。
 */
export default function PipelineBrainPicker() {
  const [value, setValue] = useState("");
  const [envDefault, setEnvDefault] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void fetch("/api/ai-provider", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "讀取失敗");
        setValue(typeof data.value === "string" ? data.value : "");
        setEnvDefault(typeof data.envDefault === "string" ? data.envDefault : "");
        setReady(true);
      })
      .catch((error) => setNotice(error instanceof Error ? error.message : "讀取模型設定失敗"));
  }, []);

  const save = async (next: string) => {
    const previous = value;
    setValue(next);
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/ai-provider", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value: next }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "儲存失敗");
      setNotice("已儲存。下一篇自動發文就會用這個設定。");
    } catch (error) {
      setValue(previous);
      setNotice(error instanceof Error ? error.message : "儲存模型設定失敗");
    } finally {
      setBusy(false);
    }
  };

  const active = value || envDefault || "未設定";

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6">
      <h2 className="text-lg font-bold">自動發文用哪個模型</h2>
      <p className="mt-1 text-sm text-slate-400">
        這個設定存在資料庫，每晚自動發文會讀它。首頁右上角的「AI 大腦」只存在這台瀏覽器，只影響你自己手動按的生成，管不到自動發文。
      </p>
      <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400">
        <p className="font-semibold text-slate-300">各角色的供應商是寫死的，這裡不會覆蓋它</p>
        <p className="mt-1">Maya 走 Claude，Iris 走 Gemini，Jack 與 Leon 走 OpenAI，SEO 審稿走 Claude。這是品質設計，不該被一個下拉整家換掉。</p>
        <p className="mt-1">所以這裡真正有效的是兩件事：所有 OpenAI 步驟改用哪個模型，以及沒有固定供應商的步驟（目前是選書）先找誰。</p>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <select
          value={value}
          disabled={!ready || busy}
          onChange={(event) => void save(event.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-slate-100 disabled:opacity-50"
        >
          {PIPELINE_PROVIDER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value} className="bg-slate-950 text-slate-200">{option.label}</option>
          ))}
        </select>
        <span className="text-xs text-slate-400">目前實際生效：{active}</span>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        選到的這家只是第一順位。它失敗時會自動換下一家（Claude、OpenAI、Gemini 依序），所以 Claude 沒額度那幾天照樣有稿；Claude 一有額度，下一篇就會自己回到 Claude，不需要你來改這裡。
      </p>
      {notice && <p className="mt-2 text-xs text-amber-200">{notice}</p>}
    </section>
  );
}
