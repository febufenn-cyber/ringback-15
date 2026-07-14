# Attribution Specification

## Evidence hierarchy

1. `financial_verified` — payment, invoice or refund evidence from an authorized financial source.
2. `provider_verified` — telephony, booking or CRM provider evidence.
3. `owner_reported` — an authenticated business user reports the outcome.
4. `estimated` — a declared assumption, never presented as collected revenue.

## Revenue stages

The report stores these independently:

- expected or booked value;
- invoiced value;
- collected value;
- refunded value;
- net collected value;
- confidence-weighted collected value;
- conservatively attributed value;
- delivery cost;
- contribution after attributed value and cost.

## Attribution classes

| Class | Default weight | Meaning |
|---|---:|---|
| `direct_recovery` | 1.00 | Missed call, Ringback connection, qualification and outcome are linked. |
| `assisted_recovery` | 0.65 | Ringback qualified the lead, but contribution is shared or incomplete. |
| `likely_incremental` | 0.40 | Timing and booking evidence suggest incrementality, but the chain is incomplete. |
| `unattributed` | 0.00 | An outcome exists without defensible Ringback contribution. |
| `counterfactual_unknown` | 0.00 | There is no adequate baseline or outcome chain. |

Every event and report stores a rule version. Changing a rule produces a new calculation version; it does not rewrite source evidence.

## Corrections

Attribution events are append-only. Refunds, chargebacks, source corrections and revised owner outcomes are new events. Original evidence is retained.

## Identity

Identity links are always scoped to one organization. Exact provider identifiers are preferred. Manual links require an actor. Name similarity alone is not a valid merge rule.

## Currency

One report has one currency. Mixed-currency evidence is rejected until a separately approved conversion source and timestamped rule are implemented.
