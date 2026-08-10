-- Propagate Reliant confirm intent from recurring templates to spawned tasks
alter table public.recurring_task_templates
  add column if not exists reliant_confirm_requested boolean not null default false;

comment on column public.recurring_task_templates.reliant_confirm_requested is
  'Default for tasks spawned from this template: request Reliant phone confirmation.';
