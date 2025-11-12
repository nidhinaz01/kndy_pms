-- Table for detailed lost time reasons breakdown
CREATE TABLE prdn_work_reporting_reasons (
  id SERIAL PRIMARY KEY,
  reporting_id INTEGER NOT NULL,
  reason_id INTEGER NOT NULL,
  minutes INTEGER NOT NULL,
  cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_by VARCHAR(255) NOT NULL,
  created_dt TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  modified_by VARCHAR(255),
  modified_dt TIMESTAMP WITHOUT TIME ZONE,
  
  CONSTRAINT fk_prdn_work_reporting_reasons_reporting 
    FOREIGN KEY (reporting_id) REFERENCES prdn_work_reporting (id),
  CONSTRAINT fk_prdn_work_reporting_reasons_reason 
    FOREIGN KEY (reason_id) REFERENCES sys_lost_time_reasons (id),
  CONSTRAINT chk_prdn_work_reporting_reasons_minutes 
    CHECK (minutes > 0)
) TABLESPACE pg_default;

-- Index for better performance
CREATE INDEX idx_prdn_work_reporting_reasons_reporting_id 
ON prdn_work_reporting_reasons (reporting_id);

CREATE INDEX idx_prdn_work_reporting_reasons_reason_id 
ON prdn_work_reporting_reasons (reason_id);
