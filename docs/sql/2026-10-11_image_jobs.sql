-- 本機 ComfyUI 生圖的待生成表（Mac mini 主動連 Supabase Realtime 聽新單，不輪詢、不用 n8n）。
-- 在 Supabase SQL Editor 執行一次即可（可重複執行）。
--
-- 狀態流程：
--   pending  --(Mac mini 認領)-->  running  --(生好並上傳)-->  done
--   running  --(失敗)-->  failed
--   pending  --(使用者取消)-->  cancelled
-- 保護：
--   * 認領用「狀態還是 pending 才更新」的單筆更新，不會被兩台機器同時領走
--   * running 超過 15 分鐘沒完成：Mac mini 重啟時會退回 pending 重做（只重生底圖，不會重複發文）
--   * 表只給 service role 使用（儀表板後端與 Mac mini 小程式），沒有開放給匿名或登入使用者的政策

create table if not exists public.image_jobs (
  id            uuid primary key default gen_random_uuid(),
  purpose       text not null default 'card' check (purpose in ('card', 'article')),
  brand_id      text not null,
  size_key      text not null,
  prompt        text not null,
  negative      text not null default '',
  seed          bigint not null default (floor(random() * 2147483647))::bigint,
  status        text not null default 'pending'
                check (status in ('pending', 'running', 'done', 'failed', 'cancelled')),
  result_url    text,
  error         text,
  attempts      int  not null default 0,
  created_at    timestamptz not null default now(),
  claimed_at    timestamptz,
  finished_at   timestamptz
);

create index if not exists image_jobs_status_created_idx on public.image_jobs (status, created_at);
alter table public.image_jobs enable row level security;

-- Mac mini 小程式每 60 秒更新一次，儀表板用它顯示「Mac mini 在線或離線」
create table if not exists public.image_worker_heartbeat (
  worker_id   text primary key,
  seen_at     timestamptz not null default now(),
  info        jsonb not null default '{}'::jsonb
);
alter table public.image_worker_heartbeat enable row level security;

-- 讓 Realtime 推送 image_jobs 的新增事件給 Mac mini
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'image_jobs'
  ) then
    alter publication supabase_realtime add table public.image_jobs;
  end if;
end $$;
