# Ringback

> When a business misses a call, Ringback safely calls the person back, captures their need, and sends the owner a measurable lead.

## Current phase

Ringback now contains the **Phase 4 vertical-intelligence and conflict-safe booking layer**.

The repository includes production tenant controls from Phase 3 plus immutable playbook versions, deterministic workflow graphs, bounded model classification, multilingual prompt packs, safety handoff rules, booking resources, expiring holds, and idempotent provider confirmation.

Start with [`phase4/README.md`](phase4/README.md). Earlier commercial, pilot, and callback documentation remains in [`phase3/README.md`](phase3/README.md), [`phase2/README.md`](phase2/README.md), [`phase1/README.md`](phase1/README.md), and [`phase0/README.md`](phase0/README.md).

Model and calendar providers remain disabled until credentials, permissions, safety review, and supervised tests are complete.

## Remaining implementation roadmap

One implementation phase remains:

- **Phase 5:** defensible revenue attribution, ROI evidence, partner controls, and scalable distribution.

See [`phase5/IMPLEMENTATION-PLAN.md`](phase5/IMPLEMENTATION-PLAN.md) and [`docs/AUTONOMOUS-BUILD-CONTRACT.md`](docs/AUTONOMOUS-BUILD-CONTRACT.md).

## Local validation

```bash
npm install
npm test
npm run typecheck
npm run build
```

## Product status

- [x] reliable missed-call recovery core
- [x] controlled multi-business pilot
- [x] production tenant and commercial foundation
- [x] versioned vertical playbooks
- [x] bounded model assistance and safety gates
- [x] multilingual prompt packs
- [x] conflict-safe booking holds and idempotent confirmation
- [ ] live model and calendar-provider validation
- [ ] defensible attribution and scalable distribution

## Architecture

```text
Reliable callback + tenant foundation
        ↓
Approved immutable playbook snapshot
        ↓
Deterministic node and safety execution
        ↓
Bounded classification or human handoff
        ↓
Atomic booking hold
        ↓
Idempotent provider confirmation
```

## Phased plan

- **Phase 0–2:** validation and controlled callback pilot — implemented.
- **Phase 3:** production multi-tenancy and commercial foundation — implemented.
- **Phase 4:** vertical intelligence and booking — implemented; provider validation pending.
- **Phase 5:** revenue attribution and scalable distribution.

---

*Blueprint inspired by the missed-call recovery wedge for local service businesses.*
