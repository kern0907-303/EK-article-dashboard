/**
 * 發文前提醒（需補的素材）一律放在文章外面。
 * 文章本文不可以留下【需補】標記，避免不小心連標記一起發出去。
 * 這裡是保險：AI 若仍把標記寫進本文，就把它搬到提醒清單，本文保持乾淨。
 */
export type SplitReminders = { body: string; reminders: string[] };

const MARKER = /【(?:需補|比喻待確認)[^】]*】/g;

export function splitPostReminders(copy: unknown, extra?: unknown): SplitReminders {
  const text = typeof copy === "string" ? copy : "";
  const reminders: string[] = [];
  const add = (value: string) => {
    const clean = value.replace(/^[【\s]*需補[:：]?/, "").replace(/[】\s]+$/, "").replace(/\s+/g, " ").trim();
    if (clean && !reminders.includes(clean)) reminders.push(clean);
  };
  const kept: string[] = [];
  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    const found = line.match(MARKER);
    if (!found) { kept.push(line); continue; }
    found.forEach((m) => add(m.startsWith("【比喻待確認") ? "本篇有 AI 自行提案的比喻，發文前請確認" : m.slice(1, -1)));
    const rest = line.replace(MARKER, "").trim();
    // 整行只是在標示要補什麼：整行拿掉；有正文就只拿掉標記
    if (rest.length >= 6) kept.push(line.replace(MARKER, "").replace(/[ \t　]{2,}/g, " ").trimEnd());
  }
  const body = kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  const list = Array.isArray(extra) ? extra : typeof extra === "string" ? extra.split(/\n+/) : [];
  list.forEach((item) => { if (typeof item === "string") add(item); });
  return { body, reminders };
}
