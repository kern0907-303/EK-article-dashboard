import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  CATEGORY_NAME, CATEGORY_WEIGHT, TITLE_NEGATIVES, TITLE_STYLE_IDS, TITLE_STYLES,
} from "@/data/skills/title-styles";
import { OPENING_STYLE_IDS, OPENING_STYLES } from "@/data/skills/opening-styles";
import { buildCopyTypeBlock, COPY_TYPE_IDS } from "@/data/skills/copy-types";
import { RULES_VERSION } from "@/lib/auto-generate";

/**
 * 寫作規則的唯讀端點，給 n8n 的海巡批次流程用。
 *
 * 為什麼需要：海巡的「分組建提示」節點原本把八種標題型與九種開場型硬寫在提示詞裡，
 * 等於第二份規則庫。而生成端是 readTitleStyleFromPrompt(prompt) || pickTitleStyle(...)，
 * n8n 指定的優先，所以規則只改程式這邊的話，海巡來的題目完全吃不到。
 * 改成由這裡吐出同一份規則，之後改規則只要改 src/data/skills/，海巡自動同步。
 *
 * 呼叫頻率：每週一批次一次、每日補洞一次，不是輪詢。
 */
function authorized(req: NextRequest): boolean {
  const secret = process.env.AUTO_PIPELINE_CRON_SECRET || "";
  const received = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  return !!secret && received.length === secret.length && timingSafeEqual(Buffer.from(received), Buffer.from(secret));
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "未授權" }, { status: 401 });

  const titleBlock = [
    "【標題型清單，每篇必須挑一型】",
    ...TITLE_STYLE_IDS.map((id) => {
      const style = TITLE_STYLES[id];
      return `${style.name}（${CATEGORY_NAME[style.category]}型）：${style.rule}`;
    }),
  ].join("\n");

  const openingBlock = [
    "【開場型清單，每篇必須挑一型，決定文章第一句怎麼寫】",
    ...OPENING_STYLE_IDS.map((id) => `${OPENING_STYLES[id].name}：${OPENING_STYLES[id].rule}`),
  ].join("\n");

  // Caples：自身利益最重要，好奇心單獨使用最弱。讓選題階段也照這個比例挑，而不是平均分配。
  const mix = [
    "【標題型的挑選比例】",
    `成功標題分三類：自身利益、新聞、好奇心。自身利益最重要，好奇心單獨使用時效果最弱也最不穩定。`,
    `同一批裡，自身利益型要占多數，好奇心型最多 ${Math.max(1, Math.round(TITLE_STYLE_IDS.length / 4))} 篇。`,
    "好奇心型要搭配一個讀者能得到的東西，不可以只留懸念。",
    "標題型要分散：同一批裡同一個標題型最多 2 篇，不可以連續兩篇同型。全部標題不要都是同樣長度的逗號長句，至少要有一篇 14 字以內的短標題。",
    "開場型同樣分散，同一批同型最多 2 篇，不可以連續兩篇同型，而且標題型與開場型不要用同一個手法。",
  ].join("\n");

  return NextResponse.json({
    success: true,
    rulesVersion: RULES_VERSION,
    titleBlock,
    openingBlock,
    titleNegatives: TITLE_NEGATIVES,
    mix,
    copyTypeBlock: buildCopyTypeBlock(),
    categoryWeight: CATEGORY_WEIGHT,
    counts: {
      titleStyles: TITLE_STYLE_IDS.length,
      openingStyles: OPENING_STYLE_IDS.length,
      copyTypes: COPY_TYPE_IDS.length,
    },
  });
}
