import { ABL_ENTRY_BRIDGE_CONTEXT } from "@/data/brands/abl";
import { NAS_ENTRY_BRIDGE_CONTEXT } from "@/data/brands/nas";
import { ERICK_ENTRY_BRIDGE_CONTEXT } from "@/data/brands/erick";
import { ENTRY_BRIDGE_LANGUAGE_LAYER } from "@/data/brands/persona";

export const ENTRY_BRIDGE_PROMPT_VERSION = "entry-bridge-v1";

export type EntryBridgeBrand = "abl" | "nas" | "erick" | "i8";
export type EntryBridgeFunnel = "cold" | "warm" | "hot";

export function resolveEntryBridgeBrand(value: string): EntryBridgeBrand | null {
  if (/I8|初八|brand_a/i.test(value)) return "i8";
  if (/ABL|艾伯林|brand_c/i.test(value)) return "abl";
  if (/NAS|平衡空間|brand_b/i.test(value)) return "nas";
  if (/Erick|個人品牌|personal_brand|personal/i.test(value)) return "erick";
  return null;
}

export function resolveEntryBridgeFunnel(value: string): EntryBridgeFunnel {
  if (/熱流量|熱（|\bhot\b|high intent|成交層/i.test(value)) return "hot";
  if (/暖流量|溫流量|溫（|\bwarm\b|nurture/i.test(value)) return "warm";
  return "cold";
}

export const ENTRY_BRIDGE_RENAME_MAP = {
  狀態觀察: "角色盤點",
  找消耗來源: "負荷來源整理",
  建立理解與信任: "你自己的檢視",
  再銜接調和: "選擇性的頻率支持",
  保留標籤: "狀態回不來",
} as const;

export const ENTRY_BRIDGE_FOUR_LEVEL_LEXICON = `第一級 可當標題與開頭
ABL 組
照顧完所有人,輪到自己什麼都不剩
上有老下有小,工作又停不下來
把每個角色都做得很好,自己卻沒有位置
想停下來,卻停不下來
一直撐著,不知道撐到什麼時候
知道要改變,就是提不起力氣
總是先把別人放在前面
把不屬於自己的事也接了過來
做了很多,沒有人看見
休息了,還是回不來
檢查都說正常,人就是很累(只能搭配並行句)
NAS 組
明明很努力,卻覺得走在別人的路上
換了很多次方向,還是卡在同一個地方
別人說你很好,你自己不相信
不知道自己要什麼,只知道不想再這樣下去
為家人、為工作做了很多選擇,哪一個是自己的
道理懂很多,做起來還是一樣
你是幾號人,然後呢
中年重啟人生組
孩子長大了,我突然不知道自己要做什麼
過了四十,我還能做什麼
前半生為別人活,後半生想為自己活一次
工作穩定了,心卻一直在問:就這樣嗎
想轉換,又怕來不及
退下一個角色之後,不知道自己還是誰
找到我的天賦與領域組
我不知道自己擅長什麼
做了很多事,卻說不出哪一件是我的
別人都比我厲害
一直拿自己的弱項去比別人的強項
不是我不夠努力,是我一直在跟別人比同一件事
我的領域在哪裡
我不知道我能做什麼

第二級 只能當一句描述,後面一定接並行句
睡不好、胃口變了、肩頸很緊、身體開始有了訊號

第三級 只能出現在並行句裡
醫師、心理師、就醫、確認

第四級 永遠不用
所有病名(憂鬱症、失眠症、自律神經、更年期等)
改善、調理、排毒、提升免疫、荷爾蒙、淋巴、調整體質
檢測、解讀你的身體
幫你找出身體生病的根源
醫生做不到的我做得到
某某導致某某病
幫你找到天職、你天生就該做什麼、你註定
改善不適應
任何醫療效能宣稱字眼`;

export const ENTRY_BRIDGE_PARALLEL_SENTENCE =
  "身體的訊號,請讓醫師陪你確認它在說什麼。我陪你看的,是你這個人怎麼運作,這些你願意扛的角色,是怎麼一層一層疊上來的。";

export const ENTRY_BRIDGE_FREQUENCY_HONEST_SENTENCE =
  "頻率是我使用的工具。它是否對人產生作用,科學上目前還沒有被證實,我不能替你保證。你可以試,我們先定好三個你自己看得見的檢視點,不適合就退。";

export const ENTRY_BRIDGE_INSPECTION_EXAMPLES = [
  "這週有沒有先把自己的一件事排進行程",
  "有沒有把不屬於我的事接了過來",
  "有沒有對一件事說了不",
] as const;

export const ENTRY_BRIDGE_OPENING_TEMPLATES = [
  `範本1 ABL 照顧者
照顧完所有人,輪到自己,什麼都不剩。
這些角色,是你認可、也願意扛的。只是最近,身體開始有了訊號。
身體的訊號,請讓醫師陪你確認它在說什麼。我陪你看的,是你這個人怎麼運作,這些你願意扛的角色,是怎麼一層一層疊上來的。我看的不是零件,是整個人。`,
  `範本2 ABL 職場角色過載
主管、同事、家人,每個角色你都想做好。
做著做著,發現自己沒有位置了。
我們先不談要怎麼改變,先把這些角色一個一個攤開來看,哪些是你選的,哪些是接過來的。`,
  `範本3 ABL 先把別人放在前面
你總是先把別人放在前面。
這不是缺點,這是你一路走來的方式。
只是有一天你會發現,自己的那一份,一直排在最後。我們可以先看看,這個習慣是怎麼形成的。`,
  `範本4 NAS 定位卡住
明明很努力,卻覺得走在別人的路上。
換了很多次方向,還是卡在同一個地方。
也許問題不在你不夠努力,而是還沒有看清楚,自己是從哪裡出發的。`,
  `範本5 NAS 別人說你很好你不信
別人說你很好,你自己不相信。
這中間少的,往往不是自信,而是一張看得懂自己的地圖。你是幾號人,然後呢?`,
  `範本6 NAS 中年重啟人生
孩子長大了,我突然不知道自己要做什麼。
前半生為別人活,後半生想為自己活一次。
這不是來不及,是換你站到自己這一邊。你是幾號人,然後呢?`,
  `範本7 NAS 找到我的領域
牛跟馬比速度,牛永遠跑不過馬。
可是牛有牛的領域,耕田的時候,馬反而比不上。
你一直在拿自己的弱項,去比別人的強項。不是你不夠努力,是你還沒找到自己的領域。`,
] as const;

export const ENTRY_BRIDGE_GENERATION_REMINDERS = [
  "內容停在「看見自己的起點與領域」。",
  "不寫「改善不適應」。",
  "不保證找到天賦或天職。",
  "第二級詞出現時,必須接並行句。",
  "冷流量不解釋信息場、頻率、調頻、TimeWaver。",
  "冷暖流量文章內文不使用括號補充句(例如「(對,就是那個…)」這類旁白)。",
  "冷暖流量文章內文不使用「能量」「磁場」。",
  "身體描述只能用第二級詞(睡不好、胃口變了、肩頸很緊、身體開始有了訊號),不加喘不過氣、心悸、胸悶等其他症狀描述。",
] as const;

const BRAND_CONTEXT: Record<Exclude<EntryBridgeBrand, "i8">, string> = {
  abl: ABL_ENTRY_BRIDGE_CONTEXT,
  nas: NAS_ENTRY_BRIDGE_CONTEXT,
  erick: ERICK_ENTRY_BRIDGE_CONTEXT,
};

export function buildEntryBridgePrompt(
  brand: EntryBridgeBrand,
  funnel: EntryBridgeFunnel
): string {
  if (brand === "i8" || funnel === "hot") return "";

  const brandTemplates = brand === "abl"
    ? ENTRY_BRIDGE_OPENING_TEMPLATES.slice(0, 3)
    : brand === "nas"
      ? ENTRY_BRIDGE_OPENING_TEMPLATES.slice(3)
      : [];
  const templateText = brandTemplates.length
    ? brandTemplates.join("\n\n")
    : "請使用第一級的日常情境詞,不要混入子品牌專有用語。";

  return [
    `【入口橋接規則 ${ENTRY_BRIDGE_PROMPT_VERSION}】`,
    "只適用於 ABL、NAS、Erick 的冷流量與暖流量文章。紅線維持原樣。角色是讀者認可、願意扛的,現在身體出現訊號,需要被理解。我看的是整個人,不是身體的零件。",
    `改名對照：${Object.entries(ENTRY_BRIDGE_RENAME_MAP).filter(([key]) => key !== "保留標籤").map(([from, to]) => `${from}改為${to}`).join("；")}。改名對照左側只供辨識,不得輸出舊名稱。入口標籤「${ENTRY_BRIDGE_RENAME_MAP.保留標籤}」可保留,服務說明不可寫成「我們處理你的狀態」。`,
    ENTRY_BRIDGE_FOUR_LEVEL_LEXICON,
    `並行句,只有文章提到身體時才放：${ENTRY_BRIDGE_PARALLEL_SENTENCE}`,
    `頻率誠實句,只有文章提到頻率時才放,冷流量很少用：${ENTRY_BRIDGE_FREQUENCY_HONEST_SENTENCE}`,
    `檢視點範例,只寫行為層：\n${ENTRY_BRIDGE_INSPECTION_EXAMPLES.join("\n")}`,
    `開頭範本,逐字保留作為語氣參考,不要拼接其他品牌素材：\n${templateText}`,
    `生成端固定提醒：\n${ENTRY_BRIDGE_GENERATION_REMINDERS.join("\n")}`,
    `目前流量層：${funnel === "cold" ? "冷" : "溫"}。${funnel === "cold" ? "冷流量文章內文不使用信息場、頻率、調頻、TimeWaver,也不解釋量子。品牌名「艾伯林量子調頻」可以出現。" : "頻率是工具而非效果承諾。提到頻率時必須使用頻率誠實句。"}`,
    BRAND_CONTEXT[brand],
    ENTRY_BRIDGE_LANGUAGE_LAYER,
  ].join("\n\n");
}
