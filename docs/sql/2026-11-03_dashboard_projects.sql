-- 階段專案改存 Supabase：手機、電腦與自動流水線讀同一份專案事實表。
-- 只有伺服器（service_role）能讀寫；瀏覽器一律經由 /api/projects/store。
create table if not exists public.dashboard_projects (
  id text primary key check (id like 'project\_%'),
  name text not null,
  guidelines text not null default '',
  parent_brand text check (parent_brand in ('brand_a_i8', 'brand_b_nas', 'brand_c_abl', 'personal_brand')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.dashboard_projects enable row level security;
revoke all on table public.dashboard_projects from anon, authenticated;
grant all on table public.dashboard_projects to service_role;
