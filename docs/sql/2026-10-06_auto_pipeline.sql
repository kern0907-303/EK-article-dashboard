-- 自動流水線與 publish_queue 向後相容擴充。可重複執行。
-- 啟用前需在 Vault 設定 auto_pipeline_tick_url 與 auto_pipeline_cron_secret。

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

alter table public.publish_queue add column if not exists source text not null default 'manual';
alter table public.publish_queue add column if not exists is_test boolean not null default false;
alter table public.publish_queue alter column article_id drop not null;
alter table public.publish_queue drop constraint if exists publish_queue_source_check;
alter table public.publish_queue add constraint publish_queue_source_check check (source in ('manual', 'auto_pipeline'));
alter table public.publish_queue drop constraint if exists publish_queue_article_required_for_manual;
alter table public.publish_queue add constraint publish_queue_article_required_for_manual
  check (source = 'auto_pipeline' or article_id is not null);

create table if not exists public.auto_pipeline_batches (
  id uuid primary key default gen_random_uuid(),
  batch_no text not null unique default ('AP-' || to_char(now(), 'YYYYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 8)),
  created_at timestamptz not null default now(),
  source text not null check (source in ('manual', 'file', 'research')),
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'attention', 'failed', 'cancelled')),
  notification_items jsonb not null default '[]'::jsonb,
  notified_at timestamptz,
  test_run boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.auto_pipeline_jobs (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.auto_pipeline_batches(id) on delete cascade,
  brand_id text not null check (brand_id in ('nas', 'abl', 'i8', 'erick')),
  project_id text,
  prompt text not null,
  scheduled_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'generating', 'optimizing', 'scheduled', 'manual', 'failed', 'cancelled')),
  current_step text not null default '等待執行',
  retry_count integer not null default 0 check (retry_count between 0 and 2),
  error_reason text,
  draft_content text,
  article_id text,
  queue_id uuid references public.publish_queue(id) on delete set null,
  reviewed boolean not null default false,
  draft_only boolean not null default false,
  test_run boolean not null default false,
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.auto_pipeline_batches add column if not exists notification_items jsonb not null default '[]'::jsonb;
alter table public.auto_pipeline_batches add column if not exists notified_at timestamptz;
alter table public.auto_pipeline_batches add column if not exists test_run boolean not null default false;
alter table public.auto_pipeline_jobs add column if not exists draft_only boolean not null default false;
alter table public.auto_pipeline_jobs add column if not exists test_run boolean not null default false;

create index if not exists auto_pipeline_jobs_pending_idx on public.auto_pipeline_jobs(status, created_at);
create index if not exists auto_pipeline_jobs_batch_idx on public.auto_pipeline_jobs(batch_id, created_at);
create index if not exists auto_pipeline_queue_idx on public.auto_pipeline_jobs(queue_id) where queue_id is not null;
alter table public.auto_pipeline_batches enable row level security;
alter table public.auto_pipeline_jobs enable row level security;

-- 一次只認領一篇。狀態更新與讀取在同一 transaction，重複 tick 不會並行處理不同工作。
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

-- 排程建立具冪等性並與取消互斥：同一工作重試不會建立多筆，已取消工作不會復活。
create or replace function public.enqueue_auto_pipeline_job(
  p_job_id uuid, p_content text, p_target_page text
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare job public.auto_pipeline_jobs%rowtype; v_queue_id uuid;
begin
  select * into job from public.auto_pipeline_jobs where id = p_job_id for update;
  if not found then return null; end if;
  if job.queue_id is not null then return job.queue_id; end if;
  if job.status <> 'optimizing' or job.scheduled_at is null or job.scheduled_at < now() + interval '30 minutes' then return null; end if;
  if p_target_page = 'fb_erick' or p_target_page not in ('fb_nas', 'fb_abl', 'fb_i8') then return null; end if;
  insert into public.publish_queue (
    brand_id, target_pages, content, image_url, article_id, source, is_test,
    scheduled_at, status, results, test_mode, created_at, updated_at
  ) values (
    job.brand_id, array[p_target_page], p_content, null, null, 'auto_pipeline', false,
    job.scheduled_at, 'pending', '[]'::jsonb, false, now(), now()
  ) returning id into v_queue_id;
  update public.auto_pipeline_jobs
     set status = 'scheduled', current_step = '已排程，未審', queue_id = v_queue_id,
         draft_content = p_content, error_reason = null, updated_at = now()
   where id = p_job_id;
  return v_queue_id;
end;
$$;
revoke all on function public.enqueue_auto_pipeline_job(uuid, text, text) from public, anon, authenticated;
grant execute on function public.enqueue_auto_pipeline_job(uuid, text, text) to service_role;

-- 取消與建立共用 job row lock，避免背景排程與取消競態。
create or replace function public.cancel_auto_pipeline_job(p_job_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare job public.auto_pipeline_jobs%rowtype;
begin
  select * into job from public.auto_pipeline_jobs where id = p_job_id for update;
  if not found or job.status not in ('pending', 'generating', 'optimizing', 'scheduled') then return false; end if;
  if job.queue_id is not null then
    update public.publish_queue set status = 'cancelled', updated_at = now()
     where id = job.queue_id and source = 'auto_pipeline' and status = 'pending';
    if not found and job.status = 'scheduled' then return false; end if;
  end if;
  update public.auto_pipeline_jobs set status = 'cancelled', current_step = '已取消', updated_at = now() where id = p_job_id;
  return true;
end;
$$;
revoke all on function public.cancel_auto_pipeline_job(uuid) from public, anon, authenticated;
grant execute on function public.cancel_auto_pipeline_job(uuid) to service_role;

create or replace function public.tick_auto_pipeline()
returns integer language plpgsql security definer set search_path = public, extensions, vault
as $$
declare endpoint text; secret text;
begin
  select decrypted_secret into endpoint from vault.decrypted_secrets where name = 'auto_pipeline_tick_url' limit 1;
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'auto_pipeline_cron_secret' limit 1;
  if endpoint is null or endpoint = '' or secret is null or secret = '' then return 0; end if;
  perform net.http_post(url := endpoint, headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || secret), body := '{}'::jsonb);
  return 1;
end;
$$;
revoke all on function public.tick_auto_pipeline() from public, anon, authenticated;

do $$ begin
  if exists (select 1 from cron.job where jobname = 'auto-pipeline-tick') then
    perform cron.unschedule('auto-pipeline-tick');
  end if;
  perform cron.schedule('auto-pipeline-tick', '* * * * *', 'select public.tick_auto_pipeline();');
end $$;
