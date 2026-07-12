# Missed-Call Audit

The audit determines the real composition of missed calls. It prevents the founder from treating every unanswered ring as a lost sale.

## Scope

Audit a defined time window for each participating business, preferably including weekdays, weekends, busy hours, and after-hours periods. Record the source and reliability of every field.

## Data minimization

- Prefer provider call IDs or locally generated pseudonymous IDs over raw phone numbers.
- Hash or redact caller numbers before exporting data from the business where practical.
- Do not copy message content, recordings, or names unless required and explicitly approved.
- Keep a separate deletion date for raw source material.
- Limit access to the smallest number of people.

## Classification taxonomy

Each missed call receives one primary class:

- `new_lead`
- `existing_customer`
- `supplier_or_partner`
- `spam_or_robocall`
- `wrong_number`
- `employee_or_internal`
- `unknown`

And one outcome:

- `not_contacted`
- `owner_called_back_no_answer`
- `owner_contacted`
- `booked`
- `won`
- `lost_to_competitor`
- `not_serviceable`
- `duplicate`
- `unknown`

## Required fields

See `templates/call-audit.csv`. Important fields include:

- business and call identifiers;
- local timestamp and business-hours flag;
- ring duration and provider disposition;
- source of classification;
- caller category;
- whether the owner returned the call;
- callback delay;
- booking/job outcome;
- approximate revenue and confidence;
- eligibility for a recovery experiment;
- exclusion reason.

## Recovery eligibility

A missed call is eligible only when all checks pass:

- no owner or employee has already returned it;
- it is not an emergency or excluded category;
- it is not known spam, internal traffic, or a wrong number;
- the business has approved the script and contact method;
- contact is permitted under applicable telecom, privacy, and consent rules;
- it has not already received the maximum recovery attempts;
- the callback can identify the business clearly.

## Bias controls

### Memory bias

Do not rely only on the owner recalling “important” calls. Use provider logs where possible.

### Classification bias

Mark uncertain calls `unknown`; do not force them into `new_lead` to improve economics.

### Survivorship bias

Include calls that never answered the owner’s return call. They may be the exact opportunities Ringback cannot recover.

### Time-window bias

Do not audit only the busiest day or a festival/seasonal peak.

### Outcome leakage

The person classifying the call should not change the original class after learning that the job became valuable. Keep the initial classification and outcome separate.

## Core audit metrics

- missed calls per business per week;
- percent classified as genuine new leads;
- percent already recovered manually;
- percent eligible for Ringback;
- median owner callback delay;
- percent never contacted;
- booking rate among manually recovered new leads;
- estimated gross profit left unrecovered;
- distribution by hour, day, source, and language.

## Interpretation

A high number of missed calls is not sufficient. Ringback needs a meaningful intersection:

`genuine new lead × still unrecovered × legally contactable × owner can fulfil × enough job value`

The report generator calculates the observable portions of this funnel, but the final decision must preserve uncertainty and exclusions.
