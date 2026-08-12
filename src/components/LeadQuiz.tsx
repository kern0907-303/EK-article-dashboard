"use client";

import React, { useState, useMemo } from "react";
import { ArrowRight, Check, Loader2, Mail, RotateCcw } from "lucide-react";
import { QuizConfig, scoreQuiz } from "@/data/quizzes";
import { getBrandConversion } from "@/data/brands/conversion";

type Phase = "intro" | "quiz" | "capture" | "done";

/**
 * 名單捕捉測驗元件。
 *
 * 流程：說明 → 逐題作答 → 留 email → 顯示結果。
 * 結果在留 email 之前不揭露（這是換取 email 的誘因），但作答本身無門檻，
 * 降低進入摩擦。依 Krug 的原則，每一頁只有一個明確動作。
 */
export default function LeadQuiz({ config }: { config: QuizConfig }) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const conversion = useMemo(() => getBrandConversion(config.brandId), [config.brandId]);
  const result = useMemo(() => scoreQuiz(config, answers), [config, answers]);
  const total = config.questions.length;
  const question = config.questions[current];
  const a = config.accent;

  const choose = (optionIndex: number) => {
    const next = { ...answers, [question.id]: optionIndex };
    setAnswers(next);
    if (current + 1 < total) {
      setCurrent(current + 1);
    } else {
      setPhase("capture");
    }
  };

  const back = () => {
    if (current > 0) setCurrent(current - 1);
    else setPhase("intro");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.includes("@") || !email.includes(".")) {
      setError("請輸入有效的 email 位址");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          brand: config.shortId,
          source: config.slug,
          stage: conversion.stage,
          resultType: result.key,
          resultTitle: result.title,
          resultBody: result.body,
          resultNextStep: result.nextStep,
          brandLabel: config.brandLabel,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "送出失敗");

      setPhase("done");
    } catch (err: any) {
      // 名單送出失敗時仍讓使用者看到結果，避免白做一場；後端會記錄錯誤
      console.error("Lead submit error:", err);
      setError("結果已為你產生，但通知信寄送失敗，請稍後再試或直接聯繫我們。");
      setPhase("done");
    } finally {
      setSubmitting(false);
    }
  };

  const restart = () => {
    setPhase("intro");
    setCurrent(0);
    setAnswers({});
    setError("");
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center px-4 py-10 sm:py-16 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black">
      <div className="w-full max-w-2xl">
        <p className={`text-[11px] font-bold uppercase tracking-[0.2em] ${a.text} mb-3`}>
          {config.brandLabel}
        </p>

        {/* ---------------------------------------------------- 說明 */}
        {phase === "intro" && (
          <section>
            <h1 className="text-2xl sm:text-4xl font-extrabold leading-tight mb-3">
              {config.title}
            </h1>
            <p className="text-sm text-slate-400 font-semibold mb-6">{config.subtitle}</p>
            <p className="text-base text-slate-300 leading-relaxed mb-8">{config.intro}</p>
            <button
              type="button"
              onClick={() => setPhase("quiz")}
              className={`inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold ${a.bg} ${a.bgHover} border ${a.border} transition-all cursor-pointer`}
            >
              開始作答（約 3 分鐘）
              <ArrowRight className="w-4 h-4" />
            </button>
            <p className="text-xs text-slate-500 mt-4">共 {total} 題，沒有標準答案。</p>
          </section>
        )}

        {/* ---------------------------------------------------- 作答 */}
        {phase === "quiz" && question && (
          <section>
            <div className="flex items-center gap-3 mb-8">
              <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full ${a.bg} transition-all duration-300`}
                  style={{ width: `${((current + 1) / total) * 100}%` }}
                />
              </div>
              <span className="text-xs text-slate-500 font-bold shrink-0">
                {current + 1} / {total}
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold leading-snug mb-7">{question.text}</h2>

            <div className="space-y-3">
              {question.options.map((opt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => choose(idx)}
                  className={`w-full text-left px-5 py-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-600 hover:bg-slate-900 text-sm sm:text-base leading-relaxed transition-all cursor-pointer`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={back}
              className="mt-6 text-xs text-slate-500 hover:text-slate-300 cursor-pointer"
            >
              ← 上一題
            </button>
          </section>
        )}

        {/* ---------------------------------------------------- 留 email */}
        {phase === "capture" && (
          <section>
            <div className={`inline-flex items-center gap-2 mb-4 ${a.text}`}>
              <Check className="w-5 h-5" />
              <span className="text-sm font-bold">作答完成</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold leading-tight mb-4">
              你的結果已經產生了
            </h2>
            <p className="text-base text-slate-300 leading-relaxed mb-8">
              {conversion.leadMagnet}
            </p>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label htmlFor="lead-name" className="block text-xs font-bold text-slate-400 mb-2">
                  怎麼稱呼你？
                </label>
                <input
                  id="lead-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="你的名字"
                  className={`w-full px-4 py-3 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 ${a.ring} transition-all`}
                />
              </div>

              <div>
                <label htmlFor="lead-email" className="block text-xs font-bold text-slate-400 mb-2">
                  結果寄到哪個信箱？
                </label>
                <input
                  id="lead-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={`w-full px-4 py-3 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 ${a.ring} transition-all`}
                />
              </div>

              {error && <p className="text-sm text-rose-400">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className={`w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold ${a.bg} ${a.bgHover} border ${a.border} disabled:bg-slate-800 disabled:text-slate-500 transition-all cursor-pointer`}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    處理中...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    {config.submitLabel}
                  </>
                )}
              </button>

              <p className="text-xs text-slate-500 leading-relaxed">{config.privacyNote}</p>
            </form>
          </section>
        )}

        {/* ---------------------------------------------------- 結果 */}
        {phase === "done" && (
          <section>
            <p className={`text-sm font-bold ${a.text} mb-3`}>你的結果</p>
            <h2 className="text-2xl sm:text-3xl font-extrabold leading-tight mb-6">
              {result.title}
            </h2>
            <p className="text-base text-slate-300 leading-relaxed mb-6">{result.body}</p>

            <div className={`px-5 py-4 rounded-xl bg-slate-900/60 border ${a.border} mb-8`}>
              <p className="text-xs font-bold text-slate-400 mb-2">下一步建議</p>
              <p className="text-sm text-slate-200 leading-relaxed">{result.nextStep}</p>
            </div>

            {error && <p className="text-sm text-amber-400 mb-6">{error}</p>}

            <p className="text-sm text-slate-400 mb-6">
              完整版已經寄到 <span className="text-slate-200 font-semibold">{email}</span>，
              如果沒收到請看一下垃圾信件匣。
            </p>

            <button
              type="button"
              onClick={restart}
              className="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              重新作答
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
