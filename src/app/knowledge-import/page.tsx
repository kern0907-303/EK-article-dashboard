import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import KnowledgeImportWorkspace from "@/components/KnowledgeImportWorkspace";
import { AUTH_COOKIE, isGateEnabled, isValidToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function KnowledgeImportPage() {
  if (!isGateEnabled()) {
    return <main className="min-h-screen bg-slate-950 p-8 text-slate-100"><h1 className="text-xl font-semibold">知識庫匯入無法公開使用</h1><p className="mt-2 text-sm text-slate-400">請先啟用儀表板登入保護，再登入使用此頁面。</p></main>;
  }
  const cookieStore = await cookies();
  if (!(await isValidToken(cookieStore.get(AUTH_COOKIE)?.value))) redirect("/login");
  return <KnowledgeImportWorkspace />;
}
