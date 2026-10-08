BEGIN;

ALTER TABLE public.knowledge_notes
  DROP CONSTRAINT IF EXISTS knowledge_notes_zh_status_check;

ALTER TABLE public.knowledge_notes
  DROP COLUMN IF EXISTS title_zh,
  DROP COLUMN IF EXISTS title_zh_subtitle,
  DROP COLUMN IF EXISTS author_zh,
  DROP COLUMN IF EXISTS translator_zh,
  DROP COLUMN IF EXISTS publisher_zh,
  DROP COLUMN IF EXISTS zh_source_url,
  DROP COLUMN IF EXISTS zh_status,
  DROP COLUMN IF EXISTS import_batch_id;

COMMIT;
