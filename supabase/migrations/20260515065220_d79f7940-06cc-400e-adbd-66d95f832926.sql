ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS heygen_session_id text,
  ADD COLUMN IF NOT EXISTS heygen_video_id text,
  ADD COLUMN IF NOT EXISTS heygen_last_error text;

CREATE POLICY "own projects update"
ON public.projects
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);