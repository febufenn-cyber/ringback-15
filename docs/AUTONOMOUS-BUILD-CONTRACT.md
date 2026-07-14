# Ringback Autonomous Build Contract

This document defines what the command **`build`** means for the remaining Ringback roadmap.

## Remaining roadmap

Three implementation phases remain:

1. **Phase 3 — Production multi-tenancy and commercial foundation**
2. **Phase 4 — Vertical intelligence and booking integrations**
3. **Phase 5 — Revenue attribution and scalable distribution**

Phase 0, Phase 1, and Phase 2 are already implemented in the repository. Phase 2 remains inactive by default and still requires supervised live evidence before production activation.

## Trigger semantics

When the user says **`build`**, execute all remaining incomplete phases in order:

```text
Phase 3
  ↓ verify completion on main
Phase 4
  ↓ verify completion on main
Phase 5
  ↓ verify completion on main
Final repository verification
```

If one or more phases have already been completed, begin with the earliest incomplete phase.

The command is intended to run without routine clarification. Resolve implementation details from:

- the current repository state;
- the relevant phase implementation plan;
- previously merged phase contracts and invariants;
- conservative safety defaults;
- reversible architecture choices.

Do not ask for approval between ordinary implementation steps. Continue through the sequence unless a genuine blocker makes safe completion impossible.

## Pre-phase verification

Before writing code for each phase:

1. Fetch the current `main` branch and confirm its head commit.
2. Read this contract and the phase-specific implementation plan.
3. Read the previous phase decision, migration, tests, and operating documentation.
4. Inspect the current source tree and identify interfaces that must remain backward compatible.
5. Confirm that the phase is not already implemented.
6. Create a fresh branch from the verified `main` head.
7. Record the assumptions being used.
8. Re-evaluate the phase threat model and blind spots.
9. Define the exact acceptance tests before implementation.
10. Keep external services inactive unless safe test credentials are already available.

## Per-phase Git workflow

Each phase must be delivered independently.

### Branches

- Phase 3: `agent/phase3-production-multitenancy`
- Phase 4: `agent/phase4-vertical-intelligence`
- Phase 5: `agent/phase5-attribution-distribution`

### Commit and PR names

- Phase 3 commit/PR: `Implement Phase 3 production multi-tenancy`
- Phase 4 commit/PR: `Implement Phase 4 vertical intelligence and booking`
- Phase 5 commit/PR: `Implement Phase 5 attribution and distribution`

### Required sequence

For each phase:

1. Branch from the latest verified `main`.
2. Implement only that phase and required compatibility changes.
3. Add or update migrations.
4. Add unit, integration, security, and regression tests.
5. Run type checking and the full test suite.
6. Review the branch diff for accidental files and secret exposure.
7. Open a pull request targeting `main`.
8. Confirm the PR is mergeable at the expected head SHA.
9. Squash-merge the PR.
10. Fetch the merge commit from `main`.
11. Fetch at least one defining file from the phase on `main`.
12. Confirm the tests, PR number, merge SHA, changed-file count, and known deployment boundaries.
13. Continue to the next incomplete phase.

## Verification commands

Use the repository’s available toolchain. At minimum, every phase must run:

```bash
npm test
npm run typecheck
npm run build
```

Additional phase-specific checks are mandatory when added by the phase plan, such as:

- migration structure tests;
- tenant-isolation tests;
- billing idempotency tests;
- booking concurrency tests;
- attribution replay tests;
- route authorization tests;
- security and secret scans;
- rollback or migration compatibility checks.

A phase may not be merged while required tests fail.

## Failure-handling rules

### Fix and continue automatically

Do not stop for routine implementation failures, including:

- TypeScript errors;
- failing tests;
- missing local development dependencies;
- branch drift that can be safely rebased or reconstructed;
- PR metadata problems;
- ordinary merge conflicts;
- incomplete documentation;
- mock-provider gaps;
- migration syntax issues detectable without a live database.

Diagnose, repair, rerun validation, and continue.

### Stop only for a material blocker

Stop and report partial completion only when one of these is true:

- repository permissions prevent writing or merging;
- a required secret or paid external account is essential to produce any safe implementation, and no mock or adapter boundary can substitute;
- a legal or safety constraint makes the intended behavior inappropriate to implement;
- the repository has incompatible user changes that cannot be preserved safely;
- the remote service refuses all available write paths;
- the implementation cannot be made testable without destructive access to live customer data.

External deployment must not be falsely claimed. Code-complete and live-proven are separate states.

## Safety defaults

The following defaults apply throughout all remaining phases:

- New automation remains disabled until explicitly activated.
- No live calls are made merely because code is merged.
- No production secrets are committed.
- Service-role credentials remain server-side.
- Tenant data is never selected without an organization or business scope.
- Billing events are idempotent and auditable.
- Booking operations use conflict-safe reservation semantics.
- Model-generated language cannot promise price, availability, diagnosis, or guaranteed service unless an approved deterministic rule authorizes it.
- Personal data collection is minimized.
- All destructive or irreversible actions require explicit server-side authorization.
- Feature flags and kill switches are retained for high-risk capabilities.

## Evidence required after every merge

The completion report for each phase must include:

- phase name;
- branch name;
- PR number and link;
- merge method;
- merge commit SHA;
- test commands and result;
- major files or systems added;
- safety state;
- what was not live-tested;
- verification that defining files are present on `main`.

The final report after Phase 5 must also confirm:

- all three phase PRs are merged;
- `main` contains the Phase 5 roadmap state;
- no remaining roadmap phase is marked unimplemented;
- the complete test suite passes at the final mainline state;
- production activation requirements remain clearly separated from code completion.

## Definition of autonomous completion

The `build` command is complete only when all incomplete phases have independently passed their acceptance gates, been squash-merged into `main`, and been verified from the remote repository.

Creating code on an unmerged branch does not count. Opening a PR does not count. Reporting a commit without verifying `main` does not count.
