# Household roles, personas, and Reliant confirmation

**Status:** Implemented in schema + invite/task UI (2026-08-10)  
**Product:** Hub · handoff intent for Reliant

## Two axes

| Axis | Field | Purpose |
|------|--------|---------|
| **A — Access** | `household_members.role` | What they can do in Hub |
| **B — Persona** | `household_members.persona` | Care relationship in this household |

These are independent. A self-advocate may be a `member` (can complete own tasks) or `viewer` (read-only). A coordinator is usually `owner`/`admin` with persona `coordinator`.

### Access roles (Axis A)

| Role | Meaning |
|------|---------|
| `owner` | Household control |
| `admin` | Members + integrations |
| `member` | Full day-to-day participation (replaces legacy `caregiver`) |
| `viewer` | Read-leaning |
| `caregiver` | **Legacy** enum value only; app normalizes to Member |

### Personas (Axis B)

| Persona | Meaning |
|---------|---------|
| `coordinator` | Runs the board |
| `care_partner` | Helps with handoffs |
| `self_advocate` | Person care is organized around; future **My day** + Reliant |
| `other` | Family without a specific care role |

`is_focus_person` marks primary care focus for filters and future Reliant routing (multi-focus later).

## Reliant confirmation requested

**Not only a display tag** — a durable boolean on the item:

| Table | Column |
|-------|--------|
| `tasks` | `reliant_confirm_requested` |
| `calendar_events` | `reliant_confirm_requested` |

### UX

- **Create task:** checkbox *“Request Reliant phone confirmation”*
- **Cards / agenda:** green **Reliant** chip when true
- **Calendar events:** field exists; UI toggle can follow (detail panel)

### Semantics (either caregiver or self-advocate)

Who gets the call is **not** the checkbox alone:

1. Prefer **assignee** if set (self-advocate or care partner with Reliant linked)  
2. Else household **focus person** with persona `self_advocate`  
3. Else coordinator’s Reliant (household-level fallback — product decision later)

The checkbox means: *this commitment should not die as a banner — ask for phone confirmation via Reliant when that pipe exists.*

### Future wire-up (not built)

- Hub outbox / job: when due, enqueue Reliant reminder for resolved phone identity  
- Reliant confirm → Hub task `done` or event acknowledged  
- Cross-product identity (PLATFORM-MIGRATION Phase 6)

## Invite flow

Invite stores both `role` and `persona`. Accept copies both onto `household_members`.

## Related

- Permissions helpers: `lib/permissions/roles.ts`
- Migration: `supabase/migrations/20250810000000_personas_and_reliant_confirm.sql`
