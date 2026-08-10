-- Must run in its own migration: new enum values cannot be used until committed.
alter type public.household_role add value if not exists 'member';
