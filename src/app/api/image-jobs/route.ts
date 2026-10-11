import { NextRequest, NextResponse } from "next/server";
import { CARD_SIZES } from "@/lib/card-layout.mjs";
import { buildComfyPrompt, randomSeed, validateJobInput } from "@/lib/image-jobs.mjs";
import { cancelImageJob, createImageJob, getImageJob, readWorkerStatus } from "@/lib/image-jobs-server";

export const dynamic = "force-dynamic";

/**
 * 本機 ComfyUI 生圖工作。登入保護由 src/proxy.ts 統一處理。
 * POST：建立一筆待生成工作（Mac mini 會自動收到）。不呼叫任何 LLM，不花 token。
 * GET ?id=…：查工作狀態與 Mac mini 是否在線；不帶 id 只回 Mac mini 狀態。
 * DELETE ?id=…：取消還在等待的工作。
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const checked = validateJobInput(body, Object.keys(CARD_SIZES));
    if (!checked.ok || !checked.value) return NextResponse.json({ error: checked.error || "輸入不正確。" }, { status: 400 });
    const seed = randomSeed();
    const { prompt, negative } = buildComfyPrompt({ brandId: checked.value.brandId, seed });
    const [job, worker] = await Promise.all([
      createImageJob({ ...checked.value, prompt, negative, seed }),
      readWorkerStatus(),
    ]);
    return NextResponse.json({ success: true, job, workerOnline: worker.online, workerSeenAt: worker.seenAt });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message.slice(0, 300) : "建立生圖工作失敗" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    const worker = await readWorkerStatus();
    if (!id) return NextResponse.json({ workerOnline: worker.online, workerSeenAt: worker.seenAt });
    const job = await getImageJob(id);
    if (!job) return NextResponse.json({ error: "找不到這筆工作。" }, { status: 404 });
    return NextResponse.json({ job, workerOnline: worker.online, workerSeenAt: worker.seenAt });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message.slice(0, 300) : "查詢失敗" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "缺少工作 ID。" }, { status: 400 });
    const cancelled = await cancelImageJob(id);
    return NextResponse.json({ success: true, cancelled });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message.slice(0, 300) : "取消失敗" }, { status: 500 });
  }
}
