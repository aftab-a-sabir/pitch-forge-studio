
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS headshot_url text NULL;

INSERT INTO storage.buckets (id, name, public)
VALUES ('headshots', 'headshots', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Headshots are publicly viewable"
ON storage.objects FOR SELECT
USING (bucket_id = 'headshots');

CREATE POLICY "Users can upload their own headshots"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'headshots' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own headshots"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'headshots' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own headshots"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'headshots' AND auth.uid()::text = (storage.foldername(name))[1]);
