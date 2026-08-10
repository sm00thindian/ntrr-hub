# Hub security review — RLS & integration encryption

**Date:** 2026-08-10  
**Scope:** Pre-beta P0 (M6)  
**Status:** Reviewed + fix migration `20250811000000_rls_member_role_and_sync.sql`

---

## Row Level Security (RLS)

### Model

| Principle | Implementation |
|-----------|----------------|
| Household isolation | Almost all tables gate on `is_household_member(household_id)` or `has_household_role(...)` |
| Role axis | `owner` / `admin` / `member` / `viewer` (+ legacy `caregiver`) |
| Writes | Editors (`owner`, `admin`, `member`, `caregiver`) for tasks; admins for integrations |

### Findings & remediations

| Finding | Severity | Action |
|---------|----------|--------|
| `can_edit_tasks()` still listed only `owner/admin/caregiver` after `member` migration | **High** | Migration updates helper to include `member` |
| Calendar event write policies still used `caregiver` only | **High** | Recreated with `member` + legacy `caregiver` |
| Sync conflict update policy omitted `member` | **Medium** | Broadened to task-editor roles |
| Service-role cron/sync uses admin client (bypasses RLS) | Info | Expected; protect with `SYNC_CRON_SECRET` |
| Invite accept policies are email-JWT based | Info | Keep magic-link email match strict |

### Residual risks (accept for beta / follow up)

1. **Multi-household users** — membership query uses `limit 1`; no household switcher yet. Document as known limit.
2. **Admin client on conflict list** — `getPendingConflicts` uses service role; OK if always scoped by `household_id` from authenticated context (verify every call path).
3. **Realtime** — publication must include `tasks`, `integration_accounts`, `sync_conflicts` (migration attempts add). Confirm on hosted Supabase Dashboard → Replication.

### Manual checklist before production

- [ ] Apply all migrations on hosted Supabase (`db push` / linked project)
- [ ] Spot-check as `member`: create/edit task, complete task, cannot manage Google connect
- [ ] Spot-check as `viewer`: read board, cannot mutate tasks
- [ ] Spot-check cross-household: user A cannot select household B tasks by UUID
- [ ] Confirm `SYNC_CRON_SECRET` set on Vercel; cron routes reject missing/wrong bearer

---

## Integration token encryption

### Model

| Piece | Behavior |
|-------|----------|
| Key | `INTEGRATION_ENCRYPTION_KEY` → SHA-256 → AES-256-GCM |
| Format | `enc:<iv+tag+ciphertext base64url>` |
| Dev fallback | Without key: `plain:<base64url>` (not for production) |
| Google tokens | Encrypted on connect / refresh (`encryptJson`) |
| Apple app password | Encrypted in metadata on connect |

### Findings & remediations

| Finding | Severity | Action |
|---------|----------|--------|
| Missing `INTEGRATION_ENCRYPTION_KEY` writes **plain:** payloads | **High in prod** | Require key in production env; fail deploy if unset (ops) |
| Some sync paths rewrite `metadata` with **decrypted** in-memory tokens | **Medium** | Do not re-serialize full metadata from decrypted account without `encryptJson(tokens)` — orchestrator last-sync intentionally only bumps `updated_at` |
| Encryption key rotation not implemented | Low | Document for 1.1 |

### Production requirements

```bash
# Required
INTEGRATION_ENCRYPTION_KEY=<long random secret, e.g. openssl rand -base64 32>
SUPABASE_SERVICE_ROLE_KEY=<never expose to client>
SYNC_CRON_SECRET=<bearer for /api/cron/*>

# Client-safe only
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_SUPABASE_URL=...
```

### Residual risks

1. Re-audit any `metadata: { ...account.metadata }` admin updates after token refresh patterns change.
2. Prefer storing OAuth tokens only as `enc:` strings in JSONB; never log metadata.

---

## Auth notes

- Magic link + Google OAuth via Supabase Auth.
- Middleware refreshes session cookies (see `lib/supabase/middleware.ts`).
- Invite tokens are unguessable UUIDs; still rate-limit accept in future if abuse appears.

---

## Sign-off for first beta

| Gate | Owner | Done |
|------|-------|------|
| Migration applied (member RLS + realtime) | Dev | After `db:reset` / deploy migrate |
| Encryption key set on Vercel | Ops | |
| Cron secret set | Ops | |
| Manual role matrix spot-check | Dev | |
| No service role in client bundles | Dev | Verified by architecture (server-only admin) |
