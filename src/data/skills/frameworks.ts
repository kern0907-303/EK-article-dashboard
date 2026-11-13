// 寫作框架下拉選單。
// 2026-11-13 起全部換成「流量結構庫」（見 flow-structures.ts）：
// 預設由系統依品牌與文體自動挑一型，也可以指定 22 型中的任何一型。
// 舊的大師框架（Russell Brunson、Dan Kennedy、Sugarman、Ogilvy）已移除；
// 「故事論點」仍由 story-argument.ts 另外加進選單。

import { FAMILY_SHORT, FLOW_STRUCTURE_LIST } from "./flow-structures";

export interface CopywritingFramework {
  id: string;
  name: string;
  author: string;
  description: string;
  promptContext: string;
  /** 對應的流量結構代號；auto 代表自動挑選 */
  flowStructureId?: string;
}

export const FLOW_FRAMEWORK_PREFIX = "flow_";
export const flowFrameworkId = (structureId: string): string => `${FLOW_FRAMEWORK_PREFIX}${structureId}`;

const flowEntries: Record<string, CopywritingFramework> = Object.fromEntries(
  FLOW_STRUCTURE_LIST.map((s) => [
    flowFrameworkId(s.id),
    {
      id: flowFrameworkId(s.id),
      name: `${s.id} ${s.name}（${FAMILY_SHORT[s.family]}）`,
      author: FAMILY_SHORT[s.family],
      description: s.use,
      // 結構指令由 ai-provider 在 Maya 階段另外加上，不放進品牌背景，避免平台改寫也被套上長文骨架
      promptContext: "",
      flowStructureId: s.id,
    },
  ])
);

export const COPYWRITING_FRAMEWORKS: Record<string, CopywritingFramework> = {
  default: {
    id: "default",
    name: "流量結構：自動挑選",
    author: "Erick",
    description: "依品牌與文體，從 22 型流量結構裡自動挑一型，避開最近用過的。",
    promptContext: "",
    flowStructureId: "auto",
  },
  ...flowEntries,
};

/** 下拉選單選的是哪個流量結構；不是流量結構（例如故事論點）回傳 null */
export function flowStructureOfFramework(frameworkId?: string | null): string | null {
  const id = String(frameworkId || "").trim();
  if (!id) return "auto";
  if (id === "story_argument") return null;
  const fw = COPYWRITING_FRAMEWORKS[id];
  // 舊的大師框架代號（瀏覽器可能還存著）一律當成自動挑選
  return fw ? fw.flowStructureId || null : "auto";
}
