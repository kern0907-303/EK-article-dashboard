"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef, memo } from "react";
import { createPortal } from "react-dom";
import { CARD_SIZES } from "@/lib/card-layout.mjs";
import { comfyWaitText, runComfyJob } from "@/lib/image-jobs-client";
import { 
  FileText, Network, Search, BarChart3, 
  Plus, Trash2, Eye, Edit2, Check,
  Send, Calendar, ArrowUpRight, ArrowDownRight, Folder, FileCode,
  Copy, Loader2, Sparkles, Brain, Shield, AlertTriangle, Zap, TrendingUp,
  Facebook, Instagram, AtSign, Heart, MessageCircle, Repeat, Bookmark, ThumbsUp, Share2, MoreHorizontal,
  ChevronDown, Activity, Maximize2, RefreshCw
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  WorkspaceData, subscribeToWorkspace, saveWorkspace, getMergedBrandGuidelines, 
  SEOKeyword, AdDataItem, TheoAnalysis, ReachKillerItem
} from "@/lib/storage";
import { BRANDS } from "./BrandSelector";
import SchedulePicker from "@/components/SchedulePicker";
import Button, { BrandButtonProvider } from "@/components/ui/Button";
import SocialQueuePanel from "@/components/SocialQueuePanel";
import { stripMarkdown } from "@/lib/plain-text";
import { pickAlign, clippingBounds, type PopoverAlign } from "@/lib/popover-align";
import { textHash, resolveWebContent, hasWebArticle, hasSocialCopy, isArticleStale, countChars, type WebArticleMeta } from "@/lib/web-article";
import { checkGenreText, blockingIssues } from "@/lib/genre-check";
import QuickDerivatives from "@/components/QuickDerivatives";
import { findTextMismatch, describeMismatch, GUARD_BRAND_LABEL } from "@/lib/brand-guard";
import { GENRES, FUNNEL_LABEL, brandKeyFromId, type GenreMeta } from "@/data/skills/genres";
import { SeoOptimization, SeoScore, faqToPlainText, buildFaqJsonLd, isScoreStale, healthHash } from "@/lib/seo-optimizer";
import { useAutoHealthCheck, useAutoHealthSetting } from "@/lib/use-auto-health";
import { getProjectName, resolveEffectiveBrandId, subscribeToProjects } from "@/lib/projects-store";
import { 
  FACEBOOK_PAGES, getDefaultFacebookPage, getFacebookPageById, getFacebookPagesByIds 
} from "@/lib/facebook-pages";
import { I8_BRAND_CONTEXT } from "../data/brands/i8";
import { NAS_BRAND_CONTEXT } from "../data/brands/nas";
import { ABL_BRAND_CONTEXT } from "../data/brands/abl";
import { ERICK_BRAND_CONTEXT } from "../data/brands/erick";
import PublishQueuePanel from "./PublishQueuePanel";
import PerformanceTab from "./PerformanceTab";
import type { QueueItem } from "@/lib/publish-queue";
import { hasUsableSocialCopy, isSocialCopyPlaceholder } from "@/lib/expert-routing";

// 沒有 API 憑證、無法排程的粉專（與 src/lib/publish-queue.ts 的 UNSCHEDULABLE_PAGE_IDS 保持一致；
// 那個檔案含伺服器端金鑰讀取，不能在 client 元件裡當值 import，所以這裡另存一份常數）
const UNSCHEDULABLE_PAGE_IDS_CLIENT = ["fb_erick"];

interface GuardrailBlock {
  violatedWords?: string[];
  context?: string;
  suggestion?: string | null;
}

/**
 * 紅線攔截時的確認對話。列出違規詞與建議改寫，
 * 回傳 true 表示使用者確認要照原文發布。
 */
const confirmGuardrail = (data: GuardrailBlock): boolean => {
  const words = (data.violatedWords || []).join("、");
  const lines = [
    `⚠️ 品牌紅線檢查未通過（${data.context || "first_tier"}）`,
    "",
    `偵測到禁用詞：${words}`,
    "",
  ];
  if (data.suggestion) {
    lines.push("建議改寫版本：", data.suggestion, "");
  }
  lines.push("按「確定」仍要照原文發布，按「取消」回去修改。");
  return window.confirm(lines.join("\n"));
};

const getBrandOrProjectName = (id: string): string => {
  if (id && id.startsWith("project_")) {
    return getProjectName(id);
  }
  const brand = BRANDS.find((b) => b.id === id);
  return brand ? brand.name : BRANDS[0].name;
};

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

type TabType = "social" | "architecture" | "seo" | "ads" | "guidelines" | "theo" | "performance";

/**
 * getBrandTheme 每次呼叫都會配置一個全新的物件，導致任何吃 theme 的
 * 子元件都無法靠參考比對跳過重繪。用 useMemo 讓同一個 brandId 共用同一份。
 */
export function useBrandTheme(brandId: string): BrandTheme {
  return useMemo(() => getBrandTheme(brandId), [brandId]);
}

// Tab 列表是靜態的，放在模組層級避免每次 render 重建陣列
const TABS = [
  { id: "social", label: "社群文案", expert: "Maya", icon: FileText, color: "from-pink-500 to-rose-500", glow: "shadow-rose-500/10" },
  { id: "architecture", label: "網頁架構", expert: "Leon", icon: Network, color: "from-sky-500 to-indigo-500", glow: "shadow-indigo-500/10" },
  { id: "seo", label: "SEO關鍵字", expert: "Iris", icon: Search, color: "from-emerald-500 to-teal-500", glow: "shadow-emerald-500/10" },
  { id: "ads", label: "廣告數據", expert: "Jack", icon: BarChart3, color: "from-purple-500 to-violet-500", glow: "shadow-violet-500/10" },
  { id: "guidelines", label: "品牌大腦", expert: "Erick", icon: Brain, color: "from-amber-500 to-orange-500", glow: "shadow-amber-500/10" },
  { id: "theo", label: "流量預測", expert: "Theo", icon: Activity, color: "from-amber-500 to-yellow-500", glow: "shadow-amber-500/10" },
  { id: "performance", label: "成效", expert: "Data", icon: TrendingUp, color: "from-cyan-500 to-sky-500", glow: "shadow-sky-500/10" }
] as const;

/** 品牌主色提供給 Button：主要按鈕會跟著目前品牌變色 */
const brandButtonColors = (t: BrandTheme) => ({ bg: t.primaryBg, hover: t.primaryBgHover, text: t.primaryBtnText, border: t.btnBorder });

export default function WorkspaceBoard(props: WorkspaceBoardProps) {
  const rootTheme = useBrandTheme(props.activeBrandId);
  return (
    <BrandButtonProvider colors={brandButtonColors(rootTheme)}>
      <WorkspaceBoardInner {...props} />
    </BrandButtonProvider>
  );
}

function WorkspaceBoardInner({ activeBrandId, aiProvider }: WorkspaceBoardProps) {
  const [activeTab, setActiveTab] = useState<TabType>("social");
  // 側邊欄點專家 → 切到對應分頁
  useEffect(() => {
    const handler = (e: Event) => {
      const t = (e as CustomEvent<string>).detail;
      if (TABS.some((x) => x.id === t)) setActiveTab(t as TabType);
    };
    window.addEventListener("ek-switch-tab", handler);
    return () => window.removeEventListener("ek-switch-tab", handler);
  }, []);
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

  // 整個 header 共用同一份 theme，不再於 map 迴圈內重複計算
  const theme = useBrandTheme(activeBrandId);

  // 第二階段：生成後自動健檢（只評分不改寫）。放在這一層，不論目前停在哪個分頁都會跑
  const healthBusy = useAutoHealthCheck(activeBrandId, data, aiProvider);

  return (
    <div className="flex flex-col h-full bg-slate-950/20 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-md">
      {/* Tabs Selector Header */}
      {/* 七個分頁排成 4 + 3 兩列，不需要左右滑動 */}
      <div className="grid grid-cols-12 bg-slate-900/40 border-b border-slate-800/60 p-2 gap-1">
        {TABS.map((tab, tabIndex) => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`${tabIndex < 4 ? "col-span-3" : "col-span-4"} flex items-center justify-center gap-2 px-2 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer whitespace-nowrap relative ${
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
            className="min-h-full flex flex-col"
          >
            {activeTab === "social" && (
              <SocialTabContent 
                brandId={activeBrandId} 
                socialCopy={data.social_copy} 
                socialCopyThreads={data.social_copy_threads}
                socialCopyFacebook={data.social_copy_facebook}
                socialCopyInstagram={data.social_copy_instagram}
                aeoSchema={data.aeo_schema}
                aeoFaq={data.aeo_faq}
                theoAnalysis={data.theo_analysis}
                aiProvider={aiProvider}
                activePlatform={data.active_platform}
                seoKeywords={data.seo_keywords}
                copyMeta={data.social_copy_meta}
                genreMeta={data.genre_meta}
                storyArgumentMeta={data.story_argument_meta}
                webArticle={data.web_article}
                webArticleMeta={data.web_article_meta}
                webSourceCopy={pickWebSourceCopy(data)}
              />
            )}
            {activeTab === "architecture" && (
              <ArchitectureTabContent 
                brandId={activeBrandId} 
                architecture={data.web_architecture} 
                socialCopy={data.social_copy}
                seoKeywords={data.seo_keywords}
                aiProvider={aiProvider}
              />
            )}
            {activeTab === "seo" && (
              <SEOTabContent 
                brandId={activeBrandId} 
                keywords={data.seo_keywords} 
                aeoSchema={data.aeo_schema}
                aeoFaq={data.aeo_faq}
                aiProvider={aiProvider}
                socialCopy={data.social_copy}
                activePlatform={data.active_platform}
                webArticle={data.web_article}
                webArticleMeta={data.web_article_meta}
                brandGuidelines={data.brand_guidelines}
                webSourceCopy={pickWebSourceCopy(data)}
                seoScore={data.seo_score}
                healthBusy={healthBusy.seo}
              />
            )}
            {activeTab === "ads" && (
              <AdsTabContent 
                brandId={activeBrandId} 
                adData={data.ad_data} 
              />
            )}
            {activeTab === "theo" && (
              <TheoTabContent
                brandId={activeBrandId}
                socialCopy={data.social_copy}
                theoAnalysis={data.theo_analysis}
                aiProvider={aiProvider}
                activePlatform={data.active_platform}
                healthBusy={healthBusy.theo}
              />
            )}
            {activeTab === "performance" && (
              <PerformanceTab brandId={activeBrandId} />
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

const getPlatformLimit = (p: string) => {
  if (p === "threads") return 500;
  if (p === "instagram") return 2200;
  if (p === "red") return 1000;
  if (p === "tiktok") return 1000;
  return Infinity;
};

// ==================== 1. 社群文案分頁 (Maya) ====================
const SocialTabContent = memo(function SocialTabContent({ 
  brandId, 
  socialCopy, 
  socialCopyThreads,
  socialCopyFacebook,
  socialCopyInstagram,
  aeoSchema, 
  aeoFaq,
  theoAnalysis,
  aiProvider,
  activePlatform,
  seoKeywords,
  copyMeta,
  genreMeta,
  storyArgumentMeta,
  webArticle,
  webArticleMeta,
  webSourceCopy
}: { 
  brandId: string; 
  socialCopy: string; 
  socialCopyThreads?: string;
  socialCopyFacebook?: string;
  socialCopyInstagram?: string;
  aeoSchema?: string; 
  aeoFaq?: string; 
  theoAnalysis?: TheoAnalysis;
  aiProvider: string;
  activePlatform?: string;
  seoKeywords?: any[];
  copyMeta?: Record<string, { generated_at?: number; edited_at?: number }>;
  genreMeta?: GenreMeta | null;
  storyArgumentMeta?: import("@/data/skills/story-argument").StoryArgumentMeta | null;
  webArticle?: string;
  webArticleMeta?: WebArticleMeta;
  webSourceCopy?: string;
}) {
  // 發文／粉專／官網分類／主題一律用「有效品牌」：一般品牌是自己，階段專案是所屬品牌
  const [parentTick, setParentTick] = useState(0);
  useEffect(() => subscribeToProjects(() => setParentTick((n) => n + 1)), []);
  const resolvedParent = useMemo(
    () => resolveEffectiveBrandId(brandId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [brandId, parentTick]
  );
  const pubBrandId = resolvedParent || brandId;
  const projectNeedsParent = brandId.startsWith("project_") && !resolvedParent;
  const requireParentBrand = (): boolean => {
    if (projectNeedsParent) {
      alert("⚠️ 此階段專案還沒有選擇「所屬品牌」，請先到左側專案區選擇（I8／NAS／ABL／Erick），才能發文或上官網。");
      return false;
    }
    return true;
  };
  const theme = useBrandTheme(pubBrandId);
  const [mode, setMode] = useState<"edit" | "preview">("preview");
  const [val, setVal] = useState(socialCopy);
  const hasCopyForActions = !isSocialCopyPlaceholder(val);
  const copyIsPending = val.trim().startsWith("⏳");
  const copyFailureReason = val.trim().startsWith("❌")
    ? val.trim().replace(/^❌\s*/, "").split("\n")[0]
    : "";
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPublishingWebsite, setIsPublishingWebsite] = useState(false);
  const [pubStatus, setPubStatus] = useState<"idle" | "success" | "error">("idle");
  const [isPublishingSocial, setIsPublishingSocial] = useState(false);
  // Threads / Instagram 排程（與 Facebook 排程分開）
  const [showSocialPicker, setShowSocialPicker] = useState(false);
  const [socialScheduleTime, setSocialScheduleTime] = useState("");
  const [isSchedulingSocial, setIsSchedulingSocial] = useState(false);
  const [socialQueueTick, setSocialQueueTick] = useState(0);
  const [igImageUrl, setIgImageUrl] = useState<string | null>(null);
  const [igImagePrompt, setIgImagePrompt] = useState("");
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imageEngine, setImageEngine] = useState<"openai" | "comfy">("openai");
  const [imageSizeKey, setImageSizeKey] = useState<string>("ig_feed");
  const [comfyNote, setComfyNote] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [scheduleTime, setScheduleTime] = useState("");
  const [platform, setPlatform] = useState(activePlatform || "threads");
  const [activeStoryArgumentMeta, setActiveStoryArgumentMeta] = useState(storyArgumentMeta || null);
  const [storyReselectIdea, setStoryReselectIdea] = useState("");
  const [storyReselectMode, setStoryReselectMode] = useState<"auto" | "candidate">("auto");
  const [storyReselectFull, setStoryReselectFull] = useState(false);
  const [storyCandidates, setStoryCandidates] = useState<Array<{ id: string; title_zh: string | null; author_zh: string | null; domain: string; subdomain: string; zh_status: string | null; selectable: boolean; highlight: string }>>([]);
  const [selectedStoryCandidateId, setSelectedStoryCandidateId] = useState("");
  const [isLoadingStoryCandidates, setIsLoadingStoryCandidates] = useState(false);
  const [isReselectingStoryCitation, setIsReselectingStoryCitation] = useState(false);
  const [storyReselectMessage, setStoryReselectMessage] = useState("");
  const [storyReselectError, setStoryReselectError] = useState("");
  const usedStoryNoteIds = useRef<Set<string>>(new Set(storyArgumentMeta?.knowledge_note_id ? [storyArgumentMeta.knowledge_note_id] : []));
  useEffect(() => {
    setActiveStoryArgumentMeta(storyArgumentMeta || null);
    if (storyArgumentMeta?.knowledge_note_id) usedStoryNoteIds.current.add(storyArgumentMeta.knowledge_note_id);
  }, [storyArgumentMeta]);
  const genreIssues = useMemo(
    () => (genreMeta ? checkGenreText(val, genreMeta, platform) : []),
    [val, genreMeta, platform]
  );
  // 擋住發佈的檢查：只看「禁用詞」與「【需補】」，這兩項與平台無關
  const requireGenreOk = (): boolean => {
    if (!genreMeta && storyArgumentMeta) {
      const storyMetaForExistingChecks = {
        genre: "case" as const,
        funnel: "warm" as const,
        prompt_version: storyArgumentMeta.prompt_version,
      };
      const blocks = blockingIssues(checkGenreText(val, storyMetaForExistingChecks));
      if (blocks.length > 0) {
        alert("⚠️ 這篇文章還不能發佈：\n\n" + blocks.map((b) => "・" + b.message).join("\n"));
        return false;
      }
    }
    if (!genreMeta) return true;
    const blocks = blockingIssues(checkGenreText(val, genreMeta));
    if (blocks.length === 0) return true;
    alert("⚠️ 這篇文章還不能發佈：\n\n" + blocks.map((b) => "・" + b.message).join("\n"));
    return false;
  };
  const fmtTaipei = (t?: number) =>
    t
      ? new Date(t).toLocaleString("zh-TW", {
          timeZone: "Asia/Taipei",
          month: "numeric",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      : "";
  const metaNow = copyMeta?.[activePlatform || platform];
  const copyTimeLabel = metaNow?.generated_at || metaNow?.edited_at
    ? [
        metaNow?.generated_at ? `生成於 ${fmtTaipei(metaNow.generated_at)}` : "",
        metaNow?.edited_at ? `編輯於 ${fmtTaipei(metaNow.edited_at)}` : "",
      ].filter(Boolean).join(" ・ ")
    : "生成時間不明（舊文案）";
  const [isAdapting, setIsAdapting] = useState(false);
  const [selectedTargetPages, setSelectedTargetPages] = useState<string[]>(() => [
    getDefaultFacebookPage(pubBrandId).id
  ]);
  const [showPageSelector, setShowPageSelector] = useState(false);
  const pageSelectorBtnRef = useRef<HTMLButtonElement>(null);
  const [pageSelectorAlign, setPageSelectorAlign] = useState<PopoverAlign>("left");
  // 展開前先量一下位置：往左長會被外層切掉就改成往右長，避免面板被擋住
  const togglePageSelector = () => {
    if (!showPageSelector && pageSelectorBtnRef.current) {
      const r = pageSelectorBtnRef.current.getBoundingClientRect();
      const b = clippingBounds(pageSelectorBtnRef.current);
      setPageSelectorAlign(pickAlign(r.left, r.right, b.left, b.right, 320));
    }
    setShowPageSelector(!showPageSelector);
  };

  // 排程佇列狀態
  const [publishedArticle, setPublishedArticle] = useState<{ id: string; content: string } | null>(null);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  // 所有品牌的排程（只給月曆標記用），不受目前品牌篩選影響
  const [allQueueItems, setAllQueueItems] = useState<QueueItem[]>([]);
  const [queueEnabled, setQueueEnabled] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  // 當切換品牌時，自動更新預設目標粉專
  useEffect(() => {
    const defaultPage = getDefaultFacebookPage(pubBrandId);
    setSelectedTargetPages([defaultPage.id]);
  }, [pubBrandId]);

  const getOtherPlatformCopy = () => {
    if (platform !== "facebook" && socialCopyFacebook?.trim()) return socialCopyFacebook;
    if (platform !== "instagram" && socialCopyInstagram?.trim()) return socialCopyInstagram;
    if (platform !== "threads" && socialCopyThreads?.trim()) return socialCopyThreads;
    if (socialCopy?.trim()) return socialCopy;
    return "";
  };

  const getOtherPlatformName = () => {
    if (platform !== "facebook" && socialCopyFacebook?.trim()) return "Facebook";
    if (platform !== "instagram" && socialCopyInstagram?.trim()) return "Instagram";
    if (platform !== "threads" && socialCopyThreads?.trim()) return "Threads";
    return "";
  };

  const hasCopyOnOtherPlatform = !!getOtherPlatformCopy();

  const renderPlatformPreview = (content: string) => {
    const brandName = getBrandOrProjectName(brandId);
    const initial = brandName ? brandName.charAt(0).toUpperCase() : "B";
    
    if (platform === "threads") {
      return (
        <div className="max-w-xl mx-auto w-full bg-slate-950 border border-slate-900 rounded-2xl p-4 font-sans text-slate-200 shadow-2xl relative overflow-hidden transition-all duration-300">
          <div className="flex items-start gap-3">
            <div className={`w-9 h-9 rounded-full bg-gradient-to-tr ${theme.gradientFromTo} flex items-center justify-center text-xs font-black text-slate-950 shrink-0 shadow-inner`}>
              {initial}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <span className="font-bold text-xs text-slate-100 hover:underline cursor-pointer">{brandName}</span>
                  <span className="w-3.5 h-3.5 bg-blue-500 text-[8px] text-white flex items-center justify-center rounded-full" title="經 Erick 營運長決策校準認證">✓</span>
                </div>
                <span className="text-[10px] text-slate-500">12m</span>
              </div>
              
              <div className="mt-1.5 text-xs text-slate-200 leading-relaxed break-words whitespace-pre-wrap select-text selection:bg-slate-800">
                {renderMarkdown(content)}
              </div>
              
              <div className="mt-4 flex items-center gap-4 text-slate-500">
                <button className="hover:text-rose-500 transition-colors p-1 hover:bg-slate-900 rounded-full cursor-pointer"><Heart className="w-3.5 h-3.5" /></button>
                <button className="hover:text-sky-500 transition-colors p-1 hover:bg-slate-900 rounded-full cursor-pointer"><MessageCircle className="w-3.5 h-3.5" /></button>
                <button className="hover:text-emerald-500 transition-colors p-1 hover:bg-slate-900 rounded-full cursor-pointer"><Repeat className="w-3.5 h-3.5" /></button>
                <button className="hover:text-slate-200 transition-colors p-1 hover:bg-slate-900 rounded-full cursor-pointer"><Share2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          </div>
        </div>
      );
    }
    
    if (platform === "facebook") {
      return (
        <div className="max-w-xl mx-auto w-full bg-[#18191a] border border-[#2f3031] rounded-xl p-4 font-sans text-slate-200 shadow-2xl relative overflow-hidden transition-all duration-300">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-full bg-gradient-to-tr ${theme.gradientFromTo} flex items-center justify-center text-xs font-black text-slate-950 shrink-0`}>
                {initial}
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <span className="font-bold text-xs text-slate-100 hover:underline cursor-pointer">{brandName}</span>
                </div>
                <div className="flex items-center gap-1 text-[9px] text-slate-500 font-medium">
                  <span>貼文預覽</span>
                  <span>·</span>
                  <span title="文案時間（台北時間）">{copyTimeLabel}</span>
                  <span>·</span>
                  <span className="text-[10px]" title="公開">🌐</span>
                </div>
              </div>
            </div>
            <button className="text-slate-400 hover:text-slate-200 p-1 rounded-full hover:bg-[#242526] transition cursor-pointer">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
          
          <div className="mt-3 text-xs text-[#e4e6eb] leading-relaxed break-words whitespace-pre-wrap select-text selection:bg-blue-600/30">
            {renderMarkdown(content)}
          </div>
          
          <div className="mt-4 pt-2 border-t border-[#2f3031] flex items-center justify-around text-slate-400 font-bold text-[11px]">
            <button className="flex items-center justify-center gap-1.5 py-1.5 hover:bg-[#242526] rounded-lg w-full transition hover:text-blue-500 cursor-pointer">
              <ThumbsUp className="w-3.5 h-3.5" />
              <span>讚</span>
            </button>
            <button className="flex items-center justify-center gap-1.5 py-1.5 hover:bg-[#242526] rounded-lg w-full transition hover:text-slate-200 cursor-pointer">
              <MessageCircle className="w-3.5 h-3.5" />
              <span>留言</span>
            </button>
            <button className="flex items-center justify-center gap-1.5 py-1.5 hover:bg-[#242526] rounded-lg w-full transition hover:text-slate-200 cursor-pointer">
              <Share2 className="w-3.5 h-3.5" />
              <span>分享</span>
            </button>
          </div>
        </div>
      );
    }
    
    if (platform === "instagram") {
      // Extract first line for graphic layout
      const firstLine = content.split("\n")[0] || "";
      const displayTitle = firstLine.replace(/[#【】\[\]*]/g, "").substring(0, 30) || "精選社群貼文";
      
      return (
        <div className="max-w-xl mx-auto w-full bg-black border border-slate-900 rounded-xl font-sans text-slate-200 shadow-2xl relative overflow-hidden transition-all duration-300">
          <div className="flex items-center justify-between p-3 border-b border-slate-900">
            <div className="flex items-center gap-2.5">
              <div className={`w-7 h-7 rounded-full bg-gradient-to-tr ${theme.gradientFromTo} flex items-center justify-center text-[10px] font-black text-slate-950 shrink-0`}>
                {initial}
              </div>
              <div className="flex items-center gap-1">
                <span className="font-bold text-xs text-slate-100 hover:underline cursor-pointer">{brandName}</span>
                <span className="w-3.5 h-3.5 bg-blue-500 text-[7px] text-white flex items-center justify-center rounded-full">✓</span>
              </div>
            </div>
            <button className="text-slate-400 hover:text-slate-200 p-1 rounded-full hover:bg-slate-950 transition cursor-pointer">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
          
          <div className={`aspect-video w-full bg-gradient-to-br ${theme.gradientFromTo} flex flex-col items-center justify-center p-6 text-center select-none`}>
            <span className="text-[10px] font-bold text-slate-950/40 uppercase tracking-widest mb-2">{brandName} x AI BOARD</span>
            <p className="text-slate-950 font-black text-lg sm:text-xl leading-tight max-w-sm drop-shadow-sm font-sans">
              {displayTitle}
            </p>
            <div className="w-8 h-1 bg-slate-950/30 rounded mt-4" />
          </div>
          
          <div className="flex items-center justify-between p-3">
            <div className="flex items-center gap-3.5 text-slate-300">
              <button className="hover:text-rose-500 transition p-0.5 cursor-pointer"><Heart className="w-4 h-4" /></button>
              <button className="hover:text-slate-100 transition p-0.5 cursor-pointer"><MessageCircle className="w-4 h-4" /></button>
              <button className="hover:text-slate-100 transition p-0.5 cursor-pointer"><Share2 className="w-4 h-4" /></button>
            </div>
            <button className="hover:text-slate-100 transition p-0.5 cursor-pointer text-slate-300"><Bookmark className="w-4 h-4" /></button>
          </div>
          
          <div className="px-3 pb-4 space-y-1.5 text-xs">
            <div className="leading-relaxed text-slate-200 break-words select-text selection:bg-pink-500/20">
              <span className="font-bold text-slate-100 mr-2 hover:underline cursor-pointer">{brandName}</span>
              {renderMarkdown(content)}
            </div>
          </div>
        </div>
      );
    }
    
    return (
      <div className="flex-1 p-5 rounded-xl bg-slate-950/40 border border-slate-850/65 overflow-y-auto min-h-[300px]">
        {renderMarkdown(content)}
      </div>
    );
  };

  const handleAdaptPlatform = async (forceGenerateFromKeywords: boolean = false) => {
    if (isAdapting) return;
    setIsAdapting(true);
    try {
      const brandName = getBrandOrProjectName(brandId);
      
      let sourceCopy = "";
      if (!forceGenerateFromKeywords) {
        if (val?.trim()) {
          sourceCopy = val;
        } else {
          sourceCopy = getOtherPlatformCopy();
        }
      }

      // 品牌錯置檢查：要改寫的原文明顯在講別的品牌時先問一次
      const guardKey = brandKeyFromId(resolveEffectiveBrandId(brandId) || brandId);
      const mm = findTextMismatch(sourceCopy, guardKey, "要改寫的原文");
      let confirmedBrand = false;
      if (mm) {
        if (!window.confirm(`${describeMismatch(mm)}\n\n仍要用「${GUARD_BRAND_LABEL[guardKey]}」的語氣改寫嗎？`)) {
          setIsAdapting(false);
          return;
        }
        confirmedBrand = true;
      }

      const callAdapt = (confirmFlag: boolean) => fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: "adapt",
          brandKey: guardKey,
          confirmBrandMismatch: confirmFlag,
          brandName,
          aiProvider,
          platform,
          copywritingFramework: (() => { try { return localStorage.getItem("ek_active_framework") || "default"; } catch { return "default"; } })(),
          brandGuidelines: getMergedBrandGuidelines(brandId),
          prevData: { 
            social_copy: sourceCopy,
            seo_keywords: seoKeywords 
          }
        })
      });
      let res = await callAdapt(confirmedBrand);
      if (res.status === 409) {
        let j: any = null;
        try { j = await res.clone().json(); } catch {}
        if (j?.code === "BRAND_MISMATCH" && window.confirm(`${j.error}\n\n仍要用「${GUARD_BRAND_LABEL[guardKey]}」改寫嗎？`)) {
          res = await callAdapt(true);
        }
      }

      if (!res.ok) {
        let serverMsg = "";
        try { serverMsg = (await res.json())?.error || ""; } catch {}
        throw new Error(res.status === 409 && serverMsg ? serverMsg : "轉化改寫失敗，請檢查 API 金鑰與連線。");
      }

      const responseData = await res.json();
      if (responseData.dispatchData && responseData.dispatchData.social_copy) {
        const newCopy = responseData.dispatchData.social_copy;
        setVal(newCopy);
        await saveWorkspace(brandId, { social_copy: newCopy }, { generated: true });
      } else {
        throw new Error("轉化資料格式不正確");
      }
    } catch (e: any) {
      console.error("Adaptation error:", e);
      alert(e.message || "轉化改寫失敗");
    } finally {
      setIsAdapting(false);
    }
  };

  useEffect(() => {
    if (activePlatform) {
      setPlatform(activePlatform);
    }
  }, [activePlatform]);

  // 依照使用者需求，取消自動流量檢測，改為純手動觸發
  // useEffect(() => {
  //   if (socialCopy && !theoAnalysis && !isAnalyzing) {
  //     handleAnalyzeViral(socialCopy);
  //   }
  // }, [socialCopy, theoAnalysis]);

  const handlePlatformChange = async (newPlatform: string) => {
    setPlatform(newPlatform);
    setShowSocialPicker(false);
    await saveWorkspace(brandId, { active_platform: newPlatform });
  };

  // 歷史文章狀態
  const [historyArticles, setHistoryArticles] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const response = await fetch(`/api/articles?brandId=${pubBrandId}`);
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
  }, [pubBrandId]);

  const fetchQueue = async () => {
    setIsLoadingQueue(true);
    try {
      const response = await fetch(`/api/publish-queue?brandId=${encodeURIComponent(pubBrandId)}`, { cache: "no-store" });
      const resData = await response.json();
      setQueueEnabled(!!resData.enabled);
      setQueueItems(Array.isArray(resData.data) ? resData.data : []);
      setQueueError(resData.success ? null : resData.error || "讀取排程失敗");
      try {
        const allRes = await fetch("/api/publish-queue?limit=100", { cache: "no-store" });
        const allData = await allRes.json();
        setAllQueueItems(Array.isArray(allData.data) ? allData.data : []);
      } catch {
        // 月曆標記讀不到時不影響主流程
      }
    } catch (err: any) {
      setQueueEnabled(false);
      setQueueError(err?.message || "讀取排程失敗");
    } finally {
      setIsLoadingQueue(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    const timer = setInterval(fetchQueue, 60000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pubBrandId]);

  const handleCancelQueue = async (id: string) => {
    try {
      const response = await fetch("/api/publish-queue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "cancel" }),
      });
      const resData = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(resData.error || "取消失敗");
      await fetchQueue();
    } catch (err: any) {
      alert(`❌ 取消排程失敗：${err?.message || "未知錯誤"}`);
      fetchQueue();
    }
  };
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

  /**
   * 官網要送哪一份：有「官網文章」就送官網文章；
   * 舊草稿沒有時，經使用者確認後退回社群貼文。回傳 null 代表使用者取消。
   */
  const getWebContent = (): string | null => {
    const r = resolveWebContent(webArticle, val);
    if (
      !r.usedFallback &&
      isArticleStale(webArticleMeta, webSourceCopy ?? val) &&
      !window.confirm(
        "社群貼文在「官網文章」產生之後又被修改過，官網文章可能不是最新（甚至是上一篇的內容）。\n\n仍要把目前的官網文章上架嗎？\n（取消後可到「SEO關鍵字」分頁重新產生）"
      )
    ) {
      return null;
    }
    if (
      r.usedFallback &&
      !window.confirm(
        "這篇還沒有「官網文章」版本，將直接使用目前的社群貼文上架官網。\n\n建議先到「SEO關鍵字」分頁按「由社群文案產生官網文章」，再回來發布。\n\n仍要用社群貼文上架嗎？"
      )
    ) {
      return null;
    }
    return r.content;
  };

  const handlePublishWebsite = async (force = false, resolvedContent?: string) => {
    if (!requireParentBrand()) return;
    if (!requireGenreOk()) return;
    if (isPublishingWebsite || !hasCopyForActions) return;
    const webContent = resolvedContent ?? getWebContent();
    if (webContent === null) return;
    setIsPublishingWebsite(true);
    try {
      const brandName = getBrandOrProjectName(brandId);

      const response = await fetch("/api/publish-website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId: pubBrandId,
          brandName,
          content: webContent,
          aeoSchema: aeoSchema || null,
          aeoFaq: aeoFaq ? stripMarkdown(aeoFaq) : null,
          promptVersion: genreMeta?.prompt_version || null,
          modelVersion: genreMeta?.model_version || null,
          force
        })
      });

      const resData = await response.json();

      // 紅線攔截：列出違規詞，由使用者決定改稿或確認放行
      if (response.status === 422 && resData.blocked) {
        setIsPublishingWebsite(false);
        if (confirmGuardrail(resData)) {
          return handlePublishWebsite(true, webContent);
        }
        return;
      }

      if (!response.ok) {
        throw new Error(resData.error || "發布至官網失敗");
      }

      const newArticleId = Array.isArray(resData.data) ? resData.data[0]?.id : resData.data?.id;
      if (newArticleId !== undefined && newArticleId !== null) {
        setPublishedArticle({ id: String(newArticleId), content: webContent });
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
    if (!requireParentBrand()) return;
    if (isPublishing) return;
    const targetIds = selectedTargetPages.length > 0 ? selectedTargetPages : [getDefaultFacebookPage(pubBrandId).id];
    const targetPageConfigs = getFacebookPagesByIds(targetIds);
    const pageNames = targetPageConfigs.map((p) => p.badge).join("、") || "FB 粉絲專頁";

    if (!confirm(`確定要將此篇歷史文章直接發布至社群【${pageNames}】（N8N 分流與第一則留言連結）嗎？`)) {
      return;
    }
    setIsPublishing(true);
    setPubStatus("idle");
    try {
      const response = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId: pubBrandId,
          targetPages: targetIds,
          content: articleContent,
          action: "now",
          scheduleTime: null
        })
      });

      if (!response.ok) {
        throw new Error("發布失敗");
      }

      setPubStatus("success");
      alert(`🎉 歷史文章已成功補發至【${pageNames}】！`);
    } catch (error: any) {
      console.error("Publish error:", error);
      setPubStatus("error");
      alert(`❌ 發布失敗：${error?.message || "請確認 n8n Webhook 設定"}`);
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

  const loadStoryArgumentCandidates = async () => {
    setIsLoadingStoryCandidates(true);
    setStoryReselectError("");
    try {
      const response = await fetch("/api/knowledge-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ action: "story-argument-candidates", idea: storyReselectIdea }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "目前無法讀取知識筆記候選。");
      setStoryCandidates(Array.isArray(result.candidates) ? result.candidates : []);
      setSelectedStoryCandidateId("");
    } catch (error) {
      setStoryReselectError(error instanceof Error ? error.message : "讀取候選失敗。");
    } finally {
      setIsLoadingStoryCandidates(false);
    }
  };

  const reselectStoryArgumentCitation = async () => {
    if (!activeStoryArgumentMeta || !val.trim()) return;
    if (storyReselectMode === "candidate" && !selectedStoryCandidateId) {
      setStoryReselectError("請先選擇一筆候選筆記。");
      return;
    }
    setIsReselectingStoryCitation(true);
    setStoryReselectError("");
    setStoryReselectMessage("");
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history: [{ role: "user", content: val }],
          brandName: getBrandOrProjectName(brandId),
          aiProvider,
          stage: "story_argument_reselect",
          expertType: "story_argument_reselect",
          storyArgument: activeStoryArgumentMeta,
          storyReselection: {
            idea: storyReselectIdea,
            mode: storyReselectMode,
            excludeNoteIds: [...usedStoryNoteIds.current],
            ...(storyReselectMode === "candidate" ? { selectedNoteId: selectedStoryCandidateId } : {}),
            rewriteFull: storyReselectFull,
            currentCopy: val,
          },
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "重新挑選引用失敗。");
      const dispatch = result.dispatchData || {};
      if (typeof dispatch.social_copy !== "string") throw new Error("重新挑選引用沒有回傳文章內容。");
      const nextMeta = dispatch.story_argument_meta || activeStoryArgumentMeta;
      setVal(dispatch.social_copy);
      setActiveStoryArgumentMeta(nextMeta);
      if (nextMeta.knowledge_note_id) usedStoryNoteIds.current.add(nextMeta.knowledge_note_id);
      await saveWorkspace(brandId, { social_copy: dispatch.social_copy, story_argument_meta: nextMeta });
      if (dispatch.citation_error === "no_matching_note") {
        setStoryReselectMessage("知識庫找不到支持這個想法的筆記，已在論點支持處保留待補標記。");
      } else if (dispatch.citation_error === "no_available_notes") {
        setStoryReselectMessage("沒有尚未使用的筆記可供自動重選，請列出候選或補充想法。");
      } else if (dispatch.citation_error === "selection_failed") {
        setStoryReselectMessage("本次未能完成知識庫選取，請重試；文章仍保留待補標記。");
      } else {
        setStoryReselectMessage(nextMeta.citation_valid ? "引用已重新挑選並通過筆記驗證。" : "引用已更新，但仍有欄位需要補齊；發佈阻擋規則仍生效。");
      }
    } catch (error) {
      setStoryReselectError(error instanceof Error ? error.message : "重新挑選引用失敗。");
    } finally {
      setIsReselectingStoryCitation(false);
    }
  };

  /**
   * 排程前確保文章已上架官網並取得 articleId（決策：排程當下就上架）。
   * 若目前內容已經上架過（且沒有再改動）就直接沿用，避免重複上架同一篇。
   * 回傳 null 表示使用者取消或失敗（訊息已處理）。
   */
  const ensureArticleId = async (force = false, resolvedContent?: string): Promise<string | null> => {
    const webContent = resolvedContent ?? getWebContent();
    if (webContent === null) return null;
    if (publishedArticle && publishedArticle.content === webContent) {
      return publishedArticle.id;
    }

    const response = await fetch("/api/publish-website", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brandId: pubBrandId,
        brandName: getBrandOrProjectName(brandId),
        content: webContent,
        aeoSchema: aeoSchema || null,
        aeoFaq: aeoFaq ? stripMarkdown(aeoFaq) : null,
        force
      })
    });
    const resData = await response.json().catch(() => ({}));

    if (response.status === 422 && resData.blocked) {
      if (confirmGuardrail(resData)) {
        return ensureArticleId(true, webContent);
      }
      return null;
    }
    if (!response.ok) {
      throw new Error(resData.error || "發布至官網失敗");
    }

    const newId = Array.isArray(resData.data) ? resData.data[0]?.id : resData.data?.id;
    if (newId === undefined || newId === null) {
      throw new Error("官網已寫入，但沒有取得文章 id，無法排程");
    }
    setPublishedArticle({ id: String(newId), content: webContent });
    fetchHistory();
    return String(newId);
  };

  const handleSchedule = async (targetTime: string, force = false) => {
    if (!requireParentBrand()) return;
    if (!requireGenreOk()) return;
    if (isScheduling || isPublishing || !val || !targetTime) return;

    const targetIds = selectedTargetPages.length > 0 ? selectedTargetPages : [getDefaultFacebookPage(pubBrandId).id];
    const blockedPages = targetIds.filter((id) => UNSCHEDULABLE_PAGE_IDS_CLIENT.includes(id));
    if (blockedPages.length > 0) {
      const names = getFacebookPagesByIds(blockedPages).map((p) => p.badge).join("、");
      alert(`❌ ${names} 目前沒有 API 憑證，無法排程，請先取消勾選。`);
      return;
    }

    // datetime-local 的值是瀏覽器所在時區的當地時間，轉成 UTC ISO 再送出
    const when = new Date(targetTime);
    if (Number.isNaN(when.getTime())) {
      alert("❌ 排程時間格式不正確");
      return;
    }
    if (when.getTime() - Date.now() < 5 * 60 * 1000) {
      alert("❌ 排程時間至少要晚於現在 5 分鐘");
      return;
    }

    const pageNames = getFacebookPagesByIds(targetIds).map((p) => p.badge).join("、") || "FB 粉絲專頁";
    const whenText = when.toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false });
    if (
      !force &&
      !window.confirm(
        `排程會「現在」先把官網文章上架到官網，再於 ${whenText}（台北時間）發到【${pageNames}】。\n\n確定要排程嗎？`
      )
    ) {
      return;
    }

    setIsScheduling(true);
    try {
      const articleId = await ensureArticleId();
      if (!articleId) return;

      const response = await fetch("/api/publish-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId: pubBrandId,
          targetPages: targetIds,
          content: val,
          articleId,
          scheduledAt: when.toISOString(),
          force
        })
      });
      const resData = await response.json().catch(() => ({}));

      if (response.status === 422 && resData.blocked) {
        if (confirmGuardrail(resData)) {
          return await handleSchedule(targetTime, true);
        }
        return;
      }
      if (!response.ok) {
        throw new Error(resData.error || "排程失敗");
      }

      alert(`📅 已排程於 ${whenText}（台北時間）發到【${pageNames}】。文章已先上架官網，可在下方「排程清單」查看狀態或取消。`);
      setShowDatePicker(false);
      setScheduleTime("");
      fetchQueue();
    } catch (error: any) {
      console.error("Schedule error:", error);
      alert(`❌ 排程失敗：${error?.message || "未知錯誤"}`);
    } finally {
      setIsScheduling(false);
    }
  };

  // Threads 發文：由 n8n 的 social_publish_api 實際發出（Facebook 仍走上面的 handlePublish）
  const handlePublishThreads = async (force = false) => {
    if (!requireParentBrand()) return;
    if (!requireGenreOk()) return;
    if (isPublishingSocial || isPublishing || !val) return;
    const brandKey = brandKeyFromId(pubBrandId);
    if (brandKey === "erick") {
      alert("Erick 個人品牌還沒有串接 Threads 帳號，請切換到 ABL、NAS 或 I8。");
      return;
    }
    if (!force) {
      const warns = genreIssues.filter((i) => i.level === "warn").map((i) => "・" + i.message);
      const ok = confirm(
        `確定要把這篇文案發布到【Threads ${brandKey.toUpperCase()}】嗎？\n發出後會立刻公開（約需 40 秒），要刪除請到 Threads 自行刪除。\n目前 ${val.length} 字。` +
          (warns.length > 0 ? "\n\n目前的提醒：\n" + warns.join("\n") : "")
      );
      if (!ok) return;
    }
    setIsPublishingSocial(true);
    try {
      const response = await fetch("/api/publish-social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId: pubBrandId, platform: "threads", content: val, force }),
      });
      const resData = await response.json().catch(() => ({}));
      if (response.status === 422 && resData.blocked) {
        setIsPublishingSocial(false);
        if (confirmGuardrail(resData)) {
          return handlePublishThreads(true);
        }
        return;
      }
      if (!response.ok || !resData.success) {
        throw new Error(resData.error || "Threads 發布失敗");
      }
      alert(`🎉 已發布到 ${resData.account || "Threads"}！${resData.url ? "\n" + resData.url : ""}`);
    } catch (error: any) {
      console.error("Threads publish error:", error);
      alert(`❌ Threads 發布失敗：${error?.message || "請稍後再試"}`);
    } finally {
      setIsPublishingSocial(false);
    }
  };

  // Threads / Instagram 排程：寫進 Supabase 佇列，到期由 n8n 的 Social Queue Runner 發出
  const handleScheduleSocial = async (targetPlatform: "threads" | "instagram", force = false) => {
    if (!requireParentBrand()) return;
    if (!requireGenreOk()) return;
    if (isSchedulingSocial || !val) return;
    const brandKey = brandKeyFromId(pubBrandId);
    if (brandKey === "erick") {
      alert("Erick 個人品牌還沒有串接 Threads / Instagram 帳號，請切換到 ABL、NAS 或 I8。");
      return;
    }
    if (targetPlatform === "instagram" && !igImageUrl) {
      alert("請先按「生成配圖」，預覽圖片後再排程。");
      return;
    }
    const when = new Date(socialScheduleTime);
    if (!socialScheduleTime || Number.isNaN(when.getTime())) {
      alert("❌ 請先選擇排程時間");
      return;
    }
    if (when.getTime() - Date.now() < 5 * 60 * 1000) {
      alert("❌ 排程時間至少要晚於現在 5 分鐘");
      return;
    }
    const label = targetPlatform === "threads" ? "Threads" : "Instagram";
    const whenText = when.toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false });
    if (!force) {
      const warns = genreIssues.filter((i) => i.level === "warn").map((i) => "・" + i.message);
      const ok = confirm(
        `確定要排程在 ${whenText}（台北時間）發布到【${label} ${brandKey.toUpperCase()}】嗎？\n時間到會自動發出，發出前可以在排程清單取消。\n目前 ${val.length} 字。` +
          (warns.length > 0 ? "\n\n目前的提醒：\n" + warns.join("\n") : "")
      );
      if (!ok) return;
    }
    setIsSchedulingSocial(true);
    try {
      const response = await fetch("/api/social-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId: pubBrandId,
          platform: targetPlatform,
          content: val,
          imageUrl: targetPlatform === "instagram" ? igImageUrl : undefined,
          scheduledAt: when.toISOString(),
          force,
        }),
      });
      const resData = await response.json().catch(() => ({}));
      if (response.status === 422 && resData.blocked) {
        setIsSchedulingSocial(false);
        if (confirmGuardrail(resData)) {
          return handleScheduleSocial(targetPlatform, true);
        }
        return;
      }
      if (!response.ok || !resData.success) {
        throw new Error(resData.error || "排程失敗");
      }
      alert(`📅 已排程在 ${whenText}（台北時間）發布到 ${label}。可在下方「排程清單」查看或取消。`);
      setShowSocialPicker(false);
      setSocialScheduleTime("");
      setSocialQueueTick((t) => t + 1);
    } catch (error) {
      console.error("Social schedule error:", error);
      alert(`❌ 排程失敗：${error instanceof Error && error.message ? error.message : "未知錯誤"}`);
    } finally {
      setIsSchedulingSocial(false);
    }
  };

  // Instagram：先依文章生成配圖（圖上不放字），預覽後才發佈
  const handleGenerateImage = async () => {
    if (!requireParentBrand()) return;
    if (isGeneratingImage || !val) return;
    const brandKey = brandKeyFromId(pubBrandId);
    if (brandKey === "erick") {
      alert("Erick 個人品牌還沒有串接 Instagram 帳號，請切換到 ABL、NAS 或 I8。");
      return;
    }
    setIsGeneratingImage(true);
    setComfyNote("");
    try {
      if (imageEngine === "comfy") {
        // 本機 ComfyUI：免費，不呼叫 LLM。Mac mini 沒開機時會排隊，開機後補做。
        const result = await runComfyJob({ brandId: pubBrandId, sizeKey: imageSizeKey, purpose: "article" }, (p) => setComfyNote(comfyWaitText(p)));
        setIgImageUrl(result.url);
        setIgImagePrompt("本機 ComfyUI 生成的情境底圖（圖上沒有文字）");
        return;
      }
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId: pubBrandId, content: val }),
      });
      const resData = await response.json().catch(() => ({}));
      if (!response.ok || !resData.success) {
        throw new Error(resData.error || "生成配圖失敗");
      }
      setIgImageUrl(resData.imageUrl);
      setIgImagePrompt(resData.prompt || "");
    } catch (error: any) {
      console.error("Generate image error:", error);
      alert(`❌ 生成配圖失敗：${error?.message || "請稍後再試"}`);
    } finally {
      setIsGeneratingImage(false);
      setComfyNote("");
    }
  };

  const handlePublishInstagram = async (force = false) => {
    if (!requireParentBrand()) return;
    if (!requireGenreOk()) return;
    if (isPublishingSocial || isPublishing || !val) return;
    if (!igImageUrl) {
      alert("請先按「生成配圖」，預覽圖片後再發佈。");
      return;
    }
    const brandKey = brandKeyFromId(pubBrandId);
    if (brandKey === "erick") {
      alert("Erick 個人品牌還沒有串接 Instagram 帳號，請切換到 ABL、NAS 或 I8。");
      return;
    }
    if (!force) {
      const warns = genreIssues.filter((i) => i.level === "warn").map((i) => "・" + i.message);
      const ok = confirm(
        `確定要把這張配圖與說明文字發布到【Instagram ${brandKey.toUpperCase()}】嗎？\n發出後會立刻公開（約需 40 秒），要刪除請到 Instagram 自行刪除。\n說明文字 ${val.length} 字。` +
          (warns.length > 0 ? "\n\n目前的提醒：\n" + warns.join("\n") : "")
      );
      if (!ok) return;
    }
    setIsPublishingSocial(true);
    try {
      const response = await fetch("/api/publish-social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId: pubBrandId, platform: "instagram", content: val, imageUrl: igImageUrl, force }),
      });
      const resData = await response.json().catch(() => ({}));
      if (response.status === 422 && resData.blocked) {
        setIsPublishingSocial(false);
        if (confirmGuardrail(resData)) {
          return handlePublishInstagram(true);
        }
        return;
      }
      if (!response.ok || !resData.success) {
        throw new Error(resData.error || "Instagram 發布失敗");
      }
      alert(`🎉 已發布到 ${resData.account || "Instagram"}！${resData.url ? "\n" + resData.url : ""}`);
    } catch (error: any) {
      console.error("Instagram publish error:", error);
      alert(`❌ Instagram 發布失敗：${error?.message || "請稍後再試"}`);
    } finally {
      setIsPublishingSocial(false);
    }
  };

  const handlePublish = async (actionType: "now" | "schedule", targetTime?: string, force = false) => {
    if (!requireParentBrand()) return;
    if (!requireGenreOk()) return;
    if (isPublishing || !val) return;
    setIsPublishing(true);
    setPubStatus("idle");

    const targetIds = selectedTargetPages.length > 0 ? selectedTargetPages : [getDefaultFacebookPage(pubBrandId).id];
    const targetPageConfigs = getFacebookPagesByIds(targetIds);
    const pageNames = targetPageConfigs.map((p) => p.badge).join("、") || "FB 粉絲專頁";

    try {
      const response = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId: pubBrandId,
          targetPages: targetIds,
          content: val,
          action: actionType,
          scheduleTime: targetTime || null,
          force
        })
      });

      const resData = await response.json().catch(() => ({}));

      // 紅線攔截，與官網發布同一套規則
      if (response.status === 422 && resData.blocked) {
        setIsPublishing(false);
        if (confirmGuardrail(resData)) {
          return handlePublish(actionType, targetTime, true);
        }
        return;
      }

      if (!response.ok) {
        throw new Error(resData.error || "發布失敗");
      }

      setPubStatus("success");
      alert(
        actionType === "now"
          ? `🎉 已成功發布至【${pageNames}】！`
          : `📅 已成功設定排程於：${new Date(targetTime!).toLocaleString()}（目標：${pageNames}）！`
      );
    } catch (error: any) {
      console.error("Publish error:", error);
      setPubStatus("error");
      alert(`❌ 發布失敗：${error?.message || "請確認 n8n Webhook 設定"}`);
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

  // Threads / Instagram 共用的排程時間選擇列
  const socialPickerBlock = (targetPlatform: "threads" | "instagram") => (
    <div className="flex items-center gap-2 bg-slate-950/80 px-2 py-1 rounded-lg border border-slate-800 animate-in fade-in slide-in-from-top-1 duration-200">
      <SchedulePicker value={socialScheduleTime} onChange={setSocialScheduleTime} accentClass={theme.primaryBg} />
      <Button size="sm" variant="primary" loading={isSchedulingSocial} disabled={!socialScheduleTime} onClick={() => handleScheduleSocial(targetPlatform)}>
        {isSchedulingSocial ? "排程中..." : "確定"}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setShowSocialPicker(false)}>
        取消
      </Button>
    </div>
  );

  return (
    <BrandButtonProvider colors={brandButtonColors(theme)}>
    <div className="flex flex-col min-h-full space-y-4">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between bg-slate-900/40 p-3 rounded-xl border border-slate-800/60 gap-2 shrink-0">
        <div className="shrink-0">
          <h4 className="text-sm font-bold text-slate-200 whitespace-nowrap">社群行銷專家：Maya</h4>
          <p className="text-[10px] text-slate-400">產出高轉換貼文與社群文案規劃</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-850 min-w-0">
            {hasCopyForActions && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => window.dispatchEvent(new CustomEvent("ek-switch-tab", { detail: "theo" }))}
                  title="前往 Theo 分頁，進行 Meta 演算法與病毒分數分析"
                  icon={<AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
                >
                  流量分析（Theo）
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={isAdapting}
                  onClick={() => handleAdaptPlatform(false)}
                  title="將現有文案改寫並適配為當前選取的平台規格"
                  icon={<Zap className="w-3.5 h-3.5 text-amber-400" />}
                >
                  {isAdapting ? "正在轉化規格..." : `一鍵改寫為 ${platform === "threads" ? "Threads" : platform === "instagram" ? "Instagram" : "Facebook"} 規格`}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCopyCleanText}
                  title="複製純文案（已自動過濾圖表程式碼與圖片網址）"
                  icon={<Copy className={`w-3.5 h-3.5 ${theme.copyIconColor}`} />}
                >
                  複製貼文
                </Button>
              </>
            )}
            <Button size="sm" variant="ghost" active={mode === "preview"} onClick={() => setMode("preview")} icon={<Eye className="w-3.5 h-3.5" />}>
              預覽
            </Button>
            <Button size="sm" variant="ghost" active={mode === "edit"} onClick={() => setMode("edit")} icon={<Edit2 className="w-3.5 h-3.5" />}>
              編輯
            </Button>
          </div>
        </div>
      </div>

      {platform === "facebook" && hasCopyForActions && !copyIsPending && !copyFailureReason && (
        <QuickDerivatives brandId={pubBrandId} content={val} />
      )}

      {/* 📱 社群平台切換器 */}
      <div className="grid grid-cols-2 md:flex bg-slate-950/60 p-1 rounded-xl border border-slate-850 gap-1 select-none overflow-x-auto scrollbar-none shrink-0 backdrop-blur-md">
        {[
          { 
            id: "threads", 
            name: "Threads (脆)", 
            active: true, 
            desc: "500字限 | 禁連結 | 鉤子優先",
            icon: AtSign,
            activeClass: "bg-slate-900 border-slate-700 text-white shadow-lg shadow-black/40 border",
            hoverClass: "hover:bg-slate-900/40 text-slate-400 hover:text-slate-100"
          },
          { 
            id: "facebook", 
            name: "Facebook", 
            active: true, 
            desc: "無字限 | 長文說書 | 互動排版",
            icon: Facebook,
            activeClass: "bg-blue-600/10 border-blue-500/30 text-blue-400 shadow-md shadow-blue-500/5 border",
            hoverClass: "hover:bg-blue-900/10 text-slate-400 hover:text-blue-400"
          },
          { 
            id: "instagram", 
            name: "Instagram", 
            active: true, 
            desc: "2200字 | 豐富 Emojis | hashtags",
            icon: Instagram,
            activeClass: "bg-pink-500/10 border-pink-500/30 text-pink-400 shadow-md shadow-pink-500/5 border",
            hoverClass: "hover:bg-pink-900/10 text-slate-400 hover:text-pink-400"
          },
          { 
            id: "red", 
            name: "小紅書 (預留)", 
            active: false, 
            desc: "標題黨 | 閨蜜調性",
            icon: FileText,
            activeClass: "",
            hoverClass: ""
          },
          { 
            id: "tiktok", 
            name: "抖音腳本 (預留)", 
            active: false, 
            desc: "口播腳本 | 黃金3秒",
            icon: FileCode,
            activeClass: "",
            hoverClass: ""
          }
        ].map((plat) => {
          const isSelected = platform === plat.id;
          const PlatIcon = plat.icon;
          return (
            <button
              key={plat.id}
              disabled={!plat.active}
              onClick={() => handlePlatformChange(plat.id)}
              className={`flex-1 py-1.5 px-2.5 rounded-lg flex items-center gap-2.5 transition-all duration-300 ${
                !plat.active
                  ? "opacity-30 cursor-not-allowed text-slate-600 border border-transparent"
                  : isSelected
                  ? plat.activeClass
                  : `cursor-pointer ${plat.hoverClass} border border-transparent`
              }`}
            >
              <div className={`p-1 rounded-md shrink-0 ${isSelected && plat.active ? "bg-slate-950/50" : "bg-transparent"}`}>
                <PlatIcon className={`w-3.5 h-3.5 ${isSelected ? "animate-pulse" : ""}`} />
              </div>
              <div className="text-left flex-1 min-w-0">
                <span className="block text-[10px] font-bold tracking-wide">{plat.name}</span>
                <span className={`block text-[8px] scale-90 -translate-x-1 origin-left truncate ${isSelected ? "opacity-90 font-medium" : "text-slate-500 font-normal"}`}>{plat.desc}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* 發佈面板：內容跟著上方選取的平台切換，每個平台只顯示自己需要的操作 */}
      {hasCopyForActions && (platform === "threads" || platform === "facebook" || platform === "instagram") && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3 space-y-3 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="font-bold text-slate-200">
                發佈到 {platform === "threads" ? "Threads" : platform === "instagram" ? "Instagram" : "Facebook"}
              </span>
              <span className="px-2 py-0.5 rounded-md border border-slate-800 bg-slate-900 text-slate-400">
                約 {countChars(val)} 字{platform === "threads" ? " / 上限 500" : platform === "instagram" ? " / 上限 2200" : ""}
              </span>
              {genreMeta && genreIssues.some((i) => i.level === "block") && (
                <span className="px-2 py-0.5 rounded-md border border-rose-500/30 bg-rose-500/10 text-rose-300">
                  有 {genreIssues.filter((i) => i.level === "block").length} 項擋住發佈
                </span>
              )}
              {genreMeta && genreIssues.some((i) => i.level === "warn") && (
                <span className="px-2 py-0.5 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-300">
                  {genreIssues.filter((i) => i.level === "warn").length} 項提醒
                </span>
              )}
              {genreMeta && genreIssues.length === 0 && (
                <span className="px-2 py-0.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">檢查通過</span>
              )}
            </div>
            <Button
              size="sm"
              variant="secondary"
              loading={isPublishingWebsite}
              disabled={isPublishing || isPublishingSocial}
              onClick={() => handlePublishWebsite()}
              icon={<Network className="w-3.5 h-3.5" />}
              title="把這篇同步發布到官網"
              className="max-sm:min-h-11 max-sm:shrink-0"
            >
              {isPublishingWebsite ? "正在同步..." : "發布至官網"}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {platform === "facebook" && (
              <>
          {/* 🎯 目標 Facebook 粉絲專頁選擇器 (Target Facebook Fan Page Selector) */}
          {hasCopyForActions && (
            <div className="relative">
              <Button
                ref={pageSelectorBtnRef}
                variant="secondary"
                onClick={togglePageSelector}
                title="切換或多選發布目標 Facebook 粉絲專頁"
                icon={<Facebook className="w-3.5 h-3.5 text-blue-400" />}
              >
                <span className="text-slate-400 font-normal">目標粉專:</span>
                <span className="font-bold text-slate-100 flex items-center gap-1">
                  {selectedTargetPages.length === 1 ? (
                    getFacebookPageById(selectedTargetPages[0])?.badge || "FB 粉專"
                  ) : selectedTargetPages.length > 1 ? (
                    <span className="bg-blue-500/20 text-blue-300 px-1.5 rounded border border-blue-500/30">
                      {selectedTargetPages.length} 個粉專同步
                    </span>
                  ) : (
                    <span className="text-rose-400">未選擇</span>
                  )}
                </span>
                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${showPageSelector ? "rotate-180" : ""}`} />
              </Button>

              {/* 下拉選擇面板 */}
              {showPageSelector && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowPageSelector(false)} />
                  <div className={`absolute ${pageSelectorAlign === "right" ? "right-0" : "left-0"} mt-2 w-80 max-w-[calc(100vw-1rem)] bg-slate-950/95 border border-slate-800 rounded-xl shadow-2xl z-50 backdrop-blur-xl p-3 animate-in fade-in slide-in-from-top-2 duration-200`}>
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-850">
                      <div className="flex items-center gap-1.5">
                        <Facebook className="w-4 h-4 text-blue-400" />
                        <span className="text-xs font-bold text-slate-100">選擇發布 Facebook 粉絲專頁</span>
                      </div>
                      <span className="text-[9px] text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">可多選發布</span>
                    </div>

                    <div className="space-y-1.5 max-h-64 overflow-y-auto">
                      {FACEBOOK_PAGES.map((page) => {
                        const isChecked = selectedTargetPages.includes(page.id);
                        const isCurrentBrand = getDefaultFacebookPage(pubBrandId).id === page.id;
                        return (
                          <div
                            key={page.id}
                            onClick={() => {
                              setSelectedTargetPages((prev) => {
                                if (prev.includes(page.id)) {
                                  if (prev.length === 1) return prev; // 至少保留一個選擇
                                  return prev.filter((id) => id !== page.id);
                                } else {
                                  return [...prev, page.id];
                                }
                              });
                            }}
                            className={`flex items-start gap-2.5 p-2.5 rounded-lg border transition-all cursor-pointer ${
                              isChecked
                                ? `${page.activeBgClass} ${page.activeBorderClass}`
                                : "bg-slate-900/40 border-slate-800/80 hover:bg-slate-900 text-slate-400"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="mt-0.5 rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-0 cursor-pointer"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className={`text-xs font-bold ${isChecked ? "text-slate-100" : "text-slate-300"}`}>
                                  {page.name}
                                </span>
                                {isCurrentBrand && (
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-semibold">
                                    當前品牌
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400 truncate mt-0.5">{page.pageName}</p>
                              <p className="text-[9px] text-slate-500 truncate mt-0.5">{page.category}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* 快捷操作列 */}
                    <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-850 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setSelectedTargetPages(FACEBOOK_PAGES.map((p) => p.id))}
                        className="text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
                      >
                        全選所有粉專
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedTargetPages([getDefaultFacebookPage(pubBrandId).id])}
                        className="text-slate-400 hover:text-slate-200 font-semibold cursor-pointer"
                      >
                        僅選當前品牌
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowPageSelector(false)}
                        className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold cursor-pointer transition"
                      >
                        完成
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}


                {showDatePicker ? (
                  <div className="flex items-center gap-2 bg-slate-950/80 px-2 py-1 rounded-lg border border-slate-800 animate-in fade-in slide-in-from-top-1 duration-200">
                    <SchedulePicker
                      value={scheduleTime}
                      onChange={setScheduleTime}
                      accentClass={theme.primaryBg}
                      items={allQueueItems}
                    />
                    <Button size="sm" variant="primary" loading={isScheduling} disabled={!scheduleTime} onClick={() => { handleSchedule(scheduleTime); }}>
                      {isScheduling ? "排程中..." : "確定"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowDatePicker(false)}>取消</Button>
                  </div>
                ) : (
                  <>
                    <Button
                      variant={pubStatus === "success" ? "success" : pubStatus === "error" ? "danger" : "primary"}
                      loading={isPublishing}
                      disabled={isPublishingWebsite}
                      onClick={() => handlePublish("now")}
                      icon={pubStatus === "success" ? <Check className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                    >
                      {pubStatus === "success"
                        ? "已發布至 Meta"
                        : pubStatus === "error"
                        ? "發布失敗"
                        : selectedTargetPages.length === 1
                        ? `發布至 Meta (${getFacebookPageById(selectedTargetPages[0])?.badge || "粉專"})`
                        : `發布至 Meta (${selectedTargetPages.length} 粉專)`}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={isPublishingWebsite || isPublishing || isScheduling || !queueEnabled}
                      onClick={() => setShowDatePicker(true)}
                      title={
                        queueEnabled
                          ? "排程：現在先上架官網，時間到再自動發到勾選的粉專"
                          : "排程尚未啟用（等 n8n 排程執行器上線後開啟）"
                      }
                      icon={<Calendar className="w-3.5 h-3.5" />}
                    >
                      {queueEnabled ? "排程" : "排程（尚未啟用）"}
                    </Button>
                  </>
                )}
              </>
            )}

            {platform === "threads" && (
              showSocialPicker ? socialPickerBlock("threads") : (
                <>
                  <Button
                    variant="primary"
                    loading={isPublishingSocial}
                    disabled={isPublishingWebsite || isPublishing}
                    onClick={() => handlePublishThreads()}
                    icon={<AtSign className="w-3.5 h-3.5" />}
                  >
                    {isPublishingSocial ? "發布中，約 40 秒..." : "發布至 Threads"}
                  </Button>
                  <Button variant="secondary" disabled={isPublishingSocial} onClick={() => setShowSocialPicker(true)} icon={<Calendar className="w-3.5 h-3.5" />}>
                    排程
                  </Button>
                </>
              )
            )}

            {platform === "instagram" && (
              showSocialPicker ? socialPickerBlock("instagram") : (
                <>
                  <select value={imageEngine} onChange={(e) => setImageEngine(e.target.value as "openai" | "comfy")} disabled={isGeneratingImage} aria-label="配圖生成方式" className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-200">
                    <option value="openai">AI 情境圖（OpenAI，會花額度）</option>
                    <option value="comfy">本機 ComfyUI（免費，Mac mini 要開機）</option>
                  </select>
                  {imageEngine === "comfy" && (
                    <select value={imageSizeKey} onChange={(e) => setImageSizeKey(e.target.value)} disabled={isGeneratingImage} aria-label="配圖尺寸" className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-200">
                      {["ig_feed", "ig_grid34", "ig_square"].map((key) => <option key={key} value={key}>{(CARD_SIZES as Record<string, { label: string }>)[key].label}</option>)}
                    </select>
                  )}
                  <Button
                    variant="secondary"
                    loading={isGeneratingImage}
                    disabled={isPublishingSocial || !hasCopyForActions}
                    onClick={() => handleGenerateImage()}
                    icon={<Sparkles className="w-3.5 h-3.5" />}
                  >
                    {isGeneratingImage ? (imageEngine === "comfy" ? "本機生成中..." : "生成中，約 30 秒...") : igImageUrl ? "重新生成配圖" : "生成配圖"}
                  </Button>
                  <Button
                    variant="primary"
                    loading={isPublishingSocial}
                    disabled={!igImageUrl || isPublishingWebsite || isPublishing || isGeneratingImage}
                    onClick={() => handlePublishInstagram()}
                    icon={<Instagram className="w-3.5 h-3.5" />}
                  >
                    {isPublishingSocial ? "發布中，約 40 秒..." : "發布至 Instagram"}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={!igImageUrl || isPublishingSocial || isGeneratingImage}
                    onClick={() => setShowSocialPicker(true)}
                    icon={<Calendar className="w-3.5 h-3.5" />}
                  >
                    排程
                  </Button>
                  {comfyNote && <span className="text-[11px] text-amber-200/90">{comfyNote}</span>}
                  {!igImageUrl && <span className="text-[11px] text-slate-500">請先生成配圖並確認預覽，才能發布或排程</span>}
                </>
              )
            )}
          </div>
        </div>
      )}

      {platform === "instagram" && igImageUrl && (
        <div className="mb-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-[11px]">
          <div className="font-bold text-slate-200 mb-2">配圖預覽（發佈前請確認）</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={igImageUrl} alt="Instagram 配圖預覽" className="w-48 rounded-lg border border-slate-800" />
          {igImagePrompt && <p className="mt-2 text-slate-500 leading-relaxed">生成描述：{igImagePrompt}</p>}
          <p className="mt-1 text-slate-600">圖片是 AI 生成的情境圖，圖上沒有文字。不滿意可按「重新生成配圖」。</p>
        </div>
      )}

      {!hasCopyForActions && (
        <div role="alert" className="mb-3 rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-200">
          <p className="font-bold">{copyFailureReason ? "社群文案生成失敗" : copyIsPending ? "社群文案生成中" : "社群文案尚未生成"}</p>
          {copyFailureReason && <p className="mt-1 whitespace-pre-wrap">{copyFailureReason}</p>}
          {!copyIsPending && <p className="mt-1 text-red-200/80">請回到「對話」分頁重送指令，完成後再查看。</p>}
        </div>
      )}

      {genreMeta && (
        <div className="mb-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-[11px]">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-200">
              文體檢查｜{GENRES[genreMeta.genre]?.name}・{FUNNEL_LABEL[genreMeta.funnel]}
            </span>
            <span className="text-slate-500">提示詞版本 {genreMeta.prompt_version}</span>
          </div>
          {genreIssues.length === 0 ? (
            <div className="mt-1.5 text-emerald-300">✓ 自動檢查全部通過。最後請念出聲，像不像自己講話。</div>
          ) : (
            <ul className="mt-1.5 space-y-1">
              {genreIssues.map((i, idx) => (
                <li key={idx} className={i.level === "block" ? "text-red-300" : "text-amber-300"}>
                  {i.level === "block" ? "⛔ 擋住發佈：" : "⚠ 提醒："}{i.message}
                </li>
              ))}
              {genreIssues.every((i) => i.level === "warn") && (
                <li className="text-slate-400">只有提醒，不影響發佈。最後請念出聲，像不像自己講話。</li>
              )}
            </ul>
          )}
        </div>
      )}

      {activeStoryArgumentMeta?.thesis && (
        <div className="mb-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-[11px]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold text-amber-200">一句話論點（不併入發佈文案）</span>
            <span className="text-slate-500">{activeStoryArgumentMeta.version === "empathy" ? "共情版" : "完整版"}｜提示詞版本 {activeStoryArgumentMeta.prompt_version}{activeStoryArgumentMeta.model_version ? `｜模型 ${activeStoryArgumentMeta.model_version}` : ""}</span>
          </div>
          <p className="mt-1.5 whitespace-pre-wrap text-slate-200">{activeStoryArgumentMeta.thesis}</p>
          {activeStoryArgumentMeta.citation_title && (
            <p className="mt-2 text-slate-400">引用來源：{activeStoryArgumentMeta.citation_author || "【需補：中文作者名】"}，《{activeStoryArgumentMeta.citation_title}》</p>
          )}
          {activeStoryArgumentMeta.knowledge_note_id && activeStoryArgumentMeta.knowledge_content_md5 && (
            <p className="mt-1 break-all text-slate-500">筆記追溯：{activeStoryArgumentMeta.knowledge_note_id}｜內容 MD5 {activeStoryArgumentMeta.knowledge_content_md5}</p>
          )}
          {activeStoryArgumentMeta.citation_valid === false && (
            <p className="mt-1 text-amber-300">出處尚未通過驗證，發佈前需補齊引用來源。</p>
          )}
        </div>
      )}

      {mode === "edit" ? (
        <div className="flex-1 flex flex-col space-y-3">
          <textarea
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onBlur={handleSave}
            placeholder="在此輸入社群文案..."
            className={`flex-1 w-full p-4 min-h-[400px] rounded-xl bg-slate-950/60 border border-slate-850 ${theme.focusBorder} text-slate-200 text-sm focus:outline-none focus:ring-1 ${theme.primaryRing} font-mono resize-none`}
          />
          <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 py-0.5">
            <span>
              已輸入：<strong className={val.length > getPlatformLimit(platform) ? "text-rose-400 font-bold" : "text-slate-200"}>{val.length}</strong> 字 
              {getPlatformLimit(platform) !== Infinity && ` / 上限 ${getPlatformLimit(platform)} 字`}
            </span>
            {val.length > getPlatformLimit(platform) && (
              <span className="text-rose-400 font-bold flex items-center gap-0.5 animate-pulse">
                ⚠️ 已超過該平台限制字數！
              </span>
            )}
          </div>
          <button
            onClick={handleSave}
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-slate-100 rounded-lg text-xs font-bold transition cursor-pointer"
          >
            儲存變更
          </button>
        </div>
      ) : (
        hasCopyForActions ? (
          <div className="flex-1 p-5 rounded-xl bg-slate-950/20 border border-slate-850/40 overflow-y-auto min-h-[300px] flex items-center justify-center">
            {renderPlatformPreview(val)}
          </div>
        ) : (
          <div className="flex-1 p-8 rounded-2xl bg-slate-950/30 border border-slate-850/80 backdrop-blur-md overflow-y-auto min-h-[350px] flex flex-col items-center justify-center text-center relative overflow-hidden transition-all duration-300">
            {/* Ambient glowing circle */}
            <div className={`absolute -top-12 w-48 h-48 bg-gradient-to-tr ${theme.gradientFromTo} opacity-5 rounded-full filter blur-2xl select-none pointer-events-none`} />
            
            <div className={`p-4 rounded-full bg-slate-900 border border-slate-800 shadow-xl ${theme.glowShadow} mb-4 relative`}>
              <FileText className={`w-8 h-8 ${theme.primaryColor} animate-pulse`} />
            </div>
            
            <div className="z-10">
              <p className="text-sm font-bold text-slate-200 tracking-wide">
                目前尚未生成 {platform === "threads" ? "Threads" : platform === "instagram" ? "Instagram" : "Facebook"} 規格文案
              </p>
              <p className="text-xs text-slate-400 max-w-sm mt-1 mb-4 leading-relaxed">
                您可以透過左側與 Maya 進行對話創作，或直接選擇下方快捷選項一鍵產出。
              </p>
            </div>
            
            {hasCopyOnOtherPlatform ? (
              <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full max-w-md justify-center z-10">
                <button
                  disabled={isAdapting}
                  onClick={() => handleAdaptPlatform(true)}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-850 text-slate-350 border border-slate-800 hover:border-slate-700 cursor-pointer flex items-center justify-center gap-1.5 transition-all"
                  title="無視其他平台的文案，直接從關鍵字庫生成全新的貼文"
                >
                  <Sparkles className="w-3.5 h-3.5 text-slate-400" />
                  生成全新 {platform === "threads" ? "Threads" : platform === "instagram" ? "Instagram" : "Facebook"} 文案
                </button>
                <button
                  disabled={isAdapting}
                  onClick={() => handleAdaptPlatform(false)}
                  className={`w-full sm:w-auto px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${theme.primaryBg} ${theme.primaryBgHover} ${theme.primaryBtnText}`}
                  title={`根據已生成的 ${getOtherPlatformName()} 文案改寫為適合 ${platform === "threads" ? "Threads" : platform === "instagram" ? "Instagram" : "Facebook"} 規格的文案`}
                >
                  {isAdapting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Zap className="w-3.5 h-3.5 fill-current" />
                  )}
                  根據已生成文案二次加工 (改寫)
                </button>
              </div>
            ) : (
              <button
                disabled={isAdapting}
                onClick={() => handleAdaptPlatform(true)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 z-10 ${theme.primaryBg} ${theme.primaryBgHover} ${theme.primaryBtnText}`}
              >
                {isAdapting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 fill-current" />
                )}
                一鍵生成 {platform === "threads" ? "Threads" : platform === "instagram" ? "Instagram" : "Facebook"} 文案
              </button>
            )}
          </div>
        )
      )}

      {activeStoryArgumentMeta?.version === "full" && (
        <section className="rounded-xl border-2 border-indigo-400/50 bg-indigo-500/10 p-4 shadow-lg shadow-indigo-950/20 ring-1 ring-indigo-400/15 space-y-3">
          <div>
            <h3 className="text-xs font-bold text-indigo-200">重新挑選引用</h3>
            <p className="mt-1 text-[10px] leading-relaxed text-slate-400">用你自己的話寫這篇想表達的重點，系統會依此重新從知識庫挑選。這欄只用於本次生成，不會併入文章或儲存。</p>
          </div>
          <textarea
            value={storyReselectIdea}
            onChange={(event) => setStoryReselectIdea(event.target.value)}
            placeholder="我的想法（可留空）"
            rows={3}
            className="w-full rounded-lg border border-slate-700 bg-slate-950/70 p-3 text-xs text-slate-200 placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => { setStoryReselectMode("auto"); setStoryReselectError(""); }}
              className={`rounded-lg border px-3 py-2 text-[10px] font-bold transition ${storyReselectMode === "auto" ? "border-indigo-400 bg-indigo-500/20 text-indigo-100" : "border-slate-700 bg-slate-900/60 text-slate-400"}`}
            >自動重選（避開剛才用過的筆記）</button>
            <button
              type="button"
              onClick={() => { setStoryReselectMode("candidate"); void loadStoryArgumentCandidates(); }}
              className={`rounded-lg border px-3 py-2 text-[10px] font-bold transition ${storyReselectMode === "candidate" ? "border-indigo-400 bg-indigo-500/20 text-indigo-100" : "border-slate-700 bg-slate-900/60 text-slate-400"}`}
            >列出候選讓我選</button>
          </div>
          {storyReselectMode === "candidate" && (
            <div className="space-y-2">
              <button type="button" onClick={() => void loadStoryArgumentCandidates()} disabled={isLoadingStoryCandidates} className="text-[10px] text-indigo-300 hover:text-indigo-200 disabled:opacity-50">
                {isLoadingStoryCandidates ? "正在讀取候選…" : "重新整理候選"}
              </button>
              {storyCandidates.map((candidate) => (
                <button
                  type="button"
                  key={candidate.id}
                  onClick={() => setSelectedStoryCandidateId(candidate.id)}
                  disabled={!candidate.selectable}
                  className={`block w-full rounded-lg border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${selectedStoryCandidateId === candidate.id ? "border-indigo-400 bg-indigo-500/10" : candidate.selectable ? "border-slate-800 bg-slate-950/50 hover:border-slate-600" : "border-slate-800 bg-slate-950/30 grayscale"}`}
                >
                  <span className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-200">
                    <span>{candidate.title_zh ? `《${candidate.title_zh}》` : "中文書名待確認"}</span><span className="text-slate-400">作者：{candidate.author_zh || "中文作者待確認"}</span>
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-400">{candidate.domain}{candidate.subdomain ? `／${candidate.subdomain}` : ""}</span>
                    {!candidate.selectable && <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-500">中文資料待確認</span>}
                    {usedStoryNoteIds.current.has(candidate.id) && <span className="text-amber-300">剛才用過，仍可明確選取</span>}
                  </span>
                  {candidate.selectable && <span className="mt-1 block text-[10px] leading-relaxed text-slate-400">筆記摘句：{candidate.highlight}</span>}
                </button>
              ))}
              {!isLoadingStoryCandidates && storyCandidates.length === 0 && <p className="text-[10px] text-slate-500">目前沒有可顯示的候選筆記。</p>}
            </div>
          )}
          <label className="flex items-center gap-2 text-[10px] text-slate-300">
            <input type="checkbox" checked={storyReselectFull} onChange={(event) => setStoryReselectFull(event.target.checked)} />
            全文重寫（未勾選時只替換論點支持段與出處，其他段落原樣保留）
          </label>
          {storyReselectMessage && <p className="text-[10px] text-emerald-300">{storyReselectMessage}</p>}
          {storyReselectError && <p role="alert" className="text-[10px] text-rose-300">{storyReselectError}</p>}
          {activeStoryArgumentMeta.citation_error === "no_matching_note" && (
            <p className="text-[10px] text-amber-300">知識庫找不到支持這個想法的筆記。</p>
          )}
          {activeStoryArgumentMeta.citation_error === "selection_failed" && (
            <p className="text-[10px] text-amber-300">知識庫選取暫時失敗，請重試。</p>
          )}
          <button
            type="button"
            disabled={isReselectingStoryCitation || !val.trim()}
            onClick={() => void reselectStoryArgumentCitation()}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-[10px] font-bold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isReselectingStoryCitation && <Loader2 className="h-3 w-3 animate-spin" />}
            {isReselectingStoryCitation ? "重新挑選並生成中…" : "重新挑選並生成"}
          </button>
        </section>
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

      {/* 📅 排程清單 (publish_queue) */}
      <PublishQueuePanel
        items={queueItems}
        enabled={queueEnabled}
        error={queueError}
        isLoading={isLoadingQueue}
        onRefresh={fetchQueue}
        onCancel={handleCancelQueue}
      />

      {/* 📅 Threads / Instagram 排程清單 (social_publish_queue) */}
      <SocialQueuePanel brandId={pubBrandId} refreshKey={socialQueueTick} />
    </div>
    </BrandButtonProvider>
  );
});

// ==================== 2. 網頁架構分頁 (Leon) ====================
const TheoTabContent = memo(function TheoTabContent({
  brandId,
  socialCopy,
  theoAnalysis,
  aiProvider,
  activePlatform,
  healthBusy
}: {
  brandId: string;
  socialCopy: string;
  theoAnalysis?: TheoAnalysis;
  aiProvider: string;
  activePlatform?: string;
  healthBusy?: boolean;
}) {
  const [manualAnalyzing, setIsAnalyzing] = useState(false);
  const isAnalyzing = manualAnalyzing || !!healthBusy;
  const theoStale = !!theoAnalysis && theoAnalysis.for_hash !== undefined && theoAnalysis.for_hash !== textHash(socialCopy);
  const platform = activePlatform || "threads";
  const platformLabel = platform === "facebook" ? "Facebook" : platform === "instagram" ? "Instagram" : "Threads";
  const hasCopy = !!socialCopy && socialCopy.trim() !== "" && !socialCopy.startsWith("⏳") && !socialCopy.startsWith("❌");

  const handleAnalyzeViral = async () => {
    if (isAnalyzing || !hasCopy) return;
    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/theo/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: socialCopy,
          brandName: getBrandOrProjectName(brandId),
          aiProvider,
          platform
        })
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "流量預測分析失敗");
      }
      const resData = await res.json();
      if (resData.success && resData.data) {
        await saveWorkspace(brandId, { theo_analysis: { ...resData.data, for_hash: textHash(socialCopy) } });
      }
    } catch (error: any) {
      console.error("Theo analysis error:", error);
      alert(`❌ 流量預測檢測失敗：${error.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApplyRewrite = async (original: string, rewrite: string) => {
    if (!socialCopy.includes(original)) {
      alert("⚠️ 無法在文案中找到一模一樣的原句，可能您已手動編輯過。請重新檢測！");
      return;
    }
    const newVal = socialCopy.replace(original, rewrite);
    const updatedAnalysis = theoAnalysis
      ? { ...theoAnalysis, reach_killers: theoAnalysis.reach_killers.filter((k) => k.original_sentence !== original), for_hash: textHash(newVal) }
      : undefined;
    await saveWorkspace(brandId, {
      social_copy: newVal,
      ...(updatedAnalysis ? { theo_analysis: updatedAnalysis } : {})
    });
  };

  return (
    <div className="space-y-4">
      <div className="bg-slate-900/20 border border-slate-800/80 p-4 rounded-xl space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-100">流量預測專家：Theo</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              檢查目前「{platformLabel}」文案會不會被演算法壓流量，並給出可一鍵套用的改寫。分數是 AI 判斷，不是真實流量預測。
            </p>
          </div>
          <Button
            variant="primary"
            loading={isAnalyzing}
            disabled={!hasCopy}
            onClick={handleAnalyzeViral}
            icon={<Activity className="w-3.5 h-3.5" />}
            className="shrink-0"
          >
            {isAnalyzing ? "分析中..." : theoAnalysis ? "重新分析" : "開始分析"}
          </Button>
        </div>
        <AutoHealthToggle />
        {theoStale && !isAnalyzing && (
          <div className="text-[11px] text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
            文案在分析後又被修改過，這份分析已過期。{aiProvider === "mock" ? "按「重新分析」更新。" : "自動健檢開啟時會自動更新，也可以按「重新分析」。"}
          </div>
        )}
        {hasCopy ? (
          <p className="text-[11px] text-slate-300 bg-slate-950/50 border border-slate-850 rounded-lg p-3 whitespace-pre-wrap line-clamp-6">
            {socialCopy}
          </p>
        ) : (
          <p className="text-[11px] text-slate-500 italic">
            目前「{platformLabel}」還沒有文案。請先到「社群文案」分頁由 Maya 產出。
          </p>
        )}
      </div>

            {(isAnalyzing || theoAnalysis) && (
        <div className="bg-slate-900/20 border border-amber-500/25 p-4 rounded-xl space-y-4 backdrop-blur-md relative overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
          {/* Decorative background glow */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full filter blur-xl -mr-6 -mt-6 select-none pointer-events-none" />
          
          <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-base">🦠</span>
              <div>
                <h4 className="text-xs font-bold text-slate-200">軍師 Theo 演算法流量分析</h4>
                <p className="text-[9px] text-slate-500 uppercase tracking-widest font-semibold mt-0.5">Meta Algorithm Viral Index Audit</p>
              </div>
            </div>
            {theoAnalysis && !isAnalyzing && (
              <span className="text-[9px] text-slate-500 font-semibold bg-slate-950 px-2 py-0.5 rounded border border-slate-850">
                分析時間: {new Date(theoAnalysis.analyzed_at).toLocaleTimeString()}
              </span>
            )}
          </div>

          {isAnalyzing ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-3">
              <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
              <div className="text-center space-y-1">
                <p className="text-xs font-bold text-slate-200 animate-pulse">Theo 正在逆向演算法與稽核文案中...</p>
                <p className="text-[10px] text-slate-500">正在評估首句 Hook、導流外連限制與商業 Spam 降權機制</p>
              </div>
            </div>
          ) : theoAnalysis ? (
            <div className="space-y-4">
              {/* Viral Score & Explanation */}
              <div className="flex flex-col sm:flex-row items-stretch gap-4 p-3 bg-slate-950/60 border border-slate-850 rounded-lg">
                {/* Score badge */}
                <div className={`flex flex-col items-center justify-center px-4 py-3 rounded-lg border min-w-[85px] shrink-0 ${
                  theoAnalysis.viral_score >= 80 
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-sm shadow-emerald-500/5"
                    : theoAnalysis.viral_score >= 50
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-sm shadow-amber-500/5"
                    : "bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-sm shadow-rose-500/5"
                }`}>
                  <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">病毒指數</span>
                  <span className="text-3xl font-black mt-1 tracking-tight">{theoAnalysis.viral_score}</span>
                  <span className="text-[8px] text-slate-400 font-semibold mt-0.5">/ 100</span>
                </div>

                {/* Explanation text */}
                <div className="flex-1 flex flex-col justify-center">
                  <div className="flex items-center gap-1.5 mb-1">
                    <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[10px] text-slate-400 font-bold">演算法評估診斷：</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-semibold">
                    {theoAnalysis.explanation}
                  </p>
                </div>
              </div>

              {/* Reach Killers */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                  <span className="text-xs font-bold text-slate-200">🔍 殺觸及檢測與爆款優化建議</span>
                </div>

                {theoAnalysis.reach_killers.length === 0 ? (
                  <div className="p-4 bg-emerald-500/5 border border-emerald-500/15 rounded-lg text-center flex flex-col items-center justify-center space-y-1">
                    <span className="text-base">🎉</span>
                    <p className="text-xs font-bold text-emerald-400">恭喜！文案完美契合 Meta 自然傳播演算法</p>
                    <p className="text-[9px] text-slate-500">未檢測到包含直白導流外連或商業降權詞彙。</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {theoAnalysis.reach_killers.map((item, index) => (
                      <div key={index} className="p-3 bg-slate-900/40 border border-slate-800/80 rounded-lg space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[9px] font-bold">
                          <span className="flex items-center gap-1 text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded uppercase">
                            ⚠️ 流量卡點 ({item.improvement_type})
                          </span>
                          <span className="text-slate-500">扣分原因: {item.reason}</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          {/* Original line */}
                          <div className="p-2.5 rounded bg-rose-500/5 border border-rose-500/10 text-rose-300 line-through decoration-rose-500/40 select-all">
                            {item.original_sentence}
                          </div>
                          
                          {/* Rewrite line */}
                          <div className="p-2.5 rounded bg-emerald-500/5 border border-emerald-500/15 text-emerald-400 flex flex-col justify-between select-all">
                            <div className="leading-relaxed">{item.viral_rewrite}</div>
                            <div className="flex justify-end mt-2.5">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleApplyRewrite(item.original_sentence, item.viral_rewrite)}
                                icon={<Zap className="w-2.5 h-2.5 fill-current" />}
                                title="直接將編輯區內文對應的原句替換為此優化版"
                              >
                                套用改寫
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}

    </div>
  );
});

const ArchitectureTabContent = memo(function ArchitectureTabContent({
  brandId,
  architecture,
  socialCopy,
  seoKeywords,
  aiProvider,
}: {
  brandId: string;
  architecture: string;
  socialCopy: string;
  seoKeywords: SEOKeyword[];
  aiProvider: string;
}) {
  const theme = useBrandTheme(brandId);
  const [val, setVal] = useState(architecture);
  const [isEditing, setIsEditing] = useState(false);
  const [viewMode, setViewMode] = useState<"preview" | "code">("preview");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const generationControllerRef = useRef<AbortController | null>(null);
  const generationStartedAtRef = useRef(0);
  const fullscreenButtonRef = useRef<HTMLButtonElement>(null);
  const fullscreenCloseButtonRef = useRef<HTMLButtonElement>(null);
  const fullscreenIframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const closeFullscreenPreview = useCallback(() => {
    setIsFullscreenOpen(false);
    window.requestAnimationFrame(() => fullscreenButtonRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!isFullscreenOpen || !isMounted) return;

    const scrollY = window.scrollY;
    const bodyStyles = {
      position: document.body.style.position,
      top: document.body.style.top,
      left: document.body.style.left,
      right: document.body.style.right,
      width: document.body.style.width,
      overflow: document.body.style.overflow,
    };
    const rootOverscrollBehavior = document.documentElement.style.overscrollBehavior;

    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "none";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeFullscreenPreview();
    };
    const handleFrameMessage = (event: MessageEvent) => {
      if (event.source !== fullscreenIframeRef.current?.contentWindow) return;
      if (event.data?.type === "ek:fullscreen-preview-escape") closeFullscreenPreview();
    };
    const handleResize = () => {
      if (window.matchMedia("(min-width: 640px)").matches) closeFullscreenPreview();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("message", handleFrameMessage);
    window.addEventListener("resize", handleResize);
    fullscreenCloseButtonRef.current?.focus();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("message", handleFrameMessage);
      window.removeEventListener("resize", handleResize);
      document.body.style.position = bodyStyles.position;
      document.body.style.top = bodyStyles.top;
      document.body.style.left = bodyStyles.left;
      document.body.style.right = bodyStyles.right;
      document.body.style.width = bodyStyles.width;
      document.body.style.overflow = bodyStyles.overflow;
      document.documentElement.style.overscrollBehavior = rootOverscrollBehavior;
      window.scrollTo(0, scrollY);
    };
  }, [isFullscreenOpen, isMounted, closeFullscreenPreview]);

  useEffect(() => {
    setVal(architecture);
  }, [architecture]);

  useEffect(() => {
    if (!isGenerating) return;
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - generationStartedAtRef.current) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isGenerating]);

  const trimmedArchitecture = val.trim();
  const storedArchitectureError = trimmedArchitecture.startsWith("❌") ? trimmedArchitecture.replace(/^❌\s*/, "") : "";
  const architectureError = generationError || storedArchitectureError;
  const isArchitecturePending = trimmedArchitecture.startsWith("⏳");
  const hasArchitecture = !!trimmedArchitecture && !storedArchitectureError && !isArchitecturePending && !trimmedArchitecture.startsWith("⚠️");
  const canGenerate = hasUsableSocialCopy(socialCopy);

  const generateArchitecture = useCallback(async (isRetry = false) => {
    if (isGenerating || !canGenerate) return;
    if (hasArchitecture && !isRetry && !window.confirm("重新生成會取代目前的網頁架構。確定嗎？")) return;

    const controller = new AbortController();
    generationControllerRef.current = controller;
    generationStartedAtRef.current = Date.now();
    setElapsedSeconds(0);
    setGenerationError("");
    setIsGenerating(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          stage: "expert",
          expertType: "leon",
          history: [],
          brandName: getBrandOrProjectName(brandId),
          brandGuidelines: getMergedBrandGuidelines(brandId),
          aiProvider,
          subPrompts: { leon: "請依提供的社群文案，製作精簡且主題一致的 Landing Page 預覽。" },
          prevData: {
            social_copy: socialCopy.slice(0, 3000),
            seo_keywords: seoKeywords,
          },
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error || `HTTP ${response.status}`);
      const html = result?.dispatchData?.web_architecture;
      if (typeof html !== "string" || !html.trim()) throw new Error("Leon 沒有回傳可用的網頁內容，請再試一次。");
      setVal(html);
      setViewMode("preview");
      setIsEditing(false);
      saveWorkspace(brandId, { web_architecture: html });
      setGenerationError("");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      const message = error instanceof Error ? error.message : "未知錯誤";
      setGenerationError(message);
    } finally {
      generationControllerRef.current = null;
      setIsGenerating(false);
    }
  }, [aiProvider, brandId, canGenerate, hasArchitecture, isGenerating, seoKeywords, socialCopy]);

  const cancelArchitectureGeneration = useCallback(() => {
    generationControllerRef.current?.abort();
    generationControllerRef.current = null;
    setIsGenerating(false);
  }, []);

  const handleSave = () => {
    saveWorkspace(brandId, { web_architecture: val });
    setIsEditing(false);
  };

  const isHtml = useMemo(
    () => val.trim().startsWith("<") || val.includes("</div>") || val.includes("class="),
    [val]
  );

  // 解析縮排層級並渲染成視覺化網站樹狀結構 (Tree View)
  const renderTreeView = useCallback((treeText: string) => {
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
  }, [theme]);

  // 樹狀圖只依賴文字內容與配色，快取避免每次 render 重跑整份縮排解析
  const treeView = useMemo(() => renderTreeView(val), [val, renderTreeView]);

  // 生成 Iframe 渲染的 srcDoc（只依賴 val，快取避免每次 render 重建整份 HTML 字串）
  const iframeSrcDoc = useMemo(() => {
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

            @media (max-width: 639px) {
              html, body {
                min-height: 100%;
                overflow-x: hidden;
                overscroll-behavior: contain;
              }

              [data-aos], [data-reveal], [class*="reveal"], [class*="scroll-reveal"],
              [class*="fade-in"], [class*="fade-up"], [class~="opacity-0"],
              [style*="opacity: 0"], [style*="opacity:0"] {
                opacity: 1 !important;
                visibility: visible !important;
                transform: none !important;
              }
            }
          </style>
          <script>
            document.addEventListener("keydown", (event) => {
              if (event.key === "Escape") {
                window.parent.postMessage({ type: "ek:fullscreen-preview-escape" }, "*");
              }
            }, true);
          </script>
        </head>
        <body class="bg-slate-900 text-slate-100 min-h-screen">
          ${val}
        </body>
      </html>
    `;
  }, [val]);

  return (
    <div className="flex flex-col min-h-full space-y-4">
      <div className="flex justify-between items-center max-sm:flex-wrap max-sm:gap-2 bg-slate-900/40 p-3 rounded-xl border border-slate-800/60 shrink-0">
        <div>
          <h4 className="text-sm font-bold text-slate-200">系統架構師：Leon</h4>
          <p className="text-[10px] text-slate-400">網頁與功能路由層次結構規劃</p>
        </div>

        <div className="flex items-center gap-3 max-sm:w-full max-sm:flex-wrap max-sm:justify-end max-sm:gap-2">
          {hasArchitecture && isHtml && !isEditing && (
            <div className="flex p-0.5 bg-slate-950/60 border border-slate-850 rounded-lg">
              <Button variant="ghost" size="sm" active={viewMode === "preview"} onClick={() => setViewMode("preview")}>
                預覽頁面
              </Button>
              <Button variant="ghost" size="sm" active={viewMode === "code"} onClick={() => setViewMode("code")}>
                HTML 原始碼
              </Button>
            </div>
          )}

          {hasArchitecture && isHtml && !isEditing && viewMode === "preview" && (
            <button
              ref={fullscreenButtonRef}
              type="button"
              onClick={() => setIsFullscreenOpen(true)}
              className="hidden max-sm:inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/80 px-3 text-xs font-bold text-slate-200"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              全螢幕
            </button>
          )}

          {hasArchitecture && (
            <>
              <Button
                variant={isEditing ? "primary" : "secondary"}
                size="sm"
                onClick={() => {
                  if (isEditing) handleSave();
                  else setIsEditing(true);
                }}
                icon={isEditing ? <Check className="w-3 h-3" /> : <Edit2 className="w-3 h-3" />}
              >
                {isEditing ? "儲存" : "編輯結構"}
              </Button>
              {!isEditing && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!canGenerate || isGenerating}
                  loading={isGenerating}
                  onClick={() => generateArchitecture()}
                  icon={<RefreshCw className="w-3 h-3" />}
                >
                  重新生成
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {isGenerating && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-100" role="status">
          <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Leon 正在生成網頁架構，已經過 {elapsedSeconds} 秒</span>
          <Button variant="secondary" size="sm" onClick={cancelArchitectureGeneration}>取消</Button>
        </div>
      )}

      {hasArchitecture && architectureError && !isGenerating && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-200">
          <span><strong>重新生成失敗：</strong>{architectureError}</span>
          <Button className="min-h-11" variant="secondary" disabled={!canGenerate} onClick={() => generateArchitecture(true)} icon={<RefreshCw className="h-4 w-4" />}>
            重試
          </Button>
        </div>
      )}

      {!hasArchitecture && !isGenerating && (
        <div className="flex min-h-[350px] flex-1 flex-col items-center justify-center rounded-2xl border border-slate-800/80 bg-slate-950/30 p-6 text-center">
          {architectureError ? (
            <>
              <p className="text-sm font-bold text-red-300">網頁架構生成失敗</p>
              <p className="mt-2 max-w-xl whitespace-pre-wrap text-sm text-red-200">{architectureError}</p>
              <Button className="mt-4 min-h-11" variant="primary" disabled={!canGenerate} onClick={() => generateArchitecture(true)} icon={<RefreshCw className="h-4 w-4" />}>
                重試
              </Button>
            </>
          ) : isArchitecturePending ? (
            <p className="text-sm text-slate-400">網頁架構尚未完成，請稍後再試。</p>
          ) : (
            <>
              <p className="text-sm font-bold text-slate-200">尚未生成網頁架構</p>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">會依目前這篇社群文案產生一份 Landing Page 預覽，需要時再生成。</p>
              <Button className="mt-4 min-h-11" variant="primary" disabled={!canGenerate || isGenerating} onClick={() => generateArchitecture()} icon={<Sparkles className="h-4 w-4" />}>
                生成網頁架構
              </Button>
              {!canGenerate && <p className="mt-2 text-sm text-amber-300">請先生成社群文案</p>}
            </>
          )}
        </div>
      )}

      {hasArchitecture && !canGenerate && <p className="-mt-2 text-sm text-amber-300">請先生成社群文案，才能重新生成網頁架構。</p>}

      {hasArchitecture && (isEditing ? (
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
              <div className="flex-1 bg-slate-950/40 border border-slate-850/65 rounded-xl overflow-hidden p-1 max-sm:flex-none max-sm:h-[60dvh] max-sm:min-h-[60dvh]">
                <iframe
                  srcDoc={iframeSrcDoc}
                  title="Landing Page Preview"
                  className="w-full h-full border-0 rounded-lg max-sm:flex-none max-sm:h-[calc(60dvh-10px)]"
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
              {treeView}
            </div>
          )}
        </div>
      ))}

      {isFullscreenOpen && isMounted && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="網頁架構全螢幕預覽"
          className="fixed inset-0 z-[80] flex h-[100dvh] w-full flex-col bg-slate-950 sm:hidden"
        >
          <div className="flex min-h-14 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900 px-3 pt-safe">
            <h2 className="text-sm font-bold text-slate-100">網頁架構預覽</h2>
            <button
              ref={fullscreenCloseButtonRef}
              type="button"
              onClick={closeFullscreenPreview}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 px-4 text-sm font-bold text-slate-100"
            >
              關閉
            </button>
          </div>
          <iframe
            ref={fullscreenIframeRef}
            srcDoc={iframeSrcDoc}
            title="Landing Page Preview 全螢幕"
            className="min-h-0 w-full flex-1 border-0 bg-slate-950"
            sandbox="allow-scripts"
          />
        </div>,
        document.body
      )}
    </div>
  );
});

// ==================== 3-1. 文章優化器（SEO / AEO / GEO） ====================
/** 官網文章當初是用哪個平台分頁的貼文產生的，取出那個分頁「現在」的內容，用來判斷官網文章是否過期 */
function pickWebSourceCopy(data: any): string {
  const p: string | undefined = data?.web_article_meta?.from_platform;
  const byPlatform: Record<string, string | undefined> = {
    threads: data?.social_copy_threads,
    facebook: data?.social_copy_facebook,
    instagram: data?.social_copy_instagram,
  };
  return (p && byPlatform[p] !== undefined ? byPlatform[p] : data?.social_copy) || "";
}

const SCORE_LABEL: Record<string, string> = { seo: "SEO 搜尋", aeo: "AEO 回答引擎", geo: "GEO AI 搜尋" };

// ==================== 自動健檢（只評分不改寫） ====================
const AutoHealthToggle = memo(function AutoHealthToggle() {
  const [enabled, setEnabled] = useAutoHealthSetting();
  return (
    <label className="flex items-center gap-2 text-[10px] text-slate-400 cursor-pointer select-none w-fit">
      <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="accent-emerald-500" />
      自動健檢：內容產生或修改後自動評分一次（只評分、不改寫）。Theo 觸及分析在用本地模擬大腦時不會自動跑
    </label>
  );
});

const SeoHealthCard = memo(function SeoHealthCard({
  brandId,
  webArticle,
  keywords,
  aiProvider,
  seoScore,
  healthBusy,
  aeoFaq,
  aeoSchema
}: {
  brandId: string;
  webArticle: string;
  keywords: SEOKeyword[];
  aiProvider: string;
  seoScore?: SeoScore;
  healthBusy: boolean;
  aeoFaq?: string;
  aeoSchema?: string;
}) {
  const [manual, setManual] = useState(false);
  const [err, setErr] = useState("");
  const busy = manual || healthBusy;
  const hash = healthHash(webArticle, aeoFaq, aeoSchema);
  const stale = !!seoScore && isScoreStale(seoScore, hash);

  const runNow = async () => {
    if (busy) return;
    setManual(true);
    setErr("");
    try {
      const res = await fetch("/api/seo/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: webArticle, brandName: getBrandOrProjectName(brandId), keywords, faqText: aeoFaq || "", schemaText: aeoSchema || "" })
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "評分失敗");
      await saveWorkspace(brandId, { seo_score: json.data });
    } catch (e: any) {
      setErr(e.message || "評分失敗");
    } finally {
      setManual(false);
    }
  };

  const color = (n: number) => (n >= 80 ? "text-emerald-400" : n >= 60 ? "text-amber-400" : "text-rose-400");

  return (
    <div className="bg-slate-950/40 border border-slate-850 rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-bold text-slate-200">
          自動健檢{seoScore ? `（${new Date(seoScore.at).toLocaleTimeString()}）` : ""}
          <span className="font-normal text-slate-500">　程式規則計分，不用 AI，同一篇每次結果一樣，沒有改寫你的文章</span>
        </div>
        <Button variant="primary" onClick={runNow} loading={busy} className="shrink-0">
          {busy ? "評分中..." : seoScore ? "重新評分" : "立即評分"}
        </Button>
      </div>
      <AutoHealthToggle />
      {err && <div className="text-[11px] text-rose-300">{err}</div>}
      {stale && !busy && (
        <div className="text-[11px] text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
          官網文章在評分後被修改過，這份分數已過期。
        </div>
      )}
      {!seoScore && !busy && (
        <p className="text-[11px] text-slate-500 italic">還沒有評分。自動健檢開啟時，文章產生後幾秒內會自動評分。</p>
      )}
      {seoScore && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {(["seo", "aeo", "geo"] as const).map((k) => (
              <div key={k} className={`bg-slate-950/50 border border-slate-850 rounded-lg p-2 text-center ${stale ? "opacity-50" : ""}`}>
                <div className={`text-xl font-black ${color(seoScore.scores[k])}`}>{seoScore.scores[k]}</div>
                <div className="text-[10px] text-slate-400">{SCORE_LABEL[k]}</div>
              </div>
            ))}
          </div>
          {seoScore.top_issues.length > 0 && (
            <div className="space-y-0.5">
              <div className="text-[11px] font-bold text-slate-300">建議先處理</div>
              {seoScore.top_issues.map((t, i) => (
                <div key={i} className="text-[11px] text-slate-400">{i + 1}. {t}</div>
              ))}
            </div>
          )}
          {seoScore.checks.length > 0 && (
            <details className="text-[11px]">
              <summary className="text-slate-400 cursor-pointer">檢查項目明細（{seoScore.checks.length}）</summary>
              <div className="space-y-1 mt-1.5">
                {seoScore.checks.map((c, i) => (
                  <div key={i} className="flex gap-2 bg-slate-950/30 border border-slate-850 rounded-lg px-3 py-1.5">
                    <span className={c.status === "ok" ? "text-emerald-400" : "text-amber-400"}>{c.status === "ok" ? "✓" : "!"}</span>
                    <span className="text-slate-500 shrink-0 w-10">{c.area.toUpperCase()}</span>
                    <span className="text-slate-200 font-semibold shrink-0">{c.item}</span>
                    <span className="text-slate-400">{c.note}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
          <p className="text-[9px] text-slate-500">
            分數是「寫法有沒有符合搜尋與 AI 引用的結構規則」，不是排名預測；真實成效要看 Search Console。想要改寫版本，按下方「開始優化」，由你決定要不要套用。
          </p>
        </>
      )}
    </div>
  );
});

const SeoOptimizerPanel = memo(function SeoOptimizerPanel({
  brandId,
  webArticle,
  webArticleMeta,
  keywords,
  aiProvider,
  seoScore,
  healthBusy,
  aeoFaq,
  aeoSchema
}: {
  brandId: string;
  webArticle: string;
  webArticleMeta?: WebArticleMeta;
  keywords: SEOKeyword[];
  aiProvider: string;
  seoScore?: SeoScore;
  healthBusy?: boolean;
  aeoFaq?: string;
  aeoSchema?: string;
}) {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<(SeoOptimization & { forContent: string }) | null>(null);
  const [showFull, setShowFull] = useState(false);
  const [applied, setApplied] = useState<"" | "all" | "faq">("");

  const hasCopy = hasWebArticle(webArticle);
  const effectiveBrand = resolveEffectiveBrandId(brandId) || brandId;
  const stale = !!result && result.forContent !== webArticle && applied === "";

  const run = async () => {
    if (isRunning || !hasCopy) return;
    setIsRunning(true);
    setApplied("");
    try {
      const res = await fetch("/api/seo/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: webArticle,
          brandId: effectiveBrand,
          brandName: getBrandOrProjectName(brandId),
          keywords,
          aiProvider,
          faqText: aeoFaq || "",
          schemaText: aeoSchema || ""
        })
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "文章優化失敗");
      setResult({ ...json.data, forContent: webArticle });
    } catch (e: any) {
      console.error(e);
      alert(`❌ 文章優化失敗：${e.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const applyAll = async () => {
    if (!result) return;
    if (result.is_local_check) {
      alert("目前是本地模擬大腦，沒有產出優化後全文，無法套用。請切換到 OpenAI 或 Gemini 後再優化。");
      return;
    }
    if (result.guardrail_violations.length > 0) {
      if (!window.confirm(`優化後內容含品牌紅線詞：${result.guardrail_violations.join("、")}\n\n仍要套用嗎？（建議取消後重新優化）`)) return;
    }
    if (!window.confirm("套用後，上方的「官網文章」會被取代為優化後版本（社群貼文不受影響）。確定嗎？")) return;
    await saveWorkspace(brandId, {
      web_article: result.optimized_content,
      web_article_meta: { ...(webArticleMeta || {}), edited_at: Date.now() },
      aeo_faq: faqToPlainText(result.faq),
      aeo_schema: result.faq.length ? buildFaqJsonLd(result.faq, result.title, result.meta_description) : ""
    });
    setApplied("all");
  };

  const applyFaq = async () => {
    if (!result || result.faq.length === 0) return;
    await saveWorkspace(brandId, {
      aeo_faq: faqToPlainText(result.faq),
      aeo_schema: buildFaqJsonLd(result.faq, result.title, result.meta_description)
    });
    setApplied("faq");
  };

  const scoreColor = (n: number) => (n >= 80 ? "text-emerald-400" : n >= 60 ? "text-amber-400" : "text-rose-400");

  return (
    <div className="bg-slate-900/30 border border-emerald-500/25 rounded-xl p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-bold text-slate-100">文章優化器：SEO ＋ AEO ＋ GEO</h4>
          <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
            檢查上方的「官網文章」（也就是按「發布至官網」會送出的內容），直接給你優化後的版本。社群貼文不受影響。
            AI 不會編造數據、案例或來源，只調整標題、結構、定義句、結論句與問答。
          </p>
        </div>
        <Button
          variant="primary"
          loading={isRunning}
          disabled={!hasCopy}
          onClick={run}
          icon={<Sparkles className="w-3.5 h-3.5" />}
          className="shrink-0"
        >
          {isRunning ? "優化中..." : result ? "重新優化" : "開始優化"}
        </Button>
      </div>

      {!hasCopy && (
        <p className="text-[11px] text-slate-500 italic">還沒有官網文章。請先在上方按「由社群文案產生官網文章」。</p>
      )}

      {hasCopy && !result && (
        <SeoHealthCard
          brandId={brandId}
          webArticle={webArticle}
          keywords={keywords}
          aiProvider={aiProvider}
          seoScore={seoScore}
          healthBusy={!!healthBusy}
          aeoFaq={aeoFaq}
          aeoSchema={aeoSchema}
        />
      )}

      {result && (
        <div className="space-y-4">
          {result.is_local_check && (
            <div className="text-[11px] text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
              目前使用本地模擬大腦，只做規則檢查、沒有改寫全文與 FAQ。切換到 OpenAI 或 Gemini 才會產出完整優化版本。
            </div>
          )}
          {stale && (
            <div className="text-[11px] text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
              官網文章在優化後又被修改過，這份結果可能已過期，建議重新優化。
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            {(["seo", "aeo", "geo"] as const).map((k) => (
              <div key={k} className="bg-slate-950/50 border border-slate-850 rounded-lg p-3 text-center">
                <div className={`text-2xl font-black ${scoreColor(result.scores[k])}`}>
                  {result.scores_before && !result.is_local_check && (
                    <span className="text-sm font-semibold text-slate-500">{result.scores_before[k]} → </span>
                  )}
                  {result.scores[k]}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">{SCORE_LABEL[k]}</div>
              </div>
            ))}
          </div>
          <p className="text-[9px] text-slate-500">分數由程式規則計算（不是 AI 打的），原文與優化後用同一把尺，箭頭左邊是原文、右邊是優化後；不是搜尋排名預測。</p>

          <div className="space-y-1.5">
            {result.checks.map((c, i) => (
              <div key={i} className="flex gap-2 text-[11px] bg-slate-950/30 border border-slate-850 rounded-lg px-3 py-2">
                <span className={c.status === "ok" ? "text-emerald-400" : "text-amber-400"}>{c.status === "ok" ? "✓" : "!"}</span>
                <span className="text-slate-500 shrink-0 w-10">{c.area.toUpperCase()}</span>
                <span className="text-slate-200 font-semibold shrink-0">{c.item}</span>
                <span className="text-slate-400">{c.note}</span>
              </div>
            ))}
          </div>

          {!result.is_local_check && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                <div className="bg-slate-950/40 border border-slate-850 rounded-lg p-3">
                  <div className="text-slate-500 mb-1">標題：修改前</div>
                  <div className="text-slate-300">{result.forContent.split(/\r?\n/).find((l) => l.trim())?.replace(/^#+\s*/, "")}</div>
                </div>
                <div className="bg-emerald-500/5 border border-emerald-500/30 rounded-lg p-3">
                  <div className="text-emerald-400 mb-1">標題：修改後</div>
                  <div className="text-slate-100 font-semibold">{result.title}</div>
                </div>
              </div>
              <div className="bg-slate-950/40 border border-slate-850 rounded-lg p-3 text-[11px]">
                <div className="text-slate-500 mb-1">搜尋結果摘要（Meta Description，{result.meta_description.length} 字）</div>
                <div className="text-slate-200">{result.meta_description}</div>
              </div>

              {result.changes.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[11px] font-bold text-slate-300">改了什麼、為什麼</div>
                  {result.changes.map((c, i) => (
                    <div key={i} className="text-[11px] text-slate-400 bg-slate-950/30 border border-slate-850 rounded-lg px-3 py-2">
                      <span className="text-slate-200 font-semibold">{c.what}</span>　{c.why}
                    </div>
                  ))}
                </div>
              )}

              {result.geo_notes.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[11px] font-bold text-slate-300">AI 搜尋（GEO）建議</div>
                  {result.geo_notes.map((n, i) => (
                    <div key={i} className="text-[11px] text-slate-400">・{n}</div>
                  ))}
                </div>
              )}

              {result.guardrail_violations.length > 0 && (
                <div className="text-[11px] text-rose-200 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
                  優化後內容含品牌紅線詞：{result.guardrail_violations.join("、")}。套用前請先處理，或重新優化。
                </div>
              )}

              <div>
                <Button variant="ghost" size="sm" onClick={() => setShowFull((v) => !v)}>
                  {showFull ? "收起原文與優化後全文對照 ▲" : "展開原文與優化後全文對照 ▼"}
                </Button>
                {showFull && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                    <pre className="whitespace-pre-wrap text-[11px] text-slate-400 bg-slate-950/50 border border-slate-850 rounded-lg p-3 max-h-80 overflow-y-auto font-sans">{result.forContent}</pre>
                    <pre className="whitespace-pre-wrap text-[11px] text-slate-100 bg-emerald-500/5 border border-emerald-500/30 rounded-lg p-3 max-h-80 overflow-y-auto font-sans">{result.optimized_content}</pre>
                  </div>
                )}
              </div>

              {result.faq.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[11px] font-bold text-slate-300">問答集（會同步產生結構化資料）</div>
                  <pre className="whitespace-pre-wrap text-[11px] text-slate-300 bg-slate-950/50 border border-slate-850 rounded-lg p-3 font-sans">{faqToPlainText(result.faq)}</pre>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button variant="primary" onClick={applyAll}>
                  套用到官網文章（取代官網文章＋問答＋結構化資料）
                </Button>
                <Button variant="secondary" onClick={applyFaq} disabled={result.faq.length === 0}>
                  只套用問答與結構化資料
                </Button>
                {applied && (
                  <span className="text-[11px] text-emerald-400">
                    {applied === "all" ? "✓ 已套用到官網文章。到「社群文案」分頁按「發布至官網」，問答與結構化資料會跟著文章一起存入。" : "✓ 已更新問答與結構化資料，發布至官網時會跟著文章一起存入。"}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
});

// ==================== 3-0. 官網文章（與社群貼文分開存放） ====================
const WebArticlePanel = memo(function WebArticlePanel({
  brandId,
  socialCopy,
  sourceCopy,
  activePlatform,
  webArticle,
  webArticleMeta,
  keywords,
  aiProvider,
  brandGuidelines
}: {
  brandId: string;
  socialCopy: string;
  sourceCopy: string;
  activePlatform?: string;
  webArticle?: string;
  webArticleMeta?: WebArticleMeta;
  keywords: SEOKeyword[];
  aiProvider: string;
  brandGuidelines?: string;
}) {
  const platformLabel = activePlatform === "facebook" ? "Facebook" : activePlatform === "instagram" ? "Instagram" : "Threads";
  const [isGenerating, setIsGenerating] = useState(false);
  const [draft, setDraft] = useState(webArticle || "");
  const [violations, setViolations] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(webArticle || "");
  }, [webArticle]);

  const hasSocial = hasSocialCopy(socialCopy);
  const hasArticle = hasWebArticle(webArticle);
  const stale = hasArticle && isArticleStale(webArticleMeta, sourceCopy);
  const dirty = draft !== (webArticle || "");
  const effectiveBrand = resolveEffectiveBrandId(brandId) || brandId;

  const generate = async () => {
    if (isGenerating || !hasSocial) return;
    if (hasArticle && !window.confirm("重新產生會取代目前的官網文章（包含你手動修改的內容）。確定嗎？")) return;
    setIsGenerating(true);
    setViolations([]);
    setSaved(false);
    try {
      const res = await fetch("/api/web-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          socialCopy,
          brandId: effectiveBrand,
          brandName: getBrandOrProjectName(brandId),
          keywords,
          brandGuidelines,
          aiProvider
        })
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "產生官網文章失敗");
      if (json.data.is_local_check) {
        alert("目前是本地模擬大腦，沒有真的改寫，只是複製社群文案。請切換到 OpenAI、Gemini 或 Claude 後再產生。");
      }
      setViolations(json.data.guardrail_violations || []);
      await saveWorkspace(brandId, {
        web_article: json.data.article,
        web_article_meta: { generated_at: Date.now(), from_hash: textHash(socialCopy), from_platform: activePlatform || "threads" }
      });
    } catch (e: any) {
      console.error(e);
      alert(`❌ 產生官網文章失敗：${e.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const saveDraft = async () => {
    await saveWorkspace(brandId, {
      web_article: draft,
      web_article_meta: { ...(webArticleMeta || {}), edited_at: Date.now() }
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="bg-slate-900/30 border border-sky-500/25 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-bold text-slate-100">官網文章</h4>
          <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
            和社群貼文分開存放。「發布至官網」送出的是這一份，下方的文章優化器也只改這一份；社群貼文的流量分析與平台改寫不受影響。產生時以目前「{platformLabel}」分頁的貼文為底稿（想用別的平台版本，先到社群文案分頁切換）。
          </p>
        </div>
        <Button
          variant="primary"
          loading={isGenerating}
          disabled={!hasSocial}
          onClick={generate}
          icon={<Sparkles className="w-3.5 h-3.5" />}
          className="shrink-0"
        >
          {isGenerating ? "產生中..." : hasArticle ? "重新由社群文案產生" : "由社群文案產生官網文章"}
        </Button>
      </div>

      {!hasSocial && (
        <p className="text-[11px] text-slate-500 italic">還沒有足夠的社群文案。請先到「社群文案」分頁產出或載入一篇文章。</p>
      )}

      {hasSocial && !hasArticle && !isGenerating && (
        <p className="text-[11px] text-slate-400">
          這篇還沒有官網文章。按上方按鈕，會以社群貼文為底稿寫成 800 到 1500 字的官網版本（不會編造內容，圖表會保留）。沒有產生的話，「發布至官網」會改用社群貼文。
        </p>
      )}

      {stale && (
        <div className="text-[11px] text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
          社群貼文在官網文章產生之後又被修改過，官網文章可能不是最新。需要的話可以重新產生。
        </div>
      )}

      {violations.length > 0 && (
        <div className="text-[11px] text-rose-200 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
          官網文章含品牌紅線詞：{violations.join("、")}。請先修改再發布。
        </div>
      )}

      {hasArticle && (
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={14}
            className="w-full bg-slate-950/60 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 leading-relaxed focus:outline-none focus:border-sky-500/50 font-sans"
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500">約 {countChars(draft)} 字</span>
            <div className="flex items-center gap-2">
              {saved && <span className="text-[11px] text-emerald-400">✓ 已儲存</span>}
              <Button variant="secondary" size="sm" disabled={!dirty} onClick={saveDraft}>
                儲存修改
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

// ==================== 3. SEO關鍵字分頁 (Iris) ====================
const SEOTabContent = memo(function SEOTabContent({ 
  brandId, 
  keywords, 
  aeoSchema, 
  aeoFaq, 
  aiProvider,
  socialCopy,
  activePlatform,
  webArticle,
  webArticleMeta,
  brandGuidelines,
  webSourceCopy,
  seoScore,
  healthBusy
}: { 
  brandId: string; 
  keywords: SEOKeyword[]; 
  aeoSchema?: string; 
  aeoFaq?: string; 
  aiProvider: string; 
  socialCopy: string;
  activePlatform?: string;
  webArticle?: string;
  webArticleMeta?: WebArticleMeta;
  brandGuidelines?: string;
  webSourceCopy?: string;
  seoScore?: SeoScore;
  healthBusy?: boolean;
}) {
  const theme = useBrandTheme(brandId);
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
      const brandName = getBrandOrProjectName(brandId);

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
    navigator.clipboard.writeText(stripMarkdown(aeoFaq));
    setFaqCopied(true);
    setTimeout(() => setFaqCopied(false), 2000);
  };

  return (
    <div className="flex flex-col min-h-full space-y-4">
      <div className="flex justify-between items-center bg-slate-900/40 p-3 rounded-xl border border-slate-800/60 shrink-0">
        <div>
          <h4 className="text-sm font-bold text-slate-200">SEO 專家：Iris</h4>
          <p className="text-[10px] text-slate-400">文章優化（SEO／AEO／GEO）與關鍵字分析</p>
        </div>
      </div>

      <WebArticlePanel
        brandId={brandId}
        socialCopy={socialCopy}
        sourceCopy={webSourceCopy ?? socialCopy}
        activePlatform={activePlatform}
        webArticle={webArticle}
        webArticleMeta={webArticleMeta}
        keywords={keywords}
        aiProvider={aiProvider}
        brandGuidelines={brandGuidelines}
      />

      <SeoOptimizerPanel
        brandId={brandId}
        webArticle={webArticle || ""}
        webArticleMeta={webArticleMeta}
        keywords={keywords}
        aiProvider={aiProvider}
        seoScore={seoScore}
        healthBusy={healthBusy}
        aeoFaq={aeoFaq}
        aeoSchema={aeoSchema}
      />

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
              <h4 className="text-xs font-bold text-slate-200">將隨文章存入官網的問答與結構化資料</h4>
              <p className="text-[10px] text-slate-400">由上方「文章優化器」按「套用」後產生，按「發布至官網」時會一起存入，官網會自動顯示問答並放入結構化資料，不需手動複製貼上。</p>
            </div>
          </div>
          
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopySchema}
                    icon={schemaCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  >
                    {schemaCopied ? "已複製" : "一鍵複製"}
                  </Button>
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyFaq}
                    icon={faqCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  >
                    {faqCopied ? "已複製" : "一鍵複製"}
                  </Button>
                </div>
                <div className="flex-1 min-h-[160px] max-h-[220px] overflow-y-auto rounded-lg bg-slate-950 border border-slate-900 p-3.5 text-xs text-slate-300 leading-relaxed font-sans scrollbar-thin select-text">
                  <div className="whitespace-pre-wrap">{stripMarkdown(aeoFaq)}</div>
                </div>
                <p className="text-[9px] text-slate-500">提示：將這些問答放置於您官網的 FAQ 區塊。結構化的問答設計更容易被 Answer Engines (AEO) 抓取。</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

// ==================== 4. 廣告數據分頁 (Jack) ====================
const AdsTabContent = memo(function AdsTabContent({ brandId, adData }: { brandId: string; adData: AdDataItem[] }) {
  const theme = useBrandTheme(brandId);
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

  // 只有從 Meta 廣告帳號實際同步的指標才算真實數據（change 欄位會標「實體後台同步」）
  const adIsReal = !!adData && adData.length > 0 && adData.every((d) => String(d.change || "").includes("實體後台同步"));

  return (
    <div className="flex flex-col min-h-full space-y-4">
      <div className="flex justify-between items-center bg-slate-900/40 p-3 rounded-xl border border-slate-800/60 shrink-0">
        <div>
          <h4 className="text-sm font-bold text-slate-200">廣告數據專家：Jack</h4>
          <p className="text-[10px] text-slate-400">廣告投放效能預估與關鍵成效指標</p>
        </div>
      </div>

      {adData && adData.length > 0 && !adIsReal && (
        <div className="shrink-0 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-[11px] text-amber-200 leading-relaxed">
          這一頁的數字是 AI 依品牌與文案「預估」出來的，不是真實投放數據，請勿當成效報告使用。
          要看真實數字，目前請到 Meta 廣告後台查看。
        </div>
      )}

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
                        <Button variant="primary" size="sm" onClick={() => handleSave(index)} className="w-full">
                          儲存
                        </Button>
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
                      {adIsReal && <span className="text-[9px] text-slate-500 ml-1">較前次發布</span>}
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
});

// ==================== 5. 品牌大腦分頁 (Erick) ====================
const GuidelinesTabContent = memo(function GuidelinesTabContent({
  brandId,
  brandGuidelines
}: {
  brandId: string;
  brandGuidelines: string;
}) {
  const theme = useBrandTheme(brandId);
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
    <div className="flex flex-col min-h-full space-y-4">
      {/* 品牌大腦頂部標題卡 */}
      <div className="flex justify-between items-center bg-slate-900/40 p-4 rounded-xl border border-slate-800/60 shrink-0">
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
          <Button variant="ghost" onClick={handleCopy} icon={<Copy className="w-3.5 h-3.5" />} title="複製規範">
            複製
          </Button>
          {!isEditing ? (
            <>
              <Button variant="primary" onClick={() => setIsEditing(true)} icon={<Edit2 className="w-3.5 h-3.5" />}>
                編輯大腦
              </Button>
              <Button variant="danger" onClick={handleReset} title="還原為預設品牌說明">
                重設預設
              </Button>
            </>
          ) : (
            <>
              <Button variant="primary" onClick={handleSave} icon={<Check className="w-3.5 h-3.5" />}>
                儲存大腦
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setVal(brandGuidelines);
                  setIsEditing(false);
                }}
              >
                取消
              </Button>
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
});
