BEGIN;

CREATE TABLE IF NOT EXISTS public.knowledge_import_batches (
  batch_id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  inserted_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  undone_at timestamptz
);

ALTER TABLE public.knowledge_import_batches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.knowledge_import_batches FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.knowledge_import_batches TO service_role;
  END IF;
END
$$;

COMMIT;
