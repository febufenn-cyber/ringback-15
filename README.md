# Ringback

> When a business misses a call, Ringback safely calls the person back, captures their need, and connects the result to defensible business evidence.

## Roadmap status

The planned repository implementation roadmap from **Phase 0 through Phase 5 is complete**.

Ringback now includes:

- evidence-before-automation market validation;
- duplicate-safe missed-call recovery;
- controlled multi-business pilot operations;
- production tenant, onboarding, entitlement and billing foundations;
- immutable vertical playbooks, bounded model assistance and conflict-safe booking;
- append-only attribution evidence, honest ROI reporting, CRM outbox integration and controlled partner distribution.

Start with [`phase5/README.md`](phase5/README.md) and [`docs/BUILD-COMPLETION.md`](docs/BUILD-COMPLETION.md). Earlier phase records remain under `phase0/` through `phase4/`.

## Implementation versus production proof

No external provider is activated merely because code is merged. Live production still requires migrations, verified credentials, provider approvals, supervised traffic, security/privacy review, jurisdictional compliance and real customer evidence.

The current scale decision is **HOLD**, not `SCALE`, until live economics and trust gates are satisfied.

## Local validation

```bash
npm install
npm test
npm run typecheck
npm run build
```

## Product status

- [x] Phase 0 validation system
- [x] Phase 1 reliable callback loop
- [x] Phase 2 closed multi-business pilot controls
- [x] Phase 3 production multi-tenancy and commercial foundation
- [x] Phase 4 vertical intelligence and booking foundation
- [x] Phase 5 attribution and controlled distribution foundation
- [ ] live provider configuration and migrations
- [ ] supervised production validation
- [ ] verified retention and unit economics
- [ ] evidence-supported scale decision

## Final architecture

```text
Signed provider evidence
        ↓
Reliable callback and tenant-scoped operations
        ↓
Approved playbook and safety execution
        ↓
Conflict-safe booking and CRM synchronization
        ↓
Append-only attribution evidence
        ↓
Confidence-labelled ROI and partner accounting
```

## Phase records

- [`phase0/README.md`](phase0/README.md)
- [`phase1/README.md`](phase1/README.md)
- [`phase2/README.md`](phase2/README.md)
- [`phase3/README.md`](phase3/README.md)
- [`phase4/README.md`](phase4/README.md)
- [`phase5/README.md`](phase5/README.md)

---

*Blueprint inspired by the missed-call recovery wedge for local service businesses.*
