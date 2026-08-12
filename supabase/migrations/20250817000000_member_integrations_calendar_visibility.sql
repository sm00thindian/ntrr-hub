-- Multiple Google/Apple connections per household (one per member)
-- + RLS so members/self-advocates can manage their own integrations.

alter table public.integration_accounts
  drop constraint if exists integration_accounts_household_id_provider_key;

create unique index if not exists integration_accounts_household_provider_user_uidx
  on public.integration_accounts (household_id, provider, created_by);

-- Replace owner/admin-only write policies with own-row + elevated manage

drop policy if exists "Owners and admins can manage integrations" on public.integration_accounts;
drop policy if exists "Owners and admins can update integrations" on public.integration_accounts;
drop policy if exists "Owners and admins can delete integrations" on public.integration_accounts;

-- Insert: household members create their own connection rows
create policy "Members can insert own integrations"
on public.integration_accounts for insert
with check (
  public.is_household_member(household_id)
  and created_by = auth.uid()
);

-- Update: own rows, or owner/admin any row
create policy "Members can update own integrations"
on public.integration_accounts for update
using (
  public.is_household_member(household_id)
  and (
    created_by = auth.uid()
    or public.has_household_role(household_id, array['owner', 'admin']::public.household_role[])
  )
);

-- Delete: own rows, or owner/admin any row
create policy "Members can delete own integrations"
on public.integration_accounts for delete
using (
  public.is_household_member(household_id)
  and (
    created_by = auth.uid()
    or public.has_household_role(household_id, array['owner', 'admin']::public.household_role[])
  )
);

comment on index public.integration_accounts_household_provider_user_uidx is
  'One Google and one Apple connection per household member.';
