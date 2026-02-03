-- ============================================================================
-- Database Migration: Add Date/Time Columns for Skill Master Versioning
-- ============================================================================
-- This migration adds wef_date, wef_time, wet_date, wet_time columns
-- to support multiple rate versions per skill with effective date ranges
-- ============================================================================

-- Step 1: Add new columns (nullable initially for safe migration)
ALTER TABLE public.hr_skill_master 
  ADD COLUMN IF NOT EXISTS wef_date DATE,
  ADD COLUMN IF NOT EXISTS wef_time TIME,
  ADD COLUMN IF NOT EXISTS wet_date DATE,
  ADD COLUMN IF NOT EXISTS wet_time TIME;

-- Step 2: Migrate existing data
-- Set wef_date from existing wef column, wef_time to 00:00:00, wet_date/wet_time to NULL
UPDATE public.hr_skill_master 
SET 
  wef_date = wef,
  wef_time = '00:00:00'::TIME,
  wet_date = NULL,
  wet_time = NULL
WHERE wef_date IS NULL AND wef IS NOT NULL;

-- Step 3: Drop foreign key constraint that depends on skill_short unique constraint
-- This constraint references the unique index we're about to drop
ALTER TABLE public.std_skill_time_standards 
  DROP CONSTRAINT IF EXISTS std_skill_time_standards_skill_short_fkey;

-- Step 4: Drop unique constraints on skill_name and skill_short
-- These constraints prevent multiple versions per skill, which we now need
ALTER TABLE public.hr_skill_master 
  DROP CONSTRAINT IF EXISTS hr_skill_master_skill_name_key,
  DROP CONSTRAINT IF EXISTS hr_skill_master_skill_short_key;

-- Note: The foreign key constraint std_skill_time_standards_skill_short_fkey was dropped above.
-- If you need to maintain referential integrity, consider recreating it to reference
-- the active version only, or adjust the relationship based on your business logic.

-- Step 5: Make wef_date and wef_time NOT NULL (after data migration)
ALTER TABLE public.hr_skill_master 
  ALTER COLUMN wef_date SET NOT NULL,
  ALTER COLUMN wef_time SET NOT NULL;

-- Step 6: Set default values for wef_time
ALTER TABLE public.hr_skill_master 
  ALTER COLUMN wef_time SET DEFAULT '00:00:00'::TIME;

-- Step 7: Drop the old wef column (no longer needed, replaced by wef_date and wef_time)
ALTER TABLE public.hr_skill_master 
  DROP COLUMN IF EXISTS wef;

-- Step 8: Add check constraint to ensure wet_date > wef_date when wet_date is not NULL
ALTER TABLE public.hr_skill_master 
  DROP CONSTRAINT IF EXISTS chk_skill_master_date_range;

ALTER TABLE public.hr_skill_master 
  ADD CONSTRAINT chk_skill_master_date_range 
  CHECK (
    wet_date IS NULL OR 
    (wet_date > wef_date) OR 
    (wet_date = wef_date AND wet_time > wef_time)
  );

-- Step 9: Add unique partial index to ensure only one active version per skill
-- (wet_date IS NULL means active)
CREATE UNIQUE INDEX IF NOT EXISTS idx_skill_master_one_active_per_skill 
  ON public.hr_skill_master(skill_name) 
  WHERE wet_date IS NULL AND is_deleted = false;

-- Step 10: Add index for efficient date range queries
CREATE INDEX IF NOT EXISTS idx_skill_master_date_range 
  ON public.hr_skill_master(skill_name, wef_date, wet_date) 
  WHERE is_deleted = false;

-- Step 11: Add index for querying active skills
CREATE INDEX IF NOT EXISTS idx_skill_master_active 
  ON public.hr_skill_master(skill_name, wef_date) 
  WHERE wet_date IS NULL AND is_deleted = false;

-- Step 12: Add comments
COMMENT ON COLUMN public.hr_skill_master.wef_date IS 'Date when this rate version becomes effective';
COMMENT ON COLUMN public.hr_skill_master.wef_time IS 'Time when this rate version becomes effective (default: 00:00:00)';
COMMENT ON COLUMN public.hr_skill_master.wet_date IS 'Date when this rate version ends (NULL = currently active)';
COMMENT ON COLUMN public.hr_skill_master.wet_time IS 'Time when this rate version ends (default: 23:59:59 when wet_date is set)';

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Changes:
-- 1. Added wef_date, wef_time, wet_date, wet_time columns
-- 2. Migrated existing data from wef column to new date/time columns
-- 3. Dropped foreign key constraint std_skill_time_standards_skill_short_fkey (depends on unique constraint)
-- 4. Dropped unique constraints on skill_name and skill_short (allows multiple versions)
-- 5. Dropped old wef column (replaced by wef_date and wef_time)
-- 6. Added constraint to ensure date range validity
-- 7. Added unique partial index to ensure only one active version per skill
-- 8. Added indexes for efficient queries
-- 
-- Note: The foreign key constraint std_skill_time_standards_skill_short_fkey was dropped.
-- Consider recreating it if referential integrity is needed, possibly referencing only active versions.
-- 
-- This allows multiple rate versions per skill with effective date ranges.
-- Only one version can be active (wet_date IS NULL) at a time per skill.
-- Multiple versions can exist for the same skill_name and skill_short.
