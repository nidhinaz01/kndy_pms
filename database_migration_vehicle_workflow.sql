-- Safe migration for std_vehicle_work_flow table
-- This script handles existing data migration

-- Step 1: Add new columns (nullable initially)
ALTER TABLE public.std_vehicle_work_flow 
ADD COLUMN IF NOT EXISTS derived_sw_code character varying(15),
ADD COLUMN IF NOT EXISTS dependency_derived_sw_code character varying(15);

-- Step 2: Migrate existing data (if any)
-- This maps swtd_id to derived_sw_code using the std_work_type_details table
UPDATE public.std_vehicle_work_flow 
SET derived_sw_code = (
  SELECT derived_sw_code 
  FROM public.std_work_type_details 
  WHERE std_work_type_details.swtd_id = std_vehicle_work_flow.swtd_id
)
WHERE derived_sw_code IS NULL AND swtd_id IS NOT NULL;

-- Also migrate dependency data
UPDATE public.std_vehicle_work_flow 
SET dependency_derived_sw_code = (
  SELECT derived_sw_code 
  FROM public.std_work_type_details 
  WHERE std_work_type_details.swtd_id = std_vehicle_work_flow.dependency_swtd_id
)
WHERE dependency_derived_sw_code IS NULL AND dependency_swtd_id IS NOT NULL;

-- Step 3: Make derived_sw_code NOT NULL (after data migration)
ALTER TABLE public.std_vehicle_work_flow 
ALTER COLUMN derived_sw_code SET NOT NULL;

-- Step 4: Drop old constraints
ALTER TABLE public.std_vehicle_work_flow 
DROP CONSTRAINT IF EXISTS std_vehicle_work_flow_swtd_id_fkey,
DROP CONSTRAINT IF EXISTS std_vehicle_work_flow_dependency_fkey,
DROP CONSTRAINT IF EXISTS std_vehicle_work_flow_unique;

-- Step 5: Drop old columns
ALTER TABLE public.std_vehicle_work_flow 
DROP COLUMN IF EXISTS swtd_id,
DROP COLUMN IF EXISTS dependency_swtd_id;

-- Step 6: Add new constraints
ALTER TABLE public.std_vehicle_work_flow 
ADD CONSTRAINT std_vehicle_work_flow_derived_sw_code_fkey 
  FOREIGN KEY (derived_sw_code) REFERENCES public.std_work_type_details(derived_sw_code) ON DELETE RESTRICT,
ADD CONSTRAINT std_vehicle_work_flow_dependency_fkey 
  FOREIGN KEY (dependency_derived_sw_code) REFERENCES public.std_work_type_details(derived_sw_code) ON DELETE SET NULL,
ADD CONSTRAINT std_vehicle_work_flow_unique UNIQUE (wo_type_id, derived_sw_code, sequence_order);

-- Step 7: Fix timestamp consistency
ALTER TABLE public.std_vehicle_work_flow 
ALTER COLUMN created_dt TYPE timestamp without time zone,
ALTER COLUMN modified_dt TYPE timestamp without time zone;

-- Step 8: Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_std_vehicle_work_flow_wo_type_id ON public.std_vehicle_work_flow(wo_type_id);
CREATE INDEX IF NOT EXISTS idx_std_vehicle_work_flow_derived_sw_code ON public.std_vehicle_work_flow(derived_sw_code); 