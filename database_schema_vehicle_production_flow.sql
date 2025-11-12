-- Create table to track vehicle flow across production stages
CREATE TABLE vehicle_production_flow (
    id SERIAL PRIMARY KEY,
    
    -- Vehicle identification
    vehicle_id VARCHAR(50) NOT NULL,  -- Unique vehicle identifier (e.g., VIN, chassis number)
    vehicle_model_id INTEGER NOT NULL, -- Reference to vehicle model
    vehicle_variant VARCHAR(100),      -- Specific variant/trim level
    
    -- Production planning reference
    production_plan_id INTEGER,        -- Reference to plan_prod_plan_per_shift or plan_prod_plan_per_day
    planned_entry_date DATE,           -- Planned entry date into production
    planned_completion_date DATE,      -- Planned completion date
    
    -- Current status
    current_stage_id INTEGER NOT NULL, -- Current production stage
    current_status VARCHAR(50) NOT NULL DEFAULT 'In Progress', -- Status: Planned, In Progress, Completed, On Hold, Rework, Cancelled
    current_shift_id INTEGER,          -- Current shift (if applicable)
    
    -- Stage tracking (JSONB for flexibility)
    stage_progress JSONB NOT NULL DEFAULT '[]', -- Array of completed stages with timestamps
    -- Structure: [{"stage_id": 1, "entry_time": "2024-01-15T08:00:00", "exit_time": "2024-01-15T16:00:00", "duration_minutes": 480, "status": "completed", "notes": "..."}]
    
    -- Time tracking
    actual_entry_date DATE,            -- Actual entry date into production
    actual_completion_date DATE,       -- Actual completion date
    total_production_time_minutes INTEGER, -- Total time from entry to completion
    
    -- Lead time tracking
    stage_lead_times JSONB DEFAULT '{}', -- Lead times per stage: {"stage_id": {"planned": 480, "actual": 520, "variance": 40}}
    cumulative_lead_time_minutes INTEGER, -- Cumulative lead time up to current stage
    
    -- Quality and rework tracking
    rework_count INTEGER DEFAULT 0,    -- Number of times vehicle has been sent for rework
    quality_issues JSONB DEFAULT '[]', -- Array of quality issues: [{"stage_id": 1, "issue_type": "Paint defect", "severity": "Minor", "resolution_time_minutes": 120}]
    
    -- Resource allocation
    assigned_team_id INTEGER,          -- Team assigned to current stage
    assigned_equipment_id INTEGER,     -- Equipment assigned (if applicable)
    skill_combination_id INTEGER,      -- Skill combination being used
    
    -- Work order tracking
    work_order_id VARCHAR(50),         -- Associated work order number
    work_order_type_id INTEGER,        -- Type of work order
    
    -- Production metrics
    efficiency_percentage DECIMAL(5,2), -- Production efficiency (planned vs actual time)
    quality_score DECIMAL(5,2),        -- Quality score (0-100)
    cost_variance DECIMAL(10,2),       -- Cost variance from planned budget
    
    -- Constraints and dependencies
    dependencies JSONB DEFAULT '[]',   -- Array of dependencies: [{"vehicle_id": "VIN123", "stage_id": 1, "dependency_type": "Sequential"}]
    constraints JSONB DEFAULT '[]',    -- Production constraints: [{"constraint_type": "Resource", "resource_id": 1, "description": "Equipment maintenance"}]
    
    -- Metadata
    created_by VARCHAR(255) NOT NULL,
    created_dt TIMESTAMP DEFAULT NOW(),
    modified_by VARCHAR(255),
    modified_dt TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    is_deleted BOOLEAN DEFAULT FALSE,
    
    -- Foreign key constraints
    CONSTRAINT fk_vehicle_production_flow_model 
        FOREIGN KEY (vehicle_model_id) REFERENCES mstr_vehicle_model(id),
    CONSTRAINT fk_vehicle_production_flow_stage 
        FOREIGN KEY (current_stage_id) REFERENCES mstr_plant_stage(id),
    CONSTRAINT fk_vehicle_production_flow_shift 
        FOREIGN KEY (current_shift_id) REFERENCES hr_shift_master(id),
    CONSTRAINT fk_vehicle_production_flow_team 
        FOREIGN KEY (assigned_team_id) REFERENCES hr_teams(id),
    CONSTRAINT fk_vehicle_production_flow_equipment 
        FOREIGN KEY (assigned_equipment_id) REFERENCES mstr_equipment(id),
    CONSTRAINT fk_vehicle_production_flow_skills 
        FOREIGN KEY (skill_combination_id) REFERENCES std_skill_combinations(id),
    CONSTRAINT fk_vehicle_production_flow_wo_type 
        FOREIGN KEY (work_order_type_id) REFERENCES mstr_wo_type(id),
    CONSTRAINT fk_vehicle_production_flow_created_by 
        FOREIGN KEY (created_by) REFERENCES app_users(username),
    CONSTRAINT fk_vehicle_production_flow_modified_by 
        FOREIGN KEY (modified_by) REFERENCES app_users(username),
    
    -- Check constraints
    CONSTRAINT chk_vehicle_production_flow_status 
        CHECK (current_status IN ('Planned', 'In Progress', 'Completed', 'On Hold', 'Rework', 'Cancelled')),
    CONSTRAINT chk_vehicle_production_flow_dates 
        CHECK (planned_entry_date <= planned_completion_date),
    CONSTRAINT chk_vehicle_production_flow_actual_dates 
        CHECK (actual_entry_date IS NULL OR actual_completion_date IS NULL OR actual_entry_date <= actual_completion_date),
    CONSTRAINT chk_vehicle_production_flow_efficiency 
        CHECK (efficiency_percentage >= 0 AND efficiency_percentage <= 200),
    CONSTRAINT chk_vehicle_production_flow_quality 
        CHECK (quality_score >= 0 AND quality_score <= 100),
    CONSTRAINT chk_vehicle_production_flow_rework 
        CHECK (rework_count >= 0)
);

-- Add comments for documentation
COMMENT ON TABLE vehicle_production_flow IS 'Tracks vehicle flow through production stages with detailed timing, quality, and resource allocation';
COMMENT ON COLUMN vehicle_production_flow.vehicle_id IS 'Unique vehicle identifier (VIN, chassis number, etc.)';
COMMENT ON COLUMN vehicle_production_flow.vehicle_model_id IS 'Reference to vehicle model being produced';
COMMENT ON COLUMN vehicle_production_flow.current_stage_id IS 'Current production stage where vehicle is located';
COMMENT ON COLUMN vehicle_production_flow.current_status IS 'Current status: Planned, In Progress, Completed, On Hold, Rework, Cancelled';
COMMENT ON COLUMN vehicle_production_flow.stage_progress IS 'JSONB array of completed stages with entry/exit times and durations';
COMMENT ON COLUMN vehicle_production_flow.stage_lead_times IS 'JSONB object with planned vs actual lead times per stage';
COMMENT ON COLUMN vehicle_production_flow.quality_issues IS 'JSONB array of quality issues with severity and resolution times';
COMMENT ON COLUMN vehicle_production_flow.dependencies IS 'JSONB array of vehicle dependencies (sequential, parallel, etc.)';
COMMENT ON COLUMN vehicle_production_flow.constraints IS 'JSONB array of production constraints (resource, time, quality)';

-- Create indexes for better performance
CREATE INDEX idx_vehicle_production_flow_vehicle_id ON vehicle_production_flow(vehicle_id);
CREATE INDEX idx_vehicle_production_flow_model ON vehicle_production_flow(vehicle_model_id);
CREATE INDEX idx_vehicle_production_flow_current_stage ON vehicle_production_flow(current_stage_id);
CREATE INDEX idx_vehicle_production_flow_status ON vehicle_production_flow(current_status);
CREATE INDEX idx_vehicle_production_flow_dates ON vehicle_production_flow(planned_entry_date, planned_completion_date);
CREATE INDEX idx_vehicle_production_flow_actual_dates ON vehicle_production_flow(actual_entry_date, actual_completion_date);
CREATE INDEX idx_vehicle_production_flow_work_order ON vehicle_production_flow(work_order_id);
CREATE INDEX idx_vehicle_production_flow_team ON vehicle_production_flow(assigned_team_id);
CREATE INDEX idx_vehicle_production_flow_shift ON vehicle_production_flow(current_shift_id);
CREATE INDEX idx_vehicle_production_flow_active ON vehicle_production_flow(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_vehicle_production_flow_created_dt ON vehicle_production_flow(created_dt DESC);

-- Create GIN indexes for JSONB columns
CREATE INDEX idx_vehicle_production_flow_stage_progress ON vehicle_production_flow USING GIN (stage_progress);
CREATE INDEX idx_vehicle_production_flow_lead_times ON vehicle_production_flow USING GIN (stage_lead_times);
CREATE INDEX idx_vehicle_production_flow_quality_issues ON vehicle_production_flow USING GIN (quality_issues);
CREATE INDEX idx_vehicle_production_flow_dependencies ON vehicle_production_flow USING GIN (dependencies);
CREATE INDEX idx_vehicle_production_flow_constraints ON vehicle_production_flow USING GIN (constraints);

-- Example data structure for stage_progress JSONB:
-- [
--   {
--     "stage_id": 1,
--     "stage_name": "Body Assembly",
--     "entry_time": "2024-01-15T08:00:00",
--     "exit_time": "2024-01-15T16:00:00",
--     "duration_minutes": 480,
--     "status": "completed",
--     "notes": "Standard assembly process",
--     "assigned_team": "Team A",
--     "quality_score": 95
--   },
--   {
--     "stage_id": 2,
--     "stage_name": "Paint Shop",
--     "entry_time": "2024-01-16T08:00:00",
--     "exit_time": "2024-01-16T14:00:00",
--     "duration_minutes": 360,
--     "status": "completed",
--     "notes": "Metallic paint application",
--     "assigned_team": "Team B",
--     "quality_score": 98
--   }
-- ]

-- Example data structure for stage_lead_times JSONB:
-- {
--   "1": {
--     "planned_minutes": 480,
--     "actual_minutes": 520,
--     "variance_minutes": 40,
--     "efficiency_percentage": 92.3
--   },
--   "2": {
--     "planned_minutes": 360,
--     "actual_minutes": 340,
--     "variance_minutes": -20,
--     "efficiency_percentage": 105.9
--   }
-- }

-- Example data structure for quality_issues JSONB:
-- [
--   {
--     "stage_id": 1,
--     "issue_type": "Paint defect",
--     "severity": "Minor",
--     "description": "Small scratch on passenger door",
--     "detected_time": "2024-01-16T10:30:00",
--     "resolution_time_minutes": 120,
--     "resolution_method": "Touch-up paint",
--     "assigned_to": "john_doe"
--   }
-- ]

-- Example data structure for dependencies JSONB:
-- [
--   {
--     "vehicle_id": "VIN123456",
--     "stage_id": 1,
--     "dependency_type": "Sequential",
--     "description": "Must complete body assembly before paint"
--   }
-- ]

-- Example data structure for constraints JSONB:
-- [
--   {
--     "constraint_type": "Resource",
--     "resource_id": 1,
--     "resource_name": "Paint Booth 1",
--     "description": "Equipment maintenance scheduled",
--     "start_time": "2024-01-17T08:00:00",
--     "end_time": "2024-01-17T16:00:00"
--   }
-- ] 