-- 成效回流閉環：實驗、每日快照、未來幾天的策略參數、分析員紀錄。
-- 在 Supabase SQL Editor 執行一次即可，可重複執行。不執行的話程式會自動退回原流程（沒有標籤、沒有實驗），不影響發文。
-- 啟用前還需要：
--   1) Render 設環境變數 EXPERIMENT_ENABLED=true、EXPERIMENT_CRON_SECRET、EXPERIMENT_ANALYST_SECRET（兩個 secret 各自產生長隨機字串，不要相同）。
--   2) Supabase Vault 存兩筆（網址與 secret 不進版控）：
--        select vault.create_secret('https://ek-article-dashboard.onrender.com/api/experiment/snapshot', 'experiment_snapshot_url');
--        select vault.create_secret('<與 Render 的 EXPERIMENT_CRON_SECRET 相同>', 'experiment_cron_secret');
-- 每天只呼叫一次儀表板，不碰 n8n 的排程額度（儀表板會讀一次 n8n 的唯讀成效出口）。

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

-- Threads / IG 排程列帶上實驗標籤：{experiment_id, variable, arm}
alter table public.social_publish_queue
  add column if not exists experiment_json jsonb;

create table if not exists public.experiments (
  id            uuid primary key default gen_random_uuid(),
  brand         text not null check (brand in ('nas', 'abl', 'i8')),
  variable      text not null check (variable in ('structure')),
  arm_a         text not null,
  arm_b         text not null,
  status        text not null default 'running' check (status in ('running', 'concluded', 'inconclusive', 'cancelled')),
  started_at    timestamptz not null default now(),
  winner        text,
  decision_note text,
  concluded_at  timestamptz,
  created_at    timestamptz not null default now(),
  constraint experiments_arms_differ check (arm_a <> arm_b),
  constraint experiments_winner_is_arm check (winner is null or winner in (arm_a, arm_b))
);
-- 每個品牌同時只能有一個進行中的實驗（一次只改一個變數）
create unique index if not exists experiments_one_running_per_brand
  on public.experiments (brand) where status = 'running';

create table if not exists public.strategy_params (
  brand         text not null check (brand in ('nas', 'abl', 'i8')),
  valid_date    date not null,                       -- 台北日期，依預定發文時間套用
  experiment_id uuid not null references public.experiments (id),
  arm           text not null,
  run_id        uuid,
  created_at    timestamptz not null default now(),
  primary key (brand, valid_date)
);

create table if not exists public.post_snapshots (
  id               bigserial primary key,
  queue_id         uuid,
  platform         text not null check (platform in ('threads', 'instagram')),
  post_id          text not null,
  brand            text not null,
  published_at     timestamptz not null,
  source_synced_at timestamptz not null,             -- n8n 那次同步的時間，成熟度以它減發文時間判斷
  observed_at      timestamptz not null default now(),
  views int, reach int, likes int, comments int, shares int, saves int,
  unique (platform, post_id, source_synced_at)
);
create index if not exists post_snapshots_queue_idx on public.post_snapshots (queue_id, source_synced_at desc);

create table if not exists public.analyst_runs (
  id          uuid primary key default gen_random_uuid(),
  run_at      timestamptz not null default now(),
  status      text not null check (status in ('accepted', 'rejected')),
  summary     text,
  request_json jsonb,
  result_json  jsonb
);

alter table public.experiments      enable row level security;
alter table public.strategy_params  enable row level security;
alter table public.post_snapshots   enable row level security;
alter table public.analyst_runs     enable row level security;
-- 刻意不建立 policy：只有 service_role（儀表板後端）能存取。

create or replace function public.snapshot_experiment_metrics()
returns integer language plpgsql security definer set search_path = public, extensions, vault
as $$
declare endpoint text; secret text;
begin
  select decrypted_secret into endpoint from vault.decrypted_secrets where name = 'experiment_snapshot_url' limit 1;
  select decrypted_secret into secret   from vault.decrypted_secrets where name = 'experiment_cron_secret' limit 1;
  if endpoint is null or endpoint = '' or secret is null or secret = '' then return 0; end if;
  perform net.http_post(url := endpoint, headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || secret), body := '{}'::jsonb);
  return 1;
end;
$$;
revoke all on function public.snapshot_experiment_metrics() from public, anon, authenticated;

-- 每天台北 04:30（UTC 20:30），在 n8n 的 03:00 到 03:40 同步之後
do $$ begin
  if exists (select 1 from cron.job where jobname = 'experiment-snapshot') then
    perform cron.unschedule('experiment-snapshot');
  end if;
  perform cron.schedule('experiment-snapshot', '30 20 * * *', 'select public.snapshot_experiment_metrics();');
end $$;
