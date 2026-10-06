-- 自動流水線回復腳本。只回復本功能新增內容；若仍有流水線佇列列或空 article_id，拒絕回復以免遺失資料。
do $$ begin
  if exists (select 1 from public.publish_queue where source = 'auto_pipeline') then
    raise exception '請先人工匯出並清理 source=auto_pipeline 的排程，再回復 schema';
  end if;
  if exists (select 1 from public.publish_queue where article_id is null) then
    raise exception 'publish_queue 尚有 article_id 為空的列，拒絕恢復 NOT NULL';
  end if;
end $$;

do $$ begin
  if exists (select 1 from cron.job where jobname = 'auto-pipeline-tick') then
    perform cron.unschedule('auto-pipeline-tick');
  end if;
end $$;
drop function if exists public.tick_auto_pipeline();
drop function if exists public.claim_auto_pipeline_job();
drop function if exists public.cancel_auto_pipeline_job(uuid);
drop function if exists public.enqueue_auto_pipeline_job(uuid, text, text);
drop table if exists public.auto_pipeline_jobs;
drop table if exists public.auto_pipeline_batches;
alter table public.publish_queue drop constraint if exists publish_queue_article_required_for_manual;
alter table public.publish_queue drop constraint if exists publish_queue_source_check;
alter table public.publish_queue alter column article_id set not null;
alter table public.publish_queue drop column if exists is_test;
alter table public.publish_queue drop column if exists source;
