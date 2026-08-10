-- M1: profiles, household invites

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  email text not null check (position('@' in email) > 1),
  role public.household_role not null default 'caregiver',
  -- Hosted Supabase installs pgcrypto in schema "extensions" (not public search_path)
  token text not null unique default encode(extensions.gen_random_bytes(32), 'hex'),
  invited_by uuid not null references auth.users (id) on delete restrict,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (role <> 'owner'),
  check (expires_at > created_at)
);

create index invites_household_id_idx on public.invites (household_id);
create index invites_token_idx on public.invites (token);
create index invites_email_idx on public.invites (lower(email));

create unique index invites_pending_email_per_household_idx
on public.invites (household_id, lower(email))
where accepted_at is null and revoked_at is null;

-- Audit triggers
create trigger profiles_audit
after insert or update or delete on public.profiles
for each row execute function public.write_audit_log();

create trigger invites_audit
after insert or update or delete on public.invites
for each row execute function public.write_audit_log();

-- Extend audit trigger for invites/profiles household_id
create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid;
  v_actor_id uuid;
  v_entity_id uuid;
  v_action text;
begin
  v_actor_id := auth.uid();

  if tg_op = 'INSERT' then
    v_action := 'create';
    v_entity_id := new.id;
    if tg_table_name = 'household_members' then
      v_household_id := new.household_id;
    elsif tg_table_name = 'households' then
      v_household_id := new.id;
    elsif tg_table_name = 'integration_accounts' then
      v_household_id := new.household_id;
    elsif tg_table_name = 'invites' then
      v_household_id := new.household_id;
    end if;
  elsif tg_op = 'UPDATE' then
    v_action := 'update';
    v_entity_id := new.id;
    if tg_table_name = 'household_members' then
      v_household_id := new.household_id;
    elsif tg_table_name = 'households' then
      v_household_id := new.id;
    elsif tg_table_name = 'integration_accounts' then
      v_household_id := new.household_id;
    elsif tg_table_name = 'invites' then
      v_household_id := new.household_id;
    end if;
  elsif tg_op = 'DELETE' then
    v_action := 'delete';
    v_entity_id := old.id;
    if tg_table_name = 'household_members' then
      v_household_id := old.household_id;
    elsif tg_table_name = 'households' then
      v_household_id := old.id;
    elsif tg_table_name = 'integration_accounts' then
      v_household_id := old.household_id;
    elsif tg_table_name = 'invites' then
      v_household_id := old.household_id;
    end if;
  end if;

  insert into public.audit_log (household_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    v_household_id,
    v_actor_id,
    v_action,
    tg_table_name,
    v_entity_id,
    case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- RLS
alter table public.profiles enable row level security;
alter table public.invites enable row level security;

create policy "Users can view own profile"
on public.profiles for select
using (auth.uid() = id);

create policy "Members can view co-member profiles"
on public.profiles for select
using (
  exists (
    select 1
    from public.household_members hm_self
    join public.household_members hm_other on hm_self.household_id = hm_other.household_id
    where hm_self.user_id = auth.uid()
      and hm_other.user_id = profiles.id
  )
);

create policy "Users can insert own profile"
on public.profiles for insert
with check (auth.uid() = id);

create policy "Users can update own profile"
on public.profiles for update
using (auth.uid() = id);

-- Invites: admins/owners manage; invitee can read pending invite by token via RPC or accept flow
create policy "Members can view household invites"
on public.invites for select
using (public.is_household_member(household_id));

create policy "Owners and admins can create invites"
on public.invites for insert
with check (
  public.has_household_role(household_id, array['owner', 'admin']::public.household_role[])
  and invited_by = auth.uid()
);

create policy "Owners and admins can update invites"
on public.invites for update
using (public.has_household_role(household_id, array['owner', 'admin']::public.household_role[]));

-- Accept invite: invitee updates accepted_at (enforced in app + policy below)
create policy "Invitee can accept pending invite"
on public.invites for update
using (
  accepted_at is null
  and revoked_at is null
  and expires_at > now()
  and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

-- Allow invitee to read their pending invite by token (for accept page)
create policy "Invitee can view pending invite by email"
on public.invites for select
using (
  accepted_at is null
  and revoked_at is null
  and expires_at > now()
  and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

-- Token-based preview for accept page (avoids exposing all pending invites)
create or replace function public.get_invite_preview(invite_token text)
returns table (
  id uuid,
  household_id uuid,
  household_name text,
  email text,
  role public.household_role,
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
    h.name,
    i.email,
    i.role,
    i.expires_at,
    i.accepted_at,
    i.revoked_at
  from public.invites i
  join public.households h on h.id = i.household_id
  where i.token = invite_token
  limit 1;
$$;

grant execute on function public.get_invite_preview(text) to authenticated, anon;