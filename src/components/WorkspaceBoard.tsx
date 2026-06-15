"use client";

import React, { useState, useEffect } from "react";
import { 
  FileText, Network, Search, BarChart3, 
  Plus, Trash2, Eye, Edit2, Check,
  Send, Calendar, ArrowUpRight, ArrowDownRight, Folder, FileCode,
  Copy, Loader2, Sparkles, Brain, Shield
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  WorkspaceData, subscribeToWorkspace, saveWorkspace, 
  SEOKeyword, AdDataItem 
} from "@/lib/firebase";
import { BRANDS } from "./BrandSelector";
import { I8_BRAND_CONTEXT } from "../data/brands/i8";
import { NAS_BRAND_CONTEXT } from "../data/brands/nas";
import { ABL_BRAND_CONTEXT } from "../data/brands/abl";
import { ERICK_BRAND_CONTEXT } from "../data/brands/erick";

export interface BrandTheme {
  primary: string;
  primaryColor: string;
  primaryBg: string;
  primaryBgHover: string;
  primaryBorder: string;
  primaryRing: string;
  focusBorder: string;
  gradientFromTo: string;
  gradientFromTransparent: string;
  glowShadow: string;
  bulletBg: string;
  hoverText: string;
  copyIconColor: string;
  loaderColor: string;
  primaryBtnText: string;
  btnBorder: string;
  bgOpacity20: string;
  borderOpacity20: string;
}

export function getBrandTheme(brandId: string): BrandTheme {
  const isI8 = brandId.includes("i8") || brandId.includes("brand_a");
  const isAbl = brandId.includes("abl") || brandId.includes("brand_c");
  const isNas = brandId.includes("nas") || brandId.includes("brand_b");

  if (isI8) {
    return {
      primary: "indigo",
      primaryColor: "text-indigo-400",
      primaryBg: "bg-indigo-600",
      primaryBgHover: "hover:bg-indigo-500",
      primaryBorder: "border-indigo-500/20",
      primaryRing: "focus:ring-indigo-500/20",
      focusBorder: "focus:border-indigo-500/60",
      gradientFromTo: "from-indigo-600 to-indigo-800",
      gradientFromTransparent: "from-indigo-500/10 to-transparent",
      glowShadow: "shadow-indigo-500/10",
      bulletBg: "bg-indigo-500",
      hoverText: "hover:text-indigo-400",
      copyIconColor: "text-indigo-500",
      loaderColor: "text-indigo-500",
      primaryBtnText: "text-slate-100",
      btnBorder: "border-indigo-400/25",
      bgOpacity20: "bg-indigo-500/20",
      borderOpacity20: "border-indigo-500/20"
    };
  } else if (isAbl) {
    return {
      primary: "cyan",
      primaryColor: "text-cyan-400",
      primaryBg: "bg-cyan-500",
      primaryBgHover: "hover:bg-cyan-400",
      primaryBorder: "border-cyan-500/20",
      primaryRing: "focus:ring-cyan-500/20",
      focusBorder: "focus:border-cyan-500/60",
      gradientFromTo: "from-cyan-500 to-teal-500",
      gradientFromTransparent: "from-cyan-500/10 to-transparent",
      glowShadow: "shadow-cyan-500/10",
      bulletBg: "bg-cyan-500",
      hoverText: "hover:text-cyan-400",
      copyIconColor: "text-cyan-500",
      loaderColor: "text-cyan-500",
      primaryBtnText: "text-slate-950",
      btnBorder: "border-cyan-400/25",
      bgOpacity20: "bg-cyan-500/20",
      borderOpacity20: "border-cyan-500/20"
    };
  } else if (isNas) {
    return {
      primary: "purple",
      primaryColor: "text-purple-400",
      primaryBg: "bg-purple-600",
      primaryBgHover: "hover:bg-purple-500",
      primaryBorder: "border-purple-500/20",
      primaryRing: "focus:ring-purple-500/20",
      focusBorder: "focus:border-purple-500/60",
      gradientFromTo: "from-purple-600 to-indigo-600",
      gradientFromTransparent: "from-purple-500/10 to-transparent",
      glowShadow: "shadow-purple-500/10",
      bulletBg: "bg-purple-500",
      hoverText: "hover:text-purple-400",
      copyIconColor: "text-purple-500",
      loaderColor: "text-purple-500",
      primaryBtnText: "text-slate-100",
      btnBorder: "border-purple-400/25",
      bgOpacity20: "bg-purple-500/20",
      borderOpacity20: "border-purple-500/20"
    };
  } else {
    return {
      primary: "amber",
      primaryColor: "text-amber-400",
      primaryBg: "bg-amber-500",
      primaryBgHover: "hover:bg-amber-400",
      primaryBorder: "border-amber-500/20",
      primaryRing: "focus:ring-amber-500/20",
      focusBorder: "focus:border-amber-500/60",
      gradientFromTo: "from-amber-500 to-orange-500",
      gradientFromTransparent: "from-amber-500/10 to-transparent",
      glowShadow: "shadow-amber-500/10",
      bulletBg: "bg-amber-500",
      hoverText: "hover:text-amber-400",
      copyIconColor: "text-amber-500",
      loaderColor: "text-amber-500",
      primaryBtnText: "text-slate-950",
      btnBorder: "border-amber-400/25",
      bgOpacity20: "bg-amber-500/20",
      borderOpacity20: "border-amber-500/20"
    };
  }
}

interface WorkspaceBoardProps {
  activeBrandId: string;
  aiProvider: string;
}

type TabType = "social" | "architecture" | "seo" | "ads" | "guidelines";

export default function WorkspaceBoard({ activeBrandId, aiProvider }: WorkspaceBoardProps) {
  const [activeTab, setActiveTab] = useState<TabType>("social");
  const [data, setData] = useState<WorkspaceData>({
    social_copy: "",
    web_architecture: "",
    seo_keywords: [],
    ad_data: [],
    brand_guidelines: ""
  });

  // 訂閱當前品牌的看板資料
  useEffect(() => {
    setData({
      social_copy: "",
      web_architecture: "",
      seo_keywords: [],
      ad_data: [],
      brand_guidelines: ""
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
    { id: "guidelines", label: "品牌大腦", expert: "Erick", icon: Brain, color: "from-amber-500 to-orange-500", glow: "shadow-amber-500/10" }
  ];

  return (
    <div className="flex flex-col h-full bg-slate-950/20 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-md">
      {/* Tabs Selector Header */}
      <div className="flex bg-slate-900/40 border-b border-slate-800/60 p-2 gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.id;
          const theme = getBrandTheme(activeBrandId);
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
              <TabIcon className={`w-4 h-4 ${isActive ? `${theme.primaryColor} animate-pulse` : ""}`} />
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
            {activeTab === "guidelines" && (
              <GuidelinesTabContent 
                brandId={activeBrandId} 
                brandGuidelines={data.brand_guidelines || ""} 
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
  const theme = getBrandTheme(brandId);
  const [mode, setMode] = useState<"edit" | "preview">("preview");
  const [val, setVal] = useState(socialCopy);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPublishingWebsite, setIsPublishingWebsite] = useState(false);
  const [pubStatus, setPubStatus] = useState<"idle" | "success" | "error">("idle");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [scheduleTime, setScheduleTime] = useState("");

  // 歷史文章狀態
  const [historyArticles, setHistoryArticles] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const response = await fetch(`/api/articles?brandId=${brandId}`);
      if (response.ok) {
        const resData = await response.json();
        if (resData.success && Array.isArray(resData.data)) {
          setHistoryArticles(resData.data);
        }
      }
    } catch (err) {
      console.error("Failed to fetch historical articles:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [brandId]);

  const handleCopyCleanText = async () => {
    try {
      // 1. 移除所有的 Mermaid 代碼區塊 (包括 ```mermaid ... ```)
      let cleanText = val.replace(/```mermaid[\s\S]*?```/g, "");
      
      // 2. 移除所有的 Markdown 圖片標籤 ![alt](url)
      cleanText = cleanText.replace(/!\[.*?\]\(.*?\)/g, "");
      
      // 3. 移除多餘的空行 (連續兩個以上的換行縮減為一個，且去除前後空白)
      cleanText = cleanText.replace(/\n{3,}/g, "\n\n").trim();
      
      // 4. 複製到剪貼簿
      await navigator.clipboard.writeText(cleanText);
      alert("📋 已複製乾淨的貼文內容至剪貼簿（已自動排除圖表程式碼與圖片網址）");
    } catch (err) {
      console.error("Failed to copy text:", err);
      alert("❌ 複製失敗，請手動複製");
    }
  };

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
      fetchHistory(); // 成功上架後重新整理歷史文章庫
    } catch (error: any) {
      console.error("Publish website error:", error);
      alert(`❌ 同步至官網失敗：${error.message}`);
    } finally {
      setIsPublishingWebsite(false);
    }
  };

  const handleLoadArticle = (articleContent: string) => {
    if (confirm("載入此歷史文章將會覆蓋您目前的編輯區塊內容，確定要載入嗎？")) {
      setVal(articleContent);
      saveWorkspace(brandId, { social_copy: articleContent });
    }
  };

  const handleSyndicateArticle = async (articleContent: string) => {
    if (isPublishing) return;
    if (!confirm("確定要將此篇歷史文章直接發布至社群（N8N 分流與第一則留言連結）嗎？")) {
      return;
    }
    setIsPublishing(true);
    setPubStatus("idle");
    try {
      const response = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId,
          content: articleContent,
          action: "now",
          scheduleTime: null
        })
      });

      if (!response.ok) {
        throw new Error("發布失敗");
      }

      setPubStatus("success");
      alert("🎉 歷史文章社群補發成功！");
    } catch (error) {
      console.error("Publish error:", error);
      setPubStatus("error");
      alert("❌ 發布失敗，請確認 n8n Webhook 設定");
    } finally {
      setIsPublishing(false);
      setTimeout(() => setPubStatus("idle"), 4000);
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

  // 升級版 Markdown 解析器，支援流程圖動態渲染與過濾
  const renderMarkdown = (text: string) => {
    if (!text) return <p className="text-slate-500 italic">尚無社群文案，請對左側 Erick 下達任務...</p>;

    const formatMermaidCode = (rawCode: string) => {
      let code = rawCode.trim();
      // 1. 移除任何既有的 %%{init: ... }%% 區塊，以防格式衝突
      code = code.replace(/%%\{init:[\s\S]*?\}%%\s*/g, "");
      
      // 2. 將標準 A[text] 節點升級為膠囊形狀 A([text])，但排除 subgraph、style 等宣告行，避免破壞特殊節點語法與結構
      const linesList = code.split("\n");
      const processedLines = linesList.map((line) => {
        const trimmed = line.trim();
        const lower = trimmed.toLowerCase();
        
        if (
          lower.startsWith("subgraph") ||
          lower.startsWith("style") ||
          lower.startsWith("classdef") ||
          lower.startsWith("class ") ||
          lower.startsWith("click") ||
          lower.startsWith("linkstyle")
        ) {
          return line;
        }
        
        return line.replace(/([a-zA-Z0-9_-]+)\s*\[(.*?)\]/g, (match, nodeId, label) => {
          const lowerNodeId = nodeId.toLowerCase();
          if (["subgraph", "style", "classdef", "click", "linkstyle", "direction"].includes(lowerNodeId)) {
            return match;
          }
          if (label.startsWith("(") || label.startsWith("[") || label.endsWith(")") || label.endsWith("]")) {
            return match;
          }
          return `${nodeId}([${label}])`;
        });
      });
      code = processedLines.join("\n");
      
      // 3. 注入麥肯錫/BCG 高階企管顧問風格之專業配色主題 (海軍藍、蒂芙尼綠、極簡白)
      const themeConfig = `%%{init: {
  'theme': 'base',
  'themeVariables': {
    'fontFamily': 'Arial, sans-serif',
    'primaryColor': '#002A54',
    'primaryTextColor': '#FFFFFF',
    'primaryBorderColor': '#00C2C2',
    'lineColor': '#00509D',
    'secondaryColor': '#00C2C2',
    'secondaryTextColor': '#FFFFFF',
    'tertiaryColor': '#F4F9FA',
    'tertiaryTextColor': '#1A202C'
  }
}}%%`;

      return themeConfig + "\n" + code;
    };
    
    const lines = text.split("\n");
    const elements: React.JSX.Element[] = [];
    let inCodeBlock = false;
    let codeContent: string[] = [];
    let codeLanguage = "";
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      if (trimmed.startsWith("```")) {
        if (inCodeBlock) {
          inCodeBlock = false;
          const codeText = codeContent.join("\n");
          if (codeLanguage === "mermaid") {
            const formattedCode = formatMermaidCode(codeText);
            let base64 = typeof window !== 'undefined' ? window.btoa(unescape(encodeURIComponent(formattedCode))) : Buffer.from(formattedCode).toString("base64");
            base64 = base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
            const imageUrl = `https://mermaid.ink/img/${base64}`;
            
            elements.push(
              <div key={`mermaid-${i}`} className="my-5 flex flex-col items-center select-none bg-slate-900/30 p-4 rounded-xl border border-slate-850 w-full max-w-lg mx-auto">
                <img 
                  src={imageUrl} 
                  alt="概念模型架構圖" 
                  className="rounded-lg border border-slate-800 max-h-[350px] shadow-lg shadow-black/30 hover:scale-[1.01] transition-transform duration-300"
                />
                <span className="text-[10px] text-slate-500 mt-2.5 italic">動態架構流程圖 (自動即時渲染)</span>
                
                <div className="flex gap-3 mt-3 w-full justify-center">
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch(imageUrl);
                        const blob = await res.blob();
                        const blobUrl = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = blobUrl;
                        a.download = `mermaid-${brandId}.png`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(blobUrl);
                      } catch (e) {
                        window.open(imageUrl, "_blank");
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
                  >
                    📥 下載圖表圖片 (FB發文用)
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(imageUrl);
                        alert("📋 已複製圖片網址！");
                      } catch (e) {
                        alert("❌ 複製失敗");
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
                  >
                    🔗 複製圖片網址
                  </button>
                </div>
              </div>
            );
          } else {
            elements.push(
              <pre key={`code-${i}`} className="p-4 bg-slate-950 rounded-xl border border-slate-850 text-xs font-mono text-slate-350 overflow-x-auto my-3">
                {codeText}
              </pre>
            );
          }
          codeContent = [];
          codeLanguage = "";
        } else {
          inCodeBlock = true;
          codeLanguage = trimmed.slice(3).trim().toLowerCase();
        }
        continue;
      }
      
      if (inCodeBlock) {
        codeContent.push(line);
        continue;
      }
      
      if (trimmed === "") {
        elements.push(<div key={`space-${i}`} className="h-3" />);
        continue;
      }
      
      // 圖片 Markdown
      if (/^!\[(.*?)\]\((.*?)\)$/.test(trimmed)) {
        const match = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
        const alt = match?.[1] || "";
        const url = match?.[2] || "";
        
        // 隱藏未配置的 pCloud 佔位破圖
        if (url.includes("your-id")) {
          continue;
        }
        
        elements.push(
          <div key={`img-${i}`} className="my-5 flex flex-col items-center">
            <img src={url} alt={alt} className="rounded-xl border border-slate-800 shadow-md max-w-full" />
            {alt && <span className="text-xs text-slate-400 mt-2.5 italic">{alt}</span>}
          </div>
        );
        continue;
      }
      
      if (line.startsWith("# ")) {
        elements.push(<h1 key={i} className="text-lg font-bold text-slate-100 mt-4 mb-2">{line.replace("# ", "")}</h1>);
      } else if (line.startsWith("## ")) {
        elements.push(<h2 key={i} className="text-base font-bold text-slate-200 mt-3.5 mb-2">{line.replace("## ", "")}</h2>);
      } else if (line.startsWith("### ")) {
        elements.push(<h3 key={i} className="text-sm font-bold text-slate-300 mt-3 mb-1.5">{line.replace("### ", "")}</h3>);
      } else if (line.startsWith("* ") || line.startsWith("- ")) {
        const content = line.substring(2);
        const parts = content.split("**");
        elements.push(
          <li key={i} className="ml-5 list-disc text-slate-350 text-xs leading-relaxed my-1">
            {parts.map((part, pIdx) => pIdx % 2 === 1 ? <strong key={pIdx} className={`font-semibold ${theme.primaryColor}`}>{part}</strong> : part)}
          </li>
        );
      } else {
        const parts = line.split("**");
        elements.push(
          <p key={i} className="text-slate-350 text-xs leading-relaxed my-1.5">
            {parts.map((part, pIdx) => pIdx % 2 === 1 ? <strong key={pIdx} className={`font-semibold ${theme.primaryColor}`}>{part}</strong> : part)}
          </p>
        );
      }
    }
    
    return elements;
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
                    className={`px-2 py-0.5 ${theme.primaryBg} ${theme.primaryBgHover} ${theme.primaryBtnText} disabled:bg-slate-800 disabled:text-slate-500 text-[9px] font-bold rounded cursor-pointer transition`}
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
                        : `bg-gradient-to-r ${theme.gradientFromTo} ${theme.primaryBtnText} ${theme.btnBorder} hover:shadow-lg hover:${theme.glowShadow} cursor-pointer`
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
            {val && (
              <button
                type="button"
                onClick={handleCopyCleanText}
                className="px-2.5 py-1.5 rounded-md text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
                title="複製純文案（已自動過濾圖表程式碼與圖片網址）"
              >
                <Copy className={`w-3.5 h-3.5 ${theme.copyIconColor}`} /> 複製貼文
              </button>
            )}
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
            className={`flex-1 w-full p-4 rounded-xl bg-slate-950/60 border border-slate-850 ${theme.focusBorder} text-slate-200 text-sm focus:outline-none focus:ring-1 ${theme.primaryRing} font-mono resize-none`}
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

      {/* 📚 歷史上架文章庫 (Supabase Archive) */}
      <div className="bg-slate-900/10 border border-slate-800/80 rounded-xl overflow-hidden backdrop-blur-md transition-all duration-300">
        <button
          type="button"
          onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
          className="w-full flex items-center justify-between px-4 py-3 bg-slate-900/30 hover:bg-slate-900/50 transition-colors text-left cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Folder className={`w-4 h-4 ${theme.copyIconColor}`} />
            <span className="text-xs font-bold text-slate-200">📚 歷史上架文章庫 (Supabase Archive)</span>
            <span className="text-[10px] text-slate-500 font-semibold bg-slate-900 px-1.5 py-0.5 rounded">
              {historyArticles.length} 篇
            </span>
          </div>
          <span className="text-xs text-slate-500 font-bold">
            {isHistoryExpanded ? "收起 ▲" : "展開 ▼"}
          </span>
        </button>

        {isHistoryExpanded && (
          <div className="p-4 border-t border-slate-800/60 max-h-[280px] overflow-y-auto space-y-2.5 scrollbar-thin scrollbar-thumb-slate-800">
            {isLoadingHistory ? (
              <div className="flex items-center justify-center py-6 gap-2 text-xs text-slate-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>讀取 Supabase 文章庫中...</span>
              </div>
            ) : historyArticles.length === 0 ? (
              <p className="text-slate-500 italic text-xs text-center py-4">此品牌目前尚無已上架至 Supabase 的文章紀錄。</p>
            ) : (
              <div className="space-y-2">
                {historyArticles.map((article: any) => (
                  <div 
                    key={article.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-950/30 border border-slate-850 rounded-xl hover:border-slate-800 transition-all duration-300 gap-3"
                  >
                    <div className="space-y-1">
                      <h5 className="text-xs font-bold text-slate-200 line-clamp-1">{article.title}</h5>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 font-semibold">
                        <span className="bg-blue-600/10 text-blue-400 px-1 py-0.5 rounded border border-blue-500/10">已上架網站</span>
                        <span>{new Date(article.created_at).toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleLoadArticle(article.content)}
                        className="px-2.5 py-1 bg-slate-900 hover:bg-slate-850 text-slate-350 text-[10px] font-bold rounded-lg border border-slate-800 transition cursor-pointer flex items-center gap-1"
                        title="載入文章內容至上方編輯區"
                      >
                        <Folder className="w-3 h-3 text-slate-400" />
                        <span>載入</span>
                      </button>
                      <button
                        onClick={() => handleSyndicateArticle(article.content)}
                        disabled={isPublishing}
                        className={`px-2.5 py-1 bg-gradient-to-r ${theme.gradientFromTo} ${theme.primaryBtnText} text-[10px] font-bold rounded-lg hover:shadow-md hover:${theme.glowShadow} transition cursor-pointer flex items-center gap-1`}
                        title="透過 N8N 自動化補發至社群與留言連結"
                      >
                        <Send className="w-3 h-3 text-slate-950" />
                        <span>補發社群</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== 2. 網頁架構分頁 (Leon) ====================
function ArchitectureTabContent({ brandId, architecture }: { brandId: string; architecture: string }) {
  const theme = getBrandTheme(brandId);
  const [val, setVal] = useState(architecture);
  const [isEditing, setIsEditing] = useState(false);
  const [viewMode, setViewMode] = useState<"preview" | "code">("preview");

  useEffect(() => {
    setVal(architecture);
  }, [architecture]);

  const handleSave = () => {
    saveWorkspace(brandId, { web_architecture: val });
    setIsEditing(false);
  };

  const isHtml = val.trim().startsWith("<") || val.includes("</div>") || val.includes("class=");

  // 解析縮排層級並渲染成視覺化網站樹狀結構 (Tree View)
  const renderTreeView = (treeText: string) => {
    if (!treeText) return <p className="text-slate-550 italic">尚無網頁架構設計，請對左側 Erick 下達任務...</p>;

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
                <Folder className={`w-4 h-4 ${theme.copyIconColor} shrink-0`} />
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

  // 生成 Iframe 渲染的 srcDoc
  const getIframeSrcDoc = () => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            body {
              font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
              margin: 0;
              padding: 0;
            }
          </style>
        </head>
        <body class="bg-slate-900 text-slate-100 min-h-screen">
          ${val}
        </body>
      </html>
    `;
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex justify-between items-center bg-slate-900/40 p-3 rounded-xl border border-slate-800/60">
        <div>
          <h4 className="text-sm font-bold text-slate-200">系統架構師：Leon</h4>
          <p className="text-[10px] text-slate-400">網頁與功能路由層次結構規劃</p>
        </div>

        <div className="flex items-center gap-3">
          {isHtml && !isEditing && (
            <div className="flex p-0.5 bg-slate-950/60 border border-slate-850 rounded-lg">
              <button
                onClick={() => setViewMode("preview")}
                className={`px-2.5 py-1 rounded-md text-[9px] font-bold transition cursor-pointer ${
                  viewMode === "preview" 
                    ? `${theme.bgOpacity20} ${theme.primaryColor} border ${theme.borderOpacity20}` 
                    : "text-slate-400 hover:text-slate-300"
                }`}
              >
                預覽頁面
              </button>
              <button
                onClick={() => setViewMode("code")}
                className={`px-2.5 py-1 rounded-md text-[9px] font-bold transition cursor-pointer ${
                  viewMode === "code" 
                    ? `${theme.bgOpacity20} ${theme.primaryColor} border ${theme.borderOpacity20}` 
                    : "text-slate-400 hover:text-slate-300"
                }`}
              >
                HTML 原始碼
              </button>
            </div>
          )}

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
      </div>

      {isEditing ? (
        <div className="flex-1 flex flex-col space-y-3">
          <textarea
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder={`使用 HTML 或層級大綱，例如：\n- 首頁\n  - 關於我們\n  - 服務項目\n    - 智慧系統`}
            className={`flex-1 w-full p-4 rounded-xl bg-slate-950/60 border border-slate-850 ${theme.focusBorder} text-slate-200 text-sm focus:outline-none focus:ring-1 ${theme.primaryRing} font-mono resize-none`}
          />
        </div>
      ) : (
        <div className="flex-1 min-h-[500px] flex flex-col">
          {isHtml ? (
            viewMode === "preview" ? (
              <div className="flex-1 bg-slate-950/40 border border-slate-850/65 rounded-xl overflow-hidden p-1">
                <iframe
                  srcDoc={getIframeSrcDoc()}
                  title="Landing Page Preview"
                  className="w-full h-full border-0 rounded-lg"
                  sandbox="allow-scripts"
                />
              </div>
            ) : (
              <div className="flex-1 p-5 rounded-xl bg-slate-950/40 border border-slate-850/65 overflow-y-auto font-mono text-xs text-slate-300 whitespace-pre-wrap">
                {val}
              </div>
            )
          ) : (
            <div className="flex-1 p-5 rounded-xl bg-slate-950/40 border border-slate-850/65 overflow-y-auto font-mono">
              {renderTreeView(val)}
            </div>
          )}
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
  const theme = getBrandTheme(brandId);
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
            className={`flex-1 min-w-[80px] px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-xs focus:outline-none ${theme.focusBorder} text-slate-200`}
          />
          <input
            type="text"
            value={newVolume}
            onChange={(e) => setNewVolume(e.target.value)}
            placeholder="月搜尋量"
            className={`w-20 px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-xs focus:outline-none ${theme.focusBorder} text-slate-200`}
          />
          <select
            value={newComp}
            onChange={(e) => setNewComp(e.target.value)}
            className={`w-16 px-1 py-1.5 rounded bg-slate-950 border border-slate-800 text-xs focus:outline-none ${theme.focusBorder} text-slate-200`}
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
            className={`flex-1 px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-xs focus:outline-none ${theme.focusBorder} text-slate-200`}
          />
          <button
            type="submit"
            className={`px-3 ${theme.primaryBg} ${theme.primaryBgHover} ${theme.primaryBtnText} rounded font-bold cursor-pointer hover:shadow-md transition shrink-0 flex items-center justify-center`}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </form>

      {/* AEO/SEO 智慧優化器 */}
      <div className="mt-4 pt-4 border-t border-slate-800/60 flex flex-col space-y-4">
        <div className={`flex justify-between items-center bg-gradient-to-r ${theme.gradientFromTransparent} p-3 rounded-xl border ${theme.borderOpacity20}`}>
          <div className="flex items-center gap-2">
            <Sparkles className={`w-4 h-4 ${theme.primaryColor} animate-pulse`} />
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
                : `${theme.primaryBg} ${theme.primaryBgHover} ${theme.primaryBtnText} hover:shadow-lg hover:${theme.glowShadow}`
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
            <Loader2 className={`w-8 h-8 ${theme.loaderColor} animate-spin mb-2`} />
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
  const theme = getBrandTheme(brandId);
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
                          className={`opacity-0 group-hover:opacity-100 p-1 text-slate-500 ${theme.hoverText} hover:bg-slate-800 rounded transition cursor-pointer`}
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
                          className={`w-full py-1 ${theme.primaryBg} ${theme.primaryBgHover} ${theme.primaryBtnText} rounded text-[10px] font-bold transition cursor-pointer`}
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

// ==================== 5. 品牌大腦分頁 (Erick) ====================
function GuidelinesTabContent({
  brandId,
  brandGuidelines
}: {
  brandId: string;
  brandGuidelines: string;
}) {
  const theme = getBrandTheme(brandId);
  const [isEditing, setIsEditing] = useState(false);
  const [val, setVal] = useState(brandGuidelines);

  useEffect(() => {
    setVal(brandGuidelines);
  }, [brandGuidelines]);

  const handleSave = async () => {
    await saveWorkspace(brandId, { brand_guidelines: val });
    setIsEditing(false);
  };

  const handleReset = async () => {
    if (!confirm("確定要將此品牌的說明大腦重設為系統預設值嗎？此操作將覆蓋您目前自訂的內容。")) {
      return;
    }

    let defaultText = "";
    if (brandId === "brand_a_i8") {
      defaultText = I8_BRAND_CONTEXT;
    } else if (brandId === "brand_b_nas") {
      defaultText = NAS_BRAND_CONTEXT;
    } else if (brandId === "brand_c_abl") {
      defaultText = ABL_BRAND_CONTEXT;
    } else {
      defaultText = ERICK_BRAND_CONTEXT;
    }

    setVal(defaultText);
    await saveWorkspace(brandId, { brand_guidelines: defaultText });
    setIsEditing(false);
    alert("📋 已成功重設品牌大腦為預設規範！");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(val);
      alert("📋 品牌規範已複製到剪貼簿");
    } catch (err) {
      console.error("Failed to copy text:", err);
    }
  };

  // 格式化預覽品牌大腦內容，使其看起來精緻高質感
  const renderFormattedPreview = (text: string) => {
    if (!text) {
      return <p className="text-slate-500 italic">品牌大腦說明為空，請點選編輯以新增內容。</p>;
    }

    const lines = text.split("\n");
    return (
      <div className="space-y-3 font-sans text-sm text-slate-300 leading-relaxed">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (trimmed.startsWith("【") && trimmed.endsWith("】")) {
            return (
              <h4 key={idx} className={`text-base font-extrabold ${theme.primaryColor} mt-4 mb-2 flex items-center gap-2 border-b border-slate-800/85 pb-2`}>
                <Shield className={`w-4 h-4 ${theme.primaryColor} animate-pulse`} />
                {trimmed}
              </h4>
            );
          }
          if (trimmed.startsWith("- ")) {
            return (
              <div key={idx} className="pl-4 flex items-start gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${theme.bulletBg} mt-2 shrink-0`} />
                <span>{trimmed.substring(2)}</span>
              </div>
            );
          }
          return <p key={idx} className="pl-4">{line}</p>;
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* 品牌大腦頂部標題卡 */}
      <div className="flex justify-between items-center bg-slate-900/40 p-4 rounded-xl border border-slate-800/60">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-slate-200">品牌大腦知識庫定位規範</h4>
            <span className="px-2 py-0.5 text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-emerald-400 animate-ping" />
              🟢 AI 生成已綁定作用中
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">營運長 Erick 控制的核心品牌說明，此規則將在生成文案與數據時強制約束 AI</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopy}
            className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-850 text-slate-300 text-xs font-semibold rounded-lg border border-slate-800 transition cursor-pointer flex items-center gap-1.5"
            title="複製規範"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>複製</span>
          </button>
          {!isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className={`px-3 py-1.5 ${theme.primaryBg} ${theme.primaryBgHover} ${theme.primaryBtnText} text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 shadow-md hover:shadow-${theme.primary}-500/5`}
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>編輯大腦</span>
              </button>
              <button
                onClick={handleReset}
                className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 text-xs font-semibold rounded-lg border border-rose-500/20 transition cursor-pointer"
                title="還原為預設品牌說明"
              >
                重設預設
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleSave}
                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-450 text-slate-950 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 shadow-md shadow-emerald-500/5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>儲存大腦</span>
              </button>
              <button
                onClick={() => {
                  setVal(brandGuidelines);
                  setIsEditing(false);
                }}
                className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-lg border border-slate-800 transition cursor-pointer"
              >
                取消
              </button>
            </>
          )}
        </div>
      </div>

      {/* 編輯器或展示區域 */}
      <div className="flex-1 overflow-hidden flex flex-col bg-slate-950/40 border border-slate-850 p-5 rounded-2xl">
        {isEditing ? (
          <textarea
            value={val}
            onChange={(e) => setVal(e.target.value)}
            className={`w-full flex-1 bg-slate-950 border border-slate-850 ${theme.focusBorder} focus:ring-1 ${theme.primaryRing} text-slate-200 text-sm font-mono p-4 rounded-xl focus:outline-none resize-none scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent leading-relaxed`}
            placeholder="請輸入品牌的核心定位、核心產品、目標受眾、語調與寫作限制..."
          />
        ) : (
          <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
            {renderFormattedPreview(val)}
          </div>
        )}
      </div>
    </div>
  );
}
