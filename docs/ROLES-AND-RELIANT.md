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
| `self_advocate` | Person care is organized around; **My day** home (Phase A) + Reliant chips |
| `other` | Family without a specific care role |

`is_focus_person` marks primary care focus for filters and Reliant routing (multi-focus later).

### Phase A — My day (shipped)

When `persona === self_advocate`:

| Surface | Behavior |
|---------|----------|
| **Dashboard** | **My day** only: tasks assigned to them + events from calendars assigned to them; Reliant chips; no setup/sync/household admin |
| **Tasks** | Default **Mine**; hide All/Unassigned; no recurring templates UI; new tasks default-assign to self |
| **Calendar** | Shared household calendars + their personal calendars + their due tasks ([ADR 0002](./adr/0002-calendar-visibility-member-integrations.md)) |
| **Settings** | Phone, profile, and optional own Google/Apple (household vs personal visibility) |
| **Nav** | Labels: My day · My tasks · Calendar · Family · Settings |

Coordinator / care_partner / other keep the full family board.

## Reliant confirmation as an **optional tiered service**

**Product decision:** Phone confirmation from Hub is **not** core free forever. It is an **optional, tiered** capability that uses Reliant’s phone stack.

| Layer | Role |
|-------|------|
| **Hub core** | Family board, calendars, tasks, personas — valuable without phone calls |
| **Reliant confirm add-on / tier** | When a task/event has `reliant_confirm_requested`, Reliant may call until confirm |
| **Hub + Reliant bundle** | One commercial package: coordination + shared confirm/dial pool |

**Reliant proper** stays the phone-first product (own commitments, inbound, quiet hours).  
**Hub → Reliant** is a **bridge**: family-board intent → hard phone confirm, powered by the **coordinator’s Reliant account**.

### Account vs call target (locked)

| Role | Who | Phone / account |
|------|-----|-----------------|
| **Reliant account holder** | Household **coordinator** (typically owner/admin) | Coordinator’s Reliant subscription + their Reliant login phone |
| **Call recipient** | Whoever must confirm (assignee, care partner, or self-advocate) | Their mobile on Hub (`profiles.phone_e164` / invite phone) — **not** required to own Reliant |

```text
Coordinator’s Reliant account  ──places call──►  Caregiver or self-advocate’s phone
        (billing / entitlement)                      (answer / confirm completion)
```

- Entitlement and billing always hang off the **coordinator Reliant** (or Hub+Reliant bundle tied to that household).  
- The person being called only needs a **reachable mobile** on the household board.  
- A self-advocate may *also* use Reliant standalone later; that is separate from Hub-originated confirms.

### Flags on items

| Table | Column | Notes |
|-------|--------|--------|
| `tasks` | `reliant_confirm_requested` | Phone confirm intent |
| `tasks` | `reliant_sms_reminder_requested` | Soft SMS reminder intent (independent) |
| `calendar_events` | `reliant_confirm_requested` | Phone confirm (events; no SMS column yet) |
| `recurring_task_templates` | `reliant_confirm_requested` / `reliant_sms_reminder_requested` | Defaults for instances |
| `households` | `reliant_connected_at` / `reliant_connected_by` | Coordinator self-attest (dogfood); later active-plan |

**Gate:** `RELIANT_BRIDGE_ENABLED` must be on **and** household Reliant connected — otherwise task forms hide both options (or show Connect CTA when ENV on). Server rejects setting either flag to true when gated off.

UX: independent checkboxes on create/edit task + recurring template when connected; **Reliant** + **SMS** chips on cards. Assignees need a free Reliant account + SMS opt-in for live texts (no subscription).

### Who gets the call (routing)

Resolve **dial number** only (not Reliant account ownership):

1. **Assignee** Hub mobile if set  
2. Else **focus person** / self-advocate mobile  
3. Else fail soft / ask coordinator to add a mobile for that member  

**Never** require the call recipient to have a paid Reliant account for Hub-initiated confirms.

### Meter what costs money

Bill the **coordinator’s Reliant / bundle entitlement** for each **confirm series started** (due → dials until outcome), not the checkbox alone.  
Recurring + Reliant on = cost per **instance** (warn on daily templates).

### Pricing sketch (go-live)

| Offer | Includes | Confirm series |
|-------|----------|----------------|
| Hub free / dogfood | Board only | Off or hard-capped / allowlist |
| Hub family | Board + calendars | Confirm add-on optional |
| **Reliant confirm add-on** | Metered series on Hub items | Debits **coordinator Reliant** (or add-on pool) |
| **Hub + Reliant bundle** | Hub family + coordinator Reliant | Shared dial/confirm pool on coordinator account |

Instrument usage during dogfood even while free.

### Implementation later

**Voice stack direction:** [ADR 0001](./adr/0001-reliant-voice-grok-primary.md) — **Grok Voice Agent primary**; Twilio only as optional number (BYON/SIP). Hub stays intent-only.

- Grok Voice confirm agent (Reliant) + tools to complete / report blocker  
- `reliant_confirm_jobs` + dial counts on **coordinator Reliant account id**  
- Outbound dial **to** member `phone_e164` (xAI number dogfood → optional Twilio import)  
- Stripe meters / debit coordinator Reliant allowance  
- Settings: “Reliant confirms used this month” for coordinator  
- Gate live dials if coordinator has no Reliant entitlement (UI: “Connect Reliant / upgrade”)  

**SMS reminders:** Hub intent shipped (`reliant_sms_reminder_requested`). Soft Reliant texts for due-soon / still-open tasks — may go live before voice. Same coordinator metering; quiet hours + daily caps; send only if target has Reliant SMS opt-in. Not Hub-owned SMS. Tracked in [CHECKPOINT.md](./CHECKPOINT.md).

Also tracked under **Open / deferred** in [CHECKPOINT.md](./CHECKPOINT.md).

---

## Cross-selling NTRR services

Keep products distinct; surface each other everywhere it helps the job.

| Surface | Hub shows | Reliant shows |
|---------|-----------|----------------|
| Settings | **NTRR services** + coordinator Reliant account story | Link to Hub for family board (when ready) |
| Footer | Reliant + ntrr.com | Already “NTRR service” |
| Tasks | Reliant phone + SMS checkboxes when bridge connected (coordinator-powered) | — |
| Apex ntrr.com | Both product cards | — |

**Dogfood copy:** mark intent now; live calls + paid tiers after coordinator Reliant link + member mobiles.

---

## Phone identity (two numbers, two jobs)

| Phone | Stored on | Purpose |
|-------|-----------|---------|
| **Coordinator Reliant account phone** | Reliant profile (and optionally Hub coordinator profile for convenience) | Login + billing identity for Reliant |
| **Call-target mobile** | Hub member `profiles.phone_e164` / invite `phone_e164` | Who Reliant dials for Hub confirm |

### Shipped foundation

| Piece | Detail |
|-------|--------|
| `profiles.phone_e164` | Optional unique mobile per Hub user (call target or coordinator’s own) |
| Settings → **Mobile for Reliant** | Members save the number they can be reached on; coordinators should also keep their Reliant number clear for account linking later |
| Invite optional phone | Seeds invitee profile for **call target**; message explains they may receive Reliant calls for completion |
| Cross-sell card | Bundle + coordinator-powered confirms |

### Onboarding path (target)

1. Hub sign-up (email)  
2. Coordinator: create/link **Reliant account** (their phone) — entitlement  
3. Members (caregiver / self-advocate): optional mobile on invite or Settings — **dial target**  
4. On confirm job: authorize via coordinator Reliant → dial member phone  

**Not yet:** shared Supabase Auth, SSO, or automatic account merge.

---

## Invite flow

Invite stores `role` + `persona`. Accept copies both; self-advocate → `is_focus_person` default true.

## Related

- Permissions: `lib/permissions/roles.ts`  
- Phone helpers: `lib/phone.ts`  
- Migrations: `2025081000000*` personas / reliant flags / profile phone  
- Platform topology: `docs/PLATFORM-MIGRATION.md` Phase 6  
