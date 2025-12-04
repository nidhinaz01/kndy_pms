-- Storage RLS Policies for rnd-documents bucket
-- These policies allow authenticated users to upload, download, and delete documents

-- Enable RLS on storage.objects (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can download documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update documents" ON storage.objects;

-- Policy for Upload (INSERT)
-- Allows authenticated users to upload files to rnd-documents bucket
CREATE POLICY "Users can upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'rnd-documents'
);

-- Policy for Download/View (SELECT)
-- Allows authenticated users to view/download files from rnd-documents bucket
CREATE POLICY "Users can download documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'rnd-documents'
);

-- Policy for Delete (DELETE)
-- Allows authenticated users to delete files from rnd-documents bucket
CREATE POLICY "Users can delete documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'rnd-documents'
);

-- Policy for Update (UPDATE)
-- Allows authenticated users to update file metadata in rnd-documents bucket
CREATE POLICY "Users can update documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'rnd-documents'
)
WITH CHECK (
  bucket_id = 'rnd-documents'
);

