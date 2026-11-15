// 階段專案清單的單一存取來源。
//
// 這份清單存在 localStorage，同時被 ProjectSelector（寫入）、page.tsx 與
// WorkspaceBoard（讀取）使用。瀏覽器原生的 "storage" 事件只會在「其他分頁」
// 改動時觸發，同分頁自己寫入不會通知自己，所以原本的做法是每 2 秒輪詢一次
// localStorage — 每次都產生新的陣列參考，逼 React 重繪整棵樹（含 2,283 行的
// WorkspaceBoard），閒置時 CPU 一直在轉。
//
// 這裡改用自訂事件：寫入端主動廣播，讀取端被動監聽，零輪詢。

export const PROJECTS_KEY = "google_sheets_projects";
export const PROJECTS_UPDATED_EVENT = "projects-updated";

/** 讀取專案清單；SSR 或資料損毀時回傳空陣列 */
export function readProjects<T = any>(): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Failed to parse projects cache:", error);
    return [];
  }
}

/** 依 id 取得專案名稱，找不到時回傳 fallback */
export function getProjectName(id: string, fallback = "階段專案"): string {
  const found = readProjects<{ id: string; name: string }>().find((p) => p.id === id);
  return found?.name || fallback;
}

/** 寫入專案清單並廣播給同分頁的所有訂閱者 */
export function writeProjects(list: unknown[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(PROJECTS_UPDATED_EVENT));
}

/**
 * 訂閱專案清單變更，回傳取消訂閱函式。
 * 同時監聽自訂事件（同分頁）與原生 storage 事件（跨分頁）。
 */
export function subscribeToProjects<T = any>(callback: (projects: T[]) => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handler = () => callback(readProjects<T>());
  const storageHandler = (e: StorageEvent) => {
    if (e.key === PROJECTS_KEY) handler();
  };

  window.addEventListener(PROJECTS_UPDATED_EVENT, handler);
  window.addEventListener("storage", storageHandler);

  return () => {
    window.removeEventListener(PROJECTS_UPDATED_EVENT, handler);
    window.removeEventListener("storage", storageHandler);
  };
}

// ---------------------------------------------------------------------------
// 專案「隸屬品牌」
//
// 階段專案必須隸屬 I8 / NAS / ABL / Erick 其中之一，決定：
//   1. 發文時預設的 Facebook 粉專
//   2. 文章上官網時的品牌分類（insights_articles.brand_id）
//   3. 品牌紅線檢查與配色主題
//   4. AI 生成時一併繼承所屬品牌的品牌規則
//
// 另存成獨立的對照表（專案 id → 品牌 id），而不是塞進專案物件，
// 因為專案清單會被 Google Sheet 同步整份覆蓋，塞進去會被洗掉。
// ---------------------------------------------------------------------------

export const PROJECT_PARENT_KEY = "project_parent_brands";

export const PARENT_BRAND_OPTIONS: { id: string; label: string }[] = [
  { id: "brand_a_i8", label: "初八企業顧問" },
  { id: "brand_b_nas", label: "平衡空間" },
  { id: "brand_c_abl", label: "艾伯林量子調頻" },
  { id: "personal_brand", label: "Erick（個人品牌）" },
];

function readParentMap(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(PROJECT_PARENT_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** 取得專案的所屬品牌 id；尚未設定回傳 null */
export function getProjectParentBrand(projectId: string): string | null {
  const v = readParentMap()[projectId];
  return PARENT_BRAND_OPTIONS.some((o) => o.id === v) ? v : null;
}

/** 設定專案的所屬品牌，並廣播讓畫面更新 */
export function setProjectParentBrand(projectId: string, brandId: string): void {
  if (typeof window === "undefined") return;
  const map = readParentMap();
  map[projectId] = brandId;
  localStorage.setItem(PROJECT_PARENT_KEY, JSON.stringify(map));
  window.dispatchEvent(new Event(PROJECTS_UPDATED_EVENT));
}

/**
 * 發文、粉專、主題用的「有效品牌 id」：
 * 一般品牌回傳自己；專案回傳所屬品牌；專案尚未設定所屬品牌回傳 null。
 */
export function resolveEffectiveBrandId(id: string): string | null {
  if (!id || !id.startsWith("project_")) return id;
  return getProjectParentBrand(id);
}

// ---------------------------------------------------------------------------
// 雲端同步（Supabase dashboard_projects，經由 /api/projects/store）
//
// 雲端是專案名稱、所屬品牌與專案事實表的正本；localStorage 只當快取。
// 換手機或換電腦打開看板時，從雲端補齊清單；新增專案或改事實表時推回雲端。
// 自動流水線也從同一份讀，所以三邊看到的事實表一致。
// ---------------------------------------------------------------------------

export interface ServerProject {
  id: string;
  name: string;
  guidelines: string;
  parent_brand: string | null;
}

/**
 * 把雲端清單併進本地清單（純函式，方便測試）：
 * 雲端有的專案以雲端名稱與事實表為準，其餘欄位保留本地；只在本地的專案保留不動。
 */
export function mergeServerProjects<T extends { id: string; name?: string; guidelines?: string }>(
  local: T[],
  server: ServerProject[],
): T[] {
  const byId = new Map(server.map((p) => [p.id, p]));
  const merged = local.map((item) => {
    const remote = byId.get(item.id);
    if (!remote) return item;
    byId.delete(item.id);
    return { ...item, name: remote.name, guidelines: remote.guidelines };
  });
  for (const remote of byId.values()) {
    merged.push({
      id: remote.id, name: remote.name, guidelines: remote.guidelines,
      social_copy: "", web_architecture: "", seo_keywords: [], ad_data: [], aeo_schema: "", aeo_faq: "",
    } as unknown as T);
  }
  return merged;
}

/** 從雲端讀專案、併進本地清單與所屬品牌對照表；回傳雲端清單（失敗回傳 null） */
export async function loadProjectsFromServer(): Promise<ServerProject[] | null> {
  if (typeof window === "undefined") return null;
  try {
    const res = await fetch("/api/projects/store", { cache: "no-store" });
    const data = await res.json();
    if (!data?.success || !Array.isArray(data.projects)) return null;
    const server = data.projects as ServerProject[];
    const map = readParentMap();
    for (const p of server) if (p.parent_brand) map[p.id] = p.parent_brand;
    localStorage.setItem(PROJECT_PARENT_KEY, JSON.stringify(map));
    writeProjects(mergeServerProjects(readProjects<{ id: string }>(), server));
    return server;
  } catch (error) {
    console.error("Failed to load projects from server:", error);
    return null;
  }
}

/** 把一個專案推到雲端（背景執行，失敗只記錄，不打斷畫面） */
export async function pushProjectToServer(project: { id: string; name?: string; guidelines?: string }): Promise<boolean> {
  if (typeof window === "undefined" || !project.id.startsWith("project_")) return false;
  try {
    const res = await fetch("/api/projects/store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project: {
          id: project.id,
          name: project.name || getProjectName(project.id),
          guidelines: project.guidelines || "",
          parent_brand: getProjectParentBrand(project.id),
        },
      }),
    });
    const data = await res.json();
    if (!data?.success) console.error("Failed to save project to server:", data?.error);
    return !!data?.success;
  } catch (error) {
    console.error("Network error saving project to server:", error);
    return false;
  }
}
