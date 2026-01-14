-- Create permissive RLS policies for rnd-documents storage bucket
-- This allows authenticated users to upload, download, and delete documents
-- while keeping the bucket private and RLS enabled

-- Note: RLS is usually already enabled on storage.objects by default in Supabase
-- If you get a permission error on ALTER TABLE, skip it and just create the policy

-- Drop existing policies for rnd-documents if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow all operations on rnd-documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can download documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update documents" ON storage.objects;

-- Create a policy that allows all operations for anon users
-- Since your app uses custom auth (not Supabase Auth), we need to allow anon role
-- This allows any request using the anon key to access the rnd-documents bucket
CREATE POLICY "Allow all operations on rnd-documents"
ON storage.objects
FOR ALL
TO anon, authenticated
USING (bucket_id = 'rnd-documents')
WITH CHECK (bucket_id = 'rnd-documents');

-- Alternative: If you prefer separate policies for each operation, use these instead:
/*
-- Policy for Upload (INSERT)
CREATE POLICY "Users can upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'rnd-documents');

-- Policy for Download/View (SELECT)
CREATE POLICY "Users can download documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'rnd-documents');

-- Policy for Delete (DELETE)
CREATE POLICY "Users can delete documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'rnd-documents');

-- Policy for Update (UPDATE)
CREATE POLICY "Users can update documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'rnd-documents')
WITH CHECK (bucket_id = 'rnd-documents');
*/

COMMENT ON POLICY "Allow all operations on rnd-documents" ON storage.objects IS 
'Allows authenticated users to perform all operations (INSERT, SELECT, UPDATE, DELETE) on files in the rnd-documents bucket';

