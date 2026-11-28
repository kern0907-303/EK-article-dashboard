// 結構型有限制的文體（2026-11-28）：數字對照、身體入口、貫徹只能用指定的幾型。
// 自動流水線（auto-generate）與主工作區（ai-provider）共用，單獨一個檔避免循環引用。
import { NUMEROLOGY_STRUCTURES } from "./numerology-compare";
import { BODY_ENTRY_STRUCTURES, FOLLOW_THROUGH_STRUCTURES } from "./recipe-genres";

export const GENRE_STRUCTURES: Partial<Record<string, readonly string[]>> = {
  numerology: NUMEROLOGY_STRUCTURES,
  bodyEntry: BODY_ENTRY_STRUCTURES,
  followThrough: FOLLOW_THROUGH_STRUCTURES,
};

/** 這個文體可不可以用這一型；沒有限制的文體一律可以 */
export function structureAllowedForGenre(genre: string | null | undefined, structure: string | null | undefined): boolean {
  const allowed = genre ? GENRE_STRUCTURES[genre] : undefined;
  return !allowed || !structure || allowed.includes(structure);
}
