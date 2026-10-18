-- 校正警示的通知紀錄：同一種警示同一品牌 7 天內只通知一次。
-- 在 Supabase SQL Editor 執行一次即可，可重複執行。沒執行的話，警示檢查會失敗並被略過，實驗與快照照常運作。

create table if not exists public.calibration_alerts (
  code    text not null,
  brand   text not null,
  sent_at timestamptz not null default now(),
  primary key (code, brand)
);

-- 與其他實驗表一致：啟用 RLS 且不建政策，只有 service role 能讀寫
alter table public.calibration_alerts enable row level security;
