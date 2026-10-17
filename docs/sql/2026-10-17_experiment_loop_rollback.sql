-- 成效回流閉環回復腳本。只移除本功能新增的內容；social_publish_queue.experiment_json 欄位保留資料時請先備份。
do $$ begin
  if exists (select 1 from cron.job where jobname = 'experiment-snapshot') then
    perform cron.unschedule('experiment-snapshot');
  end if;
end $$;
drop function if exists public.snapshot_experiment_metrics();
drop table if exists public.analyst_runs;
drop table if exists public.post_snapshots;
drop table if exists public.strategy_params;
drop table if exists public.experiments;
alter table public.social_publish_queue drop column if exists experiment_json;
