// 階段專案的雲端存放（Supabase public.dashboard_projects）。
//
// 原本專案只存在瀏覽器 localStorage，換手機、換電腦或自動流水線都讀不到。
// 這裡是伺服器端唯一的讀寫入口：看板用 /api/projects/store 讀寫，
// 流水線直接呼叫 getProjectGuidelines() 取得專案事實表。
// 表只開給 service_role，金鑰只在伺服器端。

import { getSupabaseEnv, supabaseHeaders } from "@/lib/publish-queue";

export const PARENT_BRAND_IDS = ["brand_a_i8", "brand_b_nas", "brand_c_abl", "personal_brand"] as const;

export interface StoredProject {
  id: string;
  name: string;
  guidelines: string;
  parent_brand: string | null;
  updated_at?: string;
}

const MAX_GUIDELINES = 20000;

/** 檢查並整理要寫入的專案；不合格回傳錯誤訊息字串 */
export function normalizeProjectInput(raw: unknown): StoredProject | string {
  if (!raw || typeof raw !== "object") return "缺少專案資料";
  const input = raw as Record<string, unknown>;
  const id = typeof input.id === "string" ? input.id.trim() : "";
  if (!/^project_[A-Za-z0-9_-]+$/.test(id)) return "專案 id 格式不正確";
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) return "缺少專案名稱";
  const guidelines = typeof input.guidelines === "string" ? input.guidelines : "";
  if (guidelines.length > MAX_GUIDELINES) return `專案事實表超過 ${MAX_GUIDELINES} 字`;
  const parent = typeof input.parent_brand === "string" ? input.parent_brand : null;
  const parent_brand = parent && (PARENT_BRAND_IDS as readonly string[]).includes(parent) ? parent : null;
  return { id, name: name.slice(0, 120), guidelines, parent_brand };
}

/** 流水線用：把專案事實表包成附加在 Maya 指令後面的段落，沒有內容就回傳空字串 */
export function buildProjectFactsDirective(guidelines: string | null | undefined): string {
  const text = (guidelines || "").trim();
  if (!text) return "";
  return `【本專案事實表（優先，價格與規則以此為準）】\n${text}`;
}

function env() {
  const found = getSupabaseEnv();
  if (!found) throw new Error("Supabase 尚未設定（NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY）");
  return found;
}

export async function listProjects(): Promise<StoredProject[]> {
  const { url, key } = env();
  const res = await fetch(`${url}/rest/v1/dashboard_projects?select=id,name,guidelines,parent_brand,updated_at&order=created_at.asc`, {
    headers: supabaseHeaders(key), cache: "no-store",
  });
  if (!res.ok) throw new Error(`讀取專案失敗：${res.status} ${await res.text()}`);
  return res.json();
}

export async function upsertProject(project: StoredProject): Promise<StoredProject> {
  const { url, key } = env();
  const body = { ...project, updated_at: new Date().toISOString() };
  const res = await fetch(`${url}/rest/v1/dashboard_projects?on_conflict=id`, {
    method: "POST",
    headers: supabaseHeaders(key, { Prefer: "resolution=merge-duplicates,return=representation" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`寫入專案失敗：${res.status} ${await res.text()}`);
  const rows = await res.json();
  return rows[0];
}

/** 流水線用：取專案事實表。查不到、未設定或連線失敗都回傳空字串，不讓流水線因此中斷。 */
export async function getProjectGuidelines(projectId: string | null | undefined): Promise<string> {
  if (!projectId || !projectId.startsWith("project_")) return "";
  const found = getSupabaseEnv();
  if (!found) return "";
  try {
    const res = await fetch(`${found.url}/rest/v1/dashboard_projects?id=eq.${encodeURIComponent(projectId)}&select=guidelines&limit=1`, {
      headers: supabaseHeaders(found.key), cache: "no-store",
    });
    if (!res.ok) return "";
    const rows = await res.json();
    return typeof rows?.[0]?.guidelines === "string" ? rows[0].guidelines : "";
  } catch {
    return "";
  }
}
