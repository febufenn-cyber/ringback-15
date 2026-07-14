# Phase 3 — Production Multi-Tenancy

Phase 3 implements the commercial control plane that sits around the reliable callback engine.

## Implemented

- organizations and explicit memberships;
- role-capability authorization;
- sequential onboarding state machine;
- tenant-scoped locations and phone lines;
- provider-number verification state;
- plan catalog and entitlement evaluation;
- idempotent normalized billing events;
- idempotent usage metering;
- audit events for privileged changes;
- activation gates, suspension, and line shutdown;
- additive Supabase schema and RLS boundaries.

## Safety position

Merging Phase 3 does not activate billing, provisioning, or calls. Provider webhooks must be verified by an adapter before normalization. Client-side code does not receive service-role credentials, and client writes to commercial tables remain denied.

## Core modules

- `src/platform/types.ts`
- `src/platform/authz.ts`
- `src/platform/onboarding.ts`
- `src/platform/billing.ts`
- `src/platform/memory-store.ts`
- `src/platform/platform-service.ts`
- `supabase/migrations/003_phase3_production_multitenancy.sql`

## Activation boundary

A real deployment still requires Auth configuration, a live Supabase migration, billing-provider credentials, signed webhook verification, phone-number provisioning approval, and supervised traffic.
