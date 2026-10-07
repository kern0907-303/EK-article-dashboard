-- 只回復本功能新增的三張表。若已有衍生草稿，先匯出／確認後再手動清理。
do $$
declare
  has_rows boolean;
begin
  if to_regclass('public.derivative_posts') is not null then
    execute 'select exists(select 1 from public.derivative_posts)' into has_rows;
    if has_rows then
      raise exception 'derivative_posts 尚有草稿，拒絕回復以免刪除使用者內容。';
    end if;
  end if;
end $$;

drop table if exists public.derivative_posts;
drop table if exists public.platform_content_rules;
drop table if exists public.platform_specs;
