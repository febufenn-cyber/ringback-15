# Phase 5 Implementation Plan — Revenue Attribution and Scalable Distribution

## Mission

Complete Ringback’s product loop by connecting every recoverable missed call to a defensible business outcome, then add the controlled distribution and partner capabilities required to scale acquisition without corrupting attribution, tenant boundaries, or unit economics.

Phase 5 answers:

> Can Ringback prove what value it created, explain the confidence of that claim, and distribute the product through repeatable channels without turning estimates into fake revenue or partners into uncontrolled administrators?

## Position analysis

The obvious final move is to build an ROI dashboard and an agency portal. Both can look successful while hiding structural weaknesses:

1. **Attribution inflation** — Ringback may claim jobs the owner would have recovered anyway.
2. **Outcome selection bias** — owners may report wins but ignore losses.
3. **Duplicate lead identity** — the same caller can appear across phone lines, campaigns, or CRM imports.
4. **Revenue ambiguity** — booked value, estimated value, invoiced value, and collected cash are different facts.
5. **Partner overreach** — agencies or resellers may gain access to customer data beyond their contractual scope.
6. **Commission disputes** — payouts can be calculated from mutable or low-confidence outcomes.
7. **Channel leakage** — direct, agency, referral, and organic sources may overwrite one another.
8. **Cohort illusion** — aggregate metrics may hide businesses with poor economics or trust failures.
9. **Feedback gaming** — incentives may encourage partners or customers to mark leads as won incorrectly.
10. **Premature white labeling** — hiding Ringback’s identity can complicate trust, support, compliance, and incident response.

Phase 5 must build an evidence ledger, not a marketing counter.

## Scope

### Included

- acquisition-source and campaign tracking;
- immutable attribution event ledger;
- caller/lead identity linkage with conservative deduplication;
- booking, job, invoice, payment and owner-reported outcome models;
- attribution rules and confidence scoring;
- baseline/manual-recovery comparison;
- recovered revenue and gross-profit estimates;
- cost and contribution-margin reporting;
- ROI and funnel summaries;
- CRM import/export adapter contracts;
- agency, referral, and reseller relationship model;
- partner-scoped access controls;
- referral and commission ledger;
- partner onboarding and customer assignment;
- campaign links/codes and source preservation;
- data-quality and missing-outcome monitoring;
- cohort and retention metrics;
- experiment and pricing-analysis support;
- scale/hold/stop decision report;
- final product roadmap and production-readiness documentation.

### Explicitly excluded

- claiming revenue without evidence and confidence labels;
- automated bank reconciliation without an approved provider integration;
- irreversible partner payouts from estimated outcomes;
- unrestricted partner access to transcripts or caller details;
- a full accounting system;
- a full CRM replacement;
- marketplace lead resale;
- deceptive white labeling;
- automatic pricing changes without an experiment and rollback path;
- using customer outcome data to train external models without governance.

## Evidence and event model

### Immutable attribution events

Create `attribution_events` with:

- organization ID;
- business/location/line IDs;
- event type;
- event timestamp;
- source system;
- source event ID;
- idempotency key;
- related callback, conversation, lead, booking, job, invoice or payment IDs;
- observed value and currency where appropriate;
- evidence type;
- confidence metadata;
- actor/source;
- redacted metadata;
- ingestion timestamp.

Events are append-only. Corrections are new events, not destructive edits.

### Event types

At minimum:

- missed call observed;
- callback attempted;
- callback connected;
- lead qualified;
- owner notified;
- owner contacted lead;
- booking requested;
- booking confirmed;
- booking canceled;
- service completed;
- owner reported won/lost;
- invoice issued;
- payment collected;
- refund/chargeback;
- attribution correction;
- acquisition source observed;
- partner assignment changed;
- commission accrued/approved/reversed/paid.

## Outcome hierarchy

Store distinct states rather than one overloaded `won` flag.

```text
lead created
  → contacted
  → booking requested
  → booking confirmed
  → service completed
  → invoiced
  → paid
```

Each stage may have independent evidence.

### Revenue facts

Separate:

- estimated lead value;
- expected booking value;
- quoted value;
- invoice amount;
- collected amount;
- refunded amount;
- gross profit estimate;
- verified gross profit where available.

Never show estimated revenue as collected revenue.

## Attribution model

### Attribution classes

Recommended classes:

- `direct_recovery` — strong evidence that Ringback created the recovered contact or booking;
- `assisted_recovery` — Ringback contributed, but owner or another channel also acted;
- `likely_incremental` — outcome is plausibly incremental based on timing and baseline, but direct evidence is incomplete;
- `unattributed` — outcome exists but Ringback’s contribution is not defensible;
- `counterfactual_unknown` — no reliable baseline exists.

### Confidence

Confidence should derive from observable evidence, for example:

- verified source missed call;
- Ringback callback timing;
- owner manual callback timing;
- caller engagement;
- booking linkage;
- unique caller/service/time match;
- CRM/invoice/payment evidence;
- owner confirmation;
- duplicate/channel conflict;
- elapsed time;
- baseline recovery rate.

Store the rule version and evidence used.

### Conservative calculation

A default attributed value should be bounded:

```text
verified outcome value
× attribution class weight
× confidence factor
```

Gross profit calculations additionally apply a business-provided or evidenced margin factor.

All weights and assumptions must be visible and versioned.

### Baseline and incrementality

Support comparison against:

- pre-Ringback owner callback recovery rate;
- holdout or disabled windows where ethically and operationally acceptable;
- allowlist/shadow periods;
- comparable time-of-day/day-of-week cohorts;
- tenant historical data;
- manual callback timing.

Do not require intentionally losing urgent customer leads merely to construct a control group.

## Identity and deduplication

### Stable identity links

Use privacy-minimized identifiers to associate:

- caller;
- source call;
- callback job;
- lead;
- booking;
- CRM contact/opportunity;
- invoice/payment;
- acquisition campaign.

### Deduplication rules

- exact provider IDs first;
- exact tenant-scoped normalized phone match where permitted;
- bounded service/time/location matching;
- explicit CRM mapping;
- manual merge with audit trail;
- never merge solely because names are similar;
- preserve original records and merge evidence.

Cross-tenant identity matching is prohibited unless a separate lawful, explicit design is approved.

## Source and campaign tracking

Create:

- `acquisition_sources`;
- `campaigns`;
- `tracking_numbers` or line-source assignments;
- `referral_codes`;
- `source_observations`;
- `source_resolution_events`.

Source precedence must be versioned. Original source and later touchpoints should both be retained.

Possible sources:

- direct/organic;
- search advertising;
- local listing;
- website;
- agency campaign;
- referral partner;
- reseller;
- imported CRM;
- unknown.

Do not overwrite `unknown` with a guessed source for cosmetic reporting.

## Cost and unit economics

Track immutable cost entries for:

- telephony attempts and duration;
- SMS/WhatsApp;
- model usage;
- booking-provider usage;
- support adjustments where recorded;
- partner commission;
- payment processing;
- credits/refunds.

Report:

- cost per callback attempt;
- cost per connected callback;
- cost per qualified lead;
- cost per booking;
- cost per completed job;
- attributed revenue;
- attributed gross profit;
- contribution margin;
- payback period estimate;
- usage by tenant, plan, vertical, source and partner.

Cost data must identify whether it is observed, imported, or estimated.

## ROI reporting

### Tenant dashboard/API contract

Show:

- missed calls;
- eligible recoveries;
- callbacks attempted/connected;
- qualified leads;
- bookings;
- completed jobs;
- invoice/payment evidence;
- attributed revenue by confidence;
- estimated gross profit;
- delivery cost;
- owner feedback completion;
- unresolved outcomes;
- assumption and rule versions.

### Honesty requirements

- Separate verified, estimated and unknown values visually and structurally.
- Display confidence and missing-data warnings.
- Provide drill-down to evidence events.
- Do not present a single oversized ROI number without its basis.
- Preserve historical calculations when attribution rules change.

## CRM and outcome integrations

### Adapter interface

Support provider-neutral operations:

- upsert lead/contact mapping;
- push structured lead;
- read opportunity/status changes;
- read job/invoice/payment references where authorized;
- process provider webhooks;
- reconcile missing events;
- revoke integration.

At least one mock/reference adapter must support all tests. Real provider credentials remain optional.

### Integration controls

- tenant-authorized installation;
- least-privilege scopes;
- encrypted secret references;
- idempotent sync;
- cursor/checkpoint persistence;
- rate-limit handling;
- dead-letter/retry records;
- field-mapping versioning;
- deletion/revocation handling;
- audit events.

## Partner and distribution model

### Partner entities

Create:

- `partners`;
- `partner_memberships`;
- `partner_programs`;
- `partner_customer_assignments`;
- `partner_campaigns`;
- `referrals`;
- `commission_rules`;
- `commission_ledger`;
- `payout_batches` where appropriate.

Partner types may include:

- agency;
- referral partner;
- reseller;
- telecom/implementation partner.

### Access boundaries

Partners may see only customers explicitly assigned under an active relationship.

Default partner visibility should be aggregated operational and commercial metrics, not raw caller content.

A partner must not:

- change customer billing ownership without approval;
- activate live calls unilaterally;
- read another partner’s customers;
- see private lead details unless explicitly authorized;
- change attribution rules;
- mark commissions paid;
- override incidents or safety stops.

### Customer consent and control

- Customer owner approves partner assignment.
- Customer can revoke access.
- Access changes are audited.
- Revocation removes future access immediately while preserving accounting history.
- Partner branding cannot obscure required Ringback/automation disclosures.

## Commission ledger

Commission entries are immutable and stateful:

```text
estimated
  → accrued
  → approved
  → payable
  → paid
```

Reversal states:

```text
reversed
held
in_dispute
```

Rules:

- no payout based solely on low-confidence estimated revenue;
- commission source and rule version stored;
- duplicate provider/payment events do not duplicate commission;
- refunds and chargebacks create reversal entries;
- manual adjustments require reason and audit actor;
- partner cannot approve its own payout;
- currency and tax handling are explicit.

## Distribution workflows

Implement controlled workflows for:

### Referral

- partner obtains a code/link;
- customer attribution recorded;
- customer creates organization;
- ownership and consent remain with customer;
- qualifying subscription event accrues commission according to rule.

### Agency-managed onboarding

- agency proposes customer setup;
- customer owner accepts invitation/relationship;
- agency receives scoped setup/metrics access;
- customer controls live activation and billing authorization.

### Reseller

Only implement if the model can preserve clear billing ownership, support responsibility, disclosures, and tenant data control. Otherwise provide the schema and keep activation disabled.

## Experiments and pricing analysis

Support versioned experiments for:

- plan packaging;
- onboarding flow;
- lead-card presentation;
- owner feedback reminders;
- agency offer;
- callback timing;
- supported channel.

Requirements:

- tenant/sample assignment recorded;
- no safety-critical randomization;
- metric definitions versioned;
- exposure events immutable;
- stop conditions defined;
- no retroactive reassignment;
- experiment does not bypass entitlement or consent.

## Data quality

Track and surface:

- missing owner outcomes;
- conflicting outcomes;
- orphan CRM records;
- unmatched invoices/payments;
- duplicate caller/lead candidates;
- stale integration sync;
- unknown acquisition source;
- attribution confidence distribution;
- partner assignment conflicts;
- currency or timezone mismatch.

Do not silently discard conflicting evidence. Preserve it and lower confidence.

## Retention, privacy and governance

- Tenant-configurable retention within platform/legal bounds;
- minimize raw caller identifiers in analytics tables;
- separate operational data from aggregated reporting;
- deletion requests propagate to integrations where supported;
- accounting and commission records retain only necessary references;
- data export includes attribution assumptions;
- partner access is revocable;
- model training use is separately governed;
- all sensitive exports are authorized and audited.

## Observability

Track:

- attribution event ingestion and rejection;
- deduplication decisions;
- attribution class/confidence changes;
- missing outcome rate;
- CRM sync lag and failures;
- cost-ingestion gaps;
- partner access and assignment changes;
- commission lifecycle changes;
- payout/reversal discrepancies;
- cohort retention;
- tenant contribution margin;
- support and incident burden by channel.

## Migration plan

1. Add attribution event and rule-version tables.
2. Add source/campaign/tracking entities.
3. Add job, invoice, payment and cost evidence models.
4. Backfill existing leads, feedback and bookings as explicitly labeled historical evidence.
5. Add identity-link and deduplication audit tables.
6. Add CRM integration and sync state.
7. Add partner and assignment model.
8. Add commission ledger and rules.
9. Add reporting views/RPCs with organization and partner scoping.
10. Add experiment exposure and metric-definition tables.
11. Preserve original Phase 2/3/4 event history.

## Implementation workstreams

### Workstream A — Attribution ledger

- event schema;
- ingestion service;
- idempotency;
- rule engine;
- confidence model;
- historical calculation versions.

### Workstream B — Identity, source and outcomes

- lead/booking/job/invoice/payment links;
- deduplication;
- source tracking;
- reconciliation;
- missing-data workflows.

### Workstream C — Economics and reporting

- cost ledger;
- contribution calculations;
- tenant ROI summary;
- evidence drill-down;
- cohorts and retention.

### Workstream D — Integrations

- CRM adapter;
- mock provider;
- webhook/reconciliation;
- secret and cursor handling;
- export/import controls.

### Workstream E — Distribution

- partner organizations and roles;
- customer assignment/consent;
- referral tracking;
- commission ledger;
- partner dashboard/API boundaries.

### Workstream F — Final hardening

- security and isolation tests;
- attribution replay tests;
- commission idempotency tests;
- final roadmap and production-readiness report;
- scale/hold/stop decision template.

## Required files

At minimum, Phase 5 should add or update:

- `phase5/README.md`;
- `phase5/ATTRIBUTION-SPEC.md`;
- `phase5/PARTNER-ACCESS-MODEL.md`;
- `phase5/THREAT-MODEL.md`;
- `phase5/DEPLOYMENT-CHECKLIST.md`;
- `phase5/VALIDATION.md`;
- `phase5/DECISION.md`;
- attribution, cost, partner and commission migrations;
- attribution event service;
- rule/confidence engine;
- identity/deduplication module;
- source/campaign module;
- ROI reporting service;
- CRM adapter and mock;
- partner authorization service;
- commission ledger service;
- replay, security and regression tests;
- final root README roadmap status.

## Acceptance gates

Phase 5 is code-complete only when all are true:

- [ ] Attribution inputs are append-only and idempotent.
- [ ] Verified, estimated and unknown revenue remain separate.
- [ ] Attribution calculations store rule and evidence versions.
- [ ] Corrections preserve historical calculations.
- [ ] Duplicate events do not duplicate revenue, usage, cost or commission.
- [ ] Cross-tenant identity matching is prohibited.
- [ ] CRM sync is resumable and idempotent.
- [ ] Partner access requires explicit active customer assignment.
- [ ] Revoked partner access stops immediately.
- [ ] Partner cannot modify platform attribution rules or approve its own payout.
- [ ] Commission reversals handle refunds and duplicate events.
- [ ] ROI reports expose confidence and missing-data warnings.
- [ ] Cohort metrics cannot leak individual tenant data to unauthorized partners.
- [ ] Existing Phase 0–4 workflows continue to pass regression tests.
- [ ] Attribution replay produces stable deterministic results.
- [ ] Full Phase 0–5 test suite, build and typecheck pass.
- [ ] External CRM/payment/payout providers remain mockable and inactive without credentials.
- [ ] Root README marks the planned implementation roadmap complete while clearly separating live proof from code completion.

## Final scale decision framework

Phase 5 documentation must include a decision record evaluating:

- callback engagement;
- qualified lead rate;
- owner follow-through;
- booking and completion rate;
- verified and attributed gross profit;
- gross margin after delivery and partner costs;
- tenant retention;
- missing outcome rate;
- complaint and incident rate;
- support burden;
- acquisition cost by direct and partner channel;
- partner quality;
- legal/compliance readiness;
- provider concentration risk.

Decision options:

- `SCALE` — economics, trust and operations support expansion;
- `HOLD` — code is ready but evidence is insufficient;
- `REVISE` — narrow vertical, channel, pricing or workflow;
- `STOP` — value or safety does not justify continued operation.

Code completion must not automatically produce a `SCALE` decision.

## Merge verification

After implementation:

- branch: `agent/phase5-attribution-distribution`;
- PR title: `Implement Phase 5 attribution and distribution`;
- squash-merge into `main`;
- verify `phase5/README.md`, the attribution migration, and the partner access model on remote `main`;
- run the final entire repository test suite;
- report PR, merge SHA, total tests, completed roadmap status and live-production boundaries.

## Final repository state

After Phase 5, the implementation roadmap is complete when remote `main` contains:

- production multi-tenancy and billing foundation;
- versioned vertical playbooks and booking infrastructure;
- attribution evidence ledger and ROI reporting;
- controlled partner/distribution model;
- migrations, threat models, deployment checklists and tests for all phases;
- an explicit production activation and scale decision document.

The product may still require real credentials, provider certification, live migrations, supervised traffic, jurisdictional review and market evidence. Those are deployment and business-proof gates, not missing implementation phases.
