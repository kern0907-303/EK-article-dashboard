import DerivativesWorkspace from "@/components/DerivativesWorkspace";

export default function DerivativesPage() {
  if (process.env.DERIVATIVES_ENABLED !== "true") {
    return <main className="min-h-screen bg-slate-950 p-8 text-slate-200">多平台衍生功能尚未啟用。</main>;
  }
  return <DerivativesWorkspace />;
}
