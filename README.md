# Ringback

> When a business misses a call, Ringback safely calls the person back, captures their need, and sends the owner a measurable lead.

## Current phase

Ringback now contains the **Phase 2 closed multi-business pilot layer**.

The code supports a small operator-managed roster of businesses with:

- database-backed business and phone-line configuration;
- strict business-scoped job and lead access;
- `setup`, `allowlist_only`, `live`, `paused`, and `completed` pilot modes;
- a global emergency stop and per-business kill switches;
- per-business daily callback limits;
- allowlisted supervised testing;
- signed owner outcome links;
- owner feedback and optional recovered-revenue capture;
- pilot incidents and a compact operational summary.

Start with [`phase2/README.md`](phase2/README.md). Phase 1 reliability documentation remains in [`phase1/README.md`](phase1/README.md), and the original validation system remains in [`phase0/README.md`](phase0/README.md).

The system remains inactive by default:

```env
PILOT_GLOBAL_ACTIVE=false
```

## Local validation

```bash
npm install
npm test
npm run typecheck
```

Phase 0 reporting remains available:

```bash
python3 scripts/phase0_report.py --data-dir phase0/templates --output phase0-report.md
python3 -m unittest discover -s tests -v
```

## MVP status

- [x] duplicate-safe missed-call detection
- [x] delayed callback orchestration with manual suppression
- [x] deterministic service, location, and urgency capture
- [x] Supabase persistence and audit history
- [x] closed multi-business pilot roster
- [x] allowlist and live pilot modes
- [x] per-business callback quota
- [x] signed owner outcome feedback
- [x] pilot incident and summary controls
- [ ] supervised pilot completion
- [ ] verified caller trust and carrier performance
- [ ] multi-tenant self-service authentication
- [ ] billing and production CRM integrations

## Architecture

```text
Twilio signed events
        ↓
Cloudflare Worker
        ↓
Supabase pilot directory resolves the business
        ↓
Business-scoped callback repository and coordinator
        ↓
Atomic claim + atomic daily quota reservation
        ↓
Deterministic callback qualification
        ↓
Lead SMS with signed owner outcome link
        ↓
Owner feedback + pilot summary + incident log
```

Phase 2 deliberately postpones public signup, billing, autonomous free-form voice reasoning, recording, calendar booking, and a full CRM.

## Phased plan

- **Phase 0:** prove problem frequency, caller behaviour, owner action, economics, and trust.
- **Phase 1:** implement the one-business reliable technical loop.
- **Phase 2:** operate a controlled closed multi-business pilot — implementation complete, live evidence pending.
- **Phase 3:** production multi-tenancy, self-service onboarding, authentication, billing, and operational tooling.
- **Phase 4:** vertical intelligence and booking integrations.
- **Phase 5:** revenue attribution and scalable distribution.

---

*Blueprint inspired by the missed-call recovery wedge for local service businesses.*
