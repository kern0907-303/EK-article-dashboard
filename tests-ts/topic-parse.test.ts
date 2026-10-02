import { parsePastedTopics, materialFor } from "../src/lib/topic-parse";

let pass = 0, fail = 0;
const t = (name: string, cond: boolean) => { cond ? pass++ : fail++; console.log(`${cond ? "✓" : "✗"} ${name}`); };

const msg = `🔎 本週品牌調研｜NAS 生命數字（2026-10-02）
資料：Google 趨勢 10 則、新聞 13 則、YouTube 6 部、留言 4 則，另加網路搜尋

━━━━━━━━━━
題目 1｜我的看法
容貌焦慮的解法不是「接受自己的外表」
【本週事件】兒福聯盟發布調查報告。
【市場常見說法】解方是接受外貌。
【我的角度】接受外表仍把外表當價值來源。
【建議】拆解文｜冷流量
【主張】問題不在臉，在你用哪把尺量自己的價值
【需要你補的素材】無需額外素材
【來源】兒福聯盟

━━━━━━━━━━
題目 3｜我的看法
「我不是在迷路，我是在被引導」——這句話很暖
【本週事件】留言區出現重複金句。
【受眾原話】
　「我不是在迷路，我是在被引導🥰✨」
　「我不是在迷路，我是在被引導!」
【市場常見說法】找不到方向是被宇宙引導。
【我的角度】被引導是接受，不是認識。
【建議】邀請文｜溫流量
【主張】你不是被引導，是還沒讀懂自己
【需要你補的素材】導向測驗網址

👀 不建議做：1. 紅包：略過。
`;

const b = parsePastedTopics(msg);
t("認出品牌 NAS", b.brandKey === "nas");
t("解析出 2 題", b.topics.length === 2);
t("題目 1 模式與標題", b.topics[0].mode === "我的看法" && b.topics[0].title.startsWith("容貌焦慮"));
t("題目 1 文體與漏斗", b.topics[0].genre === "breakdown" && b.topics[0].funnel === "cold");
t("題目 1 主張", b.topics[0].claim === "問題不在臉，在你用哪把尺量自己的價值");
t("題目 3 受眾原話兩句且去掉引號", b.topics[1].audienceVoice.length === 2 && b.topics[1].audienceVoice[0].startsWith("我不是在迷路"));
t("題目 3 邀請文／溫流量", b.topics[1].genre === "invite" && b.topics[1].funnel === "warm");
t("最後一題不吃進『不建議做』", !b.topics[1].needMaterial.includes("紅包"));
t("拆解文素材預填含讀者原話與事件", materialFor(b.topics[0], "breakdown").includes("本週事件"));
t("案例文與邀請文不代填素材", materialFor(b.topics[0], "case") === "" && materialFor(b.topics[1], "invite") === "");

const one = parsePastedTopics(`題目 2｜二創
報告做得很好卻沒人看見
【建議】案例文｜溫流量
【主張】努力沒被看見，是你還不認識自己
【需要你補的素材】一位學員的真實歷程`);
t("單題可解析", one.topics.length === 1 && one.topics[0].genre === "case" && one.topics[0].funnel === "warm");

const sheet = parsePastedTopics("【二創】文體：拆解｜漏斗：冷流量｜主張：假放了還是累，是你帶著空殼在放假。｜需補素材：一位個案");
t("Sheet content_task 格式可解析", sheet.topics.length === 1 && sheet.topics[0].genre === "breakdown" && sheet.topics[0].funnel === "cold" && sheet.topics[0].claim.startsWith("假放了還是累") && sheet.topics[0].needMaterial === "一位個案");

t("亂貼的字不會誤判", parsePastedTopics("今天天氣很好").topics.length === 0);
t("空字串", parsePastedTopics("").topics.length === 0);
t("回應文不自動帶入", parsePastedTopics("題目 1｜x\n標題\n【建議】回應文｜熱流量\n【主張】甲").topics[0].genre === null);

const emoji = `🔎 本週品牌調研｜NAS 生命數字（2026-10-02）

📊 資料：Google 趨勢 10 則・新聞 13 則

━━━━━━━━━━━━

📌 題目 1｜我的看法
👉 容貌焦慮的解法不是「接受自己的外表」

📰 【本週事件】
兒福聯盟發布調查報告。

💬 【受眾原話】
　「我不是在迷路，我是在被引導」

🗣 【市場常見說法】
解方是接受外貌。

💡 【我的角度】
接受外表仍把外表當價值來源。

🎯 【建議】拆解文｜冷流量

✍️ 【主張】
問題不在臉，在你用哪把尺量自己的價值

📎 【需要你補的素材】
無需額外素材

🔗 【來源】兒福聯盟

━━━━━━━━━━━━

📌 題目 2｜二創
👉 報告做得很好卻沒人看見

🎯 【建議】案例文｜溫流量

✍️ 【主張】
努力沒被看見，是你還不認識自己

━━━━━━━━━━━━

👀 不建議做：1. 紅包：略過。
`;
const e = parsePastedTopics(emoji);
t("emoji 版：品牌", e.brandKey === "nas");
t("emoji 版：2 題", e.topics.length === 2);
t("emoji 版：模式與標題", e.topics[0].mode === "我的看法" && e.topics[0].title.startsWith("容貌焦慮"));
t("emoji 版：欄位內容換行也能讀", e.topics[0].event === "兒福聯盟發布調查報告。" && e.topics[0].claim.startsWith("問題不在臉"));
t("emoji 版：原話", e.topics[0].audienceVoice[0] === "我不是在迷路，我是在被引導");
t("emoji 版：文體漏斗", e.topics[0].genre === "breakdown" && e.topics[0].funnel === "cold" && e.topics[1].genre === "case" && e.topics[1].funnel === "warm");
t("emoji 版：不建議做不混入", !e.topics[1].claim.includes("紅包") && !e.topics[1].needMaterial.includes("紅包"));
t("emoji 版：單題（前綴符號）", parsePastedTopics("📌 題目 2｜二創\n👉 標題\n🎯 【建議】邀請文｜熱流量\n✍️ 【主張】甲").topics[0].genre === "invite");

console.log(`\n${pass} 通過 / ${fail} 失敗`);
if (fail > 0) process.exit(1);
