-- 題材成效回流：記錄每篇已發貼文屬於哪個題材（關鍵字宇宙裡的詞，或「其他」）。
-- 在 Supabase SQL Editor 執行一次即可，可重複執行。沒執行的話程式會當作沒有任何標記，實驗與發文照常運作。
-- 題材由 Codex 成效分析員每天標記，伺服器端檢查題材必須在該品牌的允許清單內，標記後不可改標。

create table if not exists public.post_topics (
  queue_id   uuid primary key references public.social_publish_queue (id) on delete cascade,
  brand      text not null check (brand in ('nas', 'abl', 'i8')),
  topic      text not null,
  tagged_by  text not null default 'analyst',
  run_id     uuid,
  created_at timestamptz not null default now()
);
create index if not exists post_topics_brand_topic_idx on public.post_topics (brand, topic);

-- 與其他實驗表一致：啟用 RLS 且不建政策，只有 service role 能讀寫
alter table public.post_topics enable row level security;
