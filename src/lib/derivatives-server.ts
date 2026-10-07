import "server-only";
import { getSupabaseEnv, supabaseHeaders } from "@/lib/publish-queue";
import { selectPlatformSpec } from "@/lib/derivatives-core.mjs";

const TABLES = new Set(["platform_specs", "platform_content_rules", "derivative_posts"]);

export async function derivativesDb<T>(table: string, query = "", init: RequestInit = {}): Promise<T> {
  if (!TABLES.has(table)) throw new Error("不支援的衍生資料表。");
  const env = getSupabaseEnv();
  if (!env) throw new Error("伺服器未設定 Supabase 連線資訊。");
  const response = await fetch(`${env.url}/rest/v1/${table}${query ? `?${query}` : ""}`, {
    ...init,
    headers: supabaseHeaders(env.key, init.headers as Record<string, string> | undefined),
    cache: "no-store",
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`衍生資料表 ${table} 回應 HTTP ${response.status}：${error.slice(0, 240)}`);
  }
  if (response.status === 204) return [] as T;
  return response.json() as Promise<T>;
}

export async function readDerivativeCatalog() {
  const [specs, rules, posts] = await Promise.all([
    derivativesDb<any[]>("platform_specs", "select=*&order=platform.asc,format.asc"),
    derivativesDb<any[]>("platform_content_rules", "select=*&order=platform.asc,category.asc,language_version.asc"),
    derivativesDb<any[]>("derivative_posts", "select=*&order=updated_at.desc&limit=100"),
  ]);
  return { specs, rules, posts };
}

export function getSpecFor(specs: any[], platform: string, format: string) {
  return selectPlatformSpec(specs, platform, format);
}

export function getRulesFor(rules: any[], platform: string, languageVersion: string) {
  return rules.filter((item) => item.platform === platform && item.language_version === languageVersion && item.enabled);
}

export async function upsertDerivativeRows(rows: any[]) {
  return derivativesDb<any[]>("derivative_posts", "", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(rows),
  });
}
