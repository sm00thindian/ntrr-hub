-- Coordinators (owner/admin) may update co-member profile fields used on the
-- Family page: display name and call-target phone for Reliant routing.

drop policy if exists "Owners and admins can update co-member profiles" on public.profiles;

create policy "Owners and admins can update co-member profiles"
on public.profiles for update
using (
  exists (
    select 1
    from public.household_members hm_self
    join public.household_members hm_other
      on hm_self.household_id = hm_other.household_id
    where hm_self.user_id = auth.uid()
      and hm_other.user_id = profiles.id
      and hm_self.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.household_members hm_self
    join public.household_members hm_other
      on hm_self.household_id = hm_other.household_id
    where hm_self.user_id = auth.uid()
      and hm_other.user_id = profiles.id
      and hm_self.role in ('owner', 'admin')
  )
);

comment on policy "Owners and admins can update co-member profiles" on public.profiles is
  'Family board: coordinators may set display name and Reliant call-target phone for household members.';
