# NTRR — Resume checkpoint

**Saved:** July 9, 2026  
**Status:** M4 + M5 complete — calendar polish done — ready for M6 (launch prep)

---

## What's done

| Area | Status |
|------|--------|
| M0 Foundation | Complete |
| M1 Family (invites, roles) | Complete |
| M2 Tasks (board, recurring, realtime) | Complete |
| M3 Google sync | Complete — OAuth, multi-calendar sync, tasks, conflicts |
| M4 Apple + dashboard | Complete — CalDAV, Zapier, unified dashboard |
| M5 AI insights | Complete — agents, digest cron, dismiss/snooze |
| UI branding | Light sidebar, black active nav, vivid green accents |
| Calendar views | 5-day, 7-day, month views at `/calendar` |
| Calendar colors | Family member + calendar accent colors; assigned in Settings |
| Calendar UX | Title-first rows, compact times, legend, horizontal scroll on 7-day |

---

## Recent session (July 8–9)

- **Multi-calendar Google sync** — checkbox selection, per-calendar sync tokens, time window (-30 to +90 days)
- **Family color coding** — `households.calendar_settings` JSONB; member colors + calendar accents when a member has 2+ calendars
- **Settings** — `GoogleCalendarSettings` replaces simple picker (members, colors, calendar assignment)
- **Calendar UI** — agenda rows with color bars (no calendar name clutter); detail panel shows member; legend with Settings link
- **Webpack fix** — split `resolve-entry-colors.ts`, `"use client"` on color bars, `npm run clean` when HMR breaks `/calendar`

---

## Key routes

| Route | Purpose |
|-------|---------|
| `/dashboard` | Today's priorities, family status, agenda, AI insights |
| `/calendar` | 5/7-day agenda + month view with family color coding |
| `/tasks` | Shared task board |
| `/settings` | Google / Apple / Zapier integrations + calendar colors |
| `/api/cron/digest` | Daily AI agent run (6:00 UTC on Vercel) |
| `/api/cron/sync` | Scheduled Google sync (every 6h on Vercel) |

---

## Migrations to apply (if DB is behind)

```bash
npm run db:reset   # or apply individually:
# 20250707160000_grant_service_role_permissions.sql
# 20250708100000_m4_ai_insights.sql
# 20250708110000_m5_ai_insights_snooze.sql
# 20250708120000_household_calendar_settings.sql
```

---

## `.env.local` — required for full stack

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- `INTEGRATION_ENCRYPTION_KEY` (recommended)
- `SYNC_CRON_SECRET` (cron + `npm run digest:run`)

---

## Resume commands

```bash
cd /Users/kilynn/Projects/ntrr
npm run db:start    # if Docker/Supabase not running
npm run dev
npm run digest:run  # manual AI digest (needs SYNC_CRON_SECRET)
```

If `/calendar` throws webpack `Cannot read properties of undefined (reading 'call')`:

```bash
npm run clean && npm run dev
```

Then hard refresh the browser (`Cmd+Shift+R`).

- App: http://localhost:3000
- Mailpit (magic links): http://127.0.0.1:54324
- Supabase Studio: http://127.0.0.1:54323

---

## Next steps (M6)

1. ~~RLS security audit + token encryption review~~ — see [SECURITY-REVIEW.md](./SECURITY-REVIEW.md); apply `20250811000000_rls_member_role_and_sync.sql`
2. ~~Playwright E2E smoke~~ — `npm run test:e2e` / `test:e2e:public`; unit ranking `npm run test:unit`
3. Performance + accessibility pass
4. Beta with 3–5 caregiver households
5. Deploy Hub to hub.ntrr.com (Vercel + hosted Supabase) + tag v1.0.0 — see [PLATFORM-MIGRATION.md](./PLATFORM-MIGRATION.md)

### P0 beta readiness (2026-08-10)

| Item | Status |
|------|--------|
| Task edit + delete confirm | Done |
| Mine / Overdue / Unassigned filters | Done |
| Needs attention ranking (dashboard) | Done |
| Last sync + reconnect banners + near-realtime refresh | Done |
| Conflict badge + one-tap resolve path | Done |
| Post-household setup checklist | Done |
| RLS / encryption review | Done (doc + migration) |
| Smoke E2E | Done (public + optional auth) |

---

## Open / deferred

- GitHub #2: Apple CalDAV tester (needs iCloud account)
- GitHub #3: Zapier webhook end-to-end test
- Microsoft sync (1.1 preview)
- Apple CalDAV calendar→member color mapping (same pattern as Google)
- **Google Tasks sync off** (2026-08): Hub is source of truth for tasks; only Google Calendar syncs. Flag: `GOOGLE_TASKS_SYNC_ENABLED` in `lib/sync/google/tasks-config.ts`
- **Calendar visibility** ([ADR 0002](./adr/0002-calendar-visibility-member-integrations.md)): household vs personal; members + self-advocates connect own Google/Apple — apply migration `20250817000000_member_integrations_calendar_visibility.sql`

### Later — Reliant voice / live confirms (not Hub MVP)

**Direction locked:** [ADR 0001 — Grok Voice Agent primary, Twilio optional BYON](./adr/0001-reliant-voice-grok-primary.md)

| When ready | Work |
|------------|------|
| Reliant product | Confirm agent in Grok Voice Agent Builder; tools → complete / blocker |
| Telephony | xAI number for dogfood; optional Twilio/SIP import for stable line |
| Bridge | `reliant_confirm_jobs` (or equiv.): due → dial target → agent → audit |
| Hub (thin) | Keep intent flag + member mobiles only; no voice stack in Hub |
| Go-live | Quiet hours, max attempts, coordinator entitlement / usage |

Until then: Hub checkbox = **intent only** (see [ROLES-AND-RELIANT.md](./ROLES-AND-RELIANT.md)).