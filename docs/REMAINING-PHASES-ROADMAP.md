# Remaining Phases Roadmap

## Status

Ringback has six numbered phases from Phase 0 through Phase 5.

| Phase | Purpose | Repository status |
|---|---|---|
| Phase 0 | Validate the problem, caller behavior, owner action, economics and trust | Implemented |
| Phase 1 | Build one reliable callback loop | Implemented |
| Phase 2 | Build a controlled closed multi-business pilot | Implemented; live evidence pending |
| Phase 3 | Production multi-tenancy, onboarding, authentication, billing and operations | Planned |
| Phase 4 | Vertical intelligence, bounded model assistance and booking | Planned |
| Phase 5 | Revenue attribution, ROI evidence and scalable distribution | Planned |

**Three implementation phases remain.**

## Execution order

```text
Phase 3 — secure production SaaS foundation
  ↓
Phase 4 — add versioned intelligence and conflict-safe booking
  ↓
Phase 5 — prove value and enable controlled distribution
```

The order is structural:

- Phase 4 requires the stable tenant, entitlement and audit model created in Phase 3.
- Phase 5 requires the stable lead, conversation and booking identities created in Phase 4.
- Skipping ahead would create temporary IDs, duplicate migrations, unsafe partner access and unreliable attribution.

## Phase plans

- [Autonomous Build Contract](AUTONOMOUS-BUILD-CONTRACT.md)
- [Phase 3 Implementation Plan](../phase3/IMPLEMENTATION-PLAN.md)
- [Phase 4 Implementation Plan](../phase4/IMPLEMENTATION-PLAN.md)
- [Phase 5 Implementation Plan](../phase5/IMPLEMENTATION-PLAN.md)

## Meaning of `build`

When the user says **`build`**, the expected execution is:

1. Verify remote `main` and these plans.
2. Implement Phase 3 on its own branch.
3. Run all required tests and repair failures.
4. Open a PR, confirm mergeability, squash-merge, and verify the Phase 3 files on `main`.
5. Repeat independently for Phase 4.
6. Repeat independently for Phase 5.
7. Run and report the final repository validation.

No ordinary approval pause is required between phases.

## Required proof after every phase

A phase is not complete until the response confirms:

- branch;
- PR number/link;
- squash merge;
- merge commit SHA;
- tests and result;
- defining files verified on remote `main`;
- features intentionally disabled without external credentials;
- live validation still outstanding.

## Product state after Phase 5

The planned implementation will be complete, but production proof may still require:

- applying migrations to a real Supabase project;
- configuring real Twilio, billing, model, calendar or CRM credentials;
- provider verification/certification;
- supervised real traffic;
- security and privacy review;
- jurisdiction-specific telecom and consent review;
- real customer retention and recovered-profit evidence.

The autonomous implementation must never describe code-complete work as live-proven when those steps have not occurred.
