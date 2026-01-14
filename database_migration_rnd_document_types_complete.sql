-- Migration: R&D Document Types - Complete Setup
-- This migration adds support for document types and "Not Required" tracking

-- ============================================================================
-- PART 1: Add "Not Required" Requirements Table
-- ============================================================================

-- Create table for tracking document requirements and "Not Required" status
CREATE TABLE IF NOT EXISTS public.rnd_document_requirements (
    id SERIAL PRIMARY KEY,
    sales_order_id INTEGER NOT NULL REFERENCES prdn_wo_details(id),
    document_type VARCHAR(50) NOT NULL,
    is_not_required BOOLEAN NOT NULL DEFAULT FALSE,
    not_required_comments TEXT NULL,
    marked_by VARCHAR(100) NOT NULL,
    marked_dt TIMESTAMP NOT NULL DEFAULT NOW(),
    created_dt TIMESTAMP NOT NULL DEFAULT NOW(),
    modified_by VARCHAR(100) NULL,
    modified_dt TIMESTAMP NULL,
    
    -- Ensure one requirement record per document type per work order
    CONSTRAINT rnd_document_requirements_unique UNIQUE (sales_order_id, document_type),
    
    -- Ensure valid document types
    CONSTRAINT chk_valid_document_type CHECK (LOWER(TRIM(document_type)) IN (
        'bill of material',
        'cutting profile',
        'general',
        'material checklist',
        'platform drawing',
        'seat layout',
        'structure drawing'
    )),
    
    -- Comments are mandatory when marked as not required
    CONSTRAINT chk_not_required_comments CHECK (
        (is_not_required = false) OR 
        (is_not_required = true AND not_required_comments IS NOT NULL AND TRIM(not_required_comments) != '')
    )
);

-- Indexes for rnd_document_requirements
CREATE INDEX IF NOT EXISTS idx_rnd_doc_requirements_sales_order 
    ON public.rnd_document_requirements(sales_order_id);

CREATE INDEX IF NOT EXISTS idx_rnd_doc_requirements_type 
    ON public.rnd_document_requirements(sales_order_id, document_type);

CREATE INDEX IF NOT EXISTS idx_rnd_doc_requirements_not_required 
    ON public.rnd_document_requirements(sales_order_id, document_type) 
    WHERE is_not_required = true;

-- Comments
COMMENT ON TABLE public.rnd_document_requirements IS 'Tracks document requirements and "Not Required" status for R&D documents';
COMMENT ON COLUMN public.rnd_document_requirements.is_not_required IS 'True if document is marked as not required for this work order';
COMMENT ON COLUMN public.rnd_document_requirements.not_required_comments IS 'Mandatory comments explaining why document is not required';

-- ============================================================================
-- PART 2: Update Main Table Constraints
-- ============================================================================

-- Add CHECK constraint for valid document types in main table
ALTER TABLE public.rnd_document_submissions
    DROP CONSTRAINT IF EXISTS chk_valid_document_type;

ALTER TABLE public.rnd_document_submissions
    ADD CONSTRAINT chk_valid_document_type CHECK (
        document_type IS NULL OR 
        LOWER(TRIM(document_type)) IN (
            'bill of material',
            'cutting profile',
            'general',
            'material checklist',
            'platform drawing',
            'seat layout',
            'structure drawing'
        )
    );

-- Add CHECK constraint to ensure file_path is provided for actual documents
-- (This ensures data integrity - documents must have files)
ALTER TABLE public.rnd_document_submissions
    DROP CONSTRAINT IF EXISTS chk_document_has_file;

ALTER TABLE public.rnd_document_submissions
    ADD CONSTRAINT chk_document_has_file CHECK (
        file_path IS NOT NULL AND 
        TRIM(file_path) != ''
    );

-- ============================================================================
-- PART 3: Create View for Document Status Overview
-- ============================================================================

-- View to easily query document status (uploaded, not required, or pending)
CREATE OR REPLACE VIEW public.rnd_document_status AS
SELECT 
    COALESCE(d.sales_order_id, r.sales_order_id) as sales_order_id,
    COALESCE(d.document_type, r.document_type) as document_type,
    CASE 
        WHEN d.id IS NOT NULL AND d.is_deleted = false AND d.is_current = true THEN 'uploaded'
        WHEN r.is_not_required = true THEN 'not_required'
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
    -- Get all document types that exist in either table
    SELECT DISTINCT sales_order_id, document_type 
    FROM public.rnd_document_submissions
    WHERE document_type IS NOT NULL
    UNION
    SELECT DISTINCT sales_order_id, document_type 
    FROM public.rnd_document_requirements
) all_types
LEFT JOIN public.rnd_document_submissions d 
    ON d.sales_order_id = all_types.sales_order_id 
    AND LOWER(TRIM(d.document_type)) = LOWER(TRIM(all_types.document_type))
    AND d.is_current = true 
    AND d.is_deleted = false
LEFT JOIN public.rnd_document_requirements r 
    ON r.sales_order_id = all_types.sales_order_id 
    AND LOWER(TRIM(r.document_type)) = LOWER(TRIM(all_types.document_type));

COMMENT ON VIEW public.rnd_document_status IS 'Unified view showing document status: uploaded, not_required, or pending';

-- ============================================================================
-- PART 4: Helper Functions (Optional - for easier querying)
-- ============================================================================

-- Function to get document status for a work order
CREATE OR REPLACE FUNCTION public.get_document_status(
    p_sales_order_id INTEGER,
    p_document_type VARCHAR(50)
)
RETURNS TABLE (
    status TEXT,
    document_id INTEGER,
    file_path TEXT,
    not_required_comments TEXT,
    not_required_marked_by VARCHAR(100),
    not_required_marked_dt TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE 
            WHEN d.id IS NOT NULL AND d.is_deleted = false AND d.is_current = true THEN 'uploaded'::TEXT
            WHEN r.is_not_required = true THEN 'not_required'::TEXT
            ELSE 'pending'::TEXT
        END as status,
        d.id as document_id,
        d.file_path,
        r.not_required_comments,
        r.marked_by as not_required_marked_by,
        r.marked_dt as not_required_marked_dt
    FROM (
        SELECT p_sales_order_id as sales_order_id, LOWER(TRIM(p_document_type)) as document_type
    ) dt
    LEFT JOIN public.rnd_document_submissions d 
        ON d.sales_order_id = dt.sales_order_id 
        AND LOWER(TRIM(d.document_type)) = dt.document_type
        AND d.is_current = true 
        AND d.is_deleted = false
    LEFT JOIN public.rnd_document_requirements r 
        ON r.sales_order_id = dt.sales_order_id 
        AND LOWER(TRIM(r.document_type)) = dt.document_type;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.get_document_status IS 'Get document status (uploaded, not_required, or pending) for a specific work order and document type';

-- ============================================================================
-- PART 5: Document Type Constants (for reference)
-- ============================================================================

/*
Document Types (in alphabetical order, General last):
1. Bill of Material - Multiple files allowed
2. Cutting Profile - Multiple files allowed
3. General - Multiple files allowed (keep at last)
4. Material Checklist - Single file only
5. Platform Drawing - Single file only
6. Seat Layout - Single file only
7. Structure Drawing - Single file only

Single-file types: Material Checklist, Platform Drawing, Seat Layout, Structure Drawing
Multi-file types: Bill of Material, Cutting Profile, General
*/

-- ============================================================================
-- PART 6: Verification Queries
-- ============================================================================

-- Verify table structure
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'rnd_document_submissions' 
-- ORDER BY ordinal_position;

-- Verify indexes
-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE tablename IN ('rnd_document_submissions', 'rnd_document_requirements')
-- ORDER BY tablename, indexname;

-- Verify constraints
-- SELECT constraint_name, constraint_type 
-- FROM information_schema.table_constraints 
-- WHERE table_name IN ('rnd_document_submissions', 'rnd_document_requirements')
-- ORDER BY table_name, constraint_name;

