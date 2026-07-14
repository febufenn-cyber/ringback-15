# Phase 5 Deployment Checklist

- [ ] Phases 1–4 migrations are applied and verified.
- [ ] `005_phase5_attribution_distribution.sql` is applied to a dedicated environment.
- [ ] Append-only triggers reject update and delete attempts.
- [ ] Organization-scoped event idempotency is concurrency-tested.
- [ ] Financial webhook signatures are verified before normalization.
- [ ] CRM credentials use least-privilege scopes and encrypted references.
- [ ] CRM retry and dead-letter behavior is tested.
- [ ] Partner assignments require customer-owner approval.
- [ ] Revocation is tested against every partner route.
- [ ] Commission rules, currency and tax ownership are approved.
- [ ] No payout can be approved by the beneficiary partner.
- [ ] Refund and chargeback reconciliation is tested.
- [ ] Mixed-currency reporting is disabled without a verified conversion policy.
- [ ] Cohort privacy thresholds are enforced.
- [ ] Retention and deletion propagation is documented.
- [ ] Data exports include evidence strength, confidence and rule versions.
- [ ] Real customer ROI is reviewed against source events before publication.
- [ ] Legal, privacy, telecom and financial reviews are complete for the operating region.
