# Vertical Selection — Choose the Battlefield

The objective is not to find the largest market. It is to find the narrowest market in which missed-call recovery is frequent, valuable, safe, and easy to prove.

## Candidate filter

Reject a vertical before scoring when it depends on any of the following during the first pilot:

- emergency diagnosis or high-harm advice;
- regulated professional judgment;
- complex pricing commitments;
- long enterprise procurement;
- very low inbound call volume;
- no practical way to identify missed calls or return them under the business identity.

## Weighted scorecard

Score each criterion from 0 to 5. Multiply the score by its weight. Maximum weighted score: 500.

| Criterion | Weight | What a 5 looks like |
|---|---:|---|
| Missed-call frequency | 15 | Missed calls happen daily across many businesses |
| Value per genuine lead | 15 | One converted lead can pay for months of service |
| Customer urgency | 10 | The caller is likely to choose the first credible responder |
| Qualification simplicity | 10 | Four or fewer questions create an actionable lead |
| Owner reachability | 10 | Owner-operators can be reached and can approve pilots quickly |
| Sales-cycle speed | 10 | Leads normally book or fail within days, not months |
| Outcome observability | 10 | Booking and job value can be verified with little effort |
| Low caller harm | 10 | Misclassification is inconvenient, not dangerous |
| Telephony feasibility | 5 | Call events and callbacks can be integrated reliably |
| Language fit | 3 | The first target language covers most callers |
| Channel fallback | 2 | SMS/WhatsApp fallback is normal and trusted |

### Negative modifiers

Subtract points after the weighted score:

| Risk | Penalty |
|---|---:|
| Call recording or consent uncertainty | -20 |
| Customers commonly use shared/family numbers | -10 |
| High spam-label risk for callbacks | -15 |
| Existing franchise/call-centre system blocks experimentation | -15 |
| Owner cannot provide outcome feedback | -20 |
| Highly seasonal demand | -10 |

## Recommended candidates to compare

1. **Appliance repair** — simple intent, moderate urgency, observable bookings.
2. **Plumbing/electrical services** — high urgency and job value; exclude life-safety emergencies.
3. **Vehicle repair/service** — valuable leads, but qualification may become more complex.
4. **Cleaning/pest control** — easy qualification and scheduling, but lower urgency in some segments.
5. **Real-estate brokers** — high value but long attribution cycles and duplicate-lead disputes.

Avoid medical, legal, lending, insurance advice, and emergency-response workflows in the opening pilot.

## Tie-break questions

When two markets score similarly, choose the one where:

- the founder already has warm access to five businesses;
- one completed job is visibly valuable;
- the business can share outcomes without exposing sensitive customer data;
- callers can be qualified with a deterministic script;
- a failed recovery attempt creates minimal downside;
- the first pilot can start within seven days.

## Selection record

Before live research, record:

- chosen vertical;
- chosen city/region;
- primary language;
- excluded call types;
- why this market won;
- what evidence would prove the choice wrong;
- the date on which the choice will be revisited.

Use `templates/vertical-scorecard.csv` to compare candidates.
