# Phase 2 Decision

## Decision

**IMPLEMENTED, NOT YET PROVEN IN LIVE MULTI-BUSINESS TRAFFIC.**

The repository now contains the closed-pilot control plane and business-scoped callback loop. This establishes the software boundary for a small supervised cohort; it does not establish production readiness.

## Proven by local tests

- legacy Phase 1 idempotency and state invariants remain intact;
- allowlist mode rejects unapproved callers;
- daily callback limits suppress excess jobs;
- quota events create pilot incidents;
- separate businesses use separate callback identities;
- signed feedback links reject tampering and expiry;
- lead SMS includes the outcome link;
- feedback cannot be written against another business;
- owner outcomes can be updated;
- paused businesses leave the dispatchable roster.

## Still unproven

- live Supabase transaction behaviour under concurrent Workers;
- real multi-business Twilio routing;
- carrier spam reputation across callback numbers;
- owner outcome completion in everyday use;
- caller trust across languages and accents;
- real incident response speed;
- recovered revenue and retention;
- jurisdiction-specific legal and telecom compliance.

## Reversal condition

Immediately disable global dispatch and pause the affected business after any wrong-business contact, cross-tenant access, duplicate callback, quota bypass, material complaint, emergency-flow failure, or uncontrolled spend.
