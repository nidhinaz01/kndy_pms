-- Migration: Support "Revert to Draft" for approved reporting submissions
-- Behavior: keep work lifecycle status untouched; reopen reporting draft rows.

begin;

-- 1) Add revert audit columns
alter table public.prdn_reporting_submissions
  add column if not exists reverted_by character varying(100),
  add column if not exists reverted_dt timestamp without time zone,
  add column if not exists revert_reason text;

-- 2) Extend status constraint to include reverted
alter table public.prdn_reporting_submissions
  drop constraint if exists chk_reporting_submission_status;

alter table public.prdn_reporting_submissions
  add constraint chk_reporting_submission_status
  check (
    status::text = any (
      array[
        'pending_approval'::character varying,
        'approved'::character varying,
        'rejected'::character varying,
        'reverted'::character varying
      ]::text[]
    )
  );

create index if not exists idx_reporting_submissions_status
  on public.prdn_reporting_submissions using btree (status);

-- 3) RPC function to revert approved reporting submission
create or replace function public.revert_reporting_submission_to_draft(
  p_submission_id integer,
  p_reverted_by text,
  p_revert_reason text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_now timestamp without time zone := (now() at time zone 'utc');
  v_status text;
  v_work_count integer := 0;
  v_manpower_count integer := 0;
  v_reassign_count integer := 0;
begin
  if p_submission_id is null then
    raise exception 'p_submission_id is required';
  end if;

  if coalesce(trim(p_reverted_by), '') = '' then
    raise exception 'p_reverted_by is required';
  end if;

  if coalesce(trim(p_revert_reason), '') = '' then
    raise exception 'p_revert_reason is required';
  end if;

  select status::text
    into v_status
  from public.prdn_reporting_submissions
  where id = p_submission_id
    and is_deleted = false
  for update;

  if not found then
    raise exception 'Submission % not found', p_submission_id;
  end if;

  if v_status <> 'approved' then
    raise exception 'Only approved submissions can be reverted. Current status: %', v_status;
  end if;

  update public.prdn_reporting_submissions
  set
    status = 'reverted',
    reverted_by = trim(p_reverted_by),
    reverted_dt = v_now,
    revert_reason = trim(p_revert_reason),
    modified_by = trim(p_reverted_by),
    modified_dt = v_now
  where id = p_submission_id;

  update public.prdn_work_reporting
  set
    status = 'draft',
    reporting_submission_id = null,
    modified_by = trim(p_reverted_by),
    modified_dt = v_now
  where reporting_submission_id = p_submission_id;
  get diagnostics v_work_count = row_count;

  update public.prdn_reporting_manpower
  set
    status = 'draft',
    reporting_submission_id = null,
    modified_by = trim(p_reverted_by),
    modified_dt = v_now
  where reporting_submission_id = p_submission_id;
  get diagnostics v_manpower_count = row_count;

  update public.prdn_reporting_stage_reassignment
  set
    status = 'draft',
    reporting_submission_id = null,
    modified_by = trim(p_reverted_by),
    modified_dt = v_now
  where reporting_submission_id = p_submission_id;
  get diagnostics v_reassign_count = row_count;

  return jsonb_build_object(
    'success', true,
    'submission_id', p_submission_id,
    'submission_status', 'reverted',
    'work_rows_reopened', v_work_count,
    'manpower_rows_reopened', v_manpower_count,
    'reassignment_rows_reopened', v_reassign_count,
    'reverted_dt', v_now
  );
exception
  when others then
    return jsonb_build_object(
      'success', false,
      'submission_id', p_submission_id,
      'error', sqlerrm
    );
end;
$function$;

commit;
