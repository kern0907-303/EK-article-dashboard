-- 排程派發：Supabase 每分鐘檢查 publish_queue，有到期的才呼叫 n8n。
-- 沒有到期項目時完全不碰 n8n，所以不消耗 n8n 執行額度。
-- 在 Supabase SQL Editor 執行一次即可（可重複執行）。
--
-- n8n 觸發網址不放在這個檔案（避免進版控）：另外用下面這句存進 Supabase Vault，
-- 網址未設定時，函式會直接結束，到期項目維持 pending，不會被認領。
--   select vault.create_secret('<n8n 觸發網址>', 'publish_queue_webhook_url');
--
-- 狀態流程：
--   pending  --(到期，本函式認領並呼叫 n8n)-->  sending
--   sending  --(n8n 發完寫回)-->  sent / partial / failed
-- 保護：
--   * 過了預定時間超過 6 小時仍是 pending：標為 failed，避免過期貼文突然發出
--   * sending 超過 10 分鐘 n8n 仍沒接手（attempts = 0，代表還沒發任何東西）：退回 pending 重派
--   * sending 超過 15 分鐘且 n8n 已接手（attempts >= 1）：結果不明，標為 failed，不自動重發（避免重複發文）

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

create or replace function public.dispatch_publish_queue()
returns integer
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  claimed uuid[];
  hook_url text;
begin
  update public.publish_queue
     set status = 'failed',
         error = '逾時未發送：預定時間已過超過 6 小時，為避免過期貼文突然發出，已停止',
         updated_at = now()
   where status = 'pending' and coalesce(is_test, false) = false and scheduled_at < now() - interval '6 hours';

  update public.publish_queue
     set status = 'pending', updated_at = now()
   where status = 'sending' and coalesce(is_test, false) = false and attempts = 0 and updated_at < now() - interval '10 minutes';

  update public.publish_queue
     set status = 'failed',
         error = '發送結果不明：執行器逾時。請到粉專確認是否已發出，避免重複發文',
         updated_at = now()
   where status = 'sending' and coalesce(is_test, false) = false and attempts >= 1 and updated_at < now() - interval '15 minutes';

  select decrypted_secret into hook_url
    from vault.decrypted_secrets
   where name = 'publish_queue_webhook_url'
   limit 1;

  if hook_url is null or hook_url = '' then
    return 0;
  end if;

  with due as (
    select id from public.publish_queue
     where status = 'pending' and coalesce(is_test, false) = false and scheduled_at <= now()
     order by scheduled_at
     limit 20
     for update skip locked
  ), upd as (
    update public.publish_queue q
       set status = 'sending', updated_at = now()
      from due
     where q.id = due.id
    returning q.id
  )
  select array_agg(id) into claimed from upd;

  if claimed is null then
    return 0;
  end if;

  perform net.http_post(
    url := hook_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('ids', to_jsonb(claimed))
  );

  return array_length(claimed, 1);
end;
$$;

-- 這個函式有 security definer，不能讓一般金鑰透過 API 呼叫
revoke all on function public.dispatch_publish_queue() from public, anon, authenticated;

-- 每分鐘跑一次（在 Supabase 內部執行，不經過 n8n）
do $$
begin
  if exists (select 1 from cron.job where jobname = 'dispatch-publish-queue') then
    perform cron.unschedule('dispatch-publish-queue');
  end if;
  perform cron.schedule('dispatch-publish-queue', '* * * * *', 'select public.dispatch_publish_queue();');
end;
$$;
