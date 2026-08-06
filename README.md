# NTRR

**Nexus Task & Resource Relay** — a secure, AI-powered Family Care Orchestrator.

One intelligent dashboard for sandwich-generation families, guardians of adult disabled children, and multi-generational households. NTRR reduces cognitive load by unifying calendars, tasks, and family coordination across the tools you already use — without asking you to rip and replace Google, Apple, or Microsoft.

→ Platform: [ntrr.com](https://ntrr.com) · Hub product: [hub.ntrr.com](https://hub.ntrr.com)  
→ Hosting / domain roadmap: [docs/PLATFORM-MIGRATION.md](docs/PLATFORM-MIGRATION.md)

---

## The problem

Caregiving families juggle fragmented ecosystems:

- Calendars and tasks spread across Google, Apple, and Microsoft
- No shared view of who is doing what, when conflicts arise, or what needs attention today
- Guardians and caregivers need reliable records — not another app that loses context

The result is constant mental overhead, missed handoffs, and burnout.

## The solution

NTRR is a **coordination hub** — not a replacement for your existing tools.

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
| **Cross-ecosystem sync** | Calendars and tasks from Google, Apple, Microsoft |
| **Family task board** | Shared tasks with roles, permissions, recurring templates |
| **Unified dashboard** | Today's priorities, family status, AI highlights |
| **AI agents** | Reminders, schedule conflicts, actionable suggestions |
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

## What makes NTRR different

- **Cross-ecosystem** — meets families where they already live
- **Provenance-first** — every synthesized fact traces to a source
- **Audit-friendly** — lightweight trails suitable for guardianship and SSA contexts
- **Privacy-first** — user-controlled data; no clinical scope in MVP
- **Proactive, not noisy** — AI that helps, not chatbots for chatbots' sake

---

## Tech stack

| Layer | Planned |
|-------|---------|
| Backend / auth / sync | Supabase, Postgres |
| Frontend | Next.js (or similar) |
| AI orchestration | Claude / Grok APIs (local option later) |
| Early integrations | Zapier / Make |

TypeScript throughout. Accessible UI (WCAG-minded).

---

## Project status

**Early bootstrap.** Vision, agent guidelines, and the [1.0 release plan](docs/RELEASE-1.0.md) are defined; application code is not yet scaffolded.

This is a solo passion project — built incrementally, validated with real caregivers, with an emphasis on reliability over speed.

**1.0 scope:** Google bidirectional sync + Apple CalDAV/Zapier bridge, family task board, unified dashboard, basic AI agents, responsive PWA. Microsoft sync ships in **1.1**.

### Local development (M0+)

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