-- Create table for capturing deviations in planning
CREATE TABLE public.prdn_work_planning_deviations (
  id serial NOT NULL,
  planning_id integer NOT NULL,
  deviation_type character varying(50) NOT NULL,
  reason text NOT NULL,
  is_active boolean NULL DEFAULT true,
  is_deleted boolean NULL DEFAULT false,
  created_by character varying(100) NULL,
  created_dt timestamp without time zone NULL DEFAULT CURRENT_TIMESTAMP,
  modified_by character varying(100) NULL,
  modified_dt timestamp without time zone NULL,
  CONSTRAINT prdn_work_planning_deviations_pkey PRIMARY KEY (id),
  CONSTRAINT prdn_work_planning_deviations_planning_id_fkey FOREIGN KEY (planning_id) 
    REFERENCES prdn_work_planning (id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- Add comment to table
COMMENT ON TABLE public.prdn_work_planning_deviations IS 'Table for recording deviations in work planning';

-- Add comments to key columns
COMMENT ON COLUMN public.prdn_work_planning_deviations.planning_id IS 'Reference to the planning record where deviation occurred';
COMMENT ON COLUMN public.prdn_work_planning_deviations.deviation_type IS 'Type of deviation (e.g., time, quantity, resource)';
COMMENT ON COLUMN public.prdn_work_planning_deviations.reason IS 'Detailed reason for the deviation';
