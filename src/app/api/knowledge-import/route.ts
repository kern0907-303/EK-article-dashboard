import { NextRequest, NextResponse } from "next/server";
import {
  getKnowledgeImportOverview,
  isKnowledgeImportAuthorized,
  KNOWLEDGE_IMPORT_PATCH_FIELDS,
  safeKnowledgeImportError,
  updateUnverifiedKnowledgeNote,
} from "@/lib/knowledge-import-server";

export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ error: "此頁面需要已啟用的登入保護與有效登入狀態。" }, { status: 401 });
}

export async function GET(request: NextRequest) {
  if (!(await isKnowledgeImportAuthorized(request))) return unauthorized();
  try {
    return NextResponse.json(await getKnowledgeImportOverview());
  } catch (error) {
    const result = safeKnowledgeImportError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}

export async function PATCH(request: NextRequest) {
  if (!(await isKnowledgeImportAuthorized(request))) return unauthorized();
  try {
    const body = await request.json();
    const id = typeof body?.id === "string" ? body.id : "";
    if (!id) return NextResponse.json({ error: "缺少筆記 ID。" }, { status: 400 });
    const patch: Record<string, string> = {};
    for (const field of KNOWLEDGE_IMPORT_PATCH_FIELDS) {
      if (Object.hasOwn(body, field)) {
        if (typeof body[field] !== "string") return NextResponse.json({ error: "書目欄位必須是文字。" }, { status: 400 });
        patch[field] = body[field].trim();
      }
    }
    if (!Object.keys(patch).length) return NextResponse.json({ error: "沒有可儲存的書目欄位。" }, { status: 400 });
    const result = await updateUnverifiedKnowledgeNote(id, patch);
    if (result.kind === "missing") return NextResponse.json({ error: "找不到這筆知識筆記。" }, { status: 404 });
    if (result.kind === "not-unverified") return NextResponse.json({ error: "只有 unverified 筆記可由此頁編輯。" }, { status: 409 });
    return NextResponse.json({ success: true, note: result.note });
  } catch (error) {
    const result = safeKnowledgeImportError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
