# Phase 3 Validation

Local isolated validation:

```text
tsc -p tsconfig.json --noEmit
tsc -p tsconfig.json
node --test test-js/phase3.test.mjs
```

Result: 9 Phase 3 tests passed.

The merged branch must additionally pass the repository-wide GitHub Actions workflow:

```text
npm test
npm run typecheck
npm run build
```

Covered: owner bootstrap, role denial, billing idempotency, entitlement expiry, plan limits, activation gates, tenant fail-closed behavior, usage idempotency, suspension, and onboarding transition safety.
