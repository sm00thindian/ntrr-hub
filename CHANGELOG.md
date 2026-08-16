# Changelog

All notable changes to **Hub** (Not The Runaround) are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/) for product milestones (pre-1.0: `0.y.z` may include meaningful UX/behavior changes).

---

## [Unreleased]

### Changed

- **Google Calendar OAuth is read-only**: Hub requests list + events read scopes only (multi-calendar select still works). Does not create or edit Google events. Existing dogfood connections should **Reconnect** in Settings once.

---

## [0.2.0] — 2026-08-15

Care board reliability release: Focus, recurring daily care, and the Tasks board behave like a single source of truth caregivers can trust.

### Added

- **Focus** household day board (caregiver dashboard): Hub tasks + shared calendars, with calm **Tomorrow** look-ahead for one-offs only (“outside the usual”).
- **My day** board for self-advocate persona (own tasks + relevant calendars).
- Tasks board **sections**: needs attention / overdue, today, upcoming, done today, and one-off **history**.
- Recurring templates: **pause** open card vs **delete series**, cadence chips, due-time presets.
- Quiet **live refresh** on caregiver Focus and My day (background calendar pull while the tab is open).
- Manual Google sync **full calendar pull** so new family-calendar events are not missed.
- Household vs personal **calendar visibility** (member connections); Hub as task source of truth (Google Tasks sync off by default).

### Fixed

- **Daily recurring start / complete**: first open instance can start today (even after the usual clock time); completing advances to **tomorrow**, not day-after-tomorrow.
- **One open card per series**: missed prior-day opens are **archived** (`cancelled`, hidden from the board, still tracked); only the **current household day** stays completable.
- **Focus Done feedback**: marking Done turns the row green and keeps completed-today work visible; no longer replaced by tomorrow’s next open instance looking like “still open.”
- Task **remove / delete series** reliability (verified cancels, clear series rows, surfaced errors).
- Self-advocate complete path and false-green Done regressions after live refresh.

### Changed

- Dashboard copy: **Needs attention** → **Focus**; calmer Tomorrow empty-state language.
- Brand positioning aligned with **Not The Runaround** (ntrr.com / hub.ntrr.com).
- Tasks UI: scannable sections, relative due labels, cleaner chips (assignee left of title on Focus).

### Notes for operators

- Refresh dashboard/tasks after deploy so ensure + miss-day roll-forward runs once per household load.
- Recurring miss archives use `status: cancelled` with system provenance (`archiveReason: missed_occurrence`); user pause of the **current** open still pauses the series.

---

## [0.1.0] — 2026-07

Initial coordination-hub baseline (M0–M5 era): Supabase auth/RLS, family invites & roles, task board + recurring templates, Google Calendar sync + conflicts, Apple CalDAV / Zapier bridges, unified dashboard shell, AI highlights agents, calendar views, responsive PWA shell.

See [docs/CHECKPOINT.md](docs/CHECKPOINT.md) and [docs/RELEASE-1.0.md](docs/RELEASE-1.0.md) for milestone history and 1.0 acceptance criteria.

---

[0.2.0]: https://github.com/sm00thindian/ntrr-hub/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/sm00thindian/ntrr-hub/releases/tag/v0.1.0
