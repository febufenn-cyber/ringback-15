# Unit Economics

Phase 0 economics must be conservative. Do not count every missed call as a lead or every booking as attributable to Ringback.

## Funnel model

For a period:

```text
eligible missed leads
× recovery engagement rate
× qualification completion rate
× owner follow-through rate
× booking rate
× job completion rate
× gross profit per completed job
= expected recovered gross profit
```

Keep the owner follow-through term explicit. A perfect lead ignored by the business has no realized value.

## Delivery cost model

```text
outbound telephony
+ transcription
+ text-to-speech
+ model inference
+ SMS/WhatsApp
+ storage and observability
+ support time
+ refunds/credits
= variable and service cost
```

During concierge tests, price human operator time at a realistic fully loaded rate even when the founder performs the work.

## Contribution model

```text
subscription and usage revenue
- variable delivery cost
- expected support cost
- partner/reseller share
- payment fees
= contribution before acquisition cost
```

## Conservative attribution

Apply an attribution factor below 100% when:

- the owner may have called back anyway;
- the customer contacted multiple channels;
- the lead already existed in the CRM;
- the booking occurred long after the recovery;
- revenue is owner-estimated rather than documented.

Record low, base, and high scenarios instead of one precise number.

## Required scenarios

### Low case

- lower genuine-lead share;
- lower engagement;
- higher delivery cost;
- lower owner follow-through;
- conservative gross profit;
- partial attribution.

### Base case

Use the median observed values from the pilot without rounding upward.

### High case

Use plausible upside, but never use it as the sole justification to proceed.

## Pricing tests

Test willingness to pay using commitments, not survey answers:

1. paid pilot with fixed limits;
2. refundable deposit;
3. letter of intent with a stated monthly price;
4. invoice accepted after a supervised trial.

Possible future models:

- flat monthly fee with included attempts;
- base fee plus usage;
- agency/reseller wholesale price;
- per-qualified-lead only after qualification disputes are understood.

Avoid revenue-share pricing until attribution is reliable.

## Decision ratios

Track:

- recovered gross profit per eligible missed call;
- cost per completed qualification;
- cost per owner-accepted lead;
- cost per booking;
- recovered gross profit divided by total delivery cost;
- monthly contribution per business;
- support minutes per business per week;
- estimated customer acquisition payback.

## Economic gate

Phase 1 should not begin merely because recovered revenue exceeds API cost. It should begin when a conservative model shows room for:

- telecom and AI costs;
- customer support;
- failures and credits;
- reseller or sales margin;
- acquisition cost;
- healthy contribution at the intended price.

A useful qualitative test is whether one ordinary recovered job can cover several months of subscription. Record the actual ratio rather than forcing a preset answer.

Use `templates/economics-inputs.csv` and the generated Phase 0 report for calculations.
