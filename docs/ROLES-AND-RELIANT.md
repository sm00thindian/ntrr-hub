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

### Recurring templates

`recurring_task_templates.reliant_confirm_requested` is the default for each spawned task instance (create form checkbox). Spawning code should always copy the flag onto `tasks.reliant_confirm_requested`.

### Future wire-up (not built)

- Hub outbox / job: when due, enqueue Reliant reminder for resolved phone identity  
- Reliant confirm → Hub task `done` or event acknowledged  
- Cross-product identity (PLATFORM-MIGRATION Phase 6)
- **Billing:** see “Charging for Reliant confirmations” below

## Charging for Reliant confirmations (go-live guidance)

Reliant today is a **standalone** phone-reliability product (subscription-ish, dial/SMS meters). Hub confirm is a **usage event** that burns Reliant cost (Twilio + xAI voice). Don’t give unlimited Hub→Reliant confirms free on a flat Hub plan.

### Recommended model

**Meter the confirmation, not the checkbox.**

| Concept | Meter |
|---------|--------|
| Billable unit | **Confirm attempt series** (one commitment due → outbound call(s) until confirm/snooze/cancel, or max attempts) — *not* every redial as a separate SKU if possible |
| Alternate unit | **Outbound dial minutes** / dials (aligns with Reliant’s own COGS) |

**Who pays**

1. **Preferred v1:** Household (or the **focus person’s** Reliant account) holds a Reliant entitlement. Hub only *requests* confirms if a linked Reliant identity has remaining quota.  
2. **Alt:** Hub plan includes a small monthly allotment of “Reliant confirms”; overage routes through Reliant billing.

**Tiers (sketch)**

| Tier | Included Reliant confirms / mo | Overage |
|------|----------------------------------|---------|
| Hub free / dogfood | 0–5 or allowlist only | Block or manual |
| Hub family | e.g. 20–40 series | Soft warn → pay-as-you-go or upgrade |
| Hub + Reliant bundle | Higher / shared pool with Reliant Starter dials | Same overage rules as Reliant |

**Product rules that control cost**

- Cap redials and respect quiet hours (Reliant already does this).  
- Only bill **started** series (not checkbox alone).  
- Recurring templates with Reliant on: each **instance due** can start one series (daily series = daily cost — make that obvious in UI).  
- Prefer self-advocate / assignee phone; don’t call every coordinator by default.

**Implementation later**

- `reliant_confirm_jobs` table: household, task/event id, status, dial_count, billable_at  
- Stripe: meter event or prepaid credits; or debit Reliant’s existing dial allowance via internal API  
- Dashboard: “Reliant confirms used this month” on Hub Settings

**Dogfood:** free / unlimited with soft rate limits is fine; instrument counts now so you know real usage before pricing.

### Positioning vs “Reliant proper”

| | Reliant standalone | Hub → Reliant confirm |
|--|--------------------|------------------------|
| Use case | User’s own commitments, phone-first | Family board item needs a hard confirm |
| Buyer | Individual operator | Household / caregiver |
| Billing | Reliant sub + dials | Confirm series metered, often via Reliant identity or Hub add-on |

Keep products separate; **sell the confirm as a bridge**, not a free unlimited feature of Hub.

## Invite flow

Invite stores both `role` and `persona`. Accept copies both onto `household_members`.

## Related

- Permissions helpers: `lib/permissions/roles.ts`
- Migration: `supabase/migrations/20250810000000_personas_and_reliant_confirm.sql`
