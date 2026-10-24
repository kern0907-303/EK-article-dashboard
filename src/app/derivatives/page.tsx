import DerivativesWorkspace from "@/components/DerivativesWorkspace";
import PipelineDerivatives from "@/components/PipelineDerivatives";
import Link from "next/link";

export default function DerivativesPage() {
  if (process.env.DERIVATIVES_ENABLED !== "true") {
    return <main className="min-h-screen bg-slate-950 p-8 text-slate-200">多平台衍生功能尚未啟用。<Link href="/" className="ml-3 underline">回主工作區</Link></main>;
  }
  return (
    <div className="bg-slate-950 pt-6">
      <nav className="mx-auto mb-4 flex max-w-6xl flex-wrap gap-2 px-4 sm:px-8" aria-label="頁面導覽">
        <Link href="/" className="inline-flex min-h-[44px] items-center rounded-lg border border-white/20 px-4 text-sm font-semibold text-slate-100">回主工作區</Link>
        <Link href="/auto-pipeline" className="inline-flex min-h-[44px] items-center rounded-lg border border-white/20 px-4 text-sm font-semibold text-slate-100">自動流水線</Link>
        <Link href="/needs-attention" className="inline-flex min-h-[44px] items-center rounded-lg border border-white/20 px-4 text-sm font-semibold text-slate-100">待處理中心</Link>
      </nav>
      <div className="px-4 sm:px-8"><PipelineDerivatives /></div>
      <details className="mx-auto max-w-6xl px-4 pb-8 sm:px-8">
        <summary className="cursor-pointer rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-300">進階：貼上外部文章，手動產生各平台草稿（一般用不到，要用再展開）</summary>
        <DerivativesWorkspace />
      </details>
    </div>
  );
}
