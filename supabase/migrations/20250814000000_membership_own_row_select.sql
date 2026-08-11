-- Allow each user to always read their own household_members row.
-- Defensive: the household-scoped SELECT already works via is_household_member
-- (security definer), but an own-row policy avoids false "no membership"
-- flashes if embed/join paths fail or RLS helpers lag after invite accept.

drop policy if exists "Users can view own membership" on public.household_members;

create policy "Users can view own membership"
on public.household_members for select
using (user_id = auth.uid());
