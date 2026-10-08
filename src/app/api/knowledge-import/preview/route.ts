import { NextRequest, NextResponse } from "next/server";
import { isKnowledgeImportAuthorized, previewKnowledgeImport, safeKnowledgeImportError } from "@/lib/knowledge-import-server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!(await isKnowledgeImportAuthorized(request))) {
    return NextResponse.json({ error: "此頁面需要已啟用的登入保護與有效登入狀態。" }, { status: 401 });
  }
  try {
    return NextResponse.json(await previewKnowledgeImport(await request.formData()));
  } catch (error) {
    const result = safeKnowledgeImportError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
