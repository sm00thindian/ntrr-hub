# Household roles, personas, and Reliant confirmation

**Status:** Schema + invite/task UI + profile phone (2026-08-10)  
**Product:** Hub · optional tiered bridge to Reliant · cross-sell under NTRR

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

## Reliant confirmation as an **optional tiered service**

**Product decision:** Phone confirmation from Hub is **not** core free forever. It is an **optional, tiered** capability that uses Reliant’s phone stack.

| Layer | Role |
|-------|------|
| **Hub core** | Family board, calendars, tasks, personas — valuable without phone calls |
| **Reliant confirm add-on / tier** | When a task/event has `reliant_confirm_requested`, Reliant may call until confirm |
| **Hub + Reliant bundle** | One commercial package: coordination + shared confirm/dial pool |

**Reliant proper** stays the phone-first product (own commitments, inbound, quiet hours).  
**Hub → Reliant** is a **bridge**: family-board intent → hard phone confirm.

### Flag on items (shipped)

| Table | Column |
|-------|--------|
| `tasks` | `reliant_confirm_requested` |
| `calendar_events` | `reliant_confirm_requested` |
| `recurring_task_templates` | `reliant_confirm_requested` (default for instances) |

UX: checkbox on create task + recurring template; **Reliant** chip on cards.

### Who gets the call (routing)

1. **Assignee** if set and has linked phone / Reliant  
2. Else **focus person** (often self-advocate)  
3. Else household default (product decision later — avoid calling every coordinator)

### Meter what costs money

Bill **confirm series started** (due → dials until outcome), not the checkbox alone.  
Recurring + Reliant on = cost per **instance** (warn on daily templates).

### Pricing sketch (go-live)

| Offer | Includes | Confirm series |
|-------|----------|----------------|
| Hub free / dogfood | Board only | Off or hard-capped / allowlist |
| Hub family | Board + calendars | Optional small allotment **or** requires Reliant link |
| **Reliant confirm add-on** | Metered series on Hub items | e.g. N/mo then overage |
| **Hub + Reliant bundle** | Hub family + Reliant Starter (or above) | Shared dial/confirm pool |

Instrument usage during dogfood even while free.

### Implementation later

- `reliant_confirm_jobs` + dial counts  
- Stripe meters / debit Reliant allowance via internal API  
- Settings: “Reliant confirms used this month”  
- Gate checkbox effects when entitlement missing (UI: “Add Reliant / upgrade”)

---

## Cross-selling NTRR services

Keep products distinct; surface each other everywhere it helps the job.

| Surface | Hub shows | Reliant shows |
|---------|-----------|----------------|
| Settings | **NTRR services** card → Reliant + bundle story | Link to Hub for family board (when ready) |
| Footer | Reliant + ntrr.com | Already “NTRR service” |
| Tasks | Reliant confirm checkbox (tiered later) | — |
| Apex ntrr.com | Both product cards | — |

**Dogfood copy:** mark intent now; live calls + paid tiers after phone correlation and metering.

---

## Phone identity for correlation (required for live bridge)

Reliant identity is **phone-first** (`phone_e164`). Hub is **email-first** today. Correlation needs a shared key.

### Shipped foundation

| Piece | Detail |
|-------|--------|
| `profiles.phone_e164` | Optional unique mobile on Hub profile |
| Settings → **Mobile for Reliant** | User saves E.164; same number they use in Reliant |
| Cross-sell card | Explains link + bundle |

### Onboarding path (target)

1. Hub sign-up (email magic link / Google)  
2. **Prompt for mobile** early (after household create or first Reliant checkbox)  
3. Optionally verify SMS later (reuse patterns from Reliant)  
4. Match `profiles.phone_e164` ↔ Reliant `profiles.phone_e164` (or allowlist) when enqueueing confirms  

**Not yet:** shared Supabase Auth, SSO, or automatic account merge (Phase 6 options still apply). Phone is the **pragmatic join key** for v1 bridge.

### Security / privacy

- Unique phone per Hub profile (DB unique index when set)  
- Don’t expose other members’ phones beyond household need  
- Verified phone before dialing (when SMS verify ships)

---

## Invite flow

Invite stores `role` + `persona`. Accept copies both; self-advocate → `is_focus_person` default true.

## Related

- Permissions: `lib/permissions/roles.ts`  
- Phone helpers: `lib/phone.ts`  
- Migrations: `2025081000000*` personas / reliant flags / profile phone  
- Platform topology: `docs/PLATFORM-MIGRATION.md` Phase 6  
