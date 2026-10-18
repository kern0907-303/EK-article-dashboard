-- 還原：把 experiments.variable 改回只允許 structure。
-- 若已有 variable = 'genre' 的資料列，這段會失敗（請先確認沒有文體實驗再還原）。

do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.experiments'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%variable%'
  loop
    execute format('alter table public.experiments drop constraint %I', c);
  end loop;
  alter table public.experiments add constraint experiments_variable_check check (variable in ('structure'));
end $$;
