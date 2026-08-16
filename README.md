# Hub

**Not The Runaround.**  
**Hub** — Family Care Orchestrator, a product of [Not The Runaround](https://ntrr.com).

One calm place for sandwich-generation families, guardians of adult disabled children, and multi-generational households. Hub reduces cognitive load by unifying calendars, tasks, and family coordination across the tools you already use — without asking you to rip and replace Google, Apple, or Microsoft.

**Promise:** *You shouldn't have to think about this to have it work.*

Naming: brand `Not The Runaround` · short `NTRR` · product `Hub`.

→ Platform: [ntrr.com](https://ntrr.com) · Hub: [hub.ntrr.com](https://hub.ntrr.com) · Sibling: [Reliant](https://reliant.ntrr.com)  
→ Positioning: [ntrr-com `docs/positioning.md`](https://github.com/sm00thindian/ntrr-com/blob/main/docs/positioning.md)  
→ Hosting / domain roadmap: [docs/PLATFORM-MIGRATION.md](docs/PLATFORM-MIGRATION.md)

---

## The problem

Caregiving has two failure modes. Hub exists for the first; [Reliant](https://reliant.ntrr.com) exists for the second. Same company, two instincts.

### Coordination overhead (Hub)

Families juggle fragmented ecosystems:

- Calendars and tasks spread across Google, Apple, and Microsoft
- No shared view of who is doing what, when conflicts arise, or what needs attention today
- The mental tax of being the only one who holds the whole picture

The result is constant overhead, missed handoffs, and burnout — the runaround of *managing it*.

### Follow-through risk (Reliant)

Something was on a calendar, but nobody confirmed it actually happened. The appointment nobody double-checked. The medication schedule that lived in someone's head. The document nobody could find when it actually mattered.

That is not drama — it is ordinary follow-through risk, the runaround of *hoping it gets done*. Hub does not pretend a shared board solves that alone; phone confirmation is Reliant's job.

## The solution

**Hub** is a **coordination layer** — not a replacement for your existing tools.

```
Google / Apple / Microsoft
        │
        ▼
┌─────────────────────────┐
│  Sync & provenance      │  source, timestamp, confidence
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│  Unified dashboard      │  today's priorities, family status
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│  AI agents              │  reminders, conflicts, suggestions
└─────────────────────────┘
```

Families get a single source of truth that works *with* their stack, surfaces what matters now, and flags inconsistencies for human confirmation — never silent merges.

---

## Who it's for

**Gen X sandwich caregivers** — practical, time-strapped, allergic to hype.

Also: guardians of adult disabled children, multi-generational households, and anyone coordinating care across people and platforms.

**Tone:** Professional, calm, trustworthy. Quick scans, low friction, no fluff.

---

## MVP: coordination hub

The first release focuses on reliable coordination. Document vault, finance, and legacy features come later.

| Feature | Description |
|---------|-------------|
| **Cross-ecosystem sync** | Google Calendar (primary); Apple CalDAV / Zapier bridges; Microsoft planned for 1.1 |
| **Family task board** | Shared tasks, roles, recurring series (one open card; miss-day archive) |
| **Focus / My day** | Caregiver household day board + self-advocate day board; done-today stays green |
| **AI agents** | Reminders, schedule conflicts, pattern highlights |
| **Family invites** | Simple onboarding for household members |
| **PWA** | Mobile-responsive progressive web app |

### Not in MVP

- Clinical / medical records (HIPAA scope)
- Full replacements for Google Calendar, Apple Reminders, or Outlook
- Over-engineered AI autonomy

---

## Roadmap (phases)

| Phase | Focus |
|-------|-------|
| **1 — Coordination hub** *(MVP)* | Sync, dashboard, task board, basic AI agents |
| **2 — Document vault** | Care docs, guardianship paperwork, linked to tasks |
| **3 — Finance** | Shared expenses, SSA/guardianship-friendly reporting |
| **4 — Legacy & insights** | Long-term planning, richer analytics |

Architecture is modular from day one so each phase plugs in without rewriting the core.

---

## What makes Hub different

- **Subtraction, not more apps** — one less call to make, one less thing to remember
- **Cross-ecosystem** — meets families where they already live
- **Provenance-first** — every synthesized fact traces to a source
- **Audit-friendly** — lightweight trails suitable for guardianship and SSA contexts
- **Privacy-first** — user-controlled data; no clinical scope in MVP
- **Proactive, not noisy** — surfaces what matters; does not invent drama
- **Sibling to Reliant** — coordination and confirmation are both NTRR promises

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Backend / auth / sync | Supabase, Postgres, RLS |
| Frontend | Next.js (App Router), TypeScript |
| AI orchestration | Claude / Grok APIs (digest agents) |
| Integrations | Google Calendar (primary); Apple CalDAV / Zapier bridges |

Accessible UI (WCAG-minded). Mobile-responsive PWA shell.

---

## Project status

**v0.2.0** — coordination hub in active use for family care boards. Core flows work: Focus + My day, recurring daily care with one open card, Tasks sections, Google calendar sync, AI highlights.

| Release | Notes |
|---------|--------|
| **[0.2.0](CHANGELOG.md#0200--2026-08-15)** | Care board reliability: Focus Done, recurring start/complete, miss-day archive, Tasks sections |
| **0.1.0** | M0–M5 baseline: auth, family, tasks, Google/Apple sync, dashboard, AI agents |
| **1.0** (target) | Acceptance criteria in [docs/RELEASE-1.0.md](docs/RELEASE-1.0.md); Microsoft sync in **1.1** |

Full history: **[CHANGELOG.md](CHANGELOG.md)**. Resume notes: [docs/CHECKPOINT.md](docs/CHECKPOINT.md).

This is a solo passion project — built incrementally, validated with real caregivers, with an emphasis on reliability over speed.

### Local development

```bash
cp .env.example .env.local
# 1. Start Supabase locally (requires Docker) — first run downloads images (~5 min)
npm run db:start
# 2. Copy keys into .env.local (or run: npx supabase status -o env)
npm run db:status
# 3. Reset only works while Supabase is running
npm run db:reset
npm run dev
```

Magic-link emails appear in Mailpit: [http://127.0.0.1:54324](http://127.0.0.1:54324)

Open [http://localhost:3000](http://localhost:3000). Supabase Studio runs at [http://localhost:54323](http://localhost:54323).

---

## For developers & AI agents

| Doc | Audience | Purpose |
|-----|----------|---------|
| **README.md** *(this file)* | Humans | Vision, scope, roadmap |
| **[AGENTS.md](AGENTS.md)** | AI coding agents | Rules, conventions, code-generation guidance |
| **[docs/PLATFORM-MIGRATION.md](docs/PLATFORM-MIGRATION.md)** | Humans + agents | Domains, Vercel/Supabase migrate, Hub vs platform |

When using Cursor, Continue.dev, or similar tools in this repo:

> Following NTRR AGENTS.md rules, implement …

---

## Principles

1. Solve real pains from lived caregiving and guardianship experience
2. Reliability and trust over feature count
3. Ship lean, learn fast, extend modularly
4. Strong auth, encryption, and audit logs from day one

---

## License

TBD.