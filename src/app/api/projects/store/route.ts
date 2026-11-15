// 階段專案雲端存放：GET 取全部專案，POST 新增或更新一個專案。
// 登入檢查由 src/proxy.ts 統一處理。
import { NextRequest, NextResponse } from "next/server";
import { listProjects, normalizeProjectInput, upsertProject } from "@/lib/projects-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ success: true, projects: await listProjects() });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const project = normalizeProjectInput(body?.project);
    if (typeof project === "string") return NextResponse.json({ success: false, error: project }, { status: 400 });
    return NextResponse.json({ success: true, project: await upsertProject(project) });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
