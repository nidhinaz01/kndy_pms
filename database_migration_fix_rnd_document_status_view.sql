-- Fix for rnd_document_status view
-- The view was creating rows with all null values when requirements were deleted
-- This fix ensures only rows with actual data are returned

-- First, check for problematic data
-- This will help identify the source of null rows
DO $$
BEGIN
    RAISE NOTICE 'Checking for orphaned requirement records...';
    RAISE NOTICE 'Records with is_not_required = false or NULL: %', 
        (SELECT COUNT(*) FROM public.rnd_document_requirements WHERE is_not_required IS NULL OR is_not_required = false);
    RAISE NOTICE 'Records with NULL sales_order_id: %', 
        (SELECT COUNT(*) FROM public.rnd_document_requirements WHERE sales_order_id IS NULL);
    RAISE NOTICE 'Records with NULL document_type: %', 
        (SELECT COUNT(*) FROM public.rnd_document_requirements WHERE document_type IS NULL);
END $$;

-- Clean up any orphaned requirement records (where is_not_required = false or NULL)
-- These shouldn't exist, but if they do, they can cause issues
DELETE FROM public.rnd_document_requirements 
WHERE is_not_required IS NULL OR is_not_required = false;

-- Drop the existing view
DROP VIEW IF EXISTS public.rnd_document_status;

-- Recreate the view with proper filtering
-- Only shows rows where there's actual data (either a document or an active requirement)
CREATE OR REPLACE VIEW public.rnd_document_status AS
SELECT 
    COALESCE(d.sales_order_id, r.sales_order_id) as sales_order_id,
    COALESCE(d.document_type, r.document_type) as document_type,
    CASE 
        WHEN d.id IS NOT NULL AND d.is_deleted = false AND d.is_current = true THEN 'uploaded'
        WHEN r.id IS NOT NULL AND r.is_not_required = true THEN 'not_required'
        ELSE 'pending'
    END as status,
    d.id as document_id,
    d.file_path,
    d.document_name,
    d.submission_date,
    d.revision_number,
    d.uploaded_by,
    r.not_required_comments,
    r.marked_by as not_required_marked_by,
    r.marked_dt as not_required_marked_dt
FROM (
    -- Get all document types that have actual documents
    SELECT DISTINCT sales_order_id, document_type 
    FROM public.rnd_document_submissions
    WHERE document_type IS NOT NULL
        AND sales_order_id IS NOT NULL
    UNION
    -- Get all document types that have active "not required" requirements
    SELECT DISTINCT sales_order_id, document_type 
    FROM public.rnd_document_requirements
    WHERE is_not_required = true
        AND sales_order_id IS NOT NULL
        AND document_type IS NOT NULL
) all_types
LEFT JOIN public.rnd_document_submissions d 
    ON d.sales_order_id = all_types.sales_order_id 
    AND LOWER(TRIM(d.document_type)) = LOWER(TRIM(all_types.document_type))
    AND d.is_current = true 
    AND d.is_deleted = false
LEFT JOIN public.rnd_document_requirements r 
    ON r.sales_order_id = all_types.sales_order_id 
    AND LOWER(TRIM(r.document_type)) = LOWER(TRIM(all_types.document_type))
    AND r.is_not_required = true
WHERE 
    -- Only return rows where there's actual data (document or requirement)
    (d.id IS NOT NULL OR r.id IS NOT NULL)
    AND all_types.sales_order_id IS NOT NULL
    AND all_types.document_type IS NOT NULL;

COMMENT ON VIEW public.rnd_document_status IS 'Unified view showing document status: uploaded, not_required, or pending. Only shows rows with actual data (documents or active "not required" requirements).';

