import { NextResponse } from "next/server";
import { getKnowledgeNoteDirectory } from "@/lib/knowledge-notes-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const notes = await getKnowledgeNoteDirectory();
    return NextResponse.json({ notes });
  } catch (error) {
    console.error("GET /api/knowledge-notes failed:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "目前無法讀取引用來源目錄。" }, { status: 503 });
  }
}
