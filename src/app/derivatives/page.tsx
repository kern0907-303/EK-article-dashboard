import DerivativesWorkspace from "@/components/DerivativesWorkspace";
import PipelineDerivatives from "@/components/PipelineDerivatives";

export default function DerivativesPage() {
  if (process.env.DERIVATIVES_ENABLED !== "true") {
    return <main className="min-h-screen bg-slate-950 p-8 text-slate-200">多平台衍生功能尚未啟用。</main>;
  }
  return (
    <div className="bg-slate-950 pt-6">
      <div className="px-4 sm:px-8"><PipelineDerivatives /></div>
      <details className="mx-auto max-w-6xl px-4 pb-8 sm:px-8">
        <summary className="cursor-pointer rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-300">進階：貼上外部文章，手動產生各平台草稿（一般用不到，要用再展開）</summary>
        <DerivativesWorkspace />
      </details>
    </div>
  );
}
