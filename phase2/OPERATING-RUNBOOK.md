# Phase 2 Operating Runbook

## Start-of-day check

1. Confirm `PILOT_GLOBAL_ACTIVE` matches the approved operating window.
2. Review `/internal/pilot/summary`.
3. Confirm no open critical incident.
4. Confirm each live business has the intended daily limit.
5. Confirm the correct business name, callback number, and owner number.
6. Confirm Twilio spend alerts and account limits.
7. Confirm an operator can pause the business immediately.

## During the pilot

Review every attempt for:

- correct business identity;
- correct caller and owner destination;
- duplicate or simultaneous owner contact;
- caller confusion;
- emergency or excluded intent;
- lead completeness;
- owner notification delivery;
- owner outcome feedback.

Do not raise a daily limit while investigating an anomaly.

## Incident severity

### Critical

Examples:

- wrong business identity;
- wrong owner receives a lead;
- duplicate caller contact;
- unauthorized callback;
- cross-business data access;
- emergency flow handled incorrectly;
- global or business stop fails.

Action:

1. Set `PILOT_GLOBAL_ACTIVE=false`.
2. Set affected businesses to `paused`.
3. Stop dispatching.
4. Preserve logs and provider identifiers.
5. Record the incident.
6. Do not resume until the root cause and replay test are documented.

### Warning

Examples:

- quota reached;
- provider call creation fails;
- SMS delivery fails;
- feedback link cannot be created;
- caller repeatedly provides no speech;
- owner does not provide outcomes.

Action:

- pause the affected business when repeated;
- investigate before increasing volume;
- document the operational decision.

### Info

Examples:

- planned test;
- temporary allowlist change;
- mode change;
- supervised pilot window opened or closed.

## End-of-day close

1. Pause live businesses unless another approved window exists.
2. Reconcile attempts with Twilio.
3. Reconcile notified leads with owner feedback.
4. Contact owners for missing outcomes.
5. Review incidents and unresolved warnings.
6. Record any manual callback collisions.
7. Export the pilot summary to the decision log.
8. Delete unnecessary raw personal data according to the retention policy.
