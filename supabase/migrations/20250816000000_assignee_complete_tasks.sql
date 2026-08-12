-- Self-advocates (and anyone) may complete tasks assigned to them even when
-- access role is viewer. Coordinators still use can_edit_tasks for full edit.
-- Also re-assert can_edit_tasks includes Axis A `member` (was missing in early schemas).

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

-- Complete / reopen own assigned tasks (status and light provenance only — enforced in app)
drop policy if exists "Assignees can update own assigned tasks" on public.tasks;

create policy "Assignees can update own assigned tasks"
on public.tasks for update
using (
  public.is_household_member(household_id)
  and assignee_id = auth.uid()
)
with check (
  public.is_household_member(household_id)
  and assignee_id = auth.uid()
);

comment on policy "Assignees can update own assigned tasks" on public.tasks is
  'Self-advocates and care partners may mark tasks assigned to them done/reopen without full editor role.';
