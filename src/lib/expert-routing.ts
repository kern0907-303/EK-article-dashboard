/** Dashboard-only expert request helpers shared by the client and chat route. */
export const LEON_GENERATION_OPTIONS = {
  maxTokens: 12000,
  timeoutMs: 120000,
} as const;

export function isSocialCopyPlaceholder(value: unknown): boolean {
  if (typeof value !== "string" || !value.trim()) return true;
  const text = value.trim();
  return /^(?:⏳|❌|⚠️|【系統狀態】|【營運回報】)/.test(text);
}

export function hasUsableSocialCopy(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && !isSocialCopyPlaceholder(value);
}

export function friendlyLeonError(value: unknown): string {
  const message = value instanceof Error ? value.message : String(value ?? "未知錯誤");
  if (/截斷|finish_reason\s*=\s*(?:length|max_tokens)|MAX_TOKENS|max_tokens/i.test(message)) {
    return "網頁內容過長被截斷，請再試一次";
  }
  if (/JSON 格式錯誤|回覆格式/i.test(message)) {
    return "Leon 回覆格式不完整，請再試一次";
  }
  return message;
}
