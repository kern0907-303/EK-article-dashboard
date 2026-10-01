"use client";

import React, { useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        window.location.href = "/";
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error || "登入失敗，請重試");
    } catch {
      setError("連線失敗，請稍後再試（主機休眠時第一次可能要等約 1 分鐘）");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
        <div>
          <h1 className="text-lg font-bold text-slate-100">AI 團隊決策大腦</h1>
          <p className="text-xs text-slate-400 mt-1">請輸入密碼進入儀表板</p>
        </div>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="密碼"
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500"
        />
        {error && <div className="text-xs text-red-400">{error}</div>}
        <button
          type="submit"
          disabled={busy || !password}
          className="w-full rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-sm font-bold py-2 cursor-pointer"
        >
          {busy ? "驗證中…" : "登入"}
        </button>
      </form>
    </main>
  );
}
