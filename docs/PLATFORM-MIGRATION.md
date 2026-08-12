# NTRR platform migration roadmap

**Status:** Source of truth for platform topology, domains, and production hosting  
**Audience:** Humans + AI agents implementing deploy and brand split  
**Last updated:** 2026-08-11  
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
- [x] Auth → **Site URL:** `https://hub.ntrr.com`
- [x] Auth → **Redirect URLs** include `https://hub.ntrr.com/auth/callback` (+ localhost for local dev)
- [x] Platform sending: Resend domain `ntrr.com` verified (DKIM + `send` SPF on Vercel DNS)
- [x] Hub Supabase **custom SMTP** → Resend; magic-link template “Sign in to NTRR” (platform-shared branding)
- [x] Magic link smoke test on `https://hub.ntrr.com` (2026-08-10)
- [ ] Enable Google provider for **sign-in** (Supabase Auth) — optional if email magic link is enough
- [x] Copy project URL, anon/publishable key, service_role key into password manager

#### 1.2 Google Cloud (Hub integrations)

Two Google uses stay distinct — **do not mix OAuth clients**:

| Use | Config surface | Production redirect / callback |
|-----|----------------|--------------------------------|
| Sign-in (“Continue with Google”) | **Supabase Auth** Google provider | Supabase `https://<project-ref>.supabase.co/auth/v1/callback` (or custom domain — see below) |
| Calendar + Tasks sync | App `GOOGLE_CLIENT_ID` / `SECRET` | `https://hub.ntrr.com/api/integrations/google/callback` |

**Integration client (Calendar + Tasks):**

- [ ] Enable Google Calendar API + Tasks API
- [ ] OAuth consent screen ready for testing / production
- [ ] Web client authorized JS origins: `https://hub.ntrr.com`, `http://localhost:3000`
- [ ] Authorized redirect URIs for **integration** client include Hub callback above + local equivalent
- [ ] Prefer Hub-dedicated OAuth client (or clearly labeled) vs Reliant’s client

#### 1.2a Google Auth branding / custom domain (sign-in)

**Why this exists:** Google’s consent screen shows **“Continue to &lt;redirect host&gt;”**. With default Supabase Auth that host is `abzudmcdwgqfbygdkctx.supabase.co`, not Hub. Hub code already returns users to `https://hub.ntrr.com/auth/callback` after OAuth; branding of the Google interstitial is controlled by **Google consent screen + Auth redirect host**, not Next.js copy.

**Supabase Auth URL (next to Site URL):**

| Setting | Production value |
|---------|------------------|
| Site URL | `https://hub.ntrr.com` |
| Redirect URLs | `https://hub.ntrr.com/auth/callback` (+ `http://localhost:3000/auth/callback` for local) |
| App env | `NEXT_PUBLIC_SITE_URL=https://hub.ntrr.com` |

- [x] Site URL + Hub redirect URL set (see §1.1)
- [ ] Supabase Auth → **Google** provider enabled; client ID/secret = **Auth** OAuth client (not Calendar client)
- [ ] Smoke: Continue with Google → lands on Hub with session

**Google Cloud — Auth OAuth client + consent screen:**

Use the client registered in Supabase Auth (not the Calendar/Tasks integration client unless intentionally shared).

- [ ] OAuth consent screen **App name:** `Hub` or `NTRR Hub`
- [ ] **Application home page:** `https://hub.ntrr.com`
- [ ] **Authorized domains:** `ntrr.com` (add `hub.ntrr.com` if the console requires it)
- [ ] Optional: app logo (Hub / NTRR icon)
- [ ] Authorized redirect URI for Auth client still includes  
  `https://abzudmcdwgqfbygdkctx.supabase.co/auth/v1/callback`  
  until a custom domain replaces it
- [ ] JS origins for Auth client as required by Google (often not used for pure server OAuth; follow Supabase docs for the provider)

**Removing “Continue to …supabase.co” (real fix):**

Google displays the **redirect URI hostname**. Site URL alone does not change that. To show ntrr/hub branding on the host line:

1. Supabase **custom domain** (typically Pro) for the Hub project, e.g. `https://api.hub.ntrr.com` or `https://auth.ntrr.com`
2. Complete DNS + verification in Supabase
3. Google Auth client: add  
   `https://<custom-domain>/auth/v1/callback`  
   as authorized redirect; cut over, then remove or keep `*.supabase.co` during transition
4. Update Hub env (`NEXT_PUBLIC_SUPABASE_URL`, etc.) if Supabase requires the custom API URL for clients
5. Retest Continue with Google

- [ ] Decide custom domain hostname (recommend `api.hub.ntrr.com` or `auth.ntrr.com`)
- [ ] Supabase custom domain verified
- [ ] Google Auth redirect URI updated to custom domain
- [ ] Env / docs updated; smoke test no longer shows `*.supabase.co` on consent

**Quick reference:**

| Goal | Where to fix |
|------|----------------|
| App name / logo on consent | Google OAuth consent screen (Auth client) |
| Land on Hub after login | Supabase Site URL + Redirect URLs + `NEXT_PUBLIC_SITE_URL` |
| “Continue to **hub/ntrr**” not supabase | Supabase custom domain + Google Auth redirect URI |

#### 1.3 Vercel (Hub app)

- [x] Import GitHub `sm00thindian/ntrr-hub` → Vercel project `ntrr-hub`
- [x] Production branch: `main`
- [x] Attach custom domain **`hub.ntrr.com`**
- [x] Set Production env vars (see [Environment matrix](#environment-matrix-hub)); Zapier optional
- [x] Deploy; build green; production at `https://hub.ntrr.com`
- [x] Crons in `vercel.json` (Hobby: max once/day per job):
  - `/api/cron/digest` — `0 6 * * *` (06:00 UTC daily)
  - `/api/cron/sync` — `0 12 * * *` (12:00 UTC daily; was every 6h — needs Pro to restore)

#### 1.4 DNS

- [x] `hub.ntrr.com` → Vercel (live)
- [x] `ntrr.com` / `www` — platform apex / redirect (existing)
- [x] Reliant stays on its own project/domain

#### 1.5 Smoke tests (Hub production)

- [x] Email magic link → lands on `hub.ntrr.com`, session sticks
- [ ] Google sign-in (Supabase Auth) — optional
- [ ] Create household + invite link uses `https://hub.ntrr.com/invite/…`
- [ ] Google Calendar/Tasks connect → OAuth returns to Hub Settings (redirect URI configured)
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

### Phase 6 — Cross-product identity + Reliant bridge (later)

**Do not start full SSO until Hub + Reliant auth are stable in production.**

**Product framing (locked for planning):**

- Hub core stays valuable without phone calls  
- **Reliant phone confirmation** from Hub items is an **optional tiered** service (or part of a **Hub + Reliant bundle**)  
- Cross-sell both products under NTRR (Settings + footers + apex)  
- Correlation key for v1: **`phone_e164`** (Reliant is phone-first; Hub stores optional mobile on `profiles`)

**Shipped foundation (not full bridge):**

- [x] `reliant_confirm_requested` on tasks / events / recurring templates  
- [x] `profiles.phone_e164` + Settings “Mobile for Reliant”  
- [x] Settings “NTRR services” cross-sell card + footer link to Reliant  
- [x] Docs: `docs/ROLES-AND-RELIANT.md` (tiers, metering, bundle)

**Still to build:**

| Step | Work |
|------|------|
| Phone in onboarding | Prompt for mobile after household create / first Reliant checkbox; optional SMS verify later |
| Link check | Resolve Hub assignee/focus → phone → Reliant identity before dialing |
| Confirm jobs | Enqueue series, map confirm back to Hub task/event |
| Entitlement | Gate live dials on Reliant sub / Hub add-on / bundle quota |
| SSO options (later) | A handoff token · B shared Auth · C parent cookies · D OIDC — pick one ADR |
| Voice / dials | [ADR 0001](./adr/0001-reliant-voice-grok-primary.md): Grok Voice primary; Twilio optional BYON |

- [x] ADR for Reliant voice stack (Grok primary) — implement later; see [CHECKPOINT deferred](./CHECKPOINT.md#later--reliant-voice--live-confirms-not-hub-mvp)  
- [ ] ADR for identity + billing of confirm series  
- [ ] Implement link + jobs behind feature flag  
- [ ] Bundle SKU in Stripe when ready  

**Exit Phase 6:** Phone-correlated Hub member can receive a metered Reliant confirm for a Hub task; products remain separately marketable with a clear bundle.

See also: [ROLES-AND-RELIANT.md](./ROLES-AND-RELIANT.md) · [ADR 0001](./adr/0001-reliant-voice-grok-primary.md).

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

### Product / Settings UI later (hidden from dogfood Settings)

- **Zapier / Make webhook card** — re-enable `ZapierWebhookCard` on Settings; API already at `/api/webhooks/zapier` (Apple Reminders → tasks). Needs `ZAPIER_WEBHOOK_SECRET` on Vercel.
- **Microsoft Graph sync (1.1)** — Outlook Calendar + To Do; Settings “Connect Microsoft” card; implement `lib/sync/microsoft/` (stub exists). See RELEASE-1.0 §1.1.

### Product / later

- **My day view** for `self_advocate` persona + RLS tightening
- **Reliant confirm pipe** — enqueue phone confirmation when `reliant_confirm_requested` and resolve assignee / focus person → Reliant (see `docs/ROLES-AND-RELIANT.md`)
- Calendar event UI toggle for `reliant_confirm_requested` (column exists; task create checkbox ships first)
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
