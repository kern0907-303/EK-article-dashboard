-- 知識筆記全文只允許伺服器端 service_role 存取，瀏覽器 anon/authenticated 無權讀寫。
-- 可重複執行；回復請執行同目錄的 2026-10-07_knowledge_notes_rollback.sql。
create table if not exists public.knowledge_notes (
  id uuid primary key default gen_random_uuid(),
  domain text not null,
  title text not null,
  author text not null default '',
  domain_tags text[] not null default '{}',
  subdomain text not null default '',
  source_file text not null unique,
  content text not null,
  chars integer not null default 0 check (chars >= 0),
  content_md5 text not null,
  imported_at timestamptz not null default now()
);

create index if not exists knowledge_notes_domain_title_idx
  on public.knowledge_notes (domain, title);

alter table public.knowledge_notes enable row level security;
revoke all on table public.knowledge_notes from public, anon, authenticated;
grant select, insert, update, delete on table public.knowledge_notes to service_role;
