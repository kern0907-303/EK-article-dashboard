export const CARD_WIDTH: number;
export const CARD_HEIGHT: number;
export const CARD_MAX_SLIDES: number;
export function parseCarouselSlides(content?: string): Array<{ index: number; text: string }>;
export function cardFontSize(text?: string, isCover?: boolean): number;
export function cleanCardText(text?: string): string;
