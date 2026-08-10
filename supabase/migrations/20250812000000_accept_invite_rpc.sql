-- Invite accept was broken under RLS: invitees are not yet members, so they cannot
-- INSERT into household_members (only owners/admins can add members).
-- Fix: security-definer RPC that validates the pending invite and joins atomically.

create or replace function public.accept_household_invite(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_email text;
  v_invite public.invites%rowtype;
  v_member_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if v_email = '' then
    raise exception 'Signed-in account has no email';
  end if;

  select * into v_invite
  from public.invites
  where token = invite_token
  limit 1;

  if not found then
    raise exception 'Invite not found';
  end if;

  if v_invite.accepted_at is not null then
    -- Idempotent: already accepted — return existing membership if any
    select id into v_member_id
    from public.household_members
    where user_id = v_user_id
      and household_id = v_invite.household_id
    limit 1;
    if v_member_id is not null then
      return v_member_id;
    end if;
    raise exception 'This invite has already been accepted';
  end if;

  if v_invite.revoked_at is not null then
    raise exception 'This invite has been revoked';
  end if;

  if v_invite.expires_at <= now() then
    raise exception 'This invite has expired';
  end if;

  if lower(v_invite.email) <> v_email then
    raise exception 'This invite was sent to %. Sign in with that email to accept.', v_invite.email;
  end if;

  if exists (select 1 from public.household_members where user_id = v_user_id) then
    raise exception 'You already belong to a household';
  end if;

  insert into public.household_members (
    household_id,
    user_id,
    role,
    persona,
    is_focus_person
  )
  values (
    v_invite.household_id,
    v_user_id,
    v_invite.role,
    coalesce(v_invite.persona, 'care_partner'::public.household_persona),
    coalesce(v_invite.persona, 'care_partner'::public.household_persona) = 'self_advocate'::public.household_persona
  )
  returning id into v_member_id;

  -- Seed profile phone from invite when profile has none
  if v_invite.phone_e164 is not null and length(trim(v_invite.phone_e164)) > 0 then
    update public.profiles
    set
      phone_e164 = v_invite.phone_e164,
      updated_at = now()
    where id = v_user_id
      and (phone_e164 is null or length(trim(phone_e164)) = 0);
  end if;

  update public.invites
  set
    accepted_at = now(),
    accepted_by = v_user_id
  where id = v_invite.id
    and accepted_at is null;

  return v_member_id;
end;
$$;

revoke all on function public.accept_household_invite(text) from public;
grant execute on function public.accept_household_invite(text) to authenticated;

comment on function public.accept_household_invite(text) is
  'Invitee joins household via token. Validates email match, expiry, and single-household rule; bypasses member-insert RLS safely.';
