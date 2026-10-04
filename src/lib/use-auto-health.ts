"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { saveWorkspace, type WorkspaceData } from "@/lib/storage";
import { getProjectName } from "@/lib/projects-store";
import { BRANDS } from "@/components/BrandSelector";
import { textHash, hasWebArticle, hasSocialCopy } from "@/lib/web-article";
import { shouldAutoCheck, healthHash } from "@/lib/seo-optimizer";

const KEY = "ek_auto_health";
const EVENT = "ek-auto-health-change";
const DEBOUNCE_MS = 3000;

/** 自動健檢開關（預設開啟）。存在瀏覽器，所有用到的元件同步。 */
export function useAutoHealthSetting(): [boolean, (v: boolean) => void] {
  const [enabled, setEnabled] = useState(true);
  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === "off") setEnabled(false);
    } catch {}
    const h = (e: Event) => setEnabled(!!(e as CustomEvent<boolean>).detail);
    window.addEventListener(EVENT, h);
    return () => window.removeEventListener(EVENT, h);
  }, []);
  const set = useCallback((v: boolean) => {
    try {
      localStorage.setItem(KEY, v ? "on" : "off");
    } catch {}
    window.dispatchEvent(new CustomEvent(EVENT, { detail: v }));
  }, []);
  return [enabled, set];
}

function brandLabel(brandId: string): string {
  if (brandId.startsWith("project_")) return getProjectName(brandId);
  return BRANDS.find((b) => b.id === brandId)?.name || brandId;
}

/**
 * 生成之後自動評分（只評分，不改寫）：
 * - 官網文章 → /api/seo/score（SEO / AEO / GEO，程式規則計分，不呼叫 AI、不花費用）
 * - 目前平台的社群貼文 → /api/theo/analyze（觸及分數）
 * 內容雜湊相同就不重跑；內容一改就等 3 秒（避免打字時連環呼叫）再重評；失敗同一份內容不重試。
 */
export function useAutoHealthCheck(brandId: string, data: WorkspaceData, aiProvider: string) {
  const [enabled] = useAutoHealthSetting();
  const [busy, setBusy] = useState<{ seo: boolean; theo: boolean }>({ seo: false, theo: false });
  const inFlight = useRef({ seo: false, theo: false });
  const attempted = useRef<{ seo?: number; theo?: number }>({});
  const latest = useRef({ brandId, data, aiProvider });
  latest.current = { brandId, data, aiProvider };

  // 換品牌就清掉「已嘗試」紀錄
  useEffect(() => {
    attempted.current = {};
  }, [brandId]);

  const webText = data.web_article || "";
  const faqText = data.aeo_faq || "";
  const schemaText = data.aeo_schema || "";
  const socialText = data.social_copy || "";
  const platform = data.active_platform || "threads";
  const isMock = aiProvider === "mock";

  // 官網文章 SEO / AEO / GEO
  useEffect(() => {
    const hash = healthHash(webText, faqText, schemaText);
    const ok = shouldAutoCheck({
      enabled,
      // 程式規則評分不用 AI，本地模擬大腦時也可以自動跑
      isMock: false,
      hasContent: hasWebArticle(webText),
      currentHash: hash,
      savedHash: data.seo_score?.for_hash,
      attemptedHash: attempted.current.seo,
      inFlight: inFlight.current.seo,
    });
    if (!ok) return;
    const timer = setTimeout(async () => {
      const cur = latest.current;
      if (healthHash(cur.data.web_article || "", cur.data.aeo_faq, cur.data.aeo_schema) !== hash) return;
      inFlight.current.seo = true;
      attempted.current.seo = hash;
      setBusy((b) => ({ ...b, seo: true }));
      try {
        const res = await fetch("/api/seo/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: webText,
            brandName: brandLabel(cur.brandId),
            keywords: cur.data.seo_keywords || [],
            faqText,
            schemaText,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || "自動健檢失敗");
        // 評分期間文章又被改了就丟棄（會由下一輪重評）
        const ld = latest.current.data;
        if (latest.current.brandId === cur.brandId && healthHash(ld.web_article || "", ld.aeo_faq, ld.aeo_schema) === hash) {
          await saveWorkspace(cur.brandId, { seo_score: json.data });
        }
      } catch (e) {
        console.warn("[auto-health] seo score failed:", e);
      } finally {
        inFlight.current.seo = false;
        setBusy((b) => ({ ...b, seo: false }));
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [enabled, webText, faqText, schemaText, data.seo_score?.for_hash]);

  // 目前平台社群貼文 Theo 觸及分數
  useEffect(() => {
    const hash = textHash(socialText);
    const saved = data.theo_analysis;
    // 舊分析沒有 for_hash：視為使用者手動跑過、不自動覆蓋
    if (saved && saved.for_hash === undefined) return;
    const ok = shouldAutoCheck({
      enabled,
      isMock,
      hasContent: hasSocialCopy(socialText),
      currentHash: hash,
      savedHash: saved?.for_hash,
      attemptedHash: attempted.current.theo,
      inFlight: inFlight.current.theo,
    });
    if (!ok) return;
    const timer = setTimeout(async () => {
      const cur = latest.current;
      if (textHash(cur.data.social_copy || "") !== hash) return;
      const startPlatform = cur.data.active_platform || "threads";
      inFlight.current.theo = true;
      attempted.current.theo = hash;
      setBusy((b) => ({ ...b, theo: true }));
      try {
        const res = await fetch("/api/theo/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: socialText,
            brandName: brandLabel(cur.brandId),
            aiProvider: cur.aiProvider,
            platform: startPlatform,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || "自動健檢失敗");
        const l = latest.current;
        if (
          l.brandId === cur.brandId &&
          (l.data.active_platform || "threads") === startPlatform &&
          textHash(l.data.social_copy || "") === hash
        ) {
          await saveWorkspace(cur.brandId, { theo_analysis: { ...json.data, for_hash: hash } });
        }
      } catch (e) {
        console.warn("[auto-health] theo analyze failed:", e);
      } finally {
        inFlight.current.theo = false;
        setBusy((b) => ({ ...b, theo: false }));
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [enabled, isMock, socialText, platform, data.theo_analysis?.for_hash, data.theo_analysis === undefined]);

  return busy;
}
