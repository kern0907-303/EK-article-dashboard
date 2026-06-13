"use client";

import React, { useState, useEffect, useRef } from "react";
import { Send, Trash2, Bot, Sparkles, User } from "lucide-react";
import { ChatMessage, subscribeToChat, saveChatMessage, saveWorkspace, clearChatHistory } from "@/lib/firebase";

interface ChatBoxProps {
  activeBrandId: string;
  activeBrandName: string;
  aiProvider: string;
}

export default function ChatBox({ activeBrandId, activeBrandName, aiProvider }: ChatBoxProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 訂閱當前品牌的聊天歷史
  useEffect(() => {
    setMessages([]); // 立即清空，防範切換品牌時對話紀錄殘留/閃爍
    const unsubscribe = subscribeToChat(activeBrandId, (msgs) => {
      setMessages(msgs);
    });
    return () => unsubscribe();
  }, [activeBrandId]);

  // 自動滾動到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, isGenerating]);

  // 元件卸載時自動中止請求
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleCancelGeneration = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsGenerating(false);
    setIsLoading(false);
    
    // 將預覽狀態重設
    await saveWorkspace(activeBrandId, {
      social_copy: "⚠️ 已取消生成。您可以重新輸入指令以開始新任務。",
      web_architecture: "⚠️ 已取消生成。",
      seo_keywords: [],
      ad_data: []
    });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading || isGenerating) return;

    const userText = inputValue.trim();
    setInputValue("");
    setIsLoading(true);
    setIsGenerating(false);

    // 初始化 AbortController
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      // 1. 先把使用者的訊息存入資料庫
      await saveChatMessage(activeBrandId, {
        role: "user",
        content: userText
      });

      // 2. 獲取更新後的對話歷史作為 Context 發送給 API
      // 我們載入資料庫的最新對話（包含剛剛寫入的這條）
      const updatedHistory = [...messages, { id: "temp-user-id", role: "user", content: userText, timestamp: Date.now() } as ChatMessage];

      // 3. 呼叫後端 API 取得 Erick COO 的任務拆解 (COO 階段，限時 3 秒內)
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: signal,
        body: JSON.stringify({
          stage: "coo",
          history: updatedHistory,
          brandName: activeBrandName,
          aiProvider: aiProvider
        })
      });

      if (!response.ok) {
        let errMsg = "系統總指揮連線中斷，請重試";
        try {
          const errData = await response.json();
          if (errData && errData.error) {
            errMsg = errData.error;
          }
        } catch (_) {}
        throw new Error(errMsg);
      }

      const result = await response.json();

      // 4. 將 Erick 的文字回覆存入對話歷史 (讓使用者先看到 Erick 的拆解對話，避免等待超時)
      await saveChatMessage(activeBrandId, {
        role: "assistant",
        content: result.content
      });

      // 5. 若有子任務 subPrompts 或是 mockData，啟動非同步專家生成，避免 Netlify 10秒超時限制
      if (result.dispatchData && result.dispatchData.subPrompts) {
        const subPrompts = result.dispatchData.subPrompts;

        // 如果是 mockData 模式，直接一次性更新，省去後續請求
        if (subPrompts.mockData) {
          await saveWorkspace(activeBrandId, subPrompts.mockData);
        } else {
          // 立即更新面板為「生成中...」狀態，提供即時的視覺回饋給使用者
          await saveWorkspace(activeBrandId, {
            social_copy: "⏳ 專家助理 Maya 正在為您撰寫爆款社群行銷長文與文章，這大約需要 15-30 秒，請您稍候...\n\n(大腦正在並行處理中，請勿關閉網頁)",
            web_architecture: "⏳ 系統架構師 Leon 正在設計網頁功能路由架構，請您稍候...\n\n(大腦正在並行處理中，請勿關閉網頁)",
            seo_keywords: [
              { keyword: "⏳ 專家助理 Iris 正在分析關鍵字與規劃文章大綱...", volume: "計算中", competition: "計算中", outline: "大腦計算中" }
            ],
            ad_data: [
              { label: "⏳ 廣告數據專家 Jack 正在計算廣告漏斗數據與預估成效指標...", value: "計算中", change: "計算中", isPositive: true }
            ],
            aeo_schema: "",
            aeo_faq: ""
          });

          // 啟動兩個獨立的背景 Fetch 請求，分別產生社群+SEO 與 網頁+廣告數據，確保各自都在 10 秒內完成
          const runMayaIris = async () => {
            try {
              const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                signal: signal,
                body: JSON.stringify({
                  stage: "expert",
                  expertType: "maya_iris",
                  subPrompts,
                  brandName: activeBrandName,
                  aiProvider
                })
              });
              if (res.ok) {
                const data = await res.json();
                if (data.dispatchData) {
                  await saveWorkspace(activeBrandId, data.dispatchData);
                } else {
                  throw new Error("專家回傳資料格式不正確");
                }
              } else {
                throw new Error(`HTTP 狀態碼: ${res.status}`);
              }
            } catch (e: any) {
              if (e.name === 'AbortError') {
                console.log("Background Maya & Iris generation aborted.");
                return;
              }
              console.error("Background Maya & Iris generation failed:", e);
              await saveWorkspace(activeBrandId, {
                social_copy: `❌ 專家助理 Maya 產出失敗：${e.message || "未知錯誤"}。\n請確認您的 API 金鑰（Gemini/OpenAI）設定是否正確，並清除歷史對話後重試。`,
                seo_keywords: [
                  { keyword: "❌ 專家助理 Iris 產出失敗", volume: "失敗", competition: "失敗", outline: e.message || "金鑰或 API 連線異常" }
                ]
              });
            }
          };

          const runLeonJack = async () => {
            try {
              const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                signal: signal,
                body: JSON.stringify({
                  stage: "expert",
                  expertType: "leon_jack",
                  subPrompts,
                  brandName: activeBrandName,
                  aiProvider
                })
              });
              if (res.ok) {
                const data = await res.json();
                if (data.dispatchData) {
                  await saveWorkspace(activeBrandId, data.dispatchData);
                } else {
                  throw new Error("專家回傳資料格式不正確");
                }
              } else {
                throw new Error(`HTTP 狀態碼: ${res.status}`);
              }
            } catch (e: any) {
              if (e.name === 'AbortError') {
                console.log("Background Leon & Jack generation aborted.");
                return;
              }
              console.error("Background Leon & Jack generation failed:", e);
              await saveWorkspace(activeBrandId, {
                web_architecture: `❌ 系統架構師 Leon 產出失敗：${e.message || "未知錯誤"}。\n請確認您的 API 金鑰（OpenAI）設定是否正確，並清除歷史對話後重試。`,
                ad_data: [
                  { label: "❌ 廣告數據專家 Jack 產出失敗", value: "失敗", change: e.message || "金鑰或 API 連線異常", isPositive: false }
                ]
              });
            }
          };

          // 順序背景發起，避免 Render 免費版同時處理兩個大腦 API 導致記憶體超載 (OOM) 與 502 崩潰
          const runSequentially = async () => {
            setIsGenerating(true);
            try {
              await runMayaIris();
              if (signal.aborted) return;
              await runLeonJack();
            } finally {
              if (!signal.aborted) {
                setIsGenerating(false);
              }
            }
          };
          runSequentially();
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log("Erick COO generation aborted.");
        return;
      }
      console.error("Chat error:", error);
      await saveChatMessage(activeBrandId, {
        role: "assistant",
        content: `【營運回報】系統處理指令時發生錯誤：${error.message || "未知異常"}。請確認您的 API 金鑰設定。`
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (confirm("確定要清除與 Erick 營運長的歷史對話紀錄嗎？")) {
      setIsLoading(true);
      await clearChatHistory(activeBrandId);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950/20 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-slate-900/40 border-b border-slate-800/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-slate-900 font-bold shadow-lg shadow-amber-500/10">
              <Bot className="w-5 h-5 text-slate-900" />
            </div>
            {/* Status Glow Indicator */}
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-950 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-100 text-base">Erick 營運長</h3>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full">
                團隊總指揮
              </span>
            </div>
            <p className="text-xs text-slate-400">管理 Maya、Leon、Iris 與 Jack 四位專家</p>
          </div>
        </div>
        
        <button
          onClick={handleClearHistory}
          title="清除對話紀錄"
          className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all duration-300 cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          return (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-[85%] ${
                isUser ? "ml-auto flex-row-reverse" : "mr-auto"
              }`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-md ${
                  isUser 
                    ? "bg-slate-800 text-slate-300" 
                    : "bg-gradient-to-tr from-amber-500 to-orange-600 text-slate-950"
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              {/* Message Bubble */}
              <div className="space-y-1">
                <div
                  className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    isUser
                      ? "bg-amber-500 text-slate-950 font-medium rounded-tr-none shadow-md shadow-amber-500/5"
                      : "bg-slate-900/80 text-slate-200 border border-slate-800/80 rounded-tl-none"
                  }`}
                >
                  {msg.content}
                </div>
                <span 
                  className={`text-[10px] text-slate-500 block px-1 ${isUser ? "text-right" : "text-left"}`}
                  suppressHydrationWarning
                >
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          );
        })}

        {/* AI Thinking Animation */}
        {isLoading && (
          <div className="flex gap-3 max-w-[85%] mr-auto">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-slate-950 shadow-md">
              <Bot className="w-4 h-4 animate-bounce" />
            </div>
            <div className="space-y-1">
              <div className="px-4 py-3 bg-slate-900/80 border border-slate-800/80 rounded-2xl rounded-tl-none flex items-center gap-2">
                <span className="text-xs text-slate-400">營運長 Erick 正在指派專家處理中</span>
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce delay-100" />
                  <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce delay-200" />
                  <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce delay-300" />
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Cancel Panel */}
      {(isLoading || isGenerating) && (
        <div className="mx-4 mb-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center gap-2 text-xs text-amber-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            {isLoading ? "營運長 Erick 正在指派中..." : "專家團隊正在並行分析與生成中..."}
          </div>
          <button
            type="button"
            onClick={handleCancelGeneration}
            className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-bold rounded-lg cursor-pointer transition-colors"
          >
            取消生成
          </button>
        </div>
      )}

      {/* Input Form */}
      <form
        onSubmit={handleSend}
        className="p-4 bg-slate-900/20 border-t border-slate-800/60 backdrop-blur-md flex gap-2.5"
      >
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={`對 Erick 營運長下達【${activeBrandName}】指令...`}
          disabled={isLoading || isGenerating}
          className="flex-1 px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-850 focus:border-amber-500/60 text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/20 placeholder-slate-500 disabled:opacity-50 transition-all duration-300"
        />
        <button
          type="submit"
          disabled={!inputValue.trim() || isLoading || isGenerating}
          className="p-3 bg-amber-500 hover:bg-amber-400 text-slate-950 disabled:bg-slate-800 disabled:text-slate-500 rounded-xl transition-all duration-300 cursor-pointer shadow-lg shadow-amber-500/5 disabled:shadow-none shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
