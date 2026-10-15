import {
  buildEntryBridgePrompt,
  ENTRY_BRIDGE_FREQUENCY_HONEST_SENTENCE,
  ENTRY_BRIDGE_GENERATION_REMINDERS,
  ENTRY_BRIDGE_OPENING_TEMPLATES,
  ENTRY_BRIDGE_PARALLEL_SENTENCE,
  resolveEntryBridgeBrand,
  resolveEntryBridgeFunnel,
} from "../src/data/skills/entry-bridge";
import { buildGenrePrompt } from "../src/data/skills/genres";

let pass = 0;
let fail = 0;
function t(name: string, condition: boolean) {
  if (condition) {
    pass++;
    console.log(`✓ ${name}`);
  } else {
    fail++;
    console.error(`✗ ${name}`);
  }
}

const ablCold = buildEntryBridgePrompt("abl", "cold");
const ablWarm = buildEntryBridgePrompt("abl", "warm");
const nasCold = buildEntryBridgePrompt("nas", "cold");
const erickWarm = buildEntryBridgePrompt("erick", "warm");
const newReminders = [
  "冷暖流量文章內文不使用括號補充句(例如「(對,就是那個…)」這類旁白)。",
  "冷暖流量文章內文不使用「能量」「磁場」。",
  "身體描述只能用第二級詞(睡不好、胃口變了、肩頸很緊、身體開始有了訊號),不加喘不過氣、心悸、胸悶等其他症狀描述。",
];

t("ABL 冷流量取得入口橋接規則", ablCold.includes("入口橋接規則 entry-bridge-v1"));
t("NAS 暖流量取得入口橋接規則", buildEntryBridgePrompt("nas", "warm").includes("入口橋接規則"));
t("Erick 暖流量取得入口橋接規則", erickWarm.includes("看見自己的起點與領域"));
t("I8 完全不注入入口橋接規則", buildEntryBridgePrompt("i8", "cold") === "");
t("熱流量不注入入口橋接規則", buildEntryBridgePrompt("abl", "hot") === "");
t("三條新增提醒逐字保存在生成端常數", newReminders.every((line) => ENTRY_BRIDGE_GENERATION_REMINDERS.includes(line as typeof ENTRY_BRIDGE_GENERATION_REMINDERS[number])));
t("三條新增提醒注入 ABL、NAS、Erick 的冷暖流量", (["abl", "nas", "erick"] as const).every((brand) => (["cold", "warm"] as const).every((funnel) => {
  const prompt = buildEntryBridgePrompt(brand, funnel);
  return newReminders.every((line) => prompt.includes(line));
})));
t("I8 與所有品牌熱流量均不注入新增提醒", buildEntryBridgePrompt("i8", "cold") === "" && (["abl", "nas", "erick", "i8"] as const).every((brand) => buildEntryBridgePrompt(brand, "hot") === ""));
t("冷流量規則明確排除深層工具詞", ablCold.includes("冷流量文章內文不使用信息場、頻率、調頻、TimeWaver"));
t("暖流量提頻時附誠實句", ablWarm.includes(ENTRY_BRIDGE_FREQUENCY_HONEST_SENTENCE));
t("身體訊號固定並行句逐字保留", ablCold.includes(ENTRY_BRIDGE_PARALLEL_SENTENCE));
t("檢視點例句逐字保留", ablCold.includes("這週有沒有先把自己的一件事排進行程"));
t("七個開頭範本完整保存", ENTRY_BRIDGE_OPENING_TEMPLATES.length === 7 && ablCold.includes(ENTRY_BRIDGE_OPENING_TEMPLATES[0]) && nasCold.includes(ENTRY_BRIDGE_OPENING_TEMPLATES[6]));
t("ABL 與 NAS 範本依品牌分開", ablCold.includes("範本1 ABL") && !ablCold.includes("範本4 NAS") && nasCold.includes("範本4 NAS") && !nasCold.includes("範本1 ABL"));
t("品牌識別不把 I8 誤判為 Erick", resolveEntryBridgeBrand("初八企業顧問") === "i8");
t("品牌識別 ABL NAS Erick", resolveEntryBridgeBrand("艾伯林量子調頻") === "abl" && resolveEntryBridgeBrand("平衡空間") === "nas" && resolveEntryBridgeBrand("Erick 個人品牌") === "erick");
t("流量層辨識熱與暖", resolveEntryBridgeFunnel("熱流量成交") === "hot" && resolveEntryBridgeFunnel("暖流量培育") === "warm" && resolveEntryBridgeFunnel("一般貼文") === "cold");

const genreSettings = { genre: "case" as const, funnel: "cold" as const, claim: "整理角色", material: "", metaphor: "", length: "", cta: "" };
t("文體提示詞對 ABL 注入橋接", buildGenrePrompt("abl", genreSettings).includes("入口橋接規則"));
t("文體提示詞 warm 層使用暖流量規則", buildGenrePrompt("abl", { ...genreSettings, funnel: "warm" }).includes(ENTRY_BRIDGE_FREQUENCY_HONEST_SENTENCE));
t("文體提示詞不對 I8 注入橋接", !buildGenrePrompt("i8", genreSettings).includes("入口橋接規則"));
t("文體提示詞熱流量不注入橋接", !buildGenrePrompt("abl", { ...genreSettings, funnel: "hot" }).includes("入口橋接規則"));

console.log(`\n結果: ${pass} 通過 / ${fail} 失敗`);
process.exit(fail ? 1 : 0);
