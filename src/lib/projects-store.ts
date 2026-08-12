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
