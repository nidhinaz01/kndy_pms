-- Create standard table for lost time reasons
CREATE TABLE IF NOT EXISTS public.sys_lost_time_reasons (
    id SERIAL PRIMARY KEY,
    p_head VARCHAR(20) NOT NULL CHECK (p_head IN ('Payable', 'Non-Payable')),
    lost_time_reason VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_by VARCHAR(255) NOT NULL,
    created_dt TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    modified_by VARCHAR(255),
    modified_dt TIMESTAMP WITHOUT TIME ZONE
);

-- Add comments for documentation
COMMENT ON TABLE public.sys_lost_time_reasons IS 'Standard table for lost time reasons used in work reporting';
COMMENT ON COLUMN public.sys_lost_time_reasons.p_head IS 'Payable head - either Payable or Non-Payable';
COMMENT ON COLUMN public.sys_lost_time_reasons.lost_time_reason IS 'Description of the lost time reason';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sys_lost_time_reasons_p_head ON public.sys_lost_time_reasons(p_head);
CREATE INDEX IF NOT EXISTS idx_sys_lost_time_reasons_active ON public.sys_lost_time_reasons(is_active) WHERE is_active = TRUE;

-- Insert standard lost time reasons
INSERT INTO public.sys_lost_time_reasons (
    p_head, lost_time_reason, created_by
) VALUES 
-- Payable Reasons
('Payable', 'Equipment Breakdown', 'system'),
('Payable', 'Equipment Maintenance', 'system'),
('Payable', 'Equipment Setup', 'system'),
('Payable', 'Quality Issue', 'system'),
('Payable', 'Quality Inspection', 'system'),
('Payable', 'Rework Required', 'system'),
('Payable', 'Training Time', 'system'),
('Payable', 'Meeting Time', 'system'),
('Payable', 'Tool Breakdown', 'system'),
('Payable', 'Process Change', 'system'),
('Payable', 'Documentation Update', 'system'),

-- Non-Payable Reasons
('Non-Payable', 'Material Shortage', 'system'),
('Non-Payable', 'Material Defect', 'system'),
('Non-Payable', 'Wrong Material', 'system'),
('Non-Payable', 'Worker Absence', 'system'),
('Non-Payable', 'Worker Late', 'system'),
('Non-Payable', 'Power Outage', 'system'),
('Non-Payable', 'Weather Conditions', 'system'),
('Non-Payable', 'Safety Issue', 'system'),
('Non-Payable', 'Tool Unavailable', 'system'),
('Non-Payable', 'Process Delay', 'system'),
('Non-Payable', 'Other', 'system');

-- Create a view for active lost time reasons (for easy querying)
CREATE OR REPLACE VIEW public.v_active_lost_time_reasons AS
SELECT 
    id,
    p_head,
    lost_time_reason
FROM public.sys_lost_time_reasons
WHERE is_active = TRUE 
  AND is_deleted = FALSE
ORDER BY p_head, lost_time_reason;

-- Add comment for the view
COMMENT ON VIEW public.v_active_lost_time_reasons IS 'View of active lost time reasons ordered by payable head and reason name';

-- Create function to get lost time reasons by payable head
CREATE OR REPLACE FUNCTION public.get_lost_time_reasons_by_p_head(payable_head VARCHAR(20) DEFAULT NULL)
RETURNS TABLE (
    id INTEGER,
    p_head VARCHAR(20),
    lost_time_reason VARCHAR(255)
) AS $$
BEGIN
    IF payable_head IS NULL THEN
        RETURN QUERY
        SELECT 
            ltr.id,
            ltr.p_head,
            ltr.lost_time_reason
        FROM public.sys_lost_time_reasons ltr
        WHERE ltr.is_active = TRUE 
          AND ltr.is_deleted = FALSE
        ORDER BY ltr.p_head, ltr.lost_time_reason;
    ELSE
        RETURN QUERY
        SELECT 
            ltr.id,
            ltr.p_head,
            ltr.lost_time_reason
        FROM public.sys_lost_time_reasons ltr
        WHERE ltr.is_active = TRUE 
          AND ltr.is_deleted = FALSE
          AND ltr.p_head = payable_head
        ORDER BY ltr.lost_time_reason;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Add comment for the function
COMMENT ON FUNCTION public.get_lost_time_reasons_by_p_head(VARCHAR(20)) IS 'Function to retrieve lost time reasons, optionally filtered by payable head';
