# Phase 1 Decision

## Decision

**IMPLEMENTED, NOT YET ACTIVATED.**

The repository now contains the one-business reliable technical loop. This is a code-complete gate, not evidence that live caller contact is safe or economically validated.

## What is proven by tests

- duplicate and stale events are controlled;
- state transitions are monotonic;
- manual callback suppression works;
- qualification produces one structured lead;
- transient owner-message failure remains recoverable;
- an early voice webhook cannot regress the dispatcher state.

## What remains unproven

- real forwarding topology and missed-call classification;
- live Postgres concurrency;
- carrier answer and spam-labelling behaviour;
- speech recognition performance for the chosen language and accent;
- caller trust and complaint rate;
- owner response and recovered revenue;
- regional telecom, consent, privacy, and recording requirements.

## Reversal condition

Disable the business immediately if any duplicate contact, identity confusion, unexpected emergency flow, uncontrolled spend, or material complaint occurs.
