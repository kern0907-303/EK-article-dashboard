-- 文體實驗：把 experiments.variable 的允許值從 ('structure') 放寬為 ('structure', 'genre')。
-- 在 Supabase SQL Editor 執行一次即可，可重複執行。沒執行的話，開文體實驗會被資料庫擋下（結構實驗不受影響）。

do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.experiments'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%variable%'
  loop
    execute format('alter table public.experiments drop constraint %I', c);
  end loop;
  alter table public.experiments add constraint experiments_variable_check check (variable in ('structure', 'genre'));
end $$;
