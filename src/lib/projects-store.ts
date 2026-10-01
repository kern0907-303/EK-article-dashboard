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
  { id: "brand_a_i8", label: "I8（企業顧問）" },
  { id: "brand_b_nas", label: "NAS（生命靈數）" },
  { id: "brand_c_abl", label: "ABL（信息場調頻）" },
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
