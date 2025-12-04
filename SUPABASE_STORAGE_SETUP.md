# Supabase Storage Setup for R&D Documents

## Create Storage Bucket

1. Go to your Supabase Dashboard
2. Navigate to **Storage** section
3. Click **Create a new bucket**
4. Configure the bucket:
   - **Name**: `rnd-documents`
   - **Public bucket**: No (private)
   - **File size limit**: Set as needed (e.g., 50MB)
   - **Allowed MIME types**: 
     - `application/pdf`
     - `application/msword`
     - `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
     - `application/vnd.ms-excel`
     - `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
     - `text/plain`

## Storage Policies (RLS)

Since we're not using RLS policies right now, you can skip this step. However, if you need to add policies later:

### Policy for Upload (INSERT)
```sql
CREATE POLICY "Users can upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'rnd-documents');
```

### Policy for Download (SELECT)
```sql
CREATE POLICY "Users can download documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'rnd-documents');
```

### Policy for Delete (DELETE)
```sql
CREATE POLICY "Users can delete documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'rnd-documents');
```

## File Path Structure

Files are stored with the following structure:
- Stage-specific: `{sales_order_id}/{stage_code}/{timestamp}_{filename}`
- General: `{sales_order_id}/general/{timestamp}_{filename}`

Example:
- `12/P1S1/1699876543210_document.pdf`
- `12/general/1699876543211_general_doc.pdf`

