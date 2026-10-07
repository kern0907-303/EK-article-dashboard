/** 所有新建排程的預設時間，以台北本地時間解讀。 */
export const DEFAULT_SCHEDULE_TIME = "10:10";
export const DEFAULT_SCHEDULE_HOUR = 10;
export const DEFAULT_SCHEDULE_MINUTE = 10;

/** 選日期時保留既有選定時間；首次選日期則用 10:10，若太早就校正到最早可選的五分鐘刻度。 */
export function buildScheduleDateTime(day: Date, selected: Date | null, minDate: Date): Date {
  let next = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    selected?.getHours() ?? DEFAULT_SCHEDULE_HOUR,
    selected?.getMinutes() ?? DEFAULT_SCHEDULE_MINUTE,
  );
  if (next < minDate) {
    next = new Date(minDate);
    next.setMinutes(Math.ceil(next.getMinutes() / 5) * 5, 0, 0);
  }
  return next;
}
