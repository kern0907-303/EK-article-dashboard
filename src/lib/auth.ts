// 單人密碼閘門：用環境變數 DASHBOARD_PASSWORD 設定密碼。
// 沒有設定這個變數時閘門自動關閉（避免部署當下把自己鎖在外面）。
// Cookie 內容是「密碼的雜湊」，不是密碼本身；改密碼後舊 Cookie 立即失效。

export const AUTH_COOKIE = "ek_auth";
export const AUTH_MAX_AGE = 60 * 60 * 24 * 30; // 30 天

export function isGateEnabled(): boolean {
  return !!(process.env.DASHBOARD_PASSWORD && process.env.DASHBOARD_PASSWORD.length > 0);
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** 目前密碼對應的 Cookie 值 */
export async function expectedToken(): Promise<string> {
  return sha256Hex(`ek-dashboard:${process.env.DASHBOARD_PASSWORD || ""}`);
}

export async function isValidToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  return token === (await expectedToken());
}

export async function isCorrectPassword(input: string): Promise<boolean> {
  const a = await sha256Hex(`ek-dashboard:${input}`);
  return a === (await expectedToken());
}
