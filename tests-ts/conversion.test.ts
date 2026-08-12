import { BRAND_CONVERSIONS, getBrandConversion } from "../src/data/brands/conversion";
let fail = 0;
for (const [k, c] of Object.entries(BRAND_CONVERSIONS)) {
  const ok = c.ctaUrl.startsWith("https://") && c.ctaLabel && c.leadMagnet;
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${k.padEnd(15)} [${c.stage.padEnd(7)}] ${c.ctaLabel} → ${c.ctaUrl}`);
}
const fb = getBrandConversion("project_xyz");
console.log(`✓ 階段專案 fallback → ${fb.shortId}`);
const closeStages = Object.values(BRAND_CONVERSIONS).filter(c => c.stage === "close");
console.log(`\n成交層品牌數: ${closeStages.length}（應為 1，只有 Erick 母品牌）`);
process.exit(fail === 0 && closeStages.length === 1 ? 0 : 1);
