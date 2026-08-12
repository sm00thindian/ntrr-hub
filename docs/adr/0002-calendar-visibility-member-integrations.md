# ADR 0002 — Calendar visibility (household vs personal) + member integrations

| Field | Value |
|-------|--------|
| **Status** | Accepted — implementing |
| **Date** | 2026-08-12 |
| **Product** | Hub calendars (Google + Apple CalDAV) |
| **Related** | [ROLES-AND-RELIANT.md](../ROLES-AND-RELIANT.md) · Phase A My day |

---

## Context

Households need **shared logistics calendars** (everyone sees) and **private calendars** (only the connector / labeled person sees). Care partners with Member access and self-advocates should be able to connect **their own** Google or Apple calendars and choose visibility.

Today:

- One Google / Apple integration per household (`unique (household_id, provider)`).
- Only owner/admin may connect.
- Non–self-advocates see **all** household events; self-advocates only see calendars **assigned to them** (no true “family shared” vs “private”).

---

## Decisions (locked)

1. **Owners do not see others’ personal calendars** (privacy).  
2. **Members may connect their own Google/Apple.**  
3. **Apple CalDAV** uses the same visibility model.  
4. **Self-advocates** may connect calendars and set **household** or **personal** visibility.  
5. **Members** may connect their own Google or Apple calendars.

---

## Model

### Per-calendar visibility

| Value | Who sees events |
|-------|-----------------|
| `household` | All household members |
| `personal` | Only the member associated with that calendar (`memberUserId`) |

Default for existing assignments: **`household`** (no surprise lockout).

### Who can connect

`canConnectCalendars(role, persona)`:

- Access: owner, admin, member (and legacy caregiver)  
- **or** persona `self_advocate` (even if Viewer)

Viewers who are not self-advocates cannot connect.

### Integrations

- Multiple accounts per household: **one Google and one Apple row per member**  
  Unique: `(household_id, provider, created_by)`.  
- Each member manages **their own** connection (disconnect/sync settings).  
- Household sync job pulls **all** connected accounts.

### Storage

`households.calendar_settings`:

```ts
googleCalendars[calendarId] = {
  memberUserId: string;   // color / personal owner
  color: string;
  visibility: "household" | "personal";
}

appleCalendars[`apple:${integrationId}`] = {
  memberUserId: string;
  color: string;
  visibility: "household" | "personal";
}
```

Events keep `provenance.calendarId` (Google calendar id or `apple:{integrationId}`).

### Read filter (all personas)

```
show event if visibility === "household"
  OR memberUserId === currentUserId
```

Coordinators/care partners no longer see every personal calendar by default.

### Self-advocate / My day

Same visibility filter (shared family + their personal). Color “family member” assignment remains for legend and accents.

---

## Consequences

- Real privacy for work/personal calendars.  
- Care partners can bring their schedules without exposing private details.  
- Self-advocates see shared family calendars without being assigned every calendar.  
- Migration: existing calendars default to household.  
- Multi-account OAuth requires reconnect only if a second member connects (first connection unchanged).

---

## Out of scope (later)

- Share with selected members only (beyond binary household/personal).  
- Owner break-glass view of personal calendars.  
- Microsoft calendars.
