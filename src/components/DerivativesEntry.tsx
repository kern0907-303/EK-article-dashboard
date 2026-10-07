"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function DerivativesEntry() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let active = true;
    void fetch("/api/derivatives?summary=1", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((value) => { if (active) setEnabled(value?.enabled === true); })
      .catch(() => { if (active) setEnabled(false); });
    return () => { active = false; };
  }, []);
  if (!enabled) return null;
  return <Link href="/derivatives" className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-2 text-[10px] font-semibold text-cyan-100 hover:bg-cyan-500/20 sm:text-xs">多平台衍生</Link>;
}
