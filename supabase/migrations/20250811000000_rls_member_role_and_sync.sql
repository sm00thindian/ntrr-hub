-- P0 security pass: align RLS with Axis A `member` role (ex-caregiver) for
-- calendar events, conflicts, and the can_edit_tasks helper used by templates.

-- 1) Task edit helper must include member (legacy caregiver retained)
create or replace function public.can_edit_tasks(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_household_role(
    target_household_id,
    array['owner', 'admin', 'member', 'caregiver']::public.household_role[]
  );
$$;

-- 2) Calendar event writes: member + legacy caregiver
drop policy if exists "Caregivers can manage calendar events" on public.calendar_events;
drop policy if exists "Caregivers can update calendar events" on public.calendar_events;
drop policy if exists "Caregivers can delete calendar events" on public.calendar_events;
drop policy if exists "Editors can manage calendar events" on public.calendar_events;
drop policy if exists "Editors can update calendar events" on public.calendar_events;
drop policy if exists "Editors can delete calendar events" on public.calendar_events;

create policy "Editors can manage calendar events"
on public.calendar_events for insert
with check (
  public.has_household_role(
    household_id,
    array['owner', 'admin', 'member', 'caregiver']::public.household_role[]
  )
  and created_by = auth.uid()
);

create policy "Editors can update calendar events"
on public.calendar_events for update
using (
  public.has_household_role(
    household_id,
    array['owner', 'admin', 'member', 'caregiver']::public.household_role[]
  )
);

create policy "Editors can delete calendar events"
on public.calendar_events for delete
using (
  public.has_household_role(
    household_id,
    array['owner', 'admin', 'member', 'caregiver']::public.household_role[]
  )
);

-- 3) Conflict resolution: members can resolve (same as task editors)
drop policy if exists "Caregivers can resolve sync conflicts" on public.sync_conflicts;
drop policy if exists "Editors can resolve sync conflicts" on public.sync_conflicts;

create policy "Editors can resolve sync conflicts"
on public.sync_conflicts for update
using (
  public.has_household_role(
    household_id,
    array['owner', 'admin', 'member', 'caregiver']::public.household_role[]
  )
);

-- 4) Ensure realtime publication includes tables used for near-live UI
-- (safe if already added; ignore errors via DO block)
do $$
begin
  begin
    alter publication supabase_realtime add table public.integration_accounts;
  exception
    when duplicate_object then null;
    when undefined_object then null;
    when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.sync_conflicts;
  exception
    when duplicate_object then null;
    when undefined_object then null;
    when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.tasks;
  exception
    when duplicate_object then null;
    when undefined_object then null;
    when others then null;
  end;
end $$;
