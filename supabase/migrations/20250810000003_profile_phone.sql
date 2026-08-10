-- Optional mobile for Reliant correlation (E.164 preferred)
alter table public.profiles
  add column if not exists phone_e164 text;

comment on column public.profiles.phone_e164 is
  'Optional mobile in E.164 (e.g. +15551234567). Used to correlate Hub members with Reliant phone identity.';

create unique index if not exists profiles_phone_e164_unique_idx
  on public.profiles (phone_e164)
  where phone_e164 is not null;
