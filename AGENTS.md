# NTRR — agent instructions

**Not The Runaround** (**NTRR**) is the **platform brand**. The **Family Care Orchestrator** product in this repo is **Hub**.

| Layer | Exact form | Host |
|-------|------------|------|
| Platform / brand | Not The Runaround | [ntrr.com](https://ntrr.com) |
| **Hub** (this app) | Hub | [hub.ntrr.com](https://hub.ntrr.com) |
| Sibling | Reliant | [reliant.ntrr.com](https://reliant.ntrr.com) |

**Naming rule:** brand = `Not The Runaround` (headers, footers, ©, legal, “a Not The Runaround service”); product UI = `Hub`. Never `Not The Run Around` (spaced).

**Chrome / wordmark rule (NTRR family):** show the product mark (icon + product name + platform line) **once per viewport**. With a persistent sidebar, the mark lives in the sidebar and the top bar is place/account only (`lg:hidden` on the header logo). On mobile (no sidebar), the mark stays in the top bar. Single-header products (Reliant, ntrr.com) already use one mark — do not add a second. Do not stack the same lockup in sidebar **and** main header.

**Production hosting + domain migration:** [docs/PLATFORM-MIGRATION.md](docs/PLATFORM-MIGRATION.md) is the source of truth.

---

## Mission

Build a reliable **coordination layer** that works *with* users' existing tools rather than replacing them. Reduce cognitive load by abstracting ecosystem fragmentation (Google, Apple, Microsoft) while delivering proactive orchestration, reliable data synthesis, and meaningful insights.

**Hub's promise:** *You shouldn't have to think about this to have it work.* Copy mode: **subtraction** — one less call, one less thing to remember.

**Platform stance (NTRR):** two kinds of runaround — *managing it* (Hub) and *hoping it gets done* (Reliant). Do not imply either product is unnecessary. Full framing: [ntrr-com `docs/positioning.md`](https://github.com/sm00thindian/ntrr-com/blob/main/docs/positioning.md).

Focus on practical Gen X caregivers who want no-BS efficiency, family alignment, and calm competence.

---

## Key differentiation

- **Subtraction language** — ease is the product; no hype, no crisis framing
- **Cross-ecosystem sync** — Google / Apple / Microsoft calendars and tasks
- **Unified dashboard** — Role-based views; linked tasks, docs, and expenses
- **Proactive AI agents** — Synthesis, conflict detection, reminders, insights
- **Provenance & audit** — Strong provenance, audit trails, lightweight reporting (guardianship / SSA friendly)
- **Privacy-first** — User-controlled data; lighter regulatory path (avoid clinical data initially)
- **Sibling to Reliant** — follow-through confirmations are Reliant's half of the story

---

## Target users & tone

**Users:** Gen X sandwich caregivers, guardians, multi-generational families — practical, time-strapped, value reliability.

**Tone:** Professional, calm, trustworthy, empowering. No hype, no fluff, no clinical/crisis drama.

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
- Phone confirmation of Hub tasks is an **optional tiered** bridge (or **Hub + Reliant bundle**) — see [docs/ROLES-AND-RELIANT.md](docs/ROLES-AND-RELIANT.md)  
- **Account vs call target:** coordinator holds the **Reliant account** (billing); Reliant may **dial** a care partner or self-advocate’s Hub mobile for completion — they need a number, not their own Reliant sub  
- Member mobiles: `profiles.phone_e164` / invite phone = call target; cross-sell in Settings/footer  
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