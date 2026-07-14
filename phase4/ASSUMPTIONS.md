# Phase 4 Assumptions

- Approved playbooks are immutable; behavior changes require a new version.
- Model output is untrusted and accepted only when it matches an approved label schema and confidence range.
- Calendar providers remain behind idempotent adapters and are disabled without verified credentials.
- Booking availability is not promised until an internal hold is confirmed by the provider.
- Emergency, sensitive-data, low-confidence, and policy-conflict paths prefer human handoff.
