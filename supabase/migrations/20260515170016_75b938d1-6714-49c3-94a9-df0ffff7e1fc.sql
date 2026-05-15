
-- 1) Restrict profiles SELECT to own row
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- 2) Restrict headshots bucket listing: drop broad SELECT, allow only owners to list/select via API.
-- Public file URLs in a public bucket continue to work without RLS for direct GETs.
DROP POLICY IF EXISTS "Headshots are publicly viewable" ON storage.objects;
CREATE POLICY "Users can view their own headshots"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'headshots'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);
