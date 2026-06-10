"use client";

import React, { useState, useEffect } from "react";
import { 
  FileText, Network, Search, BarChart3, 
  Plus, Trash2, Eye, Edit2, Check,
  Send, Calendar, ArrowUpRight, ArrowDownRight, Folder, FileCode,
  Copy, Loader2, Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  WorkspaceData, subscribeToWorkspace, saveWorkspace, 
  SEOKeyword, AdDataItem 
} from "@/lib/firebase";
import { BRANDS } from "./BrandSelector";

interface WorkspaceBoardProps {
  activeBrandId: string;
  aiProvider: string;
}

type TabType = "social" | "architecture" | "seo" | "ads";

export default function WorkspaceBoard({ activeBrandId, aiProvider }: WorkspaceBoardProps) {
  const [activeTab, setActiveTab] = useState<TabType>("social");
  const [data, setData] = useState<WorkspaceData>({
    social_copy: "",
    web_architecture: "",
    seo_keywords: [],
    ad_data: []
  });

  // 訂閱當前品牌的看板資料
  useEffect(() => {
    setData({
      social_copy: "",
      web_architecture: "",
      seo_keywords: [],
      ad_data: []
    }); // 立即重設，防範切換品牌時舊有看板資料殘留/閃爍
    const unsubscribe = subscribeToWorkspace(activeBrandId, (workspaceData) => {
      if (workspaceData) {
        setData(workspaceData);
      }
    });
    return () => unsubscribe();
  }, [activeBrandId]);

  // Tab 列表設定
  const tabs = [
    { id: "social", label: "社群文案", expert: "Maya", icon: FileText, color: "from-pink-500 to-rose-500", glow: "shadow-rose-500/10" },
    { id: "architecture", label: "網頁架構", expert: "Leon", icon: Network, color: "from-sky-500 to-indigo-500", glow: "shadow-indigo-500/10" },
    { id: "seo", label: "SEO關鍵字", expert: "Iris", icon: Search, color: "from-emerald-500 to-teal-500", glow: "shadow-emerald-500/10" },
    { id: "ads", label: "廣告數據", expert: "Jack", icon: BarChart3, color: "from-purple-500 to-violet-500", glow: "shadow-violet-500/10" },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-950/20 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-md">
      {/* Tabs Selector Header */}
      <div className="flex bg-slate-900/40 border-b border-slate-800/60 p-2 gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer whitespace-nowrap relative ${
                isActive 
                  ? "text-slate-100 bg-slate-800/80 shadow-md shadow-slate-950/20" 
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/25"
              }`}
            >
              <TabIcon className={`w-4 h-4 ${isActive ? "text-amber-400 animate-pulse" : ""}`} />
              <div className="text-left leading-none">
                <span className="block">{tab.label}</span>
                <span className="block text-[8px] text-slate-500 mt-0.5">專門家 {tab.expert}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Tab Panels Contents */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-900/10 scrollbar-thin scrollbar-thumb-slate-800">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab + "_" + activeBrandId}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {activeTab === "social" && (
              <SocialTabContent 
                brandId={activeBrandId} 
                socialCopy={data.social_copy} 
                aeoSchema={data.aeo_schema}
                aeoFaq={data.aeo_faq}
              />
            )}
            {activeTab === "architecture" && (
              <ArchitectureTabContent 
                brandId={activeBrandId} 
                architecture={data.web_architecture} 
              />
            )}
            {activeTab === "seo" && (
              <SEOTabContent 
                brandId={activeBrandId} 
                keywords={data.seo_keywords} 
                aeoSchema={data.aeo_schema}
                aeoFaq={data.aeo_faq}
                aiProvider={aiProvider}
              />
            )}
            {activeTab === "ads" && (
              <AdsTabContent 
                brandId={activeBrandId} 
                adData={data.ad_data} 
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ==================== 1. 社群文案分頁 (Maya) ====================
function SocialTabContent({ 
  brandId, 
  socialCopy, 
  aeoSchema, 
  aeoFaq 
}: { 
  brandId: string; 
  socialCopy: string; 
  aeoSchema?: string; 
  aeoFaq?: string; 
}) {
  const [mode, setMode] = useState<"edit" | "preview">("preview");
  const [val, setVal] = useState(socialCopy);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPublishingWebsite, setIsPublishingWebsite] = useState(false);
  const [pubStatus, setPubStatus] = useState<"idle" | "success" | "error">("idle");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [scheduleTime, setScheduleTime] = useState("");

  const handlePublishWebsite = async () => {
    if (isPublishingWebsite || !val) return;
    setIsPublishingWebsite(true);
    try {
      const activeBrand = BRANDS.find((b) => b.id === brandId) || BRANDS[0];
      
      const response = await fetch("/api/publish-website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId,
          brandName: activeBrand.name,
          content: val,
          aeoSchema: aeoSchema || null,
          aeoFaq: aeoFaq || null
        })
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || "發布至官網失敗");
      }

      alert("🎉 文章已成功同步至官網 Supabase 資料庫！");
    } catch (error: any) {
      console.error("Publish website error:", error);
      alert(`❌ 同步至官網失敗：${error.message}`);
    } finally {
      setIsPublishingWebsite(false);
    }
  };

  useEffect(() => {
    setVal(socialCopy);
  }, [socialCopy]);

  const handleSave = () => {
    saveWorkspace(brandId, { social_copy: val });
  };

  const handlePublish = async (actionType: "now" | "schedule", targetTime?: string) => {
    if (isPublishing || !val) return;
    setIsPublishing(true);
    setPubStatus("idle");

    try {
      const response = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId,
          content: val,
          action: actionType,
          scheduleTime: targetTime || null
        })
      });

      if (!response.ok) {
        throw new Error("發布失敗");
      }

      setPubStatus("success");
      alert(actionType === "now" ? "🎉 已發布至 Meta！" : `📅 已成功設定排程於：${new Date(targetTime!).toLocaleString()}！`);
    } catch (error) {
      console.error("Publish error:", error);
      setPubStatus("error");
      alert("❌ 發布失敗，請確認 n8n Webhook 設定");
    } finally {
      setIsPublishing(false);
      setTimeout(() => setPubStatus("idle"), 4000);
    }
  };

  // 簡易 Markdown 解析器，防範依賴性問題
  const renderMarkdown = (text: string) => {
    if (!text) return <p className="text-slate-500 italic">尚無社群文案，請對左側 Erick 下達任務...</p>;
    
    return text.split("\n").map((line, idx) => {
      if (line.startsWith("# ")) {
        return <h1 key={idx} className="text-xl font-bold text-slate-100 mt-4 mb-2">{line.replace("# ", "")}</h1>;
      }
      if (line.startsWith("## ")) {
        return <h2 key={idx} className="text-lg font-bold text-slate-200 mt-3 mb-2">{line.replace("## ", "")}</h2>;
      }
      if (line.startsWith("### ")) {
        return <h3 key={idx} className="text-md font-bold text-slate-300 mt-2 mb-1">{line.replace("### ", "")}</h3>;
      }
      if (line.startsWith("* ") || line.startsWith("- ")) {
        const content = line.substring(2);
        // 解析粗體 **
        const parts = content.split("**");
        return (
          <li key={idx} className="ml-5 list-disc text-slate-300 text-sm leading-relaxed my-0.5">
            {parts.map((part, pIdx) => pIdx % 2 === 1 ? <strong key={pIdx} className="text-amber-400 font-semibold">{part}</strong> : part)}
          </li>
        );
      }
      if (line.trim() === "") {
        return <div key={idx} className="h-2" />;
      }
      
      const parts = line.split("**");
      return (
        <p key={idx} className="text-slate-350 text-sm leading-relaxed my-1.5">
          {parts.map((part, pIdx) => pIdx % 2 === 1 ? <strong key={pIdx} className="text-amber-400 font-semibold">{part}</strong> : part)}
        </p>
      );
    });
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-900/40 p-3 rounded-xl border border-slate-800/60 gap-3">
        <div>
          <h4 className="text-sm font-bold text-slate-200">社群行銷專家：Maya</h4>
          <p className="text-[10px] text-slate-400">產出高轉換貼文與社群文案規劃</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Webhook Publish Action Buttons */}
          {val && (
            <div className="flex gap-1.5 mr-2 border-r border-slate-800 pr-2">
              {showDatePicker ? (
                <div className="flex items-center gap-1.5 bg-slate-950/80 px-2 py-1 rounded-lg border border-slate-800 animate-in fade-in slide-in-from-top-1 duration-200">
                  <input
                    type="datetime-local"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="bg-transparent text-[10px] text-slate-200 focus:outline-none focus:ring-0 cursor-pointer border-0 p-0 w-32"
                    required
                  />
                  <button
                    disabled={isPublishing || !scheduleTime}
                    onClick={() => {
                      handlePublish("schedule", scheduleTime);
                      setShowDatePicker(false);
                    }}
                    className="px-2 py-0.5 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 text-[9px] font-bold rounded cursor-pointer transition"
                  >
                    確定
                  </button>
                  <button
                    onClick={() => setShowDatePicker(false)}
                    className="px-2 py-0.5 bg-slate-850 hover:bg-slate-800 text-slate-400 text-[9px] font-bold rounded cursor-pointer transition"
                  >
                    取消
                  </button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={isPublishingWebsite || isPublishing}
                    onClick={handlePublishWebsite}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:border-slate-850 text-slate-100 border border-blue-500/25 transition-all duration-300 cursor-pointer hover:shadow-lg hover:shadow-blue-500/15"
                  >
                    {isPublishingWebsite ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Network className="w-3.5 h-3.5 text-slate-150" />
                    )}
                    {isPublishingWebsite ? "正在同步..." : "🚀 發布至官網"}
                  </button>

                  <button
                    disabled={isPublishingWebsite || isPublishing}
                    onClick={() => handlePublish("now")}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all duration-300 border ${
                      pubStatus === "success"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : pubStatus === "error"
                        ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                        : "bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 border-amber-400/25 hover:shadow-lg hover:shadow-amber-500/10 cursor-pointer"
                    }`}
                  >
                    {isPublishing ? (
                      <span className="w-3 h-3 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    ) : pubStatus === "success" ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Send className="w-3 h-3 text-slate-950" />
                    )}
                    {pubStatus === "success" ? "已發布至 Meta" : pubStatus === "error" ? "發布失敗" : "🚀 發布至 Meta"}
                  </button>

                  <button
                    disabled={isPublishingWebsite || isPublishing}
                    onClick={() => setShowDatePicker(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-slate-900 hover:bg-slate-850 text-slate-350 border border-slate-800 transition-all duration-300 cursor-pointer"
                  >
                    <Calendar className="w-3 h-3 text-slate-400" />
                    📅 排程
                  </button>
                </>
              )}
            </div>
          )}

          <div className="flex gap-1 bg-slate-950 p-1 rounded-lg border border-slate-850">
            <button
              onClick={() => setMode("preview")}
              className={`px-2.5 py-1.5 rounded-md text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all ${
                mode === "preview" ? "bg-slate-800 text-slate-100" : "text-slate-400"
              }`}
            >
              <Eye className="w-3.5 h-3.5" /> 預覽
            </button>
            <button
              onClick={() => setMode("edit")}
              className={`px-2.5 py-1.5 rounded-md text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all ${
                mode === "edit" ? "bg-slate-800 text-slate-100" : "text-slate-400"
              }`}
            >
              <Edit2 className="w-3.5 h-3.5" /> 編輯
            </button>
          </div>
        </div>
      </div>

      {mode === "edit" ? (
        <div className="flex-1 flex flex-col space-y-3">
          <textarea
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onBlur={handleSave}
            placeholder="在此輸入社群文案..."
            className="flex-1 w-full p-4 rounded-xl bg-slate-950/60 border border-slate-850 focus:border-amber-500/60 text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/20 font-mono resize-none"
          />
          <button
            onClick={handleSave}
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-slate-100 rounded-lg text-xs font-bold transition cursor-pointer"
          >
            儲存變更
          </button>
        </div>
      ) : (
        <div className="flex-1 p-5 rounded-xl bg-slate-950/40 border border-slate-850/65 overflow-y-auto min-h-[300px]">
          {renderMarkdown(val)}
        </div>
      )}
    </div>
  );
}

// ==================== 2. 網頁架構分頁 (Leon) ====================
function ArchitectureTabContent({ brandId, architecture }: { brandId: string; architecture: string }) {
  const [val, setVal] = useState(architecture);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setVal(architecture);
  }, [architecture]);

  const handleSave = () => {
    saveWorkspace(brandId, { web_architecture: val });
    setIsEditing(false);
  };

  // 解析縮排層級並渲染成視覺化網站樹狀結構 (Tree View)
  const renderTreeView = (treeText: string) => {
    if (!treeText) return <p className="text-slate-500 italic">尚無網頁架構設計，請對左側 Erick 下達任務...</p>;

    const lines = treeText.split("\n");
    return (
      <div className="space-y-1">
        {lines.map((line, idx) => {
          if (!line.trim()) return null;
          
          // 計算前面的空格數（縮排層級）
          const leadingSpaces = line.search(/\S/);
          const level = Math.max(0, Math.floor(leadingSpaces / 2)); // 假設以 2 個空格縮排為一級
          
          const cleanText = line.replace(/^[\s\-\*]+/, "").trim();

          return (
            <div 
              key={idx}
              className="flex items-center gap-2 group transition-all"
              style={{ paddingLeft: `${level * 16}px` }}
            >
              {/* 縮排連接線 */}
              {level > 0 && (
                <div 
                  className="w-3 h-4 border-l border-b border-slate-850 -mt-2 shrink-0" 
                  style={{ marginLeft: `-${8}px`, marginRight: `4px` }}
                />
              )}
              {level === 0 ? (
                <Folder className="w-4 h-4 text-amber-500 shrink-0" />
              ) : (
                <FileCode className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              )}
              <span className={`text-xs ${level === 0 ? "font-bold text-slate-200" : "text-slate-350"}`}>
                {cleanText}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex justify-between items-center bg-slate-900/40 p-3 rounded-xl border border-slate-800/60">
        <div>
          <h4 className="text-sm font-bold text-slate-200">系統架構師：Leon</h4>
          <p className="text-[10px] text-slate-400">網頁與功能路由層次結構規劃</p>
        </div>

        <button
          onClick={() => {
            if (isEditing) {
              handleSave();
            } else {
              setIsEditing(true);
            }
          }}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-slate-100 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition"
        >
          {isEditing ? <Check className="w-3 h-3" /> : <Edit2 className="w-3 h-3" />}
          {isEditing ? "儲存" : "編輯結構"}
        </button>
      </div>

      {isEditing ? (
        <div className="flex-1 flex flex-col space-y-3">
          <textarea
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder={`使用層級大綱，例如：\n- 首頁\n  - 關於我們\n  - 服務項目\n    - 智慧系統`}
            className="flex-1 w-full p-4 rounded-xl bg-slate-950/60 border border-slate-850 focus:border-amber-500/60 text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/20 font-mono resize-none"
          />
        </div>
      ) : (
        <div className="flex-1 p-5 rounded-xl bg-slate-950/40 border border-slate-850/65 overflow-y-auto font-mono">
          {renderTreeView(val)}
        </div>
      )}
    </div>
  );
}

// ==================== 3. SEO關鍵字分頁 (Iris) ====================
function SEOTabContent({ 
  brandId, 
  keywords, 
  aeoSchema, 
  aeoFaq, 
  aiProvider 
}: { 
  brandId: string; 
  keywords: SEOKeyword[]; 
  aeoSchema?: string; 
  aeoFaq?: string; 
  aiProvider: string; 
}) {
  const [newKeyword, setNewKeyword] = useState("");
  const [newVolume, setNewVolume] = useState("");
  const [newComp, setNewComp] = useState("低");
  const [newOutline, setNewOutline] = useState("");

  const [isGeneratingAeo, setIsGeneratingAeo] = useState(false);
  const [schemaCopied, setSchemaCopied] = useState(false);
  const [faqCopied, setFaqCopied] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword.trim()) return;

    const newObj: SEOKeyword = {
      keyword: newKeyword.trim(),
      volume: newVolume.trim() || "0",
      competition: newComp,
      outline: newOutline.trim()
    };

    const updated = [...keywords, newObj];
    await saveWorkspace(brandId, { seo_keywords: updated });

    setNewKeyword("");
    setNewVolume("");
    setNewComp("低");
    setNewOutline("");
  };

  const handleDelete = async (idx: number) => {
    const updated = keywords.filter((_, i) => i !== idx);
    await saveWorkspace(brandId, { seo_keywords: updated });
  };

  const handleGenerateAeo = async () => {
    if (isGeneratingAeo) return;
    setIsGeneratingAeo(true);
    try {
      const activeBrand = BRANDS.find((b) => b.id === brandId) || BRANDS[0];
      const brandName = activeBrand.name;

      const res = await fetch("/api/aeo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName,
          keywords,
          aiProvider
        })
      });

      if (!res.ok) throw new Error("AEO generation failed");

      const data = await res.json();
      await saveWorkspace(brandId, {
        aeo_schema: data.schemaMarkup,
        aeo_faq: data.aeoFaq
      });
    } catch (err) {
      console.error(err);
      alert("生成 AEO 優化代碼失敗，請稍後再試！");
    } finally {
      setIsGeneratingAeo(false);
    }
  };

  const handleCopySchema = () => {
    if (!aeoSchema) return;
    navigator.clipboard.writeText(aeoSchema);
    setSchemaCopied(true);
    setTimeout(() => setSchemaCopied(false), 2000);
  };

  const handleCopyFaq = () => {
    if (!aeoFaq) return;
    navigator.clipboard.writeText(aeoFaq);
    setFaqCopied(true);
    setTimeout(() => setFaqCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex justify-between items-center bg-slate-900/40 p-3 rounded-xl border border-slate-800/60">
        <div>
          <h4 className="text-sm font-bold text-slate-200">SEO 專家：Iris</h4>
          <p className="text-[10px] text-slate-400">探索高點擊潛力詞與競爭度分析</p>
        </div>
      </div>

      {/* 數據表格 Table */}
      <div className="flex-1 rounded-xl bg-slate-950/40 border border-slate-850/65 overflow-hidden flex flex-col min-h-[180px]">
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/50 border-b border-slate-800/80 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="px-4 py-3 w-[25%]">關鍵字 (Keyword)</th>
                <th className="px-4 py-3 w-[15%]">月搜尋量 (Vol)</th>
                <th className="px-4 py-3 w-[15%]">競爭度</th>
                <th className="px-4 py-3 w-[35%]">文章大綱 (Outline)</th>
                <th className="px-4 py-3 w-[10%] text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850 text-xs">
              {keywords && keywords.length > 0 ? (
                keywords.map((kw, index) => (
                  <tr key={index} className="hover:bg-slate-900/20 text-slate-300">
                    <td className="px-4 py-3 font-semibold text-slate-200">{kw.keyword}</td>
                    <td className="px-4 py-3">{kw.volume}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        kw.competition === "高" 
                          ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" 
                          : kw.competition === "中"
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      }`}>
                        {kw.competition}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 italic max-w-xs truncate" title={kw.outline}>
                      {kw.outline || "無大綱"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(index)}
                        className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500 italic">
                    尚無關鍵字規劃，請對左側 Erick 下達任務...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 新增關鍵字 Form */}
      <form onSubmit={handleAdd} className="flex flex-col gap-2 bg-slate-900/30 p-3 rounded-xl border border-slate-800/60">
        <div className="flex gap-2">
          <input
            type="text"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            placeholder="新關鍵字"
            required
            className="flex-1 min-w-[80px] px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-xs focus:outline-none focus:border-amber-500/60 text-slate-200"
          />
          <input
            type="text"
            value={newVolume}
            onChange={(e) => setNewVolume(e.target.value)}
            placeholder="月搜尋量"
            className="w-20 px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-xs focus:outline-none focus:border-amber-500/60 text-slate-200"
          />
          <select
            value={newComp}
            onChange={(e) => setNewComp(e.target.value)}
            className="w-16 px-1 py-1.5 rounded bg-slate-950 border border-slate-800 text-xs focus:outline-none focus:border-amber-500/60 text-slate-200"
          >
            <option value="低">低</option>
            <option value="中">中</option>
            <option value="高">高</option>
          </select>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newOutline}
            onChange={(e) => setNewOutline(e.target.value)}
            placeholder="文章大綱 (Outline)"
            className="flex-1 px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-xs focus:outline-none focus:border-amber-500/60 text-slate-200"
          />
          <button
            type="submit"
            className="px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded font-bold cursor-pointer hover:shadow-md transition shrink-0 flex items-center justify-center"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </form>

      {/* AEO/SEO 智慧優化器 */}
      <div className="mt-4 pt-4 border-t border-slate-800/60 flex flex-col space-y-4">
        <div className="flex justify-between items-center bg-gradient-to-r from-amber-500/10 to-transparent p-3 rounded-xl border border-amber-500/20">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
            <div>
              <h4 className="text-xs font-bold text-slate-200">AEO/SEO 智慧優化器 (Iris 強化)</h4>
              <p className="text-[10px] text-slate-400">一鍵生成 FAQ 結構化資料與 Answer Engine 優化問答集，鎖定 AI 搜尋引用源</p>
            </div>
          </div>
          
          <button
            type="button"
            onClick={handleGenerateAeo}
            disabled={isGeneratingAeo || !keywords || keywords.length === 0}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              isGeneratingAeo 
                ? "bg-slate-800 text-slate-400 cursor-not-allowed" 
                : !keywords || keywords.length === 0
                ? "bg-slate-900/50 text-slate-500 border border-slate-850 cursor-not-allowed"
                : "bg-amber-500 hover:bg-amber-400 text-slate-950 hover:shadow-lg hover:shadow-amber-500/10"
            }`}
          >
            {isGeneratingAeo ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                正在生成中...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                一鍵生成 AEO/SEO 優化代碼
              </>
            )}
          </button>
        </div>

        {isGeneratingAeo && (
          <div className="flex flex-col items-center justify-center p-8 rounded-xl bg-slate-950/20 border border-slate-850/65 border-dashed">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin mb-2" />
            <p className="text-slate-400 text-xs font-semibold animate-pulse">正在利用 AI 大腦分析關鍵字，為您部署 AEO 引流策略...</p>
            <p className="text-[10px] text-slate-500 mt-1">預計需要 3 - 5 秒</p>
          </div>
        )}

        {!isGeneratingAeo && (aeoSchema || aeoFaq) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* JSON-LD Schema Card */}
            {aeoSchema && (
              <div className="bg-slate-950/40 border border-slate-850/65 rounded-xl p-4 flex flex-col space-y-3 relative group">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-slate-200">JSON-LD 結構化資料 (FAQPage Schema)</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopySchema}
                    className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 rounded transition flex items-center gap-1 cursor-pointer"
                  >
                    {schemaCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-[10px] text-emerald-400 font-bold">已複製</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold">一鍵複製</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="flex-1 min-h-[160px] max-h-[220px] overflow-y-auto rounded-lg bg-slate-950 border border-slate-900 p-3.5 font-mono text-[10px] text-emerald-400/90 whitespace-pre scrollbar-thin select-all">
                  {aeoSchema}
                </div>
                <p className="text-[9px] text-slate-500">提示：將此代碼複製並貼入您官網首頁的 <code>&lt;head&gt;</code> 標籤內，幫助搜尋引擎與 AI 引用。</p>
              </div>
            )}

            {/* AEO FAQ Card */}
            {aeoFaq && (
              <div className="bg-slate-950/40 border border-slate-850/65 rounded-xl p-4 flex flex-col space-y-3 relative group">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-sky-400" />
                    <span className="text-xs font-bold text-slate-200">AEO 常見問答集 (適合 AI 搜尋引用)</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyFaq}
                    className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 rounded transition flex items-center gap-1 cursor-pointer"
                  >
                    {faqCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-[10px] text-emerald-400 font-bold">已複製</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold">一鍵複製</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="flex-1 min-h-[160px] max-h-[220px] overflow-y-auto rounded-lg bg-slate-950 border border-slate-900 p-3.5 text-xs text-slate-300 leading-relaxed font-sans scrollbar-thin select-text">
                  <div className="whitespace-pre-wrap">{aeoFaq}</div>
                </div>
                <p className="text-[9px] text-slate-500">提示：將這些問答放置於您官網的 FAQ 區塊。結構化的問答設計更容易被 Answer Engines (AEO) 抓取。</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== 4. 廣告數據分頁 (Jack) ====================
function AdsTabContent({ brandId, adData }: { brandId: string; adData: AdDataItem[] }) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editVal, setEditVal] = useState("");
  const [editChange, setEditChange] = useState("");

  const handleEdit = (idx: number) => {
    setEditingIndex(idx);
    setEditVal(adData[idx].value);
    setEditChange(adData[idx].change);
  };

  const handleSave = async (idx: number) => {
    const updated = adData.map((item, i) => {
      if (i === idx) {
        return {
          ...item,
          value: editVal.trim(),
          change: editChange.trim(),
          isPositive: editChange.startsWith("+") ? true : editChange.startsWith("-") ? false : item.isPositive
        };
      }
      return item;
    });

    await saveWorkspace(brandId, { ad_data: updated });
    setEditingIndex(null);
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex justify-between items-center bg-slate-900/40 p-3 rounded-xl border border-slate-800/60">
        <div>
          <h4 className="text-sm font-bold text-slate-200">廣告數據專家：Jack</h4>
          <p className="text-[10px] text-slate-400">廣告投放效能預估與關鍵成效指標</p>
        </div>
      </div>

      {/* 指標卡片 Metrics Grid */}
      <div className="flex-1 overflow-y-auto">
        {adData && adData.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {adData.map((item, index) => {
              const isPositive = item.isPositive !== false; // 預設正向
              const isEditing = editingIndex === index;

              return (
                <div 
                  key={index}
                  className="bg-slate-950/40 border border-slate-850 hover:border-slate-800 p-5 rounded-2xl transition-all duration-300 relative group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{item.label}</span>
                      
                      {!isEditing && (
                        <button 
                          onClick={() => handleEdit(index)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-amber-400 hover:bg-slate-800 rounded transition cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="mt-2 space-y-2">
                        <input
                          type="text"
                          value={editVal}
                          onChange={(e) => setEditVal(e.target.value)}
                          className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200"
                          placeholder="數值 (例如: 5.82%)"
                        />
                        <input
                          type="text"
                          value={editChange}
                          onChange={(e) => setEditChange(e.target.value)}
                          className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200"
                          placeholder="變更 (例如: +1.2%)"
                        />
                        <button
                          onClick={() => handleSave(index)}
                          className="w-full py-1 bg-amber-500 hover:bg-amber-450 text-slate-950 rounded text-[10px] font-bold transition cursor-pointer"
                        >
                          儲存
                        </button>
                      </div>
                    ) : (
                      <h3 className="text-xl font-extrabold text-slate-100 mt-2 tracking-tight">
                        {item.value}
                      </h3>
                    )}
                  </div>

                  {!isEditing && (
                    <div className="flex items-center gap-1 mt-3">
                      {isPositive ? (
                        <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
                      )}
                      <span className={`text-[10px] font-bold ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                        {item.change}
                      </span>
                      <span className="text-[9px] text-slate-500 ml-1">較前次發布</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 rounded-xl bg-slate-950/20 border border-slate-850/65 border-dashed">
            <BarChart3 className="w-8 h-8 text-slate-600 mb-2 animate-pulse" />
            <p className="text-slate-500 italic text-xs">
              尚無廣告指標，請對左側 Erick 下達任務...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
