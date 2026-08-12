import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 2026-08：原本這裡有 eslint.ignoreDuringBuilds 與 typescript.ignoreBuildErrors，
  // 是趕上線時關掉的安全網。Next 16 已不支援 eslint 這個 key（會噴警告），
  // 而 `npx tsc --noEmit` 目前是零錯誤，所以型別檢查也一併打開。
  //
  // 若日後 `npm run build` 因型別錯誤失敗，正確做法是修型別，
  // 而不是把 typescript: { ignoreBuildErrors: true } 加回來——
  // 那只會讓錯誤延後到 Render 上以 500 的形式出現。
};

export default nextConfig;
