-- Optional wall-clock due time for recurring templates (HH:mm in household timezone).
-- Used when spawning task instances so daily/weekly/monthly work has a time of day.

alter table public.recurring_task_templates
  add column if not exists due_time text;

alter table public.recurring_task_templates
  drop constraint if exists recurring_task_templates_due_time_check;

alter table public.recurring_task_templates
  add constraint recurring_task_templates_due_time_check
  check (
    due_time is null
    or due_time ~ '^\d{2}:\d{2}$'
  );

comment on column public.recurring_task_templates.due_time is
  'Optional local time of day (HH:mm) in the household timezone for each spawned instance due_at.';
