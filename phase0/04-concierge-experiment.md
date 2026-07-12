# Concierge Recovery Experiment

This experiment tests the product outcome before building autonomous voice infrastructure.

## Objective

Learn whether a fast, clearly identified recovery contact converts an eligible missed call into an actionable lead and, eventually, revenue.

## Non-objectives

- proving that a model can hold a long conversation;
- collecting a complete CRM record;
- impersonating a receptionist;
- providing prices, diagnosis, guarantees, or advice not approved by the business;
- optimizing voice quality before caller trust is established.

## Preconditions

- written business approval;
- approved script and exclusions;
- documented contact and recording rules for the target region;
- owner escalation contact;
- a method to detect manual callbacks and suppress duplicates;
- a daily attempt cap;
- a kill switch;
- a defined deletion period for raw notes or recordings.

## Experiment arms

Start with the safest channel and add complexity only when required.

### Arm A — Branded message first

Send a short SMS/WhatsApp message identifying the business and offering a callback or reply.

### Arm B — Human concierge callback

A trained operator calls using the approved script, identifies the business immediately, discloses that they are assisting the business, and asks at most four questions.

### Arm C — Scripted automated callback

Use only after A/B establishes that the introduction, timing, and qualification sequence work. The system must disclose automation where required and offer human escalation.

Do not compare arms with tiny samples as though the result is statistically conclusive. Use them to detect major trust or workflow failures.

## Timing hypotheses

Test controlled windows such as:

- approximately 1–2 minutes after the call ends;
- approximately 5 minutes after the call ends;
- message immediately, callback after customer confirmation.

Before every attempt, check whether the owner has already called, the customer has called again, or another recovery is in progress.

## Approved opening

> Hello, you called [Business Name] a few moments ago. They could not answer, so I am helping collect what you need. Is now a good time for a few short questions, or would you prefer the owner to call you directly?

Avoid vague openings such as “I am calling about your enquiry” that resemble spam.

## Maximum qualification sequence

1. What service do you need?
2. Where is the service needed?
3. How urgent is it or when do you need help?
4. What is the best time for the business to contact or visit you?

Optional name confirmation may replace one question. Do not extend the call merely because the caller is cooperative.

## Immediate escalation triggers

- caller asks for a human;
- safety emergency;
- complaint, refund, dispute, or threat;
- request for a binding price or guarantee;
- sensitive personal information;
- inability to understand after two repair attempts;
- caller expresses confusion about who is calling;
- hostile or distressed caller.

## Lead card

Every successful recovery produces a standard card:

- caller identifier;
- requested service;
- location/service area;
- urgency;
- preferred time;
- concise summary;
- confidence and missing information;
- actions: `Call now`, `Accept`, `Booked`, `Not a lead`.

The owner should not need to open a dashboard to act.

## Attempt limits

Default experiment rule:

- one callback attempt;
- one fallback message if appropriate;
- no repeated automated pursuit without an explicit response;
- suppress the caller immediately when requested.

## Metrics

Track the funnel separately for each arm:

- eligible missed calls;
- attempts initiated;
- delivered/rang;
- answered or replied;
- consented to continue;
- qualification completed;
- lead card delivered;
- owner acknowledged;
- owner contacted caller;
- booked;
- completed/won;
- approximate revenue and gross profit;
- opt-outs, complaints, confusion, duplicate contacts, and false positives.

## Daily review

At the end of every experiment day:

1. inspect all failures and complaints;
2. verify no duplicate contacts occurred;
3. compare owner actions with lead quality;
4. identify questions that callers could not answer;
5. record any promise or wording that exceeded the approved script;
6. decide whether to continue, modify, pause, or stop.

## Success signal

The strongest signal is not answer rate. It is a repeated chain:

`eligible missed call → trusted engagement → actionable lead → owner action → booking/job`

Use `templates/recovery-attempts.csv` and `templates/owner-outcomes.csv` to record the experiment.
