# Phase 3 Implementation Plan — Production Multi-Tenancy

## Mission

Convert the operator-managed Phase 2 pilot into a production-capable multi-tenant service without weakening the callback reliability, tenant isolation, pilot safety, or auditability established in earlier phases.

Phase 3 answers:

> Can independent businesses securely onboard, configure, pay for, operate, and leave Ringback without an operator directly editing database rows or environment variables?

## Position analysis

The obvious move is to add a signup screen and Stripe checkout. That would create the appearance of SaaS while leaving the dangerous problems unresolved.

The decisive risks are:

1. **Tenant identity confusion** — a user may access or modify another organization’s lines, leads, incidents, or billing state.
2. **Partial onboarding** — payment may succeed while phone setup fails, or a phone line may activate before policy review finishes.
3. **Entitlement races** — canceled or delinquent accounts may continue dispatching callbacks.
4. **Webhook ambiguity** — provider events must resolve to the correct tenant and line without trusting user-supplied tenant IDs.
5. **Billing duplication** — provider retries must not create duplicate subscriptions, invoices, credits, or usage entries.
6. **Privilege escalation** — an invited staff member must not silently become an owner or access platform administration.
7. **Unsafe self-service activation** — customers must not bypass compliance, number verification, spend limits, or test mode.
8. **Secret sprawl** — tenant-specific integration secrets cannot be exposed in client code or ordinary database reads.
9. **Deletion ambiguity** — offboarding must preserve legally required accounting records while deleting unnecessary personal data.
10. **Operational blindness** — production support needs searchable audit events, health status, and explainable entitlement decisions.

Phase 3 must solve these before marketing Ringback as self-service SaaS.

## Scope

### Included

- organizations/workspaces;
- user authentication integration;
- organization memberships and roles;
- server-enforced row-level tenant isolation;
- self-service onboarding state machine;
- business profile and phone-line setup;
- provider-number verification and activation states;
- subscription and plan records;
- idempotent billing webhook processing;
- entitlements and usage metering;
- plan-based callback limits;
- operator and tenant dashboards/APIs;
- audit log and support tooling;
- safe account suspension and offboarding;
- production observability contracts;
- migration and rollback documentation;
- CI validation for multi-tenant invariants.

### Explicitly excluded

- autonomous free-form voice agents;
- vertical-specific qualification logic;
- calendar booking;
- full CRM replacement;
- agency/reseller hierarchy;
- revenue attribution beyond the existing pilot outcome fields;
- production activation of a real payment account when credentials are unavailable;
- automatic purchase of regulated phone numbers without provider approval workflows.

## Domain model

Introduce or formalize these entities:

### Organizations

- `organizations`
  - stable ID;
  - display name;
  - legal/business metadata kept minimal;
  - lifecycle state: `trial`, `active`, `past_due`, `suspended`, `closing`, `closed`;
  - default timezone;
  - data-retention profile;
  - created/updated timestamps.

### Memberships

- `organization_memberships`
  - organization ID;
  - authenticated user ID;
  - role: `owner`, `admin`, `operator`, `viewer`, `billing`;
  - invitation and acceptance state;
  - immutable inviter/audit metadata.

Role capabilities must be explicit. Do not infer access from UI visibility.

### Business locations

- `business_locations`
  - organization ID;
  - customer-facing business name;
  - service region;
  - timezone;
  - operating status;
  - approved policy profile.

One organization may eventually operate multiple locations, but Phase 3 may constrain plans while preserving the model.

### Phone lines

- `phone_lines`
  - organization and location IDs;
  - inbound number;
  - callback number;
  - owner/escalation destination;
  - provider identifiers;
  - provisioning state;
  - verification state;
  - callback policy;
  - spend and daily limits;
  - activation flag;
  - last health check.

### Onboarding

- `onboarding_sessions`
  - organization ID;
  - current step;
  - completed steps;
  - validation failures;
  - provider setup state;
  - policy acceptance version;
  - activation readiness;
  - timestamps.

Use a forward-controlled state machine. A client must not arbitrarily set onboarding to complete.

### Billing

- `billing_customers`;
- `subscriptions`;
- `subscription_events`;
- `usage_ledger`;
- `entitlement_snapshots`.

Billing provider IDs must be unique. Provider webhook event IDs must be idempotent.

### Operations

- `audit_events`;
- `integration_secrets` or encrypted secret references;
- `service_health_events`;
- `support_actions`;
- `data_deletion_requests`.

## Tenant-isolation architecture

### Core invariant

Every customer-owned record must carry `organization_id` directly or be reachable through an enforced foreign-key path whose organization cannot change silently.

### Required controls

- Supabase/Auth identity resolves to membership server-side.
- RLS policies check active organization membership and role.
- Service-role operations still include explicit organization filters.
- Unscoped repository methods are prohibited.
- Composite foreign keys prevent cross-organization references.
- Callback jobs, leads, feedback, incidents, phone lines, usage and audit records are tenant-bound.
- Public feedback tokens remain narrowly scoped to one lead and cannot expose broader tenant data.
- Internal operator routes require platform authorization separate from tenant roles.

### Test matrix

For every customer resource, test:

- same-tenant owner access;
- same-tenant least-privilege access;
- cross-tenant denial;
- unauthenticated denial;
- suspended-membership denial;
- service-role method with wrong organization ID;
- forged resource ID;
- deleted membership;
- ownership transfer edge case.

## Authentication and authorization

Use Supabase Auth or the repository’s chosen authenticated identity layer.

Required flows:

- create account;
- verify email or configured identity method;
- create organization;
- invite member;
- accept invitation;
- revoke member;
- transfer ownership safely;
- recover account;
- require recent authentication for destructive actions;
- separate platform operator access from customer access.

Do not store passwords in application tables.

## Onboarding state machine

Recommended states:

```text
account_created
  → organization_created
  → business_profile_complete
  → policy_acknowledged
  → phone_line_configured
  → provider_verified
  → test_mode
  → billing_ready
  → activation_review
  → active
```

Failure and pause states:

```text
needs_attention
provider_failed
billing_failed
suspended
closed
```

Activation requires all server-side gates. UI completion alone is insufficient.

## Billing and entitlements

### Provider abstraction

Create a billing adapter interface so tests do not require live Stripe or another provider.

Expected operations:

- create or find customer;
- create checkout/session intent;
- read subscription state;
- process provider events;
- cancel at period end;
- suspend or resume entitlements;
- record credits/refunds if supported.

### Idempotency

- Persist every billing webhook event ID before applying changes.
- Duplicate events must be no-ops.
- Out-of-order events must not revive a canceled subscription incorrectly.
- Subscription state transitions must be monotonic or version-aware.
- Usage rows must have deterministic idempotency keys.

### Entitlement evaluation

A callback may dispatch only when all are true:

- global platform dispatch enabled;
- organization lifecycle permits service;
- subscription entitlement permits callbacks;
- business/location active;
- phone line active and verified;
- callback policy permits caller;
- daily/monthly usage limit available;
- no tenant or platform kill switch active.

Store the reason when dispatch is denied.

## Usage metering

Meter conservatively:

- callback attempt reserved;
- connected call duration when known;
- messages sent;
- optional model usage in later phases;
- adjustments/credits as separate immutable ledger entries.

Do not update a mutable “usage total” without retaining the source ledger.

Required tests:

- duplicate event does not double-charge;
- concurrent dispatch cannot exceed entitlement;
- billing period boundary;
- timezone-independent accounting period;
- refund/credit does not delete original usage;
- suspended tenant cannot consume new usage;
- historical usage remains readable after cancellation.

## Self-service configuration

Tenant users may configure only safe fields:

- public business name;
- service region;
- owner notification destination after verification;
- callback delay within platform bounds;
- operating schedule;
- allowlist/blocklist;
- preferred notification channel where supported;
- daily cap below plan maximum;
- pilot/test mode.

Server-controlled fields include:

- organization ownership;
- provider account identifiers;
- subscription entitlement;
- verification flags;
- maximum plan limits;
- platform safety policies;
- audit records;
- secret references.

## Operational tooling

Implement protected endpoints or a minimal dashboard contract for:

- tenant health summary;
- line provisioning state;
- callback failure reasons;
- subscription and entitlement state;
- usage summary and ledger;
- incidents;
- audit events;
- member management;
- pause/resume with reason;
- data export request;
- account closure request.

Every operator action must produce an audit event with actor, tenant, action, reason and timestamp.

## Observability

Add structured events for:

- authentication and authorization denials;
- onboarding transitions;
- line verification;
- entitlement decisions;
- billing events;
- callback dispatch and failure;
- quota denial;
- tenant pause/suspension;
- support actions;
- deletion workflow.

No raw secrets or full sensitive transcripts in logs.

## Migration plan

1. Add organizations and membership tables.
2. Create a platform-owned legacy/pilot organization for existing Phase 2 businesses.
3. Backfill organization IDs into pilot businesses and related records.
4. Add constraints and indexes.
5. Add RLS policies and role functions.
6. Add onboarding, billing, usage and audit tables.
7. Add new organization-scoped RPCs.
8. Migrate repository interfaces.
9. Retain compatibility views or adapters only when necessary.
10. Document rollback limitations after irreversible constraint enforcement.

Migration tests must verify that Phase 2 records remain connected to the correct business and organization.

## Implementation workstreams

### Workstream A — Schema and access control

- migrations;
- organization membership model;
- RLS helpers;
- composite tenant constraints;
- tenant-scoped RPCs;
- legacy backfill.

### Workstream B — Application domain

- organization service;
- membership authorization;
- onboarding state machine;
- phone-line configuration;
- entitlement evaluator;
- audit service.

### Workstream C — Billing

- provider adapter;
- webhook verification;
- event idempotency;
- subscription state machine;
- usage ledger;
- plan definitions.

### Workstream D — Routes and UI/API contracts

- authenticated tenant endpoints;
- platform operator endpoints;
- onboarding endpoints;
- billing endpoints;
- member management;
- account lifecycle.

### Workstream E — Tests and documentation

- isolation suite;
- billing replay suite;
- onboarding suite;
- compatibility tests;
- deployment checklist;
- threat model;
- decision record.

## Required files

At minimum, Phase 3 should add or update:

- `phase3/README.md`;
- `phase3/THREAT-MODEL.md`;
- `phase3/DEPLOYMENT-CHECKLIST.md`;
- `phase3/VALIDATION.md`;
- `phase3/DECISION.md`;
- production multi-tenant migration(s);
- organization/membership modules;
- onboarding state machine;
- billing adapter and mock;
- entitlement service;
- usage ledger service;
- authenticated route layer;
- regression and security tests;
- root README roadmap status.

## Acceptance gates

Phase 3 is code-complete only when all are true:

- [ ] Every tenant-owned record is organization-scoped.
- [ ] Cross-tenant access tests pass for all sensitive resources.
- [ ] Roles enforce least privilege.
- [ ] Organization ownership transfer cannot leave an ownerless tenant.
- [ ] Onboarding cannot skip server-side gates.
- [ ] Phone-line activation requires verification.
- [ ] Billing webhook retries are idempotent.
- [ ] Out-of-order billing events do not incorrectly restore entitlement.
- [ ] Usage reservation is concurrency safe.
- [ ] Suspended or delinquent tenants cannot dispatch callbacks.
- [ ] Existing Phase 2 businesses migrate without identity changes.
- [ ] Audit events exist for privileged and destructive actions.
- [ ] Account closure and data deletion workflows are documented.
- [ ] Full Phase 0–3 test suite passes.
- [ ] Build and typecheck pass.
- [ ] New external integrations remain mockable and disabled without credentials.

## Merge verification

After implementation:

- branch: `agent/phase3-production-multitenancy`;
- PR title: `Implement Phase 3 production multi-tenancy`;
- squash-merge into `main`;
- verify `phase3/README.md` and the defining migration on remote `main`;
- report PR, merge SHA, test count, migrations, inactive/live state and untested external boundaries.

## Phase 4 entry gate

Do not begin Phase 4 until the final Phase 3 mainline state has:

- stable tenant and line identities;
- server-authorized configuration;
- organization-scoped data access;
- feature entitlements;
- auditable usage;
- versioned policy/config storage suitable for vertical playbooks.
