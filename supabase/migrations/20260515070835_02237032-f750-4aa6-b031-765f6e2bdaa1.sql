
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS video_url text;

UPDATE public.projects SET status = 'processing' WHERE status = 'Generating';
UPDATE public.projects SET status = 'error' WHERE status = 'Failed';
UPDATE public.projects SET status = 'pending' WHERE status NOT IN ('pending','processing','ready','error');

ALTER TABLE public.projects ALTER COLUMN status SET DEFAULT 'pending';

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE public.projects ADD CONSTRAINT projects_status_check
  CHECK (status IN ('pending','processing','ready','error'));
