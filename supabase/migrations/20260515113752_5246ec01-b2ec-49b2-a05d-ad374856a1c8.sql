ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS script text,
  ADD COLUMN IF NOT EXISTS script_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS product_brief jsonb;