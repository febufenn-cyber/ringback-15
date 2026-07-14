# Phase 5 Validation

Local strict validation:

```text
tsc -p tsconfig.json --noEmit
tsc -p tsconfig.json
node --test test-js/phase3.test.mjs test-js/phase4.test.mjs test-js/phase5.test.mjs
```

Result: **33 combined Phase 3–5 tests passed** before publication.

Coverage includes append-only service behavior, source-event idempotency, financial evidence requirements, value-stage and evidence-strength separation, conservative attribution classes, mixed-currency rejection, source preservation, cross-tenant identity-link rejection, partner assignment/scope/revocation, commission reversal, resumable CRM delivery, missing/conflicting evidence warnings, deterministic replay, cohort privacy thresholds, the SQL migration contract and all Phase 3–4 regressions.

The branch must also pass repository-wide GitHub Actions commands:

```text
npm test
npm run typecheck
npm run build
```
