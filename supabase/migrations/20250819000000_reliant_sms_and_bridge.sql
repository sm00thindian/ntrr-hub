-- Reliant bridge: coordinator self-attest + SMS reminder intent on tasks/templates

-- 1) Household coordinator Reliant connection (dogfood self-attest; later = active plan)
alter table public.households
  add column if not exists reliant_connected_at timestamptz,
  add column if not exists reliant_connected_by uuid references auth.users (id) on delete set null;

comment on column public.households.reliant_connected_at is
  'When set, coordinator attested Reliant is connected for this household (dogfood). Later: active-plan entitlement timestamp.';
comment on column public.households.reliant_connected_by is
  'User who attested Reliant connection (owner/admin).';

-- 2) Soft SMS reminder intent (parallel to phone confirm; Reliant sends if opted-in)
alter table public.tasks
  add column if not exists reliant_sms_reminder_requested boolean not null default false;

alter table public.recurring_task_templates
  add column if not exists reliant_sms_reminder_requested boolean not null default false;

comment on column public.tasks.reliant_sms_reminder_requested is
  'When true, request a soft Reliant SMS reminder (not a phone confirm). Reliant sends only to SMS-opted-in numbers.';
comment on column public.recurring_task_templates.reliant_sms_reminder_requested is
  'Default for tasks spawned from this template: request Reliant SMS reminder.';

create index if not exists tasks_reliant_sms_reminder_idx
  on public.tasks (household_id)
  where reliant_sms_reminder_requested = true;

create index if not exists recurring_templates_reliant_sms_reminder_idx
  on public.recurring_task_templates (household_id)
  where reliant_sms_reminder_requested = true;
