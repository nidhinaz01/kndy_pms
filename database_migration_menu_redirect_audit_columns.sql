-- Add audit columns for menu_redirect writes from User Management menu tab.
-- No app-side UTC conversion is required; DB defaults/timestamps remain DB-managed.

alter table public.menu_redirect
  add column if not exists created_by text null,
  add column if not exists modified_by text null;

-- Store created/modified datetimes without timezone metadata.
-- This prevents UTC suffix/offset formatting from timestamptz columns.
alter table public.menu_redirect
  alter column created_dt type timestamp without time zone
    using created_dt at time zone 'UTC',
  alter column modified_dt type timestamp without time zone
    using modified_dt at time zone 'UTC';

-- Keep DB-managed defaults in timestamp (no tz) form.
alter table public.menu_redirect
  alter column created_dt set default (now()::timestamp),
  alter column modified_dt set default (now()::timestamp);

-- Optional backfill for existing rows
update public.menu_redirect
set
  created_by = coalesce(created_by, 'system'),
  modified_by = coalesce(modified_by, created_by, 'system')
where created_by is null
   or modified_by is null;
