-- 2026-10-31 回滾
-- app_settings 不刪表（刪了會連帶把頁面上的模型選擇清掉），只把函式還原成原本的版本。

create or replace function public.claim_auto_pipeline_job()
returns setof public.auto_pipeline_jobs
language plpgsql security definer set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtext('auto_pipeline_runner'));
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
