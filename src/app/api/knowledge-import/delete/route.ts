import { NextRequest, NextResponse } from "next/server";
import { deleteKnowledgeImportNote, isKnowledgeImportAuthorized, safeKnowledgeImportError } from "@/lib/knowledge-import-server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!(await isKnowledgeImportAuthorized(request))) {
    return NextResponse.json({ error: "此頁面需要已啟用的登入保護與有效登入狀態。" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const id = typeof body?.id === "string" ? body.id : "";
    const confirmationTitle = typeof body?.confirmation_title === "string" ? body.confirmation_title : "";
    if (!/^[0-9a-f-]{36}$/iu.test(id)) return NextResponse.json({ error: "筆記 ID 格式無效。" }, { status: 400 });
    const result = await deleteKnowledgeImportNote(id, confirmationTitle);
    if (result.kind === "missing") return NextResponse.json({ error: "找不到這筆知識筆記。" }, { status: 404 });
    if (result.kind === "unconfirmable") return NextResponse.json({ error: "中文與英文書名皆空白，無法確認刪除。" }, { status: 400 });
    if (result.kind === "confirmation-mismatch") return NextResponse.json({ error: "確認書名不符，資料未刪除。" }, { status: 400 });
    if (result.kind === "changed") return NextResponse.json({ error: "資料已變動，請重新整理後再刪除。備份編號：" + result.backupId }, { status: 409 });
    return NextResponse.json({
      success: true,
      deleted_id: result.note.id,
      deleted_title: result.note.title_zh || result.note.title,
      backup_id: result.backupId,
      deleted_at: result.deletedAt,
    });
  } catch (error) {
    const result = safeKnowledgeImportError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
