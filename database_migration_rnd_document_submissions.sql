-- Table for R&D document submissions
CREATE TABLE rnd_document_submissions (
    id SERIAL PRIMARY KEY,
    sales_order_id INTEGER NOT NULL REFERENCES prdn_wo_details(id),
    stage_code VARCHAR(50) NULL, -- NULL for general documents, stage code for stage-specific
    document_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL, -- Supabase Storage path
    file_size BIGINT NOT NULL, -- in bytes
    file_type VARCHAR(100) NOT NULL, -- mime type
    submission_date TIMESTAMP NOT NULL, -- initial upload date
    revised_date TIMESTAMP NULL, -- set when document is replaced/revised
    revision_number INTEGER NOT NULL DEFAULT 1, -- increments with each revision
    is_current BOOLEAN NOT NULL DEFAULT true, -- only one current per stage (for stage-specific)
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    replaced_by_id INTEGER NULL REFERENCES rnd_document_submissions(id), -- links to new version
    uploaded_by VARCHAR(100) NOT NULL,
    created_dt TIMESTAMP NOT NULL DEFAULT NOW(),
    modified_by VARCHAR(100),
    modified_dt TIMESTAMP
);

-- Partial unique index to ensure only one current document per stage (when stage_code is not null)
CREATE UNIQUE INDEX idx_unique_current_stage_document 
    ON rnd_document_submissions(sales_order_id, stage_code, is_current) 
    WHERE is_current = true AND is_deleted = false AND stage_code IS NOT NULL;

-- Indexes for better query performance
CREATE INDEX idx_rnd_doc_submissions_sales_order ON rnd_document_submissions(sales_order_id);
CREATE INDEX idx_rnd_doc_submissions_stage ON rnd_document_submissions(sales_order_id, stage_code);
CREATE INDEX idx_rnd_doc_submissions_current ON rnd_document_submissions(sales_order_id, stage_code, is_current, is_deleted) 
    WHERE is_current = true AND is_deleted = false;
CREATE INDEX idx_rnd_doc_submissions_replaced_by ON rnd_document_submissions(replaced_by_id);

