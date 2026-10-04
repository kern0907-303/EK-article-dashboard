import { buildDayMarks, describeDay, sameSlotHint, dayKey, MARK_BRAND_ORDER } from "../src/lib/schedule-marks";
let pass = 0, fail = 0;
const t = (name: string, cond: boolean) => { cond ? pass++ : fail++; console.log(`${cond ? "✓" : "✗"} ${name}`); };
const at = (h: number, m = 0) => new Date(2026, 9, 7, h, m).toISOString();
const items = [
  { brand_id: "nas", scheduled_at: at(12), status: "pending" },
  { brand_id: "abl", scheduled_at: at(9), status: "pending" },
  { brand_id: "abl", scheduled_at: at(18), status: "sending" },
  { brand_id: "i8", scheduled_at: at(10), status: "sent" },
  { brand_id: "i8", scheduled_at: at(11), status: "cancelled" },
  { brand_id: "brand_a_i8", scheduled_at: new Date(2026, 9, 8, 9).toISOString(), status: "pending" },
];
const m = buildDayMarks(items);
const d7 = m.get(dayKey(new Date(2026, 9, 7)));
t("已發出與取消的不標", !!d7 && !d7.brands.some((b) => b.brand === "i8"));
t("固定順序 ABL 在 NAS 前", !!d7 && d7.brands.map((b) => b.brand).join() === "abl,nas");
t("同品牌兩篇計數為 2", !!d7 && d7.brands.find((b) => b.brand === "abl")?.count === 2);
t("清單依時間排序", describeDay(d7) === "09:00 ABL、12:00 NAS、18:00 ABL");
t("沒滿四個品牌不算全滿", !!d7 && d7.full === false);
t("長格式品牌 id 也認得 (brand_a_i8)", m.get(dayKey(new Date(2026, 9, 8)))?.brands[0].brand === "i8");
const full = buildDayMarks(MARK_BRAND_ORDER.map((b, i) => ({ brand_id: b, scheduled_at: at(9 + i), status: "pending" })));
t("四個品牌都有 → 全滿", full.get(dayKey(new Date(2026, 9, 7)))?.full === true);
t("沒有排程的日子沒有標記", m.get(dayKey(new Date(2026, 9, 9))) === undefined);
t("同時段提醒", sameSlotHint(d7, new Date(2026, 9, 7, 9, 30)).includes("ABL"));
t("不同時段不提醒", sameSlotHint(d7, new Date(2026, 9, 7, 15, 0)) === "");
t("壞資料不當機", buildDayMarks([{ brand_id: "x", scheduled_at: "bad", status: "pending" }] as any).size === 0);
console.log(`\n結果: ${pass} 通過 / ${fail} 失敗`);
process.exit(fail ? 1 : 0);
