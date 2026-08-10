-- Axis A: migrate caregiver → member (enum value added in 20250810000000)
-- Axis B: care persona on members + invites
-- Reliant accountability intent on tasks + calendar events

-- 1) Persona enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'household_persona') then
    create type public.household_persona as enum (
      'coordinator',
      'care_partner',
      'self_advocate',
      'other'
    );
  end if;
end $$;

-- 3) Members: persona + focus person
alter table public.household_members
  add column if not exists persona public.household_persona not null default 'coordinator',
  add column if not exists is_focus_person boolean not null default false;

comment on column public.household_members.persona is
  'Care relationship in this household (Axis B). Independent of access role (Axis A).';
comment on column public.household_members.is_focus_person is
  'When true, this member is a primary care focus for household views and Reliant handoffs.';

-- Migrate legacy access role label
update public.household_members
set role = 'member'
where role = 'caregiver';

-- 4) Invites: persona on invite
alter table public.invites
  add column if not exists persona public.household_persona not null default 'care_partner';

update public.invites set role = 'member' where role = 'caregiver';

alter table public.invites
  alter column role set default 'member';

-- 5) Reliant confirmation requested (durable intent for tasks & events)
alter table public.tasks
  add column if not exists reliant_confirm_requested boolean not null default false;

alter table public.calendar_events
  add column if not exists reliant_confirm_requested boolean not null default false;

comment on column public.tasks.reliant_confirm_requested is
  'When true, this item should request phone confirmation via Reliant (assignee or focus person).';
comment on column public.calendar_events.reliant_confirm_requested is
  'When true, this event should request phone confirmation via Reliant.';

create index if not exists tasks_reliant_confirm_idx
  on public.tasks (household_id)
  where reliant_confirm_requested = true;

create index if not exists calendar_events_reliant_confirm_idx
  on public.calendar_events (household_id)
  where reliant_confirm_requested = true;

-- 6) RLS: treat member like former caregiver for task-related writes
-- Drop and recreate policies that listed caregiver only (from google_sync + tasks grants)

-- tasks policies may exist under various names from earlier migrations; ensure member is allowed
do $$
declare
  pol record;
begin
  -- No-op if policies use has_household_role with explicit arrays — we recreate helper-friendly policies below
  null;
end $$;

-- Broaden task write policies to include member (and legacy caregiver if any remain)
drop policy if exists "Members can insert tasks" on public.tasks;
drop policy if exists "Members can update tasks" on public.tasks;
drop policy if exists "Members can delete tasks" on public.tasks;
drop policy if exists "Household members can insert tasks" on public.tasks;
drop policy if exists "Household members can update tasks" on public.tasks;
drop policy if exists "Household members can delete tasks" on public.tasks;
drop policy if exists "Editors can insert tasks" on public.tasks;
drop policy if exists "Editors can update tasks" on public.tasks;
drop policy if exists "Editors can delete tasks" on public.tasks;

-- Select already open to household members via earlier migrations; ensure write for coordinators + members
create policy "Editors can insert tasks"
on public.tasks for insert
with check (
  public.has_household_role(
    household_id,
    array['owner', 'admin', 'member', 'caregiver']::public.household_role[]
  )
);

create policy "Editors can update tasks"
on public.tasks for update
using (
  public.has_household_role(
    household_id,
    array['owner', 'admin', 'member', 'caregiver']::public.household_role[]
  )
)
with check (
  public.has_household_role(
    household_id,
    array['owner', 'admin', 'member', 'caregiver']::public.household_role[]
  )
);

create policy "Editors can delete tasks"
on public.tasks for delete
using (
  public.has_household_role(
    household_id,
    array['owner', 'admin', 'member', 'caregiver']::public.household_role[]
  )
);

-- Invite preview includes persona for accept flow (must drop: return type changed)
drop function if exists public.get_invite_preview(text);

create function public.get_invite_preview(invite_token text)
returns table (
  id uuid,
  household_id uuid,
  household_name text,
  email text,
  role public.household_role,
  persona public.household_persona,
  expires_at timestamptz,
  accepted_at timestamptz,
  revoked_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select
    i.id,
    i.household_id,
    h.name as household_name,
    i.email,
    i.role,
    i.persona,
    i.expires_at,
    i.accepted_at,
    i.revoked_at
  from public.invites i
  join public.households h on h.id = i.household_id
  where i.token = invite_token
  limit 1;
$$;

grant execute on function public.get_invite_preview(text) to authenticated, anon;
