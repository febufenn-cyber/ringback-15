# Ringback

> When a business misses a call, Ringback safely calls the person back, captures their need, and sends the owner a measurable lead.

## Current phase

Ringback now contains the **Phase 3 production multi-tenancy foundation**.

Implemented foundations include organizations, explicit memberships and roles, tenant-scoped locations and phone lines, safe onboarding transitions, plan entitlements, idempotent billing events, usage metering, audit events, and activation/suspension controls.

Start with [`phase3/README.md`](phase3/README.md). Earlier reliability and pilot documentation remains in [`phase2/README.md`](phase2/README.md), [`phase1/README.md`](phase1/README.md), and [`phase0/README.md`](phase0/README.md).

External providers remain disabled until configured and verified. Phase 2 live-calling safety defaults remain unchanged.

## Remaining implementation roadmap

Two phases remain after Phase 3:

- **Phase 4:** versioned vertical intelligence and conflict-safe booking integrations;
- **Phase 5:** revenue attribution, ROI evidence and scalable distribution.

The detailed plans and autonomous execution rules are stored in:

- [`docs/REMAINING-PHASES-ROADMAP.md`](docs/REMAINING-PHASES-ROADMAP.md)
- [`docs/AUTONOMOUS-BUILD-CONTRACT.md`](docs/AUTONOMOUS-BUILD-CONTRACT.md)
- [`phase4/IMPLEMENTATION-PLAN.md`](phase4/IMPLEMENTATION-PLAN.md)
- [`phase5/IMPLEMENTATION-PLAN.md`](phase5/IMPLEMENTATION-PLAN.md)

## Local validation

```bash
npm install
npm test
npm run typecheck
npm run build
```

Phase 0 reporting remains available:

```bash
python3 scripts/phase0_report.py --data-dir phase0/templates --output phase0-report.md
python3 -m unittest discover -s tests -v
```

## Product status

- [x] duplicate-safe missed-call recovery core
- [x] controlled closed multi-business pilot
- [x] organizations and role-based authorization
- [x] tenant-scoped locations and phone lines
- [x] onboarding and activation state machines
- [x] idempotent billing-event normalization
- [x] subscriptions, entitlements, and usage metering
- [x] commercial audit trail and suspension controls
- [ ] supervised production-provider validation
- [ ] vertical intelligence and booking
- [ ] defensible attribution and scalable distribution

## Architecture

```text
Signed provider events
        ↓
Reliable callback and pilot engine
        ↓
Organization + membership authorization
        ↓
Tenant-scoped locations and phone lines
        ↓
Onboarding + entitlement gates
        ↓
Usage + billing event ledger
        ↓
Audit, suspension, and operational controls
```

## Phased plan

- **Phase 0:** problem and economics validation — implemented.
- **Phase 1:** reliable one-business callback loop — implemented.
- **Phase 2:** controlled closed multi-business pilot — implemented; live evidence pending.
- **Phase 3:** production multi-tenancy and commercial foundation — implemented; provider validation pending.
- **Phase 4:** vertical intelligence and booking integrations.
- **Phase 5:** revenue attribution and scalable distribution.

---

*Blueprint inspired by the missed-call recovery wedge for local service businesses.*
