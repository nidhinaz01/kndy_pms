-- Batch update skill time standards in a single transactional RPC.
-- Used by the /standards/works -> Time Standards group-edit modal.

CREATE OR REPLACE FUNCTION update_skill_time_standards_batch(
  p_wsm_id INTEGER,
  p_username TEXT,
  p_updates JSONB
)
RETURNS VOID AS $$
DECLARE
  v_item JSONB;
  v_sts_id INTEGER;
  v_skill_short TEXT;
  v_skill_order INTEGER;
  v_standard_time_minutes INTEGER;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF p_wsm_id IS NULL THEN
    RAISE EXCEPTION 'update_skill_time_standards_batch: p_wsm_id is required';
  END IF;

  IF p_updates IS NULL OR jsonb_typeof(p_updates) <> 'array' THEN
    RAISE EXCEPTION 'update_skill_time_standards_batch: p_updates must be a JSON array';
  END IF;

  -- Single RPC call is atomic; if any iteration fails, the whole call is rolled back.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_updates)
  LOOP
    v_sts_id := NULLIF(v_item->>'sts_id', '')::INTEGER;
    v_skill_short := NULLIF(v_item->>'skill_short', '')::TEXT;
    v_skill_order := NULLIF(v_item->>'skill_order', '')::INTEGER;
    v_standard_time_minutes := NULLIF(v_item->>'standard_time_minutes', '')::INTEGER;

    IF v_standard_time_minutes IS NULL OR v_standard_time_minutes <= 0 THEN
      RAISE EXCEPTION 'Standard time must be > 0. Got: %', v_item->>'standard_time_minutes';
    END IF;

    -- Prefer updating by sts_id (more precise).
    IF v_sts_id IS NOT NULL THEN
      IF EXISTS (
        SELECT 1
        FROM std_skill_time_standards
        WHERE sts_id = v_sts_id
          AND wsm_id = p_wsm_id
      ) THEN
        UPDATE std_skill_time_standards
        SET
          standard_time_minutes = v_standard_time_minutes,
          is_active = true,
          is_deleted = false,
          modified_by = p_username,
          modified_dt = v_now
        WHERE sts_id = v_sts_id
          AND wsm_id = p_wsm_id;

        CONTINUE;
      END IF;
    END IF;

    -- Fallback insert (in case sts_id is missing/unexpected).
    -- This should be rare if the modal is based on existing rows.
    IF v_skill_short IS NULL OR v_skill_order IS NULL THEN
      RAISE EXCEPTION 'Missing skill_short/skill_order for batch insert. Item: %', v_item;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM std_skill_time_standards
      WHERE wsm_id = p_wsm_id
        AND skill_short = v_skill_short
        AND skill_order = v_skill_order
    ) THEN
      INSERT INTO std_skill_time_standards (
        wsm_id,
        skill_short,
        standard_time_minutes,
        skill_order,
        is_active,
        is_deleted,
        created_by,
        created_dt,
        modified_by,
        modified_dt
      )
      VALUES (
        p_wsm_id,
        v_skill_short,
        v_standard_time_minutes,
        v_skill_order,
        true,
        false,
        p_username,
        v_now,
        p_username,
        v_now
      );
    ELSE
      -- Row exists; update by natural keys.
      UPDATE std_skill_time_standards
      SET
        standard_time_minutes = v_standard_time_minutes,
        is_active = true,
        is_deleted = false,
        modified_by = p_username,
        modified_dt = v_now
      WHERE wsm_id = p_wsm_id
        AND skill_short = v_skill_short
        AND skill_order = v_skill_order;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

