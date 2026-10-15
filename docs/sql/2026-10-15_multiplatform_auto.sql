-- 自動流水線多平台延伸（官網、Instagram、Threads）需要的欄位。
-- 在 Supabase SQL Editor 執行一次即可，可重複執行。沒有執行時程式會自動退回不帶新欄位的寫入，
-- 排程照常運作，只是少了「哪一則排程對應哪個任務、哪篇官網文章」的紀錄。

-- 流水線任務：記錄 IG、Threads、官網各自的排程結果
alter table public.auto_pipeline_jobs
  add column if not exists social_results jsonb;

-- Threads / IG 排程：記錄來源任務與官網文章，之後成效回流可以把貼文和文章對起來
alter table public.social_publish_queue
  add column if not exists job_id uuid,
  add column if not exists article_id text;

create index if not exists social_publish_queue_job_idx
  on public.social_publish_queue (job_id);

-- 還原用（不需要時不要執行）：
-- alter table public.auto_pipeline_jobs drop column if exists social_results;
-- alter table public.social_publish_queue drop column if exists job_id, drop column if exists article_id;
