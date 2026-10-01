-- 排程佇列：Dashboard 寫入；Supabase 每分鐘檢查到期項目（見 2026-10-01_publish_queue_dispatch.sql），
-- 有到期才呼叫 n8n「Publish Queue Runner」發出，沒有到期就完全不呼叫 n8n。
-- 在 Supabase SQL Editor 執行一次即可（可重複執行）。
--
-- 存取方式：只有 service_role（Dashboard 後端與 n8n credential）會讀寫，
-- 所以啟用 RLS 且不建立任何 policy = 匿名與一般金鑰完全讀不到。

create table if not exists public.publish_queue (
  id            uuid primary key default gen_random_uuid(),
  brand_id      text not null check (brand_id in ('i8', 'nas', 'abl', 'erick')),
  target_pages  text[] not null check (array_length(target_pages, 1) >= 1),  -- 例：{fb_i8,fb_nas}
  content       text not null,
  image_url     text,                                  -- 階段 2 之後才會有值；空值時 n8n 沿用原本的圖池
  article_id    text not null,                         -- insights_articles.id，首則留言連結用它，不再抓「最新一篇」
  scheduled_at  timestamptz not null,                  -- 一律存 UTC，畫面顯示才轉台北時間
  status        text not null default 'pending'
                check (status in ('pending', 'sending', 'sent', 'partial', 'failed', 'cancelled')),
  results       jsonb not null default '[]'::jsonb,    -- 每個粉專一筆：{pageId, ok, fbPostId?, error?}
  error         text,
  attempts      int  not null default 0,
  test_mode     boolean not null default false,        -- true：n8n 以 published=false 發「未公開貼文」做演練
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  sent_at       timestamptz
);

-- runner 每次只撈 pending 且到期的，這個索引讓它很快
create index if not exists publish_queue_due_idx
  on public.publish_queue (status, scheduled_at);

create index if not exists publish_queue_brand_idx
  on public.publish_queue (brand_id, scheduled_at desc);

alter table public.publish_queue enable row level security;
-- 刻意不建立 policy：只有 service_role 能存取。
