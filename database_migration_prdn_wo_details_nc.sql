-- Migration: support non-commercial work orders in prdn_wo_details
--
-- Rules (application):
--   nc_category IS NULL     -> commercial / normal vehicle WO
--   nc_category IS NOT NULL -> non-commercial; value is the category (e.g. from sys_data_elements)
--   Optional text fields that are not applicable may use 'NA'; numerics use 0.00
--
-- Run once against your database. Review FKs if your live schema differs.

-- 1. New columns
ALTER TABLE public.prdn_wo_details
  ADD COLUMN IF NOT EXISTS nc_category character varying(100) NULL,
  ADD COLUMN IF NOT EXISTS comments text NULL;

COMMENT ON COLUMN public.prdn_wo_details.nc_category IS 'NULL = commercial WO; non-NULL = non-commercial category (discriminator + value).';
COMMENT ON COLUMN public.prdn_wo_details.comments IS 'Free-text notes; often required in UI when wo_model/wo_type omitted for NC rows.';

-- 2. Allow NULL on type/model (FK on wo_model still applies when non-NULL)
ALTER TABLE public.prdn_wo_details
  ALTER COLUMN wo_type DROP NOT NULL,
  ALTER COLUMN wo_model DROP NOT NULL;

-- 3. Optional: widen columns if your live table still has shorter limits (uncomment as needed)
-- ALTER TABLE public.prdn_wo_details ALTER COLUMN wo_no TYPE character varying(64);
-- ALTER TABLE public.prdn_wo_details ALTER COLUMN wo_type TYPE character varying(100);

-- 4. Helpful for reporting / filters (partial index: NC rows only)
CREATE INDEX IF NOT EXISTS idx_prdn_wo_details_nc_category
  ON public.prdn_wo_details (nc_category)
  WHERE nc_category IS NOT NULL;
