-- Optional mobile on household invites (Reliant correlation + accept-time profile seed)
alter table public.invites
  add column if not exists phone_e164 text;

comment on column public.invites.phone_e164 is
  'Optional E.164 mobile for the invitee. Shown on accept with Reliant usage language; copied to profiles on accept when set.';

-- Extend invite preview with phone
drop function if exists public.get_invite_preview(text);

create function public.get_invite_preview(invite_token text)
returns table (
  id uuid,
  household_id uuid,
  household_name text,
  email text,
  role public.household_role,
  persona public.household_persona,
  phone_e164 text,
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
    i.phone_e164,
    i.expires_at,
    i.accepted_at,
    i.revoked_at
  from public.invites i
  join public.households h on h.id = i.household_id
  where i.token = invite_token
  limit 1;
$$;

grant execute on function public.get_invite_preview(text) to authenticated, anon;
