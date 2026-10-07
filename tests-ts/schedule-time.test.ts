import {
  buildScheduleDateTime,
  DEFAULT_SCHEDULE_TIME,
} from "../src/lib/schedule-time";

let passed = 0;
let failed = 0;
function t(name: string, condition: boolean) {
  if (condition) { passed += 1; console.log(`✓ ${name}`); }
  else { failed += 1; console.error(`✗ ${name}`); }
}

const futureDay = new Date(2026, 11, 1);
const minBefore = new Date(2026, 10, 30, 23, 55);
const firstSelection = buildScheduleDateTime(futureDay, null, minBefore);
t("新排程基準時間為 10:10", DEFAULT_SCHEDULE_TIME === "10:10" && firstSelection.getHours() === 10 && firstSelection.getMinutes() === 10);

const existingTime = new Date(2026, 11, 1, 14, 25);
const retained = buildScheduleDateTime(futureDay, existingTime, minBefore);
t("選新日期時保留使用者已選的時間", retained.getHours() === 14 && retained.getMinutes() === 25);

const minAfterDefault = new Date(2026, 11, 1, 10, 12);
const clamped = buildScheduleDateTime(futureDay, null, minAfterDefault);
t("10:10 早於允許時間時校正到下一個五分鐘刻度", clamped.getHours() === 10 && clamped.getMinutes() === 15);

console.log(`結果: ${passed} 通過 / ${failed} 失敗`);
if (failed > 0) process.exit(1);
