# Go / Revise / Stop Scorecard

Complete this document after the research window. Link every score to evidence.

## Hard gates

A **GO** decision requires all hard gates:

- [ ] At least one narrow vertical and geography are defined.
- [ ] At least three businesses provided observed call-log evidence.
- [ ] Missed calls contain a meaningful, quantified share of genuine new leads.
- [ ] A recovery attempt can identify the business credibly.
- [ ] Duplicate suppression was tested successfully.
- [ ] The experiment has documented consent, telecom, privacy, and recording boundaries.
- [ ] Callers can opt out and reach a human.
- [ ] Owners provided outcome feedback.
- [ ] At least one business made a credible payment commitment.
- [ ] No unresolved critical incident makes further testing unsafe.

Failure of a hard gate means **REVISE** or **STOP**, regardless of total score.

## Weighted evidence score

Score each dimension 0–5 and multiply by weight. Maximum: 500.

| Dimension | Weight | Evidence expected |
|---|---:|---|
| Genuine missed-lead volume | 15 | Audited call logs across businesses |
| Recoverability | 15 | Engagement and completion from eligible attempts |
| Revenue value | 15 | Bookings/jobs and conservative gross-profit estimate |
| Owner follow-through | 10 | Contact and outcome actions after lead cards |
| Willingness to pay | 15 | Deposit, paid pilot, or accepted invoice |
| Caller trust | 10 | Low confusion/complaint and clear identity |
| Delivery feasibility | 10 | Reliable event detection, timing, suppression, escalation |
| Regulatory feasibility | 5 | Documented target-region boundaries |
| Distribution access | 3 | Repeatable access to similar businesses |
| Founder advantage | 2 | Language, relationships, or domain access |

## Automatic deductions

- Unexplained duplicate contact: -75
- Serious caller complaint caused by deception: -75
- Owner outcome feedback below half of accepted leads: -30
- Economics depend on high-case assumptions: -30
- More than four qualification questions required: -15
- Support exceeds 30 minutes per business per week in steady-state estimate: -20
- No credible payment commitment: hard-gate failure

## Decision bands

Use only after hard gates:

- **375–500: GO** — define Phase 1 scope from observed workflow.
- **275–374: REVISE AND RETEST** — isolate the weakest assumption and run a narrower experiment.
- **Below 275: STOP OR PIVOT** — do not automate the current concept.

The score is a forcing function, not a substitute for judgment. A single high-impact trust or regulatory risk can override it.

## Required decision memo

Record:

1. Decision: GO, REVISE, or STOP.
2. Date and decision owner.
3. Chosen customer segment.
4. Strongest supporting evidence.
5. Strongest contradictory evidence.
6. Funnel with numerator and denominator at every stage.
7. Conservative unit economics.
8. Incidents, complaints, and exclusions.
9. What Phase 1 will build.
10. What Phase 1 will explicitly not build.
11. The condition that would reverse the decision.

Add the memo to `docs/decision-log.md`.
