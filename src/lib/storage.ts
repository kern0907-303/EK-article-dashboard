// 資料層：品牌對話與看板資料的讀寫與訂閱。
//
// 原本此檔同時包含 Firestore 與 LocalStorage 兩套實作，但六個
// NEXT_PUBLIC_FIREBASE_* 環境變數從未設定，Firestore 分支永遠不會執行，
// 卻讓整包 Firebase SDK 被打包進 client bundle。2026-08 清理時已整段移除。
//
// 若日後要接回 Firestore，請在此新增 adapter 並改為動態 import，
// 不要再用靜態 import 把 SDK 拉進前端。
import { DEFAULT_MOCK_WORKSPACE, DEFAULT_MOCK_CHATS } from "@/data/seed/defaults";
import { getProjectName } from "@/lib/projects-store";

export { DEFAULT_MOCK_WORKSPACE, DEFAULT_MOCK_CHATS };

const CHAT_KEY = (brandId: string) => `ai_team_dashboard_chat_${brandId}`;
const WORKSPACE_KEY = (brandId: string) => `ai_team_dashboard_workspace_${brandId}`;

const seedChats = (brandId: string): ChatMessage[] => DEFAULT_MOCK_CHATS[brandId] || [];
const seedWorkspace = (brandId: string): WorkspaceData =>
  DEFAULT_MOCK_WORKSPACE[brandId] || DEFAULT_MOCK_WORKSPACE.brand_a_i8;

/** 讀取 localStorage，若不存在或損毀則寫入並回傳種子資料 */
function readOrSeed<T>(storageKey: string, seed: () => T): T {
  if (typeof window === "undefined") return seed();
  try {
    const data = localStorage.getItem(storageKey);
    if (data) return JSON.parse(data) as T;
  } catch (error) {
    console.error(`Failed to parse ${storageKey}, reseeding:`, error);
  }
  const initial = seed();
  localStorage.setItem(storageKey, JSON.stringify(initial));
  return initial;
}

// Data Types
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface SEOKeyword {
  keyword: string;
  volume: string;
  competition: string;
  outline: string;
}

export interface AdDataItem {
  label: string;
  value: string;
  change: string;
  isPositive?: boolean;
}

export interface ReachKillerItem {
  original_sentence: string;
  reason: string;
  viral_rewrite: string;
  improvement_type: string;
}

export interface TheoAnalysis {
  viral_score: number;
  explanation: string;
  reach_killers: ReachKillerItem[];
  analyzed_at: number;
  /** 被分析的文案雜湊；文案改過就和目前雜湊不同 → 標示「已過期」（舊資料沒有這欄，不標） */
  for_hash?: number;
}

export interface WorkspaceData {
  social_copy: string;
  social_copy_threads?: string;
  social_copy_facebook?: string;
  social_copy_instagram?: string;
  web_architecture: string;
  seo_keywords: SEOKeyword[];
  ad_data: AdDataItem[];
  aeo_schema?: string;
  aeo_faq?: string;
  brand_guidelines?: string;
  theo_analysis?: TheoAnalysis;
  theo_analysis_threads?: TheoAnalysis;
  theo_analysis_facebook?: TheoAnalysis;
  theo_analysis_instagram?: TheoAnalysis;
  active_platform?: string;
  /** 官網文章（與社群貼文分開存放；按「由社群文案產生官網文章」才會有） */
  web_article?: string;
  /** 官網文章的自動健檢結果（只評分不改寫） */
  seo_score?: import("@/lib/seo-optimizer").SeoScore;
  web_article_meta?: { generated_at?: number; edited_at?: number; from_hash?: number; from_platform?: string };
  /** 這篇文章是用哪個文體生成的（null 代表一般生成）。發文前的檢查會用到 */
  genre_meta?: import("@/data/skills/genres").GenreMeta | null;
  /** 故事論點框架的一句話論點，獨立顯示，不屬於社群文案正文 */
  story_argument_meta?: import("@/data/skills/story-argument").StoryArgumentMeta | null;
  /** 各平台社群文案的時間戳記：generated_at = AI 生成/改寫時間，edited_at = 手動編輯儲存時間（毫秒） */
  social_copy_meta?: Record<string, { generated_at?: number; edited_at?: number }>;
}

// --- LocalStorage Mock Event Emitter for Local Real-Time Sync ---
type EventCallback = (data: any) => void;
class MockEmitter {
  private events: Record<string, EventCallback[]> = {};

  on(event: string, cb: EventCallback) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(cb);
    return () => {
      this.events[event] = this.events[event].filter(x => x !== cb);
    };
  }

  emit(event: string, data: any) {
    if (this.events[event]) {
      this.events[event].forEach(cb => cb(data));
    }
  }
}
const localEmitter = new MockEmitter();

// --- 對話 ---

/** 訂閱聊天室對話歷史，回傳取消訂閱函式 */
export function subscribeToChat(brandId: string, callback: (messages: ChatMessage[]) => void): () => void {
  const storageKey = CHAT_KEY(brandId);
  callback(readOrSeed(storageKey, () => seedChats(brandId)));
  return localEmitter.on(`chat_update_${brandId}`, callback);
}

/** 附加一則新訊息到對話歷史 */
export async function saveChatMessage(
  brandId: string,
  message: { role: "user" | "assistant"; content: string }
): Promise<void> {
  const storageKey = CHAT_KEY(brandId);
  const chats = readOrSeed(storageKey, () => seedChats(brandId));

  const newMsg: ChatMessage = {
    id: Math.random().toString(36).slice(2, 11),
    role: message.role,
    content: message.content,
    timestamp: Date.now(),
  };
  const next = [...chats, newMsg];
  localStorage.setItem(storageKey, JSON.stringify(next));
  localEmitter.emit(`chat_update_${brandId}`, next);
}

/** 清除對話歷史，只保留第一則歡迎訊息 */
export async function clearChatHistory(brandId: string): Promise<void> {
  const storageKey = CHAT_KEY(brandId);
  const source = DEFAULT_MOCK_CHATS[brandId] || DEFAULT_MOCK_CHATS.brand_a_i8;
  const welcome = source.length > 0 ? [source[0]] : [];
  localStorage.setItem(storageKey, JSON.stringify(welcome));
  localEmitter.emit(`chat_update_${brandId}`, welcome);
}

// --- 看板 ---

/** 訂閱右側看板資料，回傳取消訂閱函式 */
export function subscribeToWorkspace(brandId: string, callback: (data: WorkspaceData) => void): () => void {
  const storageKey = WORKSPACE_KEY(brandId);
  callback(readOrSeed(storageKey, () => seedWorkspace(brandId)));
  return localEmitter.on(`workspace_update_${brandId}`, callback);
}

function syncPlatformFields(current: WorkspaceData, updatedFields: Partial<WorkspaceData>): Partial<WorkspaceData> {
  const merged = { ...current, ...updatedFields };
  const platform = merged.active_platform || "threads";
  
  const updates: Partial<WorkspaceData> = { ...updatedFields };
  
  // 1. If switching platform, populate the active copy and analysis from the target platform's stored values
  if (updatedFields.active_platform !== undefined && updatedFields.active_platform !== current.active_platform) {
    const targetPlat = updatedFields.active_platform;
    if (targetPlat === "threads") {
      if (updatedFields.social_copy === undefined) updates.social_copy = current.social_copy_threads !== undefined ? current.social_copy_threads : (current.active_platform === "threads" || !current.active_platform ? current.social_copy : "");
      updates.theo_analysis = current.theo_analysis_threads !== undefined ? current.theo_analysis_threads : (current.active_platform === "threads" || !current.active_platform ? current.theo_analysis : undefined);
    } else if (targetPlat === "facebook") {
      if (updatedFields.social_copy === undefined) updates.social_copy = current.social_copy_facebook !== undefined ? current.social_copy_facebook : (current.active_platform === "facebook" ? current.social_copy : "");
      updates.theo_analysis = current.theo_analysis_facebook !== undefined ? current.theo_analysis_facebook : (current.active_platform === "facebook" ? current.theo_analysis : undefined);
    } else if (targetPlat === "instagram") {
      if (updatedFields.social_copy === undefined) updates.social_copy = current.social_copy_instagram !== undefined ? current.social_copy_instagram : (current.active_platform === "instagram" ? current.social_copy : "");
      updates.theo_analysis = current.theo_analysis_instagram !== undefined ? current.theo_analysis_instagram : (current.active_platform === "instagram" ? current.theo_analysis : undefined);
    }
  }
  
  // 2. If copy is changing, sync it to the platform-specific field
  if (updates.social_copy !== undefined) {
    if (platform === "threads") {
      updates.social_copy_threads = updates.social_copy;
    } else if (platform === "facebook") {
      updates.social_copy_facebook = updates.social_copy;
    } else if (platform === "instagram") {
      updates.social_copy_instagram = updates.social_copy;
    }
  }
  
  // 3. If analysis is changing, sync it to the platform-specific field
  if (updates.theo_analysis !== undefined) {
    if (platform === "threads") {
      updates.theo_analysis_threads = updates.theo_analysis;
    } else if (platform === "facebook") {
      updates.theo_analysis_facebook = updates.theo_analysis;
    } else if (platform === "instagram") {
      updates.theo_analysis_instagram = updates.theo_analysis;
    }
  }
  
  return updates;
}

/** 更新部分看板欄位，並在階段專案模式下同步回 Google Sheet */
import { stripMarkdown } from "@/lib/plain-text";
import { resolveEffectiveBrandId } from "@/lib/projects-store";

export async function saveWorkspace(
  brandId: string,
  updatedFields: Partial<WorkspaceData>,
  opts?: { generated?: boolean }
): Promise<void> {
  const storageKey = WORKSPACE_KEY(brandId);
  const current = readOrSeed(storageKey, () => seedWorkspace(brandId));

  // AEO 問答集一律存成純文字（官網 FAQ 區與 Facebook 都不吃 Markdown 符號）
  if (typeof updatedFields.aeo_faq === "string") {
    updatedFields = { ...updatedFields, aeo_faq: stripMarkdown(updatedFields.aeo_faq) };
  }

  const syncedFields = syncPlatformFields(current, updatedFields);
  const finalData = { ...current, ...syncedFields };

  // 記錄社群文案時間：只在真的寫入文案內容時記錄（切換平台、「生成中／失敗」提示不算）
  const newCopy = updatedFields.social_copy;
  const isRealCopy =
    typeof newCopy === "string" &&
    newCopy.trim() !== "" &&
    !newCopy.startsWith("⏳") &&
    !newCopy.startsWith("❌") &&
    !newCopy.startsWith("⚠️") &&
    updatedFields.active_platform === undefined;
  if (isRealCopy && newCopy !== current.social_copy) {
    const plat = finalData.active_platform || "threads";
    const meta = { ...(current.social_copy_meta || {}) };
    const now = Date.now();
    meta[plat] = opts?.generated
      ? { generated_at: now }
      : { ...(meta[plat] || {}), edited_at: now };
    finalData.social_copy_meta = meta;
  }
  if (syncedFields.theo_analysis === undefined) {
    delete (finalData as any).theo_analysis;
  }
  localStorage.setItem(storageKey, JSON.stringify(finalData));
  localEmitter.emit(`workspace_update_${brandId}`, finalData);

  if (brandId.startsWith("project_")) {
    void syncProjectToSheet(brandId, finalData);
  }
}

/** 階段專案：把看板內容經由 /api/projects 代理寫回 Google Sheet（背景執行，不阻塞 UI） */
async function syncProjectToSheet(brandId: string, workspace: WorkspaceData): Promise<void> {
  if (typeof window === "undefined") return;
  const scriptUrl = localStorage.getItem("google_sheets_apps_script_url");
  if (!scriptUrl) return;

  const projectName = getProjectName(brandId);

  try {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: scriptUrl,
        project: {
          id: brandId,
          name: projectName,
          guidelines: workspace.brand_guidelines || "",
          social_copy: workspace.social_copy || "",
          web_architecture: workspace.web_architecture || "",
          seo_keywords: JSON.stringify(workspace.seo_keywords || []),
          ad_data: JSON.stringify(workspace.ad_data || []),
          aeo_schema: workspace.aeo_schema || "",
          aeo_faq: workspace.aeo_faq || "",
        },
      }),
    });
    const data = await res.json();
    if (!data.success) console.error("Failed to sync workspace to Google Sheet:", data.error);
  } catch (err) {
    console.error("Network error syncing workspace to Google Sheet:", err);
  }
}


/**
 * 取得送給 AI 的品牌規則：一般品牌是自己的品牌大腦；
 * 階段專案是「所屬品牌的品牌規則」＋「專案自己的補充規範」。
 */
export function getMergedBrandGuidelines(brandId: string): string {
  if (typeof window === "undefined") return "";
  const own = readOrSeed(WORKSPACE_KEY(brandId), () => seedWorkspace(brandId))?.brand_guidelines || "";
  if (!brandId.startsWith("project_")) return own;
  const parentId = resolveEffectiveBrandId(brandId);
  const parent = parentId
    ? readOrSeed(WORKSPACE_KEY(parentId), () => seedWorkspace(parentId))?.brand_guidelines || ""
    : "";
  if (parent && own) return `${parent}\n\n【本專案補充規範（優先於上述通用規則）】\n${own}`;
  return parent || own;
}
