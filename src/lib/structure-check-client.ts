// 把一篇文章帶去「對照檢視」頁。用 localStorage 傳，新分頁打開，原本的工作區不會被換掉。
export const STRUCTURE_CHECK_KEY = "ek_structure_check";

export interface StructureCheckHandoff {
  text: string;
  structureId?: string | null;
  brand?: string;
  from?: string;
}

export function openStructureCheck(handoff: StructureCheckHandoff): void {
  try {
    localStorage.setItem(STRUCTURE_CHECK_KEY, JSON.stringify({ ...handoff, at: Date.now() }));
  } catch {
    // 瀏覽器不讓寫入時，對照頁打開後可以自己貼上文章
  }
  window.open("/structure-check", "_blank", "noopener");
}

export function readStructureCheckHandoff(): StructureCheckHandoff | null {
  try {
    const raw = localStorage.getItem(STRUCTURE_CHECK_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && typeof data.text === "string" ? data : null;
  } catch {
    return null;
  }
}
