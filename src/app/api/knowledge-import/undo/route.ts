import { NextRequest, NextResponse } from "next/server";
import { isKnowledgeImportAuthorized, safeKnowledgeImportError, undoKnowledgeImport } from "@/lib/knowledge-import-server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!(await isKnowledgeImportAuthorized(request))) {
    return NextResponse.json({ error: "此頁面需要已啟用的登入保護與有效登入狀態。" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const batchId = typeof body?.batch_id === "string" ? body.batch_id : "";
    if (!batchId || body?.confirm_batch_id !== batchId) {
      return NextResponse.json({ error: "撤銷前必須完成批次二次確認。" }, { status: 400 });
    }
    const result = await undoKnowledgeImport(batchId);
    return NextResponse.json({
      success: true,
      idempotent: result.idempotent,
      batch: {
        batch_id: result.batch.batch_id,
        created_at: result.batch.created_at,
        summary: result.batch.summary,
        inserted_ids: result.batch.inserted_ids,
        undone_at: result.batch.undone_at,
      },
    });
  } catch (error) {
    const result = safeKnowledgeImportError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
