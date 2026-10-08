BEGIN;

ALTER TABLE public.knowledge_notes
  ADD COLUMN IF NOT EXISTS title_zh text,
  ADD COLUMN IF NOT EXISTS title_zh_subtitle text,
  ADD COLUMN IF NOT EXISTS author_zh text,
  ADD COLUMN IF NOT EXISTS translator_zh text,
  ADD COLUMN IF NOT EXISTS publisher_zh text,
  ADD COLUMN IF NOT EXISTS zh_source_url text,
  ADD COLUMN IF NOT EXISTS zh_status text DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS import_batch_id text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.knowledge_notes'::regclass
      AND conname = 'knowledge_notes_zh_status_check'
  ) THEN
    ALTER TABLE public.knowledge_notes
      ADD CONSTRAINT knowledge_notes_zh_status_check
      CHECK (zh_status IN ('confirmed', 'unverified', 'no_zh_edition'));
  END IF;
END
$$;

COMMIT;
