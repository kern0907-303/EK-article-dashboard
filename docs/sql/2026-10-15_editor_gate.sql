-- 品管關卡與編輯 AI（Paperclip）需要的欄位。在 Supabase SQL Editor 執行一次即可，可重複執行。
-- editor_rejects：編輯 AI 把任務退回重生成的次數。規則：最多退回 1 次，再不行就擋下交給人處理。
-- editor_note：編輯 AI 或品管關卡留下的原因，方便事後查看。

alter table public.auto_pipeline_jobs
  add column if not exists editor_rejects int not null default 0,
  add column if not exists editor_note text;

-- 還原用（不需要時不要執行）：
-- alter table public.auto_pipeline_jobs drop column if exists editor_rejects, drop column if exists editor_note;
