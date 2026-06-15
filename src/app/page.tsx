"use client";

import React, { useState, useEffect } from "react";
import { Bot, Sparkles, LogOut, Radio, Cpu, Network } from "lucide-react";
import BrandSelector, { BRANDS } from "@/components/BrandSelector";
import ChatBox from "@/components/ChatBox";
import WorkspaceBoard from "@/components/WorkspaceBoard";

export default function DashboardPage() {
  const [activeBrandId, setActiveBrandId] = useState<string>("brand_a_i8");
  const [aiProvider, setAiProvider] = useState<string>("mock");

  useEffect(() => {
    const saved = localStorage.getItem("ai_provider_override");
    if (saved) {
      setAiProvider(saved);
    }
  }, []);

  const handleProviderChange = (newProvider: string) => {
    setAiProvider(newProvider);
    localStorage.setItem("ai_provider_override", newProvider);
  };

  const activeBrand = BRANDS.find((b) => b.id === activeBrandId) || BRANDS[0];

  return (
    <main className="min-h-screen h-screen bg-slate-950 text-slate-100 flex flex-col font-sans overflow-hidden bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black">
      {/* Header bar */}
      <header className="h-16 px-6 bg-slate-900/30 border-b border-slate-800/60 backdrop-blur-md flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400">
            <Cpu className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold tracking-wider bg-gradient-to-r from-slate-100 to-slate-400 bg-clip-text text-transparent uppercase">
              AI 團隊決策大腦
            </h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
              AI Team Command & Control Panel
            </p>
          </div>
        </div>

        {/* Live Status indicator & AI Provider Selector */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-800/80 rounded-xl px-3 py-1.5 backdrop-blur-md">
            <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse animate-duration-3000" />
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">AI 大腦:</span>
            <select
              value={aiProvider}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="bg-transparent text-xs font-extrabold text-slate-100 focus:outline-none cursor-pointer pr-1"
              suppressHydrationWarning
            >
              <option value="mock" className="bg-slate-950 text-slate-200">本地模擬 (Mock)</option>
              <option value="openai" className="bg-slate-950 text-slate-200">OpenAI (GPT-5.4 Mini)</option>
              <option value="gemini" className="bg-slate-950 text-slate-200">Google Gemini</option>
              <option value="anthropic" className="bg-slate-950 text-slate-200">Anthropic Claude</option>
              <option value="n8n" className="bg-slate-950 text-slate-200">n8n Webhook</option>
            </select>
          </div>

          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            系統主大腦連線中
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row p-6 gap-6 overflow-hidden h-[calc(100vh-64px)]">
        {/* Left Column (Brand Switcher & Profile Card) */}
        <div className="lg:w-1/4 xl:w-1/5 flex flex-col justify-between h-full bg-slate-900/20 border border-slate-800/60 p-5 rounded-2xl backdrop-blur-md shrink-0">
          <div className="space-y-6">
            {/* Brand Dropdown Selector */}
            <BrandSelector 
              activeBrandId={activeBrandId} 
              onChangeBrand={setActiveBrandId} 
            />

            {/* Erick Profile Widget */}
            <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-950/40 space-y-4">
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-500 via-orange-500 to-yellow-500 flex items-center justify-center shadow-xl shadow-amber-500/10 border border-amber-400/20">
                    <Bot className="w-8 h-8 text-slate-950" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 p-1 bg-slate-900 rounded-full border border-slate-800">
                    <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                  </div>
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-100">Erick 營運長</h3>
                  <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider mt-0.5">團隊總指揮 (COO)</p>
                </div>
              </div>

              <div className="border-t border-slate-800/80 my-3" />

              {/* Expert Team Stats */}
              <div className="space-y-2.5">
                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  直轄 AI 專家團隊
                </h4>
                <ul className="space-y-2 text-xs">
                  <li className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      Maya (社群行銷)
                    </span>
                    <span className="text-[10px] text-slate-500 font-semibold bg-slate-900 px-1.5 py-0.5 rounded">文案發布</span>
                  </li>
                  <li className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                      Leon (系統架構)
                    </span>
                    <span className="text-[10px] text-slate-500 font-semibold bg-slate-900 px-1.5 py-0.5 rounded">網頁路由</span>
                  </li>
                  <li className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Iris (SEO 專家)
                    </span>
                    <span className="text-[10px] text-slate-500 font-semibold bg-slate-900 px-1.5 py-0.5 rounded">關鍵字庫</span>
                  </li>
                  <li className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                      Jack (廣告數據)
                    </span>
                    <span className="text-[10px] text-slate-500 font-semibold bg-slate-900 px-1.5 py-0.5 rounded">指標漏斗</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Sidebar Footer */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 px-3 py-2 text-xs text-slate-400 bg-slate-950/30 border border-slate-850 rounded-xl">
              <Network className="w-3.5 h-3.5 text-slate-500" />
              <div className="truncate">
                <span className="block text-[8px] text-slate-600 font-bold uppercase">當前領域</span>
                <span className="block font-semibold text-slate-300 text-[10px] truncate">{activeBrand.name}</span>
              </div>
            </div>
            <p className="text-[9px] text-slate-600 text-center font-semibold uppercase tracking-wider">
              AI Team Dashboard v1.0
            </p>
          </div>
        </div>

        {/* Center Column (ChatBox) */}
        <div className="flex-1 lg:w-2/5 h-full flex flex-col">
          <ChatBox 
            activeBrandId={activeBrandId} 
            activeBrandName={activeBrand.name} 
            aiProvider={aiProvider}
          />
        </div>

        {/* Right Column (WorkspaceBoard) */}
        <div className="flex-1 lg:w-2/5 h-full flex flex-col">
          <WorkspaceBoard 
            activeBrandId={activeBrandId} 
            aiProvider={aiProvider}
          />
        </div>
      </div>
    </main>
  );
}
