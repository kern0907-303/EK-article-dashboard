-- 2026-10-31
-- 一、app_settings：頁面上選的模型要存在伺服器端，自動發文才讀得到。
--     首頁右上角的「AI 大腦」只寫 localStorage，從來管不到自動發文。
-- 二、claim_auto_pipeline_job 加上卡住任務回收。
--     部署或容器重啟會打斷正在生成的文章，狀態就永遠停在 generating/optimizing，
--     而認領函式只要看到有人在跑就不撿下一篇，所以一次中斷會把整條流水線無聲卡死。
--     2026-10-31 23:37 的部署就打斷了一篇 NAS，後面 18 篇全部停住。

create table if not exists public.app_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

comment on table public.app_settings is '後台可調整的伺服器端設定。ai_provider 這一筆決定自動流水線用哪個模型，空字串代表沿用環境變數 AI_PROVIDER。';

alter table public.app_settings enable row level security;

insert into public.app_settings (key, value) values ('ai_provider', '')
  on conflict (key) do nothing;

-- 一次只認領一篇。狀態更新與讀取在同一 transaction，重複 tick 不會並行處理不同工作。
create or replace function public.claim_auto_pipeline_job()
returns setof public.auto_pipeline_jobs
language plpgsql security definer set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtext('auto_pipeline_runner'));
  -- 超過 15 分鐘沒有更新的，視為執行中斷，沒有人在跑它，放回 pending 重跑。
  -- 草稿內容保留，重跑會覆蓋；生成一篇約數分鐘，15 分鐘是安全邊界。
  update public.auto_pipeline_jobs
     set status = 'pending', current_step = '等待執行（上一次執行中斷）', updated_at = now()
   where status in ('generating', 'optimizing')
     and updated_at < now() - interval '15 minutes';
  if exists (select 1 from public.auto_pipeline_jobs where status in ('generating', 'optimizing')) then
    return;
  end if;
  return query
    with next_job as (
      select id from public.auto_pipeline_jobs where status = 'pending'
      order by created_at for update skip locked limit 1
    )
    update public.auto_pipeline_jobs j
       set status = 'generating', current_step = '生成中', updated_at = now()
      from next_job n where j.id = n.id returning j.*;
end;
$$;
revoke all on function public.claim_auto_pipeline_job() from public, anon, authenticated;
grant execute on function public.claim_auto_pipeline_job() to service_role;
