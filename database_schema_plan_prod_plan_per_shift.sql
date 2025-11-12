-- Create new table for shift-based production planning
CREATE TABLE plan_prod_plan_per_shift (
    id SERIAL PRIMARY KEY,
    
    -- Plan period
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    
    -- Production targets
    ppd_count DECIMAL(10,2) NOT NULL,  -- Daily production count (e.g., 3.0 vehicles/day)
    pattern_cycle INTEGER DEFAULT 1,    -- Pattern cycle (e.g., 2 for 1.5 vehicles/day = [1,2] over 2 days)
    pattern_data INTEGER[] DEFAULT ARRAY[1], -- Pattern data (e.g., [1,2] for 1.5 vehicles/day)
    
    -- Shift configuration (JSONB for flexibility)
    shift_distribution JSONB NOT NULL,  -- Array of shift targets: [{"shift_id": 1, "target_quantity": 1.5}, ...]
    entry_slots JSONB NOT NULL,         -- Array of entry slots per shift: [{"shift_id": 1, "slots": [{"entry_time": "06:00", "slot_order": 1}, ...]}, ...]
    pattern_time_slots JSONB,           -- Array of pattern-based time slots: [{"day": 1, "vehicles": 2, "slots": [{"slot_order": 1, "entry_time": "09:00"}, ...]}, ...]
    
    -- Metadata
    created_by VARCHAR(255) NOT NULL,
    created_dt TIMESTAMP DEFAULT NOW(),
    modified_by VARCHAR(255),
    modified_dt TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    is_deleted BOOLEAN DEFAULT FALSE
);

-- Add comments for documentation
COMMENT ON TABLE plan_prod_plan_per_shift IS 'Shift-based production planning table';
COMMENT ON COLUMN plan_prod_plan_per_shift.from_date IS 'Start date of the production plan period';
COMMENT ON COLUMN plan_prod_plan_per_shift.to_date IS 'End date of the production plan period';
COMMENT ON COLUMN plan_prod_plan_per_shift.ppd_count IS 'Daily production count (vehicles per day)';
COMMENT ON COLUMN plan_prod_plan_per_shift.pattern_cycle IS 'Pattern cycle (e.g., 2 for 1.5 vehicles/day = [1,2] over 2 days)';
COMMENT ON COLUMN plan_prod_plan_per_shift.pattern_data IS 'Pattern data (e.g., [1,2] for 1.5 vehicles/day)';
COMMENT ON COLUMN plan_prod_plan_per_shift.shift_distribution IS 'JSONB array of shift targets: [{"shift_id": 1, "target_quantity": 1.5}, ...]';
COMMENT ON COLUMN plan_prod_plan_per_shift.entry_slots IS 'JSONB array of entry slots per shift: [{"shift_id": 1, "slots": [{"entry_time": "06:00", "slot_order": 1}, ...]}, ...]';
COMMENT ON COLUMN plan_prod_plan_per_shift.pattern_time_slots IS 'JSONB array of pattern-based time slots: [{"day": 1, "vehicles": 2, "slots": [{"slot_order": 1, "entry_time": "09:00"}, ...]}, ...]';

-- Create indexes for better performance
CREATE INDEX idx_plan_prod_plan_per_shift_dates ON plan_prod_plan_per_shift(from_date, to_date);
CREATE INDEX idx_plan_prod_plan_per_shift_shift_dist ON plan_prod_plan_per_shift USING GIN (shift_distribution);
CREATE INDEX idx_plan_prod_plan_per_shift_entry_slots ON plan_prod_plan_per_shift USING GIN (entry_slots);
CREATE INDEX idx_plan_prod_plan_per_shift_active ON plan_prod_plan_per_shift(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_plan_prod_plan_per_shift_created_dt ON plan_prod_plan_per_shift(created_dt DESC);

-- Add constraints
ALTER TABLE plan_prod_plan_per_shift 
ADD CONSTRAINT chk_plan_prod_plan_per_shift_dates 
CHECK (from_date <= to_date);

ALTER TABLE plan_prod_plan_per_shift 
ADD CONSTRAINT chk_plan_prod_plan_per_shift_ppd_count 
CHECK (ppd_count > 0);

-- Example data structure for shift_distribution JSONB:
-- [
--   {"shift_id": 1, "target_quantity": 1.5},
--   {"shift_id": 2, "target_quantity": 1.5}
-- ]

-- Example data structure for entry_slots JSONB:
-- [
--   {
--     "shift_id": 1,
--     "slots": [
--       {"entry_time": "06:00", "slot_order": 1},
--       {"entry_time": "14:00", "slot_order": 2}
--     ]
--   },
--   {
--     "shift_id": 2,
--     "slots": [
--       {"entry_time": "14:00", "slot_order": 1},
--       {"entry_time": "22:00", "slot_order": 2}
--     ]
--   }
-- ] 