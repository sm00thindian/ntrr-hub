# NTRR platform migration roadmap

**Status:** Source of truth for platform topology, domains, and production hosting  
**Audience:** Humans + AI agents implementing deploy and brand split  
**Last updated:** 2026-08-07  
**Related:** [RELEASE-1.0.md](./RELEASE-1.0.md) · [CHECKPOINT.md](./CHECKPOINT.md) · [AGENTS.md](../AGENTS.md) · Reliant `../reliant` · Apex site [`ntrr-com`](https://github.com/sm00thindian/ntrr-com)

---

## Purpose

This document locks decisions while we:

1. Split **NTRR (platform/brand)** from the **Family Care Orchestrator product (Hub)**
2. Move Hub production hosting to **Vercel + hosted Supabase**
3. Keep **Reliant** as a sibling product under the same brand (separate runtime)

When env URLs, OAuth redirects, Supabase Site URL, or “where does the app live?” conflict with older docs, **this file wins** until explicitly revised.

---

## Target topology

```text
Not The Run Around (brand / company)
│
├── ntrr.com                 Platform home — repo ntrr-com (Vercel)
│
├── hub.ntrr.com             Family Care Orchestrator — this repo (ntrr-hub)
│     ├── Vercel             Next.js app + cron
│     └── Supabase           Auth, Postgres, RLS (Hub project only)
│
└── reliant.ntrr.com         Reliant — phone-first reliability (../reliant)
      ├── Vercel             Next.js dashboard + Inngest serve
      ├── Supabase           Separate project (phone identity)
      ├── Railway            voice-bridge (always-on Twilio ↔ Grok)
      ├── Inngest Cloud      Due / escalate / free-busy gates
      ├── Twilio             Voice + SMS
      └── xAI                Grok Voice
```

### Product naming

| Layer | Name | Host | Repo |
|-------|------|------|------|
| Company / platform | **Not The Run Around** / **NTRR** | `ntrr.com` | [`ntrr-com`](https://github.com/sm00thindian/ntrr-com) |
| Family coordination product | **Hub** (UI: “NTRR Hub” / “Family Hub” OK) | `hub.ntrr.com` | [`ntrr-hub`](https://github.com/sm00thindian/ntrr-hub) (this repo) |
| Phone reliability product | **Reliant** | `reliant.ntrr.com` | `reliant` |

**Rule:** “NTRR” is the parent brand. Product UIs and legal footers say *a Not The Run Around service* (same pattern as Reliant today). Do not treat the Hub app as the entire company forever.

---

## Non-goals (this migration)

- Shared login / SSO across Hub and Reliant (later phase)
- Merging Hub and Reliant Supabase projects
- Putting voice-bridge or Inngest on the Hub Vercel project
- Shipping document vault, finance, or Microsoft sync as part of migrate
- Replacing Reliant’s deploy docs — link them; don’t rewrite here

---

## Principles

1. **Product subdomains, brand on apex** — Hub never permanently owns `ntrr.com` as the sole product app.
2. **Separate data planes** — Hub Supabase ≠ Reliant Supabase until an explicit identity design says otherwise.
3. **Separate OAuth clients (or at least redirect URIs)** — Hub Google Calendar/Tasks callbacks on `hub.ntrr.com`; Reliant Google on `reliant.ntrr.com`; Supabase Auth Google is per project.
4. **Ship hosting before polish** — production URLs and secrets first; marketing site and copy second.
5. **No silent domain flips** — magic links, invites, Google redirects, and PWA installs break if Site URL is wrong; change env + provider consoles together.
6. **Solo-friendly** — prefer checklists and one production path; avoid multi-env matrix until needed.

---

## Current state → target

| Area | Today | Target |
|------|--------|--------|
| Hub app URL | Local `localhost:3000`; docs say deploy to `ntrr.com` | **`https://hub.ntrr.com`** |
| Apex | Assumed = family app | **Platform home** (thin) |
| Hub database | Local Supabase Docker | **Hosted Supabase** (project e.g. `ntrr-hub`) |
| Hub host | Local Next | **Vercel** (repo `sm00thindian/ntrr-hub`) |
| Auth | Email magic link + Google OAuth (Supabase) | Same providers; production SMTP + Site URL = hub |
| AI agents | Rule-based (no LLM keys) | Unchanged for migrate |
| Cron | `vercel.json` (digest daily, sync 6h) | Enable on Vercel production |
| Reliant | Separate product; `reliant.ntrr.com` in its docs | Unchanged topology |
| Cross-product signup | Not built | Phase D (phone-first from Reliant) |

---

## Phased roadmap

### Phase 0 — Decisions locked ✅

- [x] NTRR = platform/brand; Hub = family product at `hub.ntrr.com`
- [x] Reliant remains `reliant.ntrr.com` with its own stack
- [x] Separate Supabase per product for production v1
- [x] This doc is source of truth for domain + hosting migration

**Exit:** Team/agents use this file for URL and env questions.

---

### Phase 1 — Hub production foundations (Vercel + Supabase)

**Goal:** Hub runs at `https://hub.ntrr.com` against hosted Supabase with real auth.

#### 1.1 Hosted Supabase (Hub)

- [x] Create Supabase project for Hub only (`ntrr-hub` → `https://abzudmcdwgqfbygdkctx.supabase.co`)
- [x] Apply all migrations in `supabase/migrations/` in order (`supabase db push`; invites migration uses `extensions.gen_random_bytes`)
- [ ] Auth → **Site URL:** `https://hub.ntrr.com` (use Vercel preview URL first if domain not attached yet)
- [ ] Auth → **Redirect URLs** include:
  - `https://hub.ntrr.com/auth/callback`
  - `http://localhost:3000/auth/callback` (local dev)
  - Production/preview: exact `https://<deployment>.vercel.app/auth/callback` after first deploy
- [x] Platform sending: Resend domain `ntrr.com` verified (DKIM + `send` SPF on Vercel DNS)
- [ ] Hub Supabase **custom SMTP** → Resend (`smtp.resend.com`, sender `Hub` / `noreply@ntrr.com`)
- [x] Custom magic-link HTML template deferred (free tier); default ConfirmationURL + app `code` exchange works
- [ ] Enable Google provider for **sign-in** (Supabase Auth) with Google Cloud OAuth client that includes Supabase callback URL
- [x] Copy project URL, anon/publishable key, service_role key into password manager

#### 1.2 Google Cloud (Hub integrations)

Two Google uses stay distinct:

| Use | Config surface | Production redirect / callback |
|-----|----------------|--------------------------------|
| Sign-in | Supabase Auth Google | Supabase `…/auth/v1/callback` |
| Calendar + Tasks sync | App `GOOGLE_CLIENT_ID` / `SECRET` | `https://hub.ntrr.com/api/integrations/google/callback` |

- [ ] Enable Google Calendar API + Tasks API
- [ ] OAuth consent screen ready for testing / production
- [ ] Web client authorized JS origins: `https://hub.ntrr.com`, `http://localhost:3000`
- [ ] Authorized redirect URIs for **integration** client include Hub callback above + local equivalent
- [ ] Prefer Hub-dedicated OAuth client (or clearly labeled) vs Reliant’s client

#### 1.3 Vercel (Hub app)

- [ ] Import GitHub `sm00thindian/ntrr-hub` → Vercel project (suggestion: `ntrr-hub`)
- [ ] Production branch: `main`
- [ ] Attach custom domain **`hub.ntrr.com`**
- [ ] Set Production env vars (see [Environment matrix](#environment-matrix-hub))
- [ ] Deploy; confirm build green
- [ ] Confirm Crons registered from `vercel.json`:
  - `/api/cron/digest` — `0 6 * * *`
  - `/api/cron/sync` — `0 */6 * * *`

#### 1.4 DNS

- [ ] `hub.ntrr.com` → Vercel (CNAME or A as Vercel instructs)
- [ ] `ntrr.com` / `www` — either thin platform page (Phase 2) or temporary redirect to Hub **only if** Phase 2 is delayed; document the choice
- [ ] Do not point Reliant DNS at Hub Vercel project

#### 1.5 Smoke tests (Hub production)

- [ ] Email magic link → lands on `hub.ntrr.com`, session sticks
- [ ] Google sign-in → same
- [ ] Create household + invite link uses `https://hub.ntrr.com/invite/…`
- [ ] Google Calendar/Tasks connect → OAuth returns to Hub Settings
- [ ] Manual cron: `Authorization: Bearer $SYNC_CRON_SECRET` on digest + sync
- [ ] Wait for or trigger scheduled cron; check logs
- [ ] PWA manifest loads over HTTPS; install optional

**Exit Phase 1:** Caregivers can use Hub on `hub.ntrr.com` without a laptop-local stack.

---

### Phase 2 — Platform apex (`ntrr.com`)

**Goal:** Apex represents Not The Run Around, not only Hub.

Repo: [`sm00thindian/ntrr-com`](https://github.com/sm00thindian/ntrr-com) (stubbed 2026-08-07).

- [x] Dedicated apex repo with thin Next.js product directory (Hub + Reliant cards, contact)
- [ ] Vercel: import `ntrr-com` as its own project (not Hub/Reliant)
- [ ] Domains: attach `ntrr.com` + `www` (redirect www → apex or vice versa)
- [ ] Confirm Hub/Reliant subdomains stay on their projects (Vercel already manages DNS zone)
- [ ] Optional: `ntrr.com/hub` → 302 to `https://hub.ntrr.com`
- [ ] Reliant footer already points at `ntrr.com` — verify link still correct
- [ ] Update marketing/README claims: company site vs product hosts

**Exit Phase 2:** Visitors landing on `ntrr.com` understand there are multiple services.

---

### Phase 3 — Brand and copy alignment (Hub product)

**Goal:** UI and docs call this product **Hub** under the NTRR brand.

- [x] Login / landing: product name “Hub”; parent “Not The Run Around” (aligned with Reliant / ntrr-com zinc + green theme)
- [x] Footer pattern aligned with Reliant (“a Not The Run Around service”)
- [x] PWA `name` / `short_name`: “Hub — Family Care Orchestrator” / `Hub`
- [x] Magic-link email body: Hub (`supabase/templates/magic_link.html`)
- [x] Production login copy: no Mailpit references (dev-only helper remains)
- [ ] Update [AGENTS.md](../AGENTS.md), [README.md](../README.md), [RELEASE-1.0.md](./RELEASE-1.0.md), [CHECKPOINT.md](./CHECKPOINT.md) deploy URLs to `hub.ntrr.com` (mostly done; pass for any stale copy)
- [x] GitHub repo renamed to `ntrr-hub` (2026-08-07); package name set to `ntrr-hub`

**Exit Phase 3:** A new user never confuses Hub with the whole company.

---

### Phase 4 — Hardening (overlap with RELEASE-1.0 M6)

Keep M6 quality work, but ship against **hub** hosts.

- [ ] RLS security audit
- [ ] `INTEGRATION_ENCRYPTION_KEY` required in prod; rotate if any local key was reused
- [ ] Webhook/API rate limits where applicable
- [ ] Playwright smoke against `hub.ntrr.com` (or staging)
- [ ] Accessibility + performance pass
- [ ] Privacy policy + onboarding copy (Hub-specific URLs)
- [ ] Beta with 3–5 caregiver households on Hub production
- [ ] Tag Hub v1.0.0 when RELEASE-1.0 acceptance is met

**Exit Phase 4:** Hub is trustworthy for real households.

---

### Phase 5 — Reliant coordination (parallel, not blocking Hub)

Owned primarily in `../reliant` docs; track only cross-platform touchpoints here.

- [ ] Reliant production on `reliant.ntrr.com` (Vercel)
- [ ] voice-bridge on Railway; Twilio webhooks; Inngest cloud
- [ ] Legal pages live; support email `support@ntrr.com`
- [ ] Brand links to `ntrr.com` platform home (Phase 2)
- [ ] Document shared password-manager inventory (both products)

**Exit Phase 5:** Both products demoable with laptop closed.

---

### Phase 6 — Cross-product identity (later)

**Do not start until Hub + Reliant auth are stable in production.**

Goal: phone-first signup (Reliant strength) can seed or link a Hub account.

Options to evaluate then (pick one; don’t build all):

| Option | Sketch |
|--------|--------|
| A. Explicit handoff | Reliant issues one-time link/token; Hub creates/links session |
| B. Shared Supabase Auth project | One IdP, multiple apps — largest design cost |
| C. Parent-domain cookies (`.ntrr.com`) | Only with shared auth design |
| D. OIDC / third-party IdP | Overkill for bootstrap unless forced |

- [ ] Write short ADR when chosen
- [ ] Implement behind feature flag
- [ ] Update this doc with chosen approach

**Exit Phase 6:** Documented path from phone identity → Hub household.

---

## Environment matrix (Hub)

### Production (Vercel + hosted Supabase)

| Variable | Value / notes |
|----------|----------------|
| `NEXT_PUBLIC_SITE_URL` | `https://hub.ntrr.com` |
| `NEXT_PUBLIC_SUPABASE_URL` | Hosted Hub project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable / anon |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret; server only |
| `GOOGLE_CLIENT_ID` | Hub integration OAuth client |
| `GOOGLE_CLIENT_SECRET` | Server only |
| `INTEGRATION_ENCRYPTION_KEY` | Long random; **required** in prod |
| `SYNC_CRON_SECRET` | Long random; manual cron + defense in depth |
| `ZAPIER_WEBHOOK_SECRET` | If Apple Reminders ingest enabled |

Not required for Hub migrate: `XAI_*`, Twilio, Inngest, Railway.

### Local development

| Variable | Value / notes |
|----------|----------------|
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` (or LAN via `npm run dev:lan`) |
| Supabase | Local Docker **or** hosted branch/project for shared beta |
| Google redirects | Local callback on same OAuth client or a “dev” client |

Keep `.env.example` aligned with this matrix when env names change.

---

## Provider checklist (Hub go-live)

| Provider | Must configure |
|----------|----------------|
| **DNS** | `hub.ntrr.com` → Vercel; apex per Phase 2 |
| **Vercel** | Project, domain, env, crons, deploy |
| **Supabase** | Project, migrations, Site URL, redirects, SMTP, Auth Google |
| **Google Cloud** | APIs, consent, Auth + integration OAuth clients/URIs |
| **Email SMTP** | Deliverability for magic links |
| **Zapier/Make** (optional) | Webhook URL `https://hub.ntrr.com/api/webhooks/zapier` + secret |
| **Password manager** | All secrets + recovery for Vercel/Supabase/Google |

---

## Cutover playbook (first production deploy)

Use this sequence once Phase 1 assets exist:

1. Supabase project live; migrations applied; Auth Site URL + SMTP verified with a test user on a temporary Vercel URL if needed.
2. Set Vercel env with **`NEXT_PUBLIC_SITE_URL=https://hub.ntrr.com`** (or temporary `*.vercel.app` only for a dry run — then flip Site URL + env together).
3. Attach `hub.ntrr.com`; wait for TLS.
4. Update Google OAuth redirect URIs for Hub.
5. Redeploy Vercel (env + domain).
6. Run [Phase 1.5 smoke tests](#15-smoke-tests-hub-production).
7. Only then invite beta households.
8. Schedule Phase 2 apex if still a parking page.

**Rollback:** Keep previous Vercel deployment; revert DNS if needed. Supabase data stays; do not “reset” production DB casually.

---

## Explicitly deferred (do not block migrate)

### Do next (platform ops — top of pile after first Hub URL works)

1. **`support@ntrr.com` human inbox** — set up a **forwarder** (ImprovMX / ForwardEmail / etc.) or Google Workspace so mail to `support@` reaches a real person. Not Resend receiving MX (that is API inbound, not a mailbox). Keep Resend on `send` + DKIM for Auth outbound. Do this before partners rely on footer `support@ntrr.com`.
2. **Reliant Supabase SMTP** — same Resend API key / domain; sender name `Reliant` / `noreply@ntrr.com`.
3. **Optional DMARC** — TXT `_dmarc` = `v=DMARC1; p=none;` on Vercel DNS.

### Product / later

- Microsoft Graph sync (RELEASE 1.1)
- Shared SSO / phone-first Hub signup (Phase 6)
- Hub LLM API (agents are rule-based today)
- Apple CalDAV shared service account (user-owned credentials)
- Multi-region HA, Supabase branching matrix, staging env clone (add when beta load requires it)
- Custom Supabase email templates (requires Pro) — optional polish

---

## Doc ownership

| Doc | Role after this roadmap |
|-----|-------------------------|
| **This file** | Domains, hosting, migration phases, env matrix |
| [RELEASE-1.0.md](./RELEASE-1.0.md) | Product MVP feature acceptance for Hub |
| [CHECKPOINT.md](./CHECKPOINT.md) | Session resume / feature status |
| [AGENTS.md](../AGENTS.md) | Coding rules; should link here for deploy URLs |
| Reliant docs | Reliant-only stack (Railway, Twilio, Inngest) |

When completing a phase, check boxes in this file and note the date under **Last updated**.

---

## One-line summary

**Ship Hub on Vercel + Supabase at `hub.ntrr.com`; keep `ntrr.com` as platform; leave Reliant on its own product stack; share brand now, share identity later.**
