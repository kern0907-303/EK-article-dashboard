import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { CARD_HEIGHT, CARD_WIDTH, cardFontSize, cleanCardText } from "@/lib/card-slides.mjs";

// IG 圖卡（4:5，1080x1350）。文字由程式疊上去，字型用專案內附的思源黑體（粗體、繁中常用字子集），
// 不依賴伺服器上有沒有裝中文字型。底圖可以是品牌色漸層，或一張 AI 情境圖（所有張共用，上面再蓋一層暗色讓字清楚）。

const FONT_PATH = path.join(process.cwd(), "assets", "fonts", "NotoSansTC-Bold-subset.otf");

type Palette = { from: string; to: string; accent: string; text: string; label: string };

const PALETTES: Record<string, Palette> = {
  brand_a_i8: { from: "#1f3a5c", to: "#0e1c30", accent: "#9fb8d6", text: "#f4f7fb", label: "I8 企業顧問" },
  brand_b_nas: { from: "#5a3d2b", to: "#2b1b12", accent: "#e8c9a0", text: "#fbf6ef", label: "艾瑞克 生命靈數" },
  brand_c_abl: { from: "#1f5156", to: "#2d2a52", accent: "#b9ddd7", text: "#f3faf8", label: "ABL 人生調頻" },
  personal_brand: { from: "#34343a", to: "#121214", accent: "#d9c7a3", text: "#f7f4ee", label: "艾瑞克" },
};

export function paletteFor(brandId: string): Palette {
  return PALETTES[brandId] || PALETTES.personal_brand;
}

let fontCache: ArrayBuffer | null = null;
async function loadFont(): Promise<ArrayBuffer> {
  if (fontCache) return fontCache;
  const file = await readFile(FONT_PATH);
  fontCache = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
  return fontCache;
}

/** 把情境圖縮成卡片大小的小檔案，轉成 data URI 內嵌（避免渲染時再去抓網路圖片） */
export async function sceneToDataUri(buffer: Buffer): Promise<string> {
  const sharp = (await import("sharp")).default;
  const jpeg = await sharp(buffer).resize(CARD_WIDTH, CARD_HEIGHT, { fit: "cover", position: "centre" }).jpeg({ quality: 78 }).toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}

export async function renderCardJpeg(opts: { brandId: string; text: string; index: number; total: number; sceneDataUri?: string | null }): Promise<Buffer> {
  const { brandId, index, total, sceneDataUri } = opts;
  const palette = paletteFor(brandId);
  const text = cleanCardText(opts.text);
  const isCover = index === 1;
  const fontSize = cardFontSize(text, isCover);
  const font = await loadFont();

  const element = (
    <div style={{ width: CARD_WIDTH, height: CARD_HEIGHT, display: "flex", position: "relative", background: `linear-gradient(160deg, ${palette.from}, ${palette.to})`, fontFamily: "NotoTC" }}>
      {sceneDataUri ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={sceneDataUri} width={CARD_WIDTH} height={CARD_HEIGHT} style={{ position: "absolute", top: 0, left: 0, width: CARD_WIDTH, height: CARD_HEIGHT, objectFit: "cover" }} alt="" />
          <div style={{ position: "absolute", top: 0, left: 0, width: CARD_WIDTH, height: CARD_HEIGHT, display: "flex", background: "rgba(8,10,16,0.55)" }} />
        </>
      ) : null}
      <div style={{ position: "absolute", top: 96, left: 96, width: 72, height: 6, display: "flex", background: palette.accent }} />
      <div style={{ position: "absolute", top: 150, left: 96, right: 96, bottom: 190, display: "flex", alignItems: "center", justifyContent: isCover ? "flex-start" : "center" }}>
        <div style={{ display: "flex", flexDirection: "column", color: palette.text, fontSize, fontWeight: 700, lineHeight: 1.5, letterSpacing: 2, textAlign: isCover ? "left" : "center", wordBreak: "break-all", whiteSpace: "pre-wrap" }}>
          {text}
        </div>
      </div>
      <div style={{ position: "absolute", left: 96, right: 96, bottom: 84, display: "flex", justifyContent: "space-between", alignItems: "center", color: palette.accent, fontSize: 30, fontWeight: 700, letterSpacing: 2 }}>
        <div style={{ display: "flex" }}>{palette.label}</div>
        <div style={{ display: "flex" }}>{`${index} / ${total}`}</div>
      </div>
    </div>
  );

  const png = await new ImageResponse(element, {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    fonts: [{ name: "NotoTC", data: font, weight: 700, style: "normal" }],
  }).arrayBuffer();
  const sharp = (await import("sharp")).default;
  return sharp(Buffer.from(png)).flatten({ background: palette.to }).jpeg({ quality: 90 }).toBuffer();
}
