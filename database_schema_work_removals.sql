-- Create table to track work removals from production
CREATE TABLE prdn_work_removals (
    id SERIAL PRIMARY KEY,
    
    -- Work identification
    stage_code character varying(10) not null,
    wo_details_id integer not null,
    derived_sw_code character varying(15) not null,
    
    -- Removal details
    removal_reason TEXT NOT NULL,           -- Reason for removal (mandatory)
    removed_by VARCHAR(100) NOT NULL,       -- Username who removed the work
    removed_dt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, -- When the work was removed
    
    -- Additional metadata
    created_by VARCHAR(100) NOT NULL DEFAULT 'system',
    created_dt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modified_by VARCHAR(100),
    modified_dt TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE,
    
    -- Constraints
    constraint prdn_work_removals_pkey primary key (id),
    constraint fk_prdn_work_removals_derived_sw_code foreign KEY (derived_sw_code) references std_work_type_details (derived_sw_code),
    constraint fk_prdn_work_removals_wo_details foreign KEY (wo_details_id) references prdn_wo_details (id)
);

-- Create indexes for faster lookups
CREATE INDEX idx_prdn_work_removals_derived_sw_code ON prdn_work_removals(derived_sw_code);
CREATE INDEX idx_prdn_work_removals_stage_code ON prdn_work_removals(stage_code);
CREATE INDEX idx_prdn_work_removals_wo_details_id ON prdn_work_removals(wo_details_id);
CREATE INDEX idx_prdn_work_removals_removed_dt ON prdn_work_removals(removed_dt);
CREATE INDEX idx_prdn_work_removals_is_deleted ON prdn_work_removals(is_deleted);

-- Composite index for common queries
CREATE INDEX idx_prdn_work_removals_composite ON prdn_work_removals(derived_sw_code, stage_code, wo_details_id, is_deleted);

-- Add comments to table
COMMENT ON TABLE prdn_work_removals IS 'Tracks removals of works from production stages with audit trail';
COMMENT ON COLUMN prdn_work_removals.derived_sw_code IS 'Derived standard work code that was removed';
COMMENT ON COLUMN prdn_work_removals.stage_code IS 'Production stage from which the work was removed';
COMMENT ON COLUMN prdn_work_removals.wo_details_id IS 'Work order details ID (foreign key to prdn_wo_details)';
COMMENT ON COLUMN prdn_work_removals.removal_reason IS 'Reason provided for removing the work (mandatory)';
COMMENT ON COLUMN prdn_work_removals.removed_by IS 'Username of the person who removed the work';
COMMENT ON COLUMN prdn_work_removals.removed_dt IS 'Timestamp when the work was removed';
