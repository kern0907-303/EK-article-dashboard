"use client";

import React, { useState, useEffect, useRef } from "react";
import { Send, Trash2, Bot, Sparkles, User, Copy, Settings2 } from "lucide-react";
import { resolveEffectiveBrandId, subscribeToProjects } from "@/lib/projects-store";
import { ChatMessage, subscribeToChat, saveChatMessage, saveWorkspace, clearChatHistory, subscribeToWorkspace } from "@/lib/storage";
import { COPYWRITING_FRAMEWORKS } from "@/data/skills/frameworks";
import { getWritingFrameworkOptions, getStoryArgumentSelectionError, isStoryArgumentCitationEligible, resolveStoryArgumentSelection, STORY_ARGUMENT_FRAMEWORK_ID, STORY_ARGUMENT_GENRE_NOTICE, STORY_ARGUMENT_VERSION_OPTIONS, STORY_ARGUMENT_CITATION_OPTIONS, KNOWLEDGE_DOMAIN_LABELS, type StoryArgumentVersion, type StoryArgumentCitationMode, type StoryArgumentSelection } from "@/data/skills/story-argument";
import type { KnowledgeNoteDirectoryEntry } from "@/lib/knowledge-note-utils";
import { GENRE_LIST, GENRES, FUNNEL_LABEL, brandKeyFromId, type GenreId, type FunnelLevel, type GenreSettings, type BrandKey } from "@/data/skills/genres";
import { parsePastedTopics, materialFor, type PastedBundle, type PastedTopic } from "@/lib/topic-parse";
import Button from "@/components/ui/Button";
import { findTextMismatch, describeMismatch, GUARD_BRAND_LABEL, type BrandMismatch } from "@/lib/brand-guard";

const WRITING_FRAMEWORK_OPTIONS = getWritingFrameworkOptions(Object.values(COPYWRITING_FRAMEWORKS));

interface ChatBoxProps {
  activeBrandId: string;
  activeBrandName: string;
  aiProvider: string;
}

export default function ChatBox({ activeBrandId, activeBrandName, aiProvider }: ChatBoxProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const [isSmallViewport, setIsSmallViewport] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  // 進度：0 待命、1 營運長拆解、2 Maya/Iris、3 Leon/Jack、4 完成、-1 未觸發/失敗
  const [progress, setProgress] = useState<{ stage: number; startedAt: number; note: string }>({ stage: 0, startedAt: 0, note: "" });
  const [tick, setTick] = useState(0);
  // 文體生成表單
  // 輸入框上方的設定區：分頁（一般指令／文體生成）與是否展開，預設都收起，選擇會記在瀏覽器
  const [panelTab, setPanelTab] = useState<"general" | "genre">("general");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [genreId, setGenreId] = useState<GenreId>("case");
  const [funnel, setFunnel] = useState<FunnelLevel>("cold");
  const [gClaim, setGClaim] = useState("");
  const [gMaterial, setGMaterial] = useState("");
  const [gMetaphor, setGMetaphor] = useState("");
  const [gLength, setGLength] = useState("");
  const [gCta, setGCta] = useState("");
  const [genreError, setGenreError] = useState("");
  // 貼上選題（每週品牌調研的 Telegram 訊息）
  const [pasteText, setPasteText] = useState("");
  const [pasteBundle, setPasteBundle] = useState<PastedBundle | null>(null);
  const [pasteNotes, setPasteNotes] = useState<string[]>([]);
  const [pasteApplied, setPasteApplied] = useState("");
  useEffect(() => {
    if (progress.stage < 1 || progress.stage > 3) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [progress.stage]);
  const [brandGuidelines, setBrandGuidelines] = useState("");
  // 品牌錯置確認視窗：內容明顯在講別的品牌時，生成前先問一次
  const [brandConfirm, setBrandConfirm] = useState<{ lines: string[]; onConfirm: () => void } | null>(null);
  // 使用者已確認「仍用目前品牌生成」：這一輪生成的所有請求都帶上，避免後端重複攔截
  const brandOverrideRef = useRef(false);
  const currentBrandKey = brandKeyFromId(resolveEffectiveBrandId(activeBrandId) || activeBrandId);
  const guardBody = () => ({ brandKey: currentBrandKey, confirmBrandMismatch: brandOverrideRef.current });
  const validateStoryArgumentSelection = () => {
    const selection = resolveStoryArgumentSelection(activeFramework, storyArgumentVersion, storyArgumentThesis, storyCitationMode, selectedKnowledgeNoteId);
    let error = getStoryArgumentSelectionError(selection);
    if (!error && selection?.version === "full" && selection.citationMode === "selected") {
      const selected = knowledgeNotes.find((note) => note.id === selection.noteId);
      if (!isStoryArgumentCitationEligible(selected)) error = "指定書籍模式請先選擇一筆中文資料已確認的筆記。";
    }
    setStorySelectionError(error || "");
    return !error;
  };
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 639px)");
    const updateViewport = () => {
      setIsSmallViewport(media.matches);
      if (!media.matches) setMobileSettingsOpen(false);
    };
    updateViewport();
    media.addEventListener("change", updateViewport);
    return () => media.removeEventListener("change", updateViewport);
  }, []);

  useEffect(() => {
    if (!mobileSettingsOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileSettingsOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileSettingsOpen]);

  useEffect(() => () => {
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
  }, []);

  // 訂閱當前品牌的聊天歷史
  useEffect(() => {
    setMessages([]); // 立即清空，防範切換品牌時對話紀錄殘留/閃爍
    const unsubscribe = subscribeToChat(activeBrandId, (msgs) => {
      setMessages(msgs);
    });
    return () => unsubscribe();
  }, [activeBrandId]);

  // 階段專案繼承所屬品牌的品牌規則：先放品牌規則，再接專案自己的補充規範
  const [parentGuidelines, setParentGuidelines] = useState("");
  useEffect(() => {
    let unsubWs: (() => void) | null = null;
    const bind = () => {
      unsubWs?.();
      unsubWs = null;
      setParentGuidelines("");
      if (!activeBrandId.startsWith("project_")) return;
      const parent = resolveEffectiveBrandId(activeBrandId);
      if (!parent) return;
      unsubWs = subscribeToWorkspace(parent, (w) => {
        setParentGuidelines(w?.brand_guidelines || "");
      });
    };
    bind();
    const unsubProjects = subscribeToProjects(bind);
    return () => {
      unsubWs?.();
      unsubProjects();
    };
  }, [activeBrandId]);
  const mergedGuidelines =
    parentGuidelines && brandGuidelines
      ? `${parentGuidelines}\n\n【本專案補充規範（優先於上述通用規則）】\n${brandGuidelines}`
      : parentGuidelines || brandGuidelines;

  const [activePlat, setActivePlat] = useState("threads");
  const [activeFramework, setActiveFramework] = useState<string>("default");
  const [storyArgumentVersion, setStoryArgumentVersion] = useState<StoryArgumentVersion>("empathy");
  const [storyArgumentThesis, setStoryArgumentThesis] = useState("");
  const [storyCitationMode, setStoryCitationMode] = useState<StoryArgumentCitationMode>("auto");
  const [selectedKnowledgeNoteId, setSelectedKnowledgeNoteId] = useState("");
  const [knowledgeNotes, setKnowledgeNotes] = useState<KnowledgeNoteDirectoryEntry[]>([]);
  const [knowledgeNotesError, setKnowledgeNotesError] = useState("");
  const [storySelectionError, setStorySelectionError] = useState("");
  const [frameworkLoaded, setFrameworkLoaded] = useState(false);
  // 載入上次的框架選擇（放在 effect 內避免伺服器端渲染不一致）
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ek_active_framework");
      if (saved && (COPYWRITING_FRAMEWORKS[saved] || saved === STORY_ARGUMENT_FRAMEWORK_ID)) setActiveFramework(saved);
    } catch {}
    setFrameworkLoaded(true);
  }, []);
  // 框架選擇存起來，讓社群文案頁的平台改寫也能讀到同一個選擇
  useEffect(() => {
    if (!frameworkLoaded) return;
    try { localStorage.setItem("ek_active_framework", activeFramework); } catch {}
  }, [activeFramework, frameworkLoaded]);

  // 只有故事論點使用知識目錄；API 僅回傳書目欄位，全文不會送到瀏覽器。
  useEffect(() => {
    if (activeFramework !== STORY_ARGUMENT_FRAMEWORK_ID || storyCitationMode !== "selected" || storyArgumentVersion !== "full") return;
    let active = true;
    setKnowledgeNotesError("");
    fetch("/api/knowledge-notes", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "無法載入引用來源目錄");
        if (active) setKnowledgeNotes(Array.isArray(data.notes) ? data.notes : []);
      })
      .catch((error) => { if (active) setKnowledgeNotesError(error instanceof Error ? error.message : "無法載入引用來源目錄"); });
    return () => { active = false; };
  }, [activeFramework, storyCitationMode, storyArgumentVersion]);

  // 訂閱當前品牌的看板資料以獲取品牌說明與平台設定
  useEffect(() => {
    setBrandGuidelines("");
    setActivePlat("threads");
    const unsubscribe = subscribeToWorkspace(activeBrandId, (wData) => {
      if (wData) {
        if (wData.brand_guidelines) {
          setBrandGuidelines(wData.brand_guidelines);
        }
        if (wData.active_platform) {
          setActivePlat(wData.active_platform);
        }
      }
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
    setProgress({ stage: 0, startedAt: 0, note: "" });
    
    // 將預覽狀態重設
    await saveWorkspace(activeBrandId, {
      social_copy: "⚠️ 已取消生成。您可以重新輸入指令以開始新任務。",
      web_architecture: "⚠️ 已取消生成。",
      seo_keywords: [],
      ad_data: []
    });
  };

  // 依子任務啟動專家：先 Maya + Iris，再 Leon + Jack。一般指令與文體生成共用這段。
  const dispatchExperts = async (
    subPrompts: any,
    signal: AbortSignal,
    genre?: { settings: GenreSettings; brandKey: BrandKey },
    storyArgument?: StoryArgumentSelection
  ) => {

    // 如果是 mockData 模式，直接一次性更新，省去後續請求
    if (subPrompts.mockData) {
      await saveWorkspace(activeBrandId, subPrompts.mockData, { generated: true });
      setProgress((p) => ({ ...p, stage: 4, note: "完成（模擬模式）" }));
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
      let anyFailed = false;
      const runMayaIris = async () => {
        setProgress((p) => ({ ...p, stage: 2 }));
        try {
          const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: signal,
            body: JSON.stringify({
              stage: "expert",
              expertType: "maya_iris",
              ...guardBody(),
              subPrompts,
              brandName: activeBrandName,
              aiProvider,
              brandGuidelines: mergedGuidelines,
              platform: activePlat,
              copywritingFramework: activeFramework,
              ...(storyArgument ? { storyArgument } : {}),
              ...(genre ? { genre } : {})
            })
          });
          if (res.ok) {
            const data = await res.json();
            if (data.dispatchData) {
              await saveWorkspace(activeBrandId, data.dispatchData, { generated: true });
              return data.dispatchData;
            } else {
              throw new Error(data.error || "後端未傳回專家結果資料；請重試，對話上下文已自動限制為最近 12 則。");
            }
          } else {
            let errorMsg = `HTTP 狀態碼: ${res.status}`;
            try {
              const errorData = await res.json();
              if (errorData && errorData.error) {
                errorMsg += ` - ${errorData.error}`;
              }
            } catch (_) {}
            throw new Error(errorMsg);
          }
        } catch (e: any) {
          if (e.name === 'AbortError') {
            console.log("Background Maya & Iris generation aborted.");
            return;
          }
          console.error("Background Maya & Iris generation failed:", e);
          anyFailed = true;
          const reason = e.message || "未知錯誤";
          await saveWorkspace(activeBrandId, {
            social_copy: `❌ 專家助理 Maya 產出失敗：${reason}。\n對話上下文已自動限制為最近 12 則；請依上方錯誤原因處理後重試。`,
            seo_keywords: [
              { keyword: "❌ 專家助理 Iris 產出失敗", volume: "失敗", competition: "失敗", outline: reason }
            ]
          });
        }
      };

      const runLeonJack = async (prevData?: any) => {
        setProgress((p) => ({ ...p, stage: 3 }));
        try {
          const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: signal,
            body: JSON.stringify({
              stage: "expert",
              expertType: "leon_jack",
              ...guardBody(),
              subPrompts,
              brandName: activeBrandName,
              aiProvider,
              brandGuidelines: mergedGuidelines,
              prevData
            })
          });
          if (res.ok) {
            const data = await res.json();
            if (data.dispatchData) {
              await saveWorkspace(activeBrandId, data.dispatchData, { generated: true });
            } else {
              throw new Error(data.error || "後端未傳回專家結果資料；請重試，對話上下文已自動限制為最近 12 則。");
            }
          } else {
            let errorMsg = `HTTP 狀態碼: ${res.status}`;
            try {
              const errorData = await res.json();
              if (errorData && errorData.error) {
                errorMsg += ` - ${errorData.error}`;
              }
            } catch (_) {}
            throw new Error(errorMsg);
          }
        } catch (e: any) {
          if (e.name === 'AbortError') {
            console.log("Background Leon & Jack generation aborted.");
            return;
          }
          console.error("Background Leon & Jack generation failed:", e);
          anyFailed = true;
          const reason = e.message || "未知錯誤";
          await saveWorkspace(activeBrandId, {
            web_architecture: `❌ 系統架構師 Leon 產出失敗：${reason}。\n對話上下文已自動限制為最近 12 則；請依上方錯誤原因處理後重試。`,
            ad_data: [
              { label: "❌ 廣告數據專家 Jack 產出失敗", value: "失敗", change: reason, isPositive: false }
            ]
          });
        }
      };

      // 順序背景發起，避免 Render 免費版同時處理兩個大腦 API 導致記憶體超載 (OOM) 與 502 崩潰
      const runSequentially = async () => {
        setIsGenerating(true);
        try {
          const prevData = await runMayaIris();
          if (signal.aborted) return;
          await runLeonJack(prevData);
        } finally {
          if (!signal.aborted) {
            setIsGenerating(false);
            setProgress((p) => anyFailed
              ? { ...p, stage: -1, note: "有專家產出失敗，請看右側面板的紅字錯誤訊息，或重送一次指令。" }
              : { ...p, stage: 4, note: "全部完成" });
          }
        }
      };
      runSequentially();
    }
  };

  // 把一個選題填進文體生成表單
  const applyPastedTopic = (t: PastedTopic, bundle: PastedBundle) => {
    const notes: string[] = [];
    const g: GenreId = t.genre && GENRES[t.genre].enabled ? t.genre : genreId;
    if (!t.genre) notes.push("沒有看到建議文體，文體維持你原本的選擇。");
    setGenreId(g);
    if (t.funnel) setFunnel(t.funnel);
    else notes.push("沒有看到漏斗層，維持原本的選擇。");
    setGClaim(t.claim);
    if (!t.claim) notes.push("沒有看到主張，請自己填一句。");
    setGMaterial(materialFor(t, g));
    setGMetaphor("");
    setGLength("");
    setGCta("");
    setGenreError("");

    const currentBrand = brandKeyFromId(resolveEffectiveBrandId(activeBrandId) || activeBrandId);
    if (bundle.brandKey && bundle.brandKey !== currentBrand) {
      notes.push(`這份選題屬於「${bundle.brandName}」，但你現在在「${activeBrandName}」。生成前請先切換品牌，否則會用錯語氣。`);
    }
    const need = t.needMaterial && !/^無需/.test(t.needMaterial) ? t.needMaterial : "";
    if (g === "case") notes.push(`案例文需要真實個案，系統不會代寫。請貼上個案摘要${need ? "。調研建議補：" + need : "。"}`);
    else if (g === "invite") notes.push(`邀請文請補素材欄：導向的網址、點進去會得到什麼、邀請對象。${need ? "調研建議補：" + need : ""}`);
    else if (g === "breakdown") notes.push(`拆解文請在素材欄補上要用的框架（四層／領域／隱態顯態／內外一致）。事件內容是 AI 搜尋的，貼文前先核對來源。${need ? "調研建議補：" + need : ""}`);
    setPasteNotes(notes);
    setPasteApplied(`題目 ${t.index}｜${t.mode || "選題"}：${t.title || t.claim}`);
  };

  const handlePasteParse = () => {
    const bundle = parsePastedTopics(pasteText);
    setPasteApplied("");
    setPasteNotes([]);
    if (bundle.topics.length === 0) {
      setPasteBundle(null);
      setPasteNotes(["看不出選題格式。請貼上 Telegram 收到的調研訊息（含「題目 1｜…」與【主張】），或 Google Sheet「選題情報」的 content_task 欄整段。"]);
      return;
    }
    setPasteBundle(bundle);
    if (bundle.topics.length === 1) applyPastedTopic(bundle.topics[0], bundle);
  };

  // 文體生成：不經過營運長，直接把「共用前綴 + 品牌語氣 + 漏斗層 + 文體骨架 + 本篇變數」送給 Maya
  const handleGenreGenerate = async () => {
    if (!validateStoryArgumentSelection()) return;
    if (isLoading || isGenerating) return;
    const def = GENRES[genreId];
    if (!def.enabled) {
      setGenreError(`${def.name}${def.disabledReason ? "：" + def.disabledReason : "尚未開放"}`);
      return;
    }
    if (!gClaim.trim()) {
      setGenreError("請填「主張」：這篇文章要讓讀者接受的那一件事，一句話。");
      return;
    }
    if (def.materialRequired && !gMaterial.trim()) {
      setGenreError(`請填「${def.materialLabel}」。${def.materialHint}`);
      return;
    }
    setGenreError("");

    // 品牌錯置檢查：主張／素材在講別的品牌，或貼上的選題屬於別的品牌
    const found: BrandMismatch[] = [];
    const m1 = findTextMismatch(gClaim, currentBrandKey, "主張");
    if (m1) found.push(m1);
    const m2 = findTextMismatch(gMaterial, currentBrandKey, "素材");
    if (m2) found.push(m2);
    const lines = found.map(describeMismatch);
    if (pasteApplied && pasteBundle?.brandKey && pasteBundle.brandKey !== currentBrandKey) {
      lines.push(`你貼上的選題屬於「${pasteBundle.brandName || GUARD_BRAND_LABEL[pasteBundle.brandKey]}」，但你現在在 ${GUARD_BRAND_LABEL[currentBrandKey]}。`);
    }
    brandOverrideRef.current = false;
    if (lines.length > 0) {
      setBrandConfirm({ lines, onConfirm: () => { brandOverrideRef.current = true; void runGenreGenerate(); } });
      return;
    }
    await runGenreGenerate();
  };

  const runGenreGenerate = async () => {
    if (!validateStoryArgumentSelection()) return;
    const def = GENRES[genreId];
    const settings: GenreSettings = {
      genre: genreId,
      funnel,
      claim: gClaim,
      material: gMaterial,
      metaphor: gMetaphor,
      length: gLength,
      cta: gCta,
    };
    const brandKey: BrandKey = brandKeyFromId(resolveEffectiveBrandId(activeBrandId) || activeBrandId);
    const subPrompts = {
      maya: gClaim.trim(),
      iris: `這篇文章的主張是：${gClaim.trim()}。請據此規劃關鍵字與問答，不得編造文章沒有的事實。`,
      leon: `為這篇文章設計對應的網頁結構。主張：${gClaim.trim()}`,
      jack: `為這篇文章估算廣告素材方向與指標。主張：${gClaim.trim()}`,
    };

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    setProgress({ stage: 2, startedAt: Date.now(), note: "" });

    // 文體文章是 Facebook 長文：先把看板切到 Facebook，等待中的提示與成品才會落在同一個平台
    setActivePlat("facebook");
    await saveWorkspace(activeBrandId, { active_platform: "facebook" });

    await saveChatMessage(activeBrandId, {
      role: "user",
      content: `【文體生成】${def.name}｜${FUNNEL_LABEL[funnel]}｜主張：${gClaim.trim()}`,
    });
    await saveChatMessage(activeBrandId, {
      role: "assistant",
      content: `收到。我用【${def.name}】的骨架直接交給 Maya 寫（Facebook 長文格式）。缺素材的地方她會標【需補】，不會代寫。`,
    });
    const storyArgument = resolveStoryArgumentSelection(activeFramework, storyArgumentVersion, storyArgumentThesis, storyCitationMode, selectedKnowledgeNoteId);
    await dispatchExperts(subPrompts, signal, { settings, brandKey }, storyArgument);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading || isGenerating) return;
    if (!validateStoryArgumentSelection()) return;

    const userText = inputValue.trim();
    const m = findTextMismatch(userText, currentBrandKey, "你的指令");
    brandOverrideRef.current = false;
    if (m) {
      setBrandConfirm({ lines: [describeMismatch(m)], onConfirm: () => { brandOverrideRef.current = true; void runSend(userText); } });
      return;
    }
    await runSend(userText);
  };

  const runSend = async (userText: string) => {
    if (!validateStoryArgumentSelection()) return;
    setInputValue("");
    setIsLoading(true);
    setIsGenerating(false);
    setProgress({ stage: 1, startedAt: Date.now(), note: "" });

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
          ...guardBody(),
          history: updatedHistory,
          brandName: activeBrandName,
          aiProvider: aiProvider,
          brandGuidelines: mergedGuidelines,
          platform: activePlat,
          copywritingFramework: activeFramework
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

      // 5. 若有子任務 subPrompts 或是 mockData，啟動非同步專家生成，避免單次請求過長超時（部署在 Render）
      if (!(result.dispatchData && result.dispatchData.subPrompts)) {
        const msg = "這次營運長只回覆了對話，沒有派工給專家，所以右邊內容沒有更新。請把指令說得更明確（例如「請 Maya 寫一篇……」）後重送。";
        setProgress((p) => ({ ...p, stage: -1, note: msg }));
        await saveChatMessage(activeBrandId, { role: "assistant", content: `【系統狀態】${msg}` });
      }
      if (result.dispatchData && result.dispatchData.subPrompts) {
        const storyArgument = resolveStoryArgumentSelection(activeFramework, storyArgumentVersion, storyArgumentThesis, storyCitationMode, selectedKnowledgeNoteId);
        await dispatchExperts(result.dispatchData.subPrompts, signal, undefined, storyArgument);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log("Erick COO generation aborted.");
        return;
      }
      console.error("Chat error:", error);
      setProgress((p) => ({ ...p, stage: -1, note: `營運長處理失敗：${error.message || "未知異常"}` }));
      await saveChatMessage(activeBrandId, {
        role: "assistant",
        content: `【營運回報】系統處理指令時發生錯誤：${error.message || "未知異常"}。請依錯誤內容處理後重試；系統只會傳送最近 12 則對話脈絡。`
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

  const handleCopyMessage = async (messageId: string, content: string) => {
    let copied = false;
    try {
      await navigator.clipboard.writeText(content);
      copied = true;
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = content;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      textarea.style.top = "0";
      try {
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        copied = document.execCommand("copy");
      } catch {
        copied = false;
      } finally {
        textarea.remove();
      }
    }
    if (!copied) return;
    setCopiedMessageId(messageId);
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => setCopiedMessageId(null), 2000);
  };

  // 設定區的分頁與展開狀態記在瀏覽器；讀不到就用預設（一般指令、收起）
  useEffect(() => {
    try {
      const tab = window.localStorage.getItem("ek_chat_panel_tab");
      const open = window.localStorage.getItem("ek_chat_panel_open");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (tab === "general" || tab === "genre") setPanelTab(tab);
      if (open === "1") setSettingsOpen(true);
    } catch {
      // 瀏覽器不允許儲存時，維持預設
    }
  }, []);
  const remember = (tab: "general" | "genre", open: boolean) => {
    try {
      window.localStorage.setItem("ek_chat_panel_tab", tab);
      window.localStorage.setItem("ek_chat_panel_open", open ? "1" : "0");
    } catch {
      // 忽略
    }
  };
  const choosePanelTab = (tab: "general" | "genre") => {
    setPanelTab(tab);
    remember(tab, settingsOpen);
  };
  const toggleSettings = () => {
    const next = !settingsOpen;
    setSettingsOpen(next);
    remember(panelTab, next);
  };
  // 一般指令分頁只有在選了「故事論點」框架時才有設定可展開；文體生成分頁一定有表單
  const canExpandSettings = panelTab === "genre" || activeFramework === STORY_ARGUMENT_FRAMEWORK_ID;
  const storySummary = [
    STORY_ARGUMENT_VERSION_OPTIONS.find((o) => o.id === storyArgumentVersion)?.name,
    "引用：" + (STORY_ARGUMENT_CITATION_OPTIONS.find((o) => o.id === storyCitationMode)?.name || ""),
    storyArgumentThesis.trim() ? "論點已填" : "論點由 AI 擬定",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="chatbox-shell flex flex-col h-full min-h-0 bg-slate-950/20 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-md">
      {/* Header */}
      <div className="max-sm:px-3 max-sm:py-0.5 flex items-center justify-between px-6 py-4 bg-slate-900/40 border-b border-slate-800/60 backdrop-blur-md">
        <div className="max-sm:gap-2 flex items-center gap-3">
          <div className="relative">
            <div className="max-sm:h-8 max-sm:w-8 w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-slate-900 font-bold shadow-lg shadow-amber-500/10">
              <Bot className="max-sm:h-4 max-sm:w-4 w-5 h-5 text-slate-900" />
            </div>
            {/* Status Glow Indicator */}
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-950 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="whitespace-nowrap max-sm:text-sm font-bold text-slate-100 text-base">Erick 營運長</h3>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full">
                團隊總指揮
              </span>
            </div>
            <p className="max-sm:hidden text-xs text-slate-400">管理 Maya、Leon、Iris 與 Jack 四位專家</p>
          </div>
        </div>
        
        <button
          onClick={handleClearHistory}
          title="清除對話紀錄"
          className="max-sm:min-h-11 max-sm:min-w-11 max-sm:flex max-sm:items-center max-sm:justify-center max-sm:p-2 p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all duration-300 cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Chat Area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6 max-sm:px-3 max-sm:py-3 max-sm:space-y-4 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          return (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-[85%] max-sm:max-w-[94%] max-sm:gap-0 ${
                isUser ? "ml-auto flex-row-reverse" : "mr-auto"
              }`}
            >
              {/* Avatar */}
              <div
                className={`max-sm:hidden w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-md ${
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
                  className={`max-sm:px-3 max-sm:text-[15px] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    isUser
                      ? "bg-amber-500 text-slate-950 font-medium rounded-tr-none shadow-md shadow-amber-500/5"
                      : "bg-slate-900/80 text-slate-200 border border-slate-800/80 rounded-tl-none"
                  }`}
                >
                  {msg.content}
                </div>
                <div className={`message-meta max-sm:flex max-sm:min-h-11 max-sm:items-center max-sm:gap-2 ${isUser ? "text-right" : "text-left"}`}>
                  <span
                    className={`message-time text-[10px] text-slate-500 block px-1 ${isUser ? "text-right" : "text-left"}`}
                    suppressHydrationWarning
                  >
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {!isUser && (
                    <button
                      type="button"
                      aria-label={copiedMessageId === msg.id ? "已複製訊息" : "複製訊息"}
                      onClick={() => void handleCopyMessage(msg.id, msg.content)}
                      className="touch-only min-h-11 min-w-11 items-center justify-center gap-1 rounded-lg px-2 text-[11px] font-semibold text-slate-400 hover:bg-slate-800 hover:text-amber-200"
                    >
                      <Copy aria-hidden="true" className="h-3.5 w-3.5" />
                      {copiedMessageId === msg.id ? "已複製" : "複製"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* AI Thinking Animation */}
        {isLoading && (
          <div className="flex gap-3 max-w-[85%] max-sm:max-w-[94%] max-sm:gap-0 mr-auto">
            <div className="max-sm:hidden w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-slate-950 shadow-md">
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

      {/* 進度與狀態面板 */}
      {progress.stage !== 0 && (
        <div className={`mx-4 mb-2 p-3 rounded-xl border ${progress.stage === -1 ? "bg-red-500/10 border-red-500/30" : progress.stage === 4 ? "bg-emerald-500/10 border-emerald-500/30" : "bg-amber-500/10 border-amber-500/20"}`}>
          <div className="flex items-center justify-between gap-2">
            <div className={`text-xs font-bold ${progress.stage === -1 ? "text-red-300" : progress.stage === 4 ? "text-emerald-300" : "text-amber-400"}`}>
              {progress.stage === 1 && "① 營運長拆解任務中"}
              {progress.stage === 2 && "② Maya 寫社群文案、Iris 規劃 SEO 中"}
              {progress.stage === 3 && "③ Leon 設計網頁、Jack 估算廣告中"}
              {progress.stage === 4 && `✓ ${progress.note}`}
              {progress.stage === -1 && `⚠ ${progress.note}`}
              {progress.stage >= 1 && progress.stage <= 3 && activeFramework !== "default" && (
                <span className="ml-2 font-normal text-sky-300">
                  套用框架：{COPYWRITING_FRAMEWORKS[activeFramework]?.name}
                </span>
              )}
              {progress.stage >= 1 && progress.stage <= 3 && (
                <span className="ml-2 font-normal text-slate-400" data-tick={tick}>
                  已進行 {Math.max(0, Math.round((Date.now() - progress.startedAt) / 1000))} 秒
                </span>
              )}
            </div>
            {progress.stage >= 1 && progress.stage <= 3 ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleCancelGeneration}
                className="shrink-0"
              >
                取消生成
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setProgress({ stage: 0, startedAt: 0, note: "" })}
                className="shrink-0"
              >
                關閉
              </Button>
            )}
          </div>
          {progress.stage >= 1 && progress.stage <= 3 && (
            <>
              <div className="mt-2 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full bg-amber-400 transition-all duration-500" style={{ width: `${progress.stage * 30}%` }} />
              </div>
              <div className="mt-1.5 text-[10px] text-slate-400">
                通常 30 到 90 秒。免費主機閒置後第一次可能多等約 50 秒。出錯時這裡會變紅並說明原因。
              </div>
            </>
          )}
        </div>
      )}

      {/* Input Form */}
      <form
        onSubmit={handleSend}
        className="chat-settings shrink-0 p-4 pb-safe bg-slate-900/20 border-t border-slate-800/60 backdrop-blur-md flex flex-col gap-2.5"
      >
        <div className="mobile-settings-summary sm:hidden">
          <button
            type="button"
            aria-expanded={mobileSettingsOpen}
            aria-controls="mobile-chat-settings"
            onClick={() => setMobileSettingsOpen(true)}
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 text-sm font-bold text-amber-200"
          >
            <Settings2 aria-hidden="true" className="h-4 w-4" />
            設定
          </button>
          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-400" aria-live="polite">
            {GUARD_BRAND_LABEL[currentBrandKey]}　{panelTab === "general" ? "一般指令" : "文體生成"}
          </span>
        </div>

        <div
          id="mobile-chat-settings"
          className={`mobile-settings-layer${mobileSettingsOpen ? " is-open" : ""}`}
          aria-hidden={isSmallViewport ? !mobileSettingsOpen : undefined}
        >
          <button
            type="button"
            className="mobile-settings-backdrop"
            aria-label="點擊關閉設定"
            tabIndex={mobileSettingsOpen ? 0 : -1}
            onClick={() => setMobileSettingsOpen(false)}
          />
          <div
            className="mobile-settings-panel"
            role={isSmallViewport && mobileSettingsOpen ? "dialog" : undefined}
            aria-modal={isSmallViewport && mobileSettingsOpen ? "true" : undefined}
            aria-label={isSmallViewport && mobileSettingsOpen ? "聊天設定" : undefined}
          >
            <div className="mobile-settings-header">
              <span className="mobile-settings-handle" aria-hidden="true" />
              <span className="text-sm font-bold text-slate-200">設定</span>
              <button
                type="button"
                onClick={() => setMobileSettingsOpen(false)}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl px-3 text-sm font-semibold text-amber-200 hover:bg-slate-800"
              >
                完成
              </button>
            </div>
            <div className="mobile-settings-content">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="text-[11px] font-bold h-7 inline-flex items-center px-2.5 rounded-lg border border-slate-700/80 bg-slate-800/80 text-slate-200 whitespace-nowrap"
            title="之後送出的指令與文體生成，都會以這個品牌的語氣與規範產出"
          >
            目前品牌：{GUARD_BRAND_LABEL[currentBrandKey]}
          </span>
          <div className="flex items-center gap-1 bg-slate-950/60 p-0.5 rounded-lg border border-slate-800">
            <Button size="sm" variant="ghost" active={panelTab === "general"} disabled={isLoading || isGenerating} onClick={() => choosePanelTab("general")}>
              一般指令
            </Button>
            <Button size="sm" variant="ghost" active={panelTab === "genre"} disabled={isLoading || isGenerating} onClick={() => choosePanelTab("genre")} title="用文體骨架（案例文、拆解文、邀請文）直接生成">
              文體生成
            </Button>
          </div>
          {canExpandSettings && (
            <Button size="sm" variant="secondary" className="ml-auto" disabled={isLoading || isGenerating} onClick={toggleSettings}>
              {settingsOpen ? "收起設定 ▲" : "展開設定 ▼"}
            </Button>
          )}
        </div>
        {panelTab === "general" && (
          <div className="flex flex-wrap items-center gap-2">
          <select 
            value={activeFramework}
            onChange={(e) => setActiveFramework(e.target.value)}
            disabled={isLoading || isGenerating}
            title="選擇寫作框架 (大師模式)"
            className="h-7 min-w-0 max-w-[16rem] text-[11px] bg-slate-800/80 text-slate-300 border border-slate-700/80 rounded-lg px-2 outline-none focus:ring-1 focus:ring-amber-500/50 disabled:opacity-50 cursor-pointer"
          >
            {WRITING_FRAMEWORK_OPTIONS.map(fw => (
              <option key={fw.id} value={fw.id} title={fw.description}>
                {fw.name}
              </option>
            ))}
          </select>
            {activeFramework === STORY_ARGUMENT_FRAMEWORK_ID && !settingsOpen && (
              <span className="text-[11px] text-amber-200/80 truncate" title={storySummary}>
                {storySummary}
              </span>
            )}
          </div>
        )}
        {panelTab === "genre" && settingsOpen && (
          <div className="max-h-[40dvh] overflow-y-auto rounded-xl border border-slate-700/80 bg-slate-950/60 p-3 space-y-2">
            <div className="rounded-lg border border-slate-700/80 bg-slate-900/60 p-2 space-y-1.5">
              <button
                type="button"
                onClick={() => setPasteOpen((o) => !o)}
                className="w-full flex items-center justify-between text-xs sm:text-[11px] font-bold text-slate-300 cursor-pointer"
              >
                <span>貼上選題，自動填入下方欄位</span>
                <span className="text-slate-500">{pasteOpen ? "收起 ▲" : "展開 ▼"}</span>
              </button>
              {pasteOpen && (
                <div className="space-y-1.5">
              <div className="text-xs sm:text-[10px] text-slate-400">貼上選題：把每週品牌調研的 Telegram 訊息整段貼進來，會自動填入下方的文體、漏斗層、主張與素材</div>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={3}
                placeholder="貼上「題目 1｜我的看法 …【主張】…」"
                className="w-full text-xs bg-slate-900 text-slate-100 border border-slate-700 rounded-md px-2 py-1.5 outline-none focus:border-amber-500/60 placeholder-slate-600"
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handlePasteParse}
                  disabled={!pasteText.trim()}
                >
                  解析並填入
                </Button>
                {pasteApplied && <span className="text-[10px] text-emerald-300 truncate">已填入：{pasteApplied}</span>}
              </div>
              {pasteBundle && pasteBundle.topics.length > 1 && (
                <div className="space-y-1">
                  <div className="text-[10px] text-slate-400">找到 {pasteBundle.topics.length} 個選題，選一個填入：</div>
                  {pasteBundle.topics.map((tp) => (
                    <button
                      key={tp.index}
                      type="button"
                      onClick={() => applyPastedTopic(tp, pasteBundle)}
                className="block w-full text-left text-xs sm:text-[11px] text-slate-200 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-md px-2 py-1 cursor-pointer"
                    >
                      題目 {tp.index}｜{tp.mode || "選題"}｜{tp.genreRaw || "文體未定"}：{tp.title || tp.claim}
                    </button>
                  ))}
                </div>
              )}
              {pasteNotes.map((n, i) => (
                <div key={i} className="text-[10px] text-amber-300 leading-relaxed">• {n}</div>
              ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs sm:text-[10px] text-slate-400">
                文體
                <select
                  value={genreId}
                  onChange={(e) => { setGenreId(e.target.value as GenreId); setGenreError(""); }}
                  className="mt-2 sm:mt-0.5 w-full text-xs bg-slate-800 text-slate-200 border border-slate-700 rounded-md px-2 py-1 cursor-pointer"
                >
                  {GENRE_LIST.map((g) => (
                    <option key={g.id} value={g.id} disabled={!g.enabled}>
                      {g.name}{g.enabled ? "" : "（未啟用）"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex-1 text-xs sm:text-[10px] text-slate-400">
                漏斗層
                <select
                  value={funnel}
                  onChange={(e) => setFunnel(e.target.value as FunnelLevel)}
                  className="mt-2 sm:mt-0.5 w-full text-xs bg-slate-800 text-slate-200 border border-slate-700 rounded-md px-2 py-1 cursor-pointer"
                >
                  {(Object.keys(FUNNEL_LABEL) as FunnelLevel[]).map((f) => (
                    <option key={f} value={f}>{FUNNEL_LABEL[f]}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="text-[10px] text-slate-500 leading-relaxed">{GENRES[genreId].when}</div>
            <label className="block text-xs sm:text-[10px] text-slate-400">
              主張（必填）：這篇要讓讀者接受的那一件事，一句話
              <input
                value={gClaim}
                onChange={(e) => setGClaim(e.target.value)}
                className="mt-2 sm:mt-0.5 w-full text-xs bg-slate-900 text-slate-100 border border-slate-700 rounded-md px-2 py-1.5 outline-none focus:border-amber-500/60"
              />
            </label>
            <label className="block text-xs sm:text-[10px] text-slate-400">
              {GENRES[genreId].materialLabel}{GENRES[genreId].materialRequired ? "（必填）" : ""}
              <textarea
                value={gMaterial}
                onChange={(e) => setGMaterial(e.target.value)}
                rows={4}
                placeholder={GENRES[genreId].materialHint}
                className="mt-2 sm:mt-0.5 w-full text-xs bg-slate-900 text-slate-100 border border-slate-700 rounded-md px-2 py-1.5 outline-none focus:border-amber-500/60 placeholder-slate-600"
              />
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <label className="flex-1 text-xs sm:text-[10px] text-slate-400">
                比喻（選填，留空由 AI 提案並標示）
                <input value={gMetaphor} onChange={(e) => setGMetaphor(e.target.value)} className="mt-2 sm:mt-0.5 w-full text-xs bg-slate-900 text-slate-100 border border-slate-700 rounded-md px-2 py-1.5 outline-none focus:border-amber-500/60" />
              </label>
              <label className="w-24 text-xs sm:text-[10px] text-slate-400">
                長度（選填）
                <input value={gLength} onChange={(e) => setGLength(e.target.value)} placeholder={`${GENRES[genreId].lengthRange[0]}–${GENRES[genreId].lengthRange[1]}`} className="mt-2 sm:mt-0.5 w-full text-xs bg-slate-900 text-slate-100 border border-slate-700 rounded-md px-2 py-1.5 outline-none focus:border-amber-500/60 placeholder-slate-600" />
              </label>
            </div>
            <label className="block text-xs sm:text-[10px] text-slate-400">
              CTA（選填，留空就不放）
              <input value={gCta} onChange={(e) => setGCta(e.target.value)} className="mt-2 sm:mt-0.5 w-full text-xs bg-slate-900 text-slate-100 border border-slate-700 rounded-md px-2 py-1.5 outline-none focus:border-amber-500/60" />
            </label>
            {genreError && <div className="text-[11px] text-red-300">{genreError}</div>}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-slate-500">以 Facebook 長文格式產出；Threads、IG 請之後用「改寫」。品牌：{activeBrandName}</span>
              <Button
                type="button"
                variant="primary"
                onClick={handleGenreGenerate}
                disabled={isLoading || isGenerating}
                className="shrink-0"
              >
                用此文體生成
              </Button>
            </div>
          </div>
        )}
        {panelTab === "general" && settingsOpen && activeFramework === STORY_ARGUMENT_FRAMEWORK_ID && (
          <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-2.5 space-y-2">
            <div className="flex flex-col sm:flex-row gap-2">
              <label className="flex-1 text-xs sm:text-[10px] text-slate-400">
                版本
                <select
                  value={storyArgumentVersion}
                  onChange={(e) => setStoryArgumentVersion(e.target.value as StoryArgumentVersion)}
                  disabled={isLoading || isGenerating}
                  className="mt-2 sm:mt-0.5 w-full text-xs bg-slate-800 text-slate-200 border border-slate-700 rounded-md px-2 py-1 cursor-pointer"
                >
                  {STORY_ARGUMENT_VERSION_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                </select>
              </label>
              <label className="flex-[2] text-xs sm:text-[10px] text-slate-400">
                一句話論點（可留空，由 AI 擬定）
                <input
                  value={storyArgumentThesis}
                  onChange={(e) => setStoryArgumentThesis(e.target.value)}
                  disabled={isLoading || isGenerating}
                  placeholder="留空時會顯示在文章上方，不併入發佈內容"
                  className="mt-2 sm:mt-0.5 w-full text-xs bg-slate-900 text-slate-100 border border-slate-700 rounded-md px-2 py-1.5 outline-none focus:border-amber-500/60 placeholder-slate-600"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="min-w-[150px] flex-1 text-xs sm:text-[10px] text-slate-400">
                引用來源
                <select
                  value={storyCitationMode}
                  onChange={(e) => setStoryCitationMode(e.target.value as StoryArgumentCitationMode)}
                  disabled={isLoading || isGenerating}
                  className="mt-2 sm:mt-0.5 w-full text-xs bg-slate-800 text-slate-200 border border-slate-700 rounded-md px-2 py-1 cursor-pointer"
                >
                  {STORY_ARGUMENT_CITATION_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                </select>
              </label>
              {storyCitationMode === "selected" && storyArgumentVersion === "full" && (
                <label className="min-w-[220px] flex-[2] text-xs sm:text-[10px] text-slate-400">
                  指定書籍
                  <select
                    value={selectedKnowledgeNoteId}
                    onChange={(e) => setSelectedKnowledgeNoteId(e.target.value)}
                    disabled={isLoading || isGenerating || knowledgeNotes.length === 0}
                    className="mt-2 sm:mt-0.5 w-full text-xs bg-slate-800 text-slate-200 border border-slate-700 rounded-md px-2 py-1 cursor-pointer"
                  >
                    <option value="">請選擇一本筆記</option>
                    {[...new Set(knowledgeNotes.map((note) => note.domain))].map((domain) => (
                      <optgroup key={domain} label={KNOWLEDGE_DOMAIN_LABELS[domain] || domain}>
                        {knowledgeNotes.filter((note) => note.domain === domain).map((note) => {
                          const eligible = isStoryArgumentCitationEligible(note);
                          return (
                            <option key={note.id} value={note.id} disabled={!eligible}>
                              {eligible
                                ? `《${note.title_zh}》，${note.author_zh}`
                                : `${note.title || "未提供英文書名"}（缺中文書名或作者）`}
                            </option>
                          );
                        })}
                      </optgroup>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <div className="text-[10px] text-slate-500">
              {storySelectionError || (storyArgumentVersion === "empathy"
                ? "共情版不強制引用，也不會加入出處或待補標記。"
                : storyCitationMode === "none"
                  ? "本篇不引用，不會加入出處或待補標記。"
                  : storyCitationMode === "auto"
                    ? "伺服器會先依書目挑選，再讀取相關內容；引用不符時會標示【需補：引用來源】。"
                    : knowledgeNotesError || "書目依領域分組；全文僅由伺服器端讀取。若目錄尚未載入，請稍候再選。")}
            </div>
            {storySelectionError && <div role="alert" className="text-[10px] font-semibold text-rose-300">{storySelectionError}</div>}
            <div className="text-[10px] text-amber-200/80">{STORY_ARGUMENT_GENRE_NOTICE}</div>
          </div>
        )}
            </div>
          </div>
        </div>
        <div className="mobile-composer flex gap-2.5">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={isSmallViewport ? "對 Erick 下達指令…" : `對 Erick 營運長下達【${activeBrandName}】指令...`}
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
        </div>
      </form>

      {brandConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl border border-amber-500/40 bg-slate-900 p-5 space-y-3 shadow-2xl">
            <h3 className="text-sm font-bold text-amber-300">品牌可能搞錯了</h3>
            <div className="space-y-1.5">
              {brandConfirm.lines.map((l, i) => (
                <p key={i} className="text-xs text-slate-200 leading-relaxed">{l}</p>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              繼續的話，會用「{GUARD_BRAND_LABEL[currentBrandKey]}」的語氣與規範生成。想換品牌，請取消後到左側切換。
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setBrandConfirm(null)}
              >
                取消
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => { const c = brandConfirm; setBrandConfirm(null); c.onConfirm(); }}
              >
                仍用目前品牌生成
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
