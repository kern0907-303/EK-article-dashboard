import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { cleanCardText } from "@/lib/card-slides.mjs";
import { computeLayout, resolveCardSize } from "@/lib/card-layout.mjs";

// 圖卡（預設 IG 4:5，1080x1350；尺寸可選，見 card-layout.mjs 的 CARD_SIZES）。
// 樣式取自四個品牌的參考圖：漸層底、左上 logo、置中的頁尾品牌名。文字由程式疊上去，
// 斷行規則（標點不在行首、各行平均、避免孤字）在 card-layout.mjs。
// 字型用專案內附的思源黑體子集（內文 Medium、頁尾 Light），不依賴伺服器上有沒有裝中文字型。
// 底圖可以是品牌色漸層，或一張 AI 情境圖（所有張共用，上面蓋一層暗色讓白字清楚）。

const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
const BRAND_DIR = path.join(process.cwd(), "assets", "brand");
const BODY_FONT = "NotoSansTC-Medium-subset.otf";
const FOOTER_FONT = "NotoSansTC-Light-footer.otf";

const fontCache = new Map<string, ArrayBuffer>();
async function loadFont(file: string): Promise<ArrayBuffer> {
  const cached = fontCache.get(file);
  if (cached) return cached;
  const buf = await readFile(path.join(FONT_DIR, file));
  const data = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  fontCache.set(file, data);
  return data;
}

const logoCache = new Map<string, string>();
async function logoDataUri(file: string): Promise<string> {
  const cached = logoCache.get(file);
  if (cached) return cached;
  const buf = await readFile(path.join(BRAND_DIR, file));
  const uri = `data:image/png;base64,${buf.toString("base64")}`;
  logoCache.set(file, uri);
  return uri;
}

/** 舊的呼叫端還在用：回傳品牌的漸層色與文字色（維持原本的欄位名稱）。 */
export function paletteFor(brandId: string) {
  const layout = computeLayout(undefined, brandId, "");
  return { from: layout.brand.from, to: layout.brand.to, accent: layout.brand.footer, text: layout.brand.text, label: layout.brand.label };
}

/** 把情境圖縮成卡片大小的小檔案，轉成 data URI 內嵌（避免渲染時再去抓網路圖片） */
export async function sceneToDataUri(buffer: Buffer, sizeKey?: string): Promise<string> {
  const size = resolveCardSize(sizeKey);
  const sharp = (await import("sharp")).default;
  const jpeg = await sharp(buffer).resize(size.width, size.height, { fit: "cover", position: "centre" }).jpeg({ quality: 78 }).toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}

export async function renderCardJpeg(opts: { brandId: string; text: string; index: number; total: number; sceneDataUri?: string | null; size?: string }): Promise<Buffer> {
  const { brandId, index, total, sceneDataUri } = opts;
  const text = cleanCardText(opts.text);
  const layout = computeLayout(opts.size, brandId, text);
  const { size, brand } = layout;
  const W = size.width;
  const H = size.height;
  const onScene = Boolean(sceneDataUri);
  // 情境圖底：一律白字加暗色遮罩，確保任何圖都讀得清楚
  const textColor = onScene ? "#ffffff" : brand.text;
  const footerColor = onScene ? "#ffffff" : brand.footer;
  const [bodyFont, footerFont, logo] = await Promise.all([loadFont(BODY_FONT), loadFont(FOOTER_FONT), logoDataUri(brand.logo)]);
  const box = layout.logoBox;

  const element = (
    <div style={{ width: W, height: H, display: "flex", position: "relative", background: `linear-gradient(180deg, ${brand.from}, ${brand.to})`, fontFamily: "NotoTC" }}>
      {onScene ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={sceneDataUri as string} width={W} height={H} style={{ position: "absolute", top: 0, left: 0, width: W, height: H, objectFit: "cover" }} alt="" />
          <div style={{ position: "absolute", top: 0, left: 0, width: W, height: H, display: "flex", background: "rgba(8,10,16,0.55)" }} />
        </>
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo} height={box.h} {...(box.w ? { width: box.w } : {})} style={{ position: "absolute", left: box.x, top: box.y, height: box.h, ...(box.w ? { width: box.w } : {}) }} alt="" />
      <div style={{ position: "absolute", left: layout.marginX, top: layout.blockTop, width: layout.boxWidth, display: "flex", flexDirection: "column", color: textColor, fontSize: layout.fontSize, fontWeight: 500, letterSpacing: 1 }}>
        {layout.lines.map((line, i) => (
          <div key={i} style={{ display: "flex", height: layout.lineHeight, lineHeight: `${layout.lineHeight}px`, whiteSpace: "pre" }}>{line}</div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: layout.footerY, display: "flex", justifyContent: "center", color: footerColor, fontFamily: "NotoTCLight", fontWeight: 300, fontSize: 30, letterSpacing: 8 }}>
        {brand.label}
      </div>
      {total > 1 ? (
        <div style={{ position: "absolute", right: layout.marginX, top: layout.footerY, display: "flex", color: footerColor, fontFamily: "NotoTCLight", fontWeight: 300, fontSize: 28, letterSpacing: 2 }}>{`${index} / ${total}`}</div>
      ) : null}
    </div>
  );

  const png = await new ImageResponse(element, {
    width: W,
    height: H,
    fonts: [
      { name: "NotoTC", data: bodyFont, weight: 500, style: "normal" },
      { name: "NotoTCLight", data: footerFont, weight: 300, style: "normal" },
    ],
  }).arrayBuffer();
  const sharp = (await import("sharp")).default;
  return sharp(Buffer.from(png)).flatten({ background: brand.to }).jpeg({ quality: 90 }).toBuffer();
}
