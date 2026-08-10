# NTRR — agent instructions

**NTRR** (Not The Run Around / Nexus Task & Resource Relay) is the **platform brand** for practical reliability tools. The **Family Care Orchestrator** product in this repo is **Hub** — a secure, AI-powered dashboard for sandwich-generation families, guardians of adult disabled children, and multi-generational households.

| Layer | Host |
|-------|------|
| Platform / brand | [ntrr.com](https://ntrr.com) |
| **Hub** (this app) | [hub.ntrr.com](https://hub.ntrr.com) |
| Reliant (sibling product) | [reliant.ntrr.com](https://reliant.ntrr.com) |

**Production hosting + domain migration:** [docs/PLATFORM-MIGRATION.md](docs/PLATFORM-MIGRATION.md) is the source of truth.

---

## Mission

Build a reliable **single source of truth** that works *with* users' existing tools rather than replacing them. Reduce cognitive load and burnout by abstracting ecosystem fragmentation (Google, Apple, Microsoft) while delivering proactive orchestration, reliable data synthesis, and meaningful insights.

Focus on practical Gen X caregivers who want no-BS efficiency, family alignment, and peace of mind.

---

## Key differentiation

- **Cross-ecosystem sync** — Google / Apple / Microsoft calendars and tasks
- **Unified dashboard** — Role-based views; linked tasks, docs, and expenses
- **Proactive AI agents** — Synthesis, conflict detection, reminders, insights
- **Provenance & audit** — Strong provenance, audit trails, lightweight reporting (guardianship / SSA friendly)
- **Privacy-first** — User-controlled data; lighter regulatory path (avoid clinical data initially)

---

## Target users & tone

**Users:** Gen X sandwich caregivers, guardians, multi-generational families — practical, time-strapped, value reliability.

**Tone:** Professional, calm, trustworthy, empowering. No hype, no fluff.

**UX:** Quick scans, low friction, Gen X-friendly. Prioritize clarity over cleverness.

---

## MVP scope (coordination hub)

Ship lean; extend later into documents, finance, and legacy features.

| Area | MVP deliverable |
|------|-----------------|
| Sync | Calendar/task sync across ecosystems |
| Tasks | Shared family task board with roles, permissions, recurring templates |
| Dashboard | Today's priorities, family status, AI highlights |
| AI | Basic agents: reminders, conflicts, suggestions |
| Onboarding | Family invite flow |
| Client | Mobile-responsive PWA |

---

## Non-goals (MVP)

- Heavy medical/clinical features (HIPAA scope)
- Overly complex AI or full replacements of Google / Apple / Microsoft

---

## Technical stack

| Layer | Choice |
|-------|--------|
| Backend / sync / permissions | Supabase / Postgres |
| Frontend | Next.js or similar |
| AI orchestration | Claude / Grok APIs (or local) |
| Initial integrations | Zapier / Make |

**Language:** TypeScript preferred. Accessible UI.

---

## Architecture principles

### Data reliability (non-negotiable)

Always track **provenance**: source, timestamp, confidence. Synthesize meaningfully; flag inconsistencies for user confirmation. Never silently merge conflicting data.

### Privacy & security

Strong auth, encryption, and audit logs from day one. User-controlled data. Design for extensibility without over-collecting.

### Solo-friendly development

Keep code clean, modular, and well-documented. Prefer simple, maintainable solutions over clever abstractions. Use AI assistance heavily but review for correctness.

### Extensibility

Design with future **document vault** and **finance** modules in mind. Modular architecture; loose coupling between sync, dashboard, and AI layers.

### NTRR sibling: Reliant

- **Reliant** (`reliant.ntrr.com`) is phone-first reliability; Hub is the family board  
- Phone confirmation of Hub tasks is an **optional tiered** bridge (or **Hub + Reliant bundle**), not free unlimited forever — see [docs/ROLES-AND-RELIANT.md](docs/ROLES-AND-RELIANT.md)  
- Correlate members via optional **`profiles.phone_e164`** (same number as Reliant); cross-sell sibling services in Settings/footer  
- Keep products loosely coupled; don’t merge auth stacks without Phase 6 ADR

---

## Development principles

1. Solve real pains from lived caregiving / guardianship experience
2. Prioritize reliability, simplicity, and trust
3. Build incrementally — validate early with real users
4. Maintain work-life balance; this is a passion bootstrap project
5. Include error handling, loading states, and data provenance in every feature

---

## When generating code or plans

- Reference the unified dashboard / orchestrator vision
- Suggest practical Gen X-friendly UX (quick scans, low friction)
- Include error handling, loading states, and data provenance
- Ask for clarification on scope if ambiguous
- Do not expand scope into non-goals without explicit approval

### Code style

- Clean, commented TypeScript
- Accessible UI (WCAG-minded)
- Match existing patterns in the repo when present
- Prefer small, focused diffs

---

## Success criteria

- Functional MVP that provides clear time savings
- Secure, reliable data handling
- Easy family adoption and a clear extensibility path

---

## Prompt shorthand

When working in this repo, agents may be invoked with:

> Following NTRR AGENTS.md rules, implement …

Always align output with coordination-hub MVP scope unless the user explicitly requests otherwise.