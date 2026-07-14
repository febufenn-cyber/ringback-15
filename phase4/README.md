# Phase 4 — Vertical Intelligence and Booking

Phase 4 replaces generic qualification with immutable, versioned workflow graphs and conflict-safe booking primitives.

## Implemented

- approved playbook validation and immutability contract;
- pinned playbook version per conversation;
- deterministic ask, classify, booking, handoff and completion nodes;
- bounded model classification restricted to approved labels;
- low-confidence human handoff;
- emergency and prohibited-field safety checks;
- generated-promise guard;
- locale-specific prompt packs with English fallback;
- appliance-repair reference playbook in English and Tamil;
- booking resources, slots, expiring holds and idempotent confirmation;
- atomic database reservation function preventing capacity overflow.

## Safety state

No model or calendar provider is activated by merging this phase. Provider adapters must use verified credentials, explicit feature flags and idempotency keys. The engine cannot quote prices, diagnose, promise availability, or bypass a safety handoff.
