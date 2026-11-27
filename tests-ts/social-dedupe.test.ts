// 同一篇母文章，在同一個 Threads 或 Instagram 帳號只能有一則。
// 2026-11-27 盤點的實例：noagespace 11/24 14:11、abliene358 11/10 12:11、initial8.erick 11/24 22:11、
// abliene358 IG 11/12 04:11，全部是同一個任務、同一個平台被寫了兩筆。
import assert from "node:assert/strict";
import { duplicatesToCancel, hasLiveDuplicate, pickCancelsInGroup, type SocialRowLite } from "../src/lib/social-dedupe";

const row = (id: string, over: Partial<SocialRowLite> = {}): SocialRowLite => ({
  id, platform: "threads", status: "pending", job_id: "job-1", article_id: null, created_at: "2026-11-22T13:04:00Z", ...over,
});

// 同一任務同平台兩筆待發：保留和母文章綁定的那一版（article_id 等於 FB 排程列的 article_id）
{
  const rows = [
    row("a", { article_id: null, created_at: "2026-11-22T13:04:33Z" }),
    row("b", { article_id: "art-1", created_at: "2026-11-22T13:05:44Z" }),
  ];
  assert.deepEqual(duplicatesToCancel(rows, { "job-1": "art-1" }), ["a"]);
  // 不知道母文章綁哪一篇時，留有 article_id 的那一筆
  assert.deepEqual(duplicatesToCancel(rows, {}), ["a"]);
}

// 都沒有 article_id：留最早寫入的
assert.deepEqual(pickCancelsInGroup([row("x", { created_at: "2026-11-22T13:06:00Z" }), row("y", { created_at: "2026-11-22T13:05:00Z" })]), ["x"]);

// 已經發出去的列絕對不取消；同平台已發出時，待發的那筆要取消
{
  const rows = [row("sent-1", { status: "sent" }), row("p-1", { status: "pending" })];
  assert.deepEqual(duplicatesToCancel(rows), ["p-1"]);
  assert.deepEqual(duplicatesToCancel([row("s1", { status: "sent" }), row("s2", { status: "sent" })]), [], "已發的兩筆都不動");
  assert.deepEqual(duplicatesToCancel([row("sending", { status: "sending" }), row("p", {})]), ["p"]);
}

// 不同平台互不影響；被取消的列不算
{
  const rows = [row("t", { platform: "threads" }), row("i", { platform: "instagram" }), row("c", { status: "cancelled" })];
  assert.deepEqual(duplicatesToCancel(rows), []);
}

// 不同任務共用同一篇官網文章，也算同一篇母文章
{
  const rows = [
    row("j1", { job_id: "job-1", article_id: "art-9", created_at: "2026-11-01T00:00:00Z" }),
    row("j2", { job_id: "job-2", article_id: "art-9", created_at: "2026-11-02T00:00:00Z" }),
  ];
  assert.deepEqual(duplicatesToCancel(rows), ["j2"]);
}

// 每一組最後只剩一筆待發
{
  const rows = [row("a"), row("b", { created_at: "2026-11-22T13:05:00Z" }), row("c", { created_at: "2026-11-22T13:06:00Z" })];
  const cancelled = duplicatesToCancel(rows);
  assert.equal(rows.filter((r) => !cancelled.includes(r.id)).length, 1);
}

// 不同品牌（不同帳號）互不影響
assert.deepEqual(duplicatesToCancel([row("n", { brand: "nas" }), row("a", { brand: "abl" })]), []);
assert.deepEqual(duplicatesToCancel([row("n1", { brand: "nas" }), row("n2", { brand: "nas", created_at: "2026-11-22T13:09:00Z" })]), ["n2"]);

// 寫入前檢查：同任務或同篇官網文章、同平台有活著的列，就不再寫第二筆待發排程
{
  const existing = [row("a", { status: "pending", article_id: "art-1" })];
  assert.equal(hasLiveDuplicate(existing, { platform: "threads", job_id: "job-1" }), true);
  assert.equal(hasLiveDuplicate(existing, { platform: "threads", job_id: "job-2", article_id: "art-1" }), true);
  assert.equal(hasLiveDuplicate(existing, { platform: "instagram", job_id: "job-1" }), false);
  assert.equal(hasLiveDuplicate([row("a", { status: "cancelled" })], { platform: "threads", job_id: "job-1" }), false);
  assert.equal(hasLiveDuplicate([row("a", { status: "sent" })], { platform: "threads", job_id: "job-1" }), true, "已發出也算有了");
  assert.equal(hasLiveDuplicate([row("a", { brand: "abl", article_id: "art-1" })], { platform: "threads", brand: "nas", article_id: "art-1" }), false, "不同帳號不算重複");
}

console.log("social dedupe tests passed");
