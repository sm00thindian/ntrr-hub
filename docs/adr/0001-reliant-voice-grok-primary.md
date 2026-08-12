# ADR 0001 — Reliant voice: Grok Voice Agent primary, Twilio optional BYON

| Field | Value |
|-------|--------|
| **Status** | Accepted (direction); **implementation deferred** |
| **Date** | 2026-08-12 |
| **Product** | Reliant (phone-first); Hub only as intent bridge |
| **Deciders** | NTRR (solo / bootstrap) |
| **Related** | [ROLES-AND-RELIANT.md](../ROLES-AND-RELIANT.md) · [PLATFORM-MIGRATION.md](../PLATFORM-MIGRATION.md) Phase 6 · [AGENTS.md](../../AGENTS.md) |

---

## Context

Hub marks tasks with `reliant_confirm_requested` but does **not** place calls yet. Live confirmation is productized as an optional tier powered by the **coordinator’s Reliant account**, dialing the assignee / focus person’s Hub mobile.

Historically a “full stack” phone path looked like:

```text
Twilio (or similar) + STT + TTS + LLM + custom call state machine + webhooks
```

xAI’s **Grok Voice Agent Builder** (and related voice models) offers speech-to-speech agents, tools, stats, conversation export, and numbers — including **import / bring numbers from Twilio** (or SIP from major carriers). That changes the default build path for Reliant’s first real outbound confirm agent.

We need a locked direction so dogfood does not invent a second phone AI stack inside Hub, and so “later” work has a clear target.

---

## Decision

1. **Grok Voice Agent is the primary conversation engine for Reliant phone confirms.**  
   Prefer Agent Builder / Grok Voice APIs for the spoken dialog, tools, and call analytics over assembling STT + TTS + LLM ourselves.

2. **Hub never owns the voice stack.**  
   Hub remains the family board + intent (`reliant_confirm_requested`, dial-target mobiles, future `reliant_confirm_jobs`). Outbound voice runs only under **Reliant** (or a thin Reliant service that Hub enqueues).

3. **Telephony numbers are secondary to the agent.**  
   - **Dogfood / Phase A:** xAI-provisioned (or free) number for speed.  
   - **Phase B (optional):** import / SIP a **Twilio** (or other) number if we need a stable branded line or existing number continuity (**BYON**).  
   - **Phase C:** drop Twilio only if xAI telephony + portability meet production needs.

4. **Twilio is optional BYON / SIP, not the AI brain.**  
   We do **not** commit to a Twilio-centric IVR + third-party voice AI pipeline as the long-term default. We also do **not** mandate ripping Twilio out before Grok Voice dogfood succeeds.

5. **Billing and entitlement stay NTRR’s domain.**  
   Confirm-series metering still hangs on the **coordinator Reliant** (or Hub+Reliant bundle). Grok minutes are a cost of goods line under that entitlement — not a reason to bill call targets or put Grok keys in Hub client code.

---

## Target architecture (later)

```text
Hub
  task due + reliant_confirm_requested
  resolve dial target (assignee → focus person → soft fail)
       │
       ▼  confirm job (entitlement, retry policy, audit)
Reliant
       │
       ▼  outbound
Grok Voice Agent  ──tools/webhooks──►  Reliant / Hub APIs
  (complete | needs help | no answer | decline)
       │
       ▼
Number: xAI-provisioned  OR  Twilio/SIP BYON
```

### In scope for Reliant later

- Confirm agent prompt + guardrails (calm, short, Gen X–friendly; no clinical advice)  
- Tools: mark complete, report blocker, request human follow-up  
- Quiet hours / max dials per series  
- Call stats (minutes, outcomes) for coordinator-facing usage later  
- Dogfood checklist: one agent, one number, one household allowlist  

### Out of scope for this ADR

- Shared Hub ↔ Reliant SSO (separate Phase 6 identity ADR)  
- Hub embedding Grok Voice in the browser  
- Full replacement of Reliant product with “just Agent Builder SaaS” branding  
- Multi-language or enterprise SIP fleets at launch  

---

## Consequences

### Positive

- Fewer moving parts for first live confirm calls  
- Better conversational quality than DTMF-only IVR for care handoffs  
- Aligns with optional-tier Reliant product story without bloating Hub MVP  
- Number portability path remains (Twilio/SIP BYON)  

### Negative / risks

- Vendor concentration on xAI for voice quality + (often) telephony  
- Beta surface area (Agent Builder, models, pricing) may change  
- Still need reliable **outbound** scheduling, retries, and audit — Agent Builder does not replace confirm-job design  
- Care-context compliance (recording consent, sensitive copy) must be designed deliberately  

### Mitigations

- Keep job queue + dial-target resolution in NTRR-controlled code  
- Start allowlisted dogfood; instrument outcomes before paid tiers  
- Document escape hatch: re-point agent tools to a different voice provider without changing Hub schema  

---

## Dogfood checklist (when implementation starts)

- [ ] Create Reliant confirm agent in Grok Voice Agent Builder (Think Fast or current production model)  
- [ ] Tools → Reliant/Hub endpoints (auth, idempotent complete)  
- [ ] Provision xAI number; log call outcomes  
- [ ] Optional: import Twilio number and assign to agent  
- [ ] Wire `reliant_confirm_jobs` (or equivalent) due → outbound  
- [ ] Quiet hours + max attempts  
- [ ] Coordinator Settings: usage hint / “connect Reliant” gate  
- [ ] Update ROLES-AND-RELIANT “Implementation later” → “shipped” sections  

---

## Alternatives considered

| Option | Why not default |
|--------|------------------|
| **Twilio Studio + custom LLM voice** | More glue, more latency ownership, weaker “talk naturally” out of the box |
| **Grok Voice only, never Twilio** | Fine for dogfood; premature as a hard ban on BYON numbers |
| **Voice inside Hub** | Violates product split; couples family board to dial stack and billing |
| **Defer all voice forever** | Blocks Reliant differentiation and Hub confirm checkbox honesty |

---

## Status of work

**Decision accepted.** Implementation is **explicitly later** — track under deferred work in [CHECKPOINT.md](../CHECKPOINT.md). Do not expand Hub MVP scope to ship live dials until Reliant voice path is intentionally scheduled.
