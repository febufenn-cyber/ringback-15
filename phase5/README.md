# Phase 5 — Attribution and Distribution

Phase 5 completes Ringback’s planned implementation roadmap with an evidence-first value ledger and controlled partner distribution foundation.

## Implemented

- append-only, idempotent attribution events;
- separate booked, invoiced, collected, refunded, cost and contribution values;
- explicit estimated, owner-reported, provider-verified and financial-verified value breakdowns;
- conservative attribution classes and versioned weights;
- confidence-weighted attributed value rather than a marketing-only ROI counter;
- first-touch and last-touch acquisition preservation;
- missing-evidence and conflicting-outcome warnings;
- tenant-scoped identity links with manual-link audit actors;
- deterministic attribution replay;
- privacy-thresholded cohort aggregation;
- partner records, active customer assignments and explicit scopes;
- commission idempotency, rule versions and refund reversal;
- resumable, idempotent CRM outbox delivery;
- append-only database protections and server-only mutation boundaries.

## Honesty boundary

Ringback never treats expected booking value as collected cash. Financial events require verified evidence, an amount and a currency. Mixed-currency reports fail closed until an approved conversion rule exists. Missing outcomes remain missing rather than being estimated silently.

## Distribution boundary

Partners see only organizations with active assignments and only capabilities in their explicit scope. Assignment revocation takes effect immediately. Partners cannot activate calls, change attribution rules, approve their own payouts or access raw caller content through the Phase 5 model.

## Production boundary

No CRM, payment, payout or partner portal is activated by merging this phase. Real provider credentials, live migrations, privacy/security review, supervised traffic and verified customer economics remain required.
