-- Disable Row-Level Security (RLS) on Supabase Storage
-- This allows all operations on storage.objects without RLS policies

-- Disable RLS on storage.objects
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;

-- Note: This will disable RLS for ALL storage buckets
-- If you need RLS for other buckets, you should instead create permissive policies
-- or make the rnd-documents bucket public in the Supabase dashboard

-- Alternative: If you want to keep RLS enabled but allow all operations on rnd-documents bucket,
-- you can use these policies instead:
/*
CREATE POLICY "Allow all operations on rnd-documents"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'rnd-documents')
WITH CHECK (bucket_id = 'rnd-documents');
*/

