# Phase 3 Assumptions

- External Auth, billing, telephony provisioning, and database services remain disabled during repository implementation.
- Provider webhook signature verification is implemented by provider adapters before events reach the normalized billing service.
- Existing Phase 2 rows are not automatically assigned to synthetic organizations; migration to production tenants requires an explicit mapping step.
- Service-role credentials remain server-side and commercial table mutations pass through audited application services.
- Code completion does not imply live production readiness.
