export type CardSizeKey = "ig_feed" | "ig_grid34" | "ig_square" | "ig_story" | "fb_feed" | "threads";
export type CardSize = { label: string; width: number; height: number; insetTop: number; insetBottom: number; official: boolean };
export type CardBrand = {
  key: string; label: string; logo: string; from: string; to: string; text: string; footer: string;
  zone: [number, number]; logoBox: { x: number; y: number; w?: number; h: number };
};
export type CardLayout = {
  size: CardSize & { key: string }; brand: CardBrand; fontSize: number; lines: string[]; lineHeight: number;
  boxWidth: number; blockTop: number; blockHeight: number; footerY: number;
  logoBox: { x: number; y: number; w?: number; h: number }; marginX: number;
};
export const CARD_SIZES: Record<CardSizeKey, CardSize>;
export const DEFAULT_CARD_SIZE: CardSizeKey;
export const CARD_BRANDS: Record<string, CardBrand>;
export const DEFAULT_CARD_BRAND: string;
export const CARD_MARGIN_X: number;
export const CARD_FONT_SIZES: number[];
export const CARD_LINE_HEIGHT: number;
export function resolveCardSize(key?: string): CardSize & { key: string };
export function cardBrandFor(brandId: string): CardBrand;
export function charWidth(ch: string): number;
export function textWidth(text: string, fontSize: number, letterSpacing?: number): number;
export function wrapLines(text: string, fontSize: number, width: number, letterSpacing?: number): string[];
export function fitText(text: string, boxWidth: number, boxHeight: number, sizes?: number[], letterSpacing?: number): { fontSize: number; lines: string[]; lineHeight: number };
export function computeLayout(sizeKey: string | undefined, brandId: string, text: string): CardLayout;
