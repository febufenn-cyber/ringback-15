# Phase 0 — Evidence Before Automation

Phase 0 answers one question:

> Can Ringback recover enough real revenue from missed calls in one narrow market to justify automating the workflow?

This phase is not complete when interviews are finished. It is complete only when observed call data, live recovery attempts, owner actions, and economic outcomes support a go/no-go decision.

## The four proofs

1. **Problem proof** — target businesses miss enough genuine new-customer calls.
2. **Behaviour proof** — callers answer or respond to a fast, clearly identified recovery attempt.
3. **Workflow proof** — owners act on structured leads instead of ignoring them.
4. **Economic proof** — recovered gross profit comfortably exceeds delivery and acquisition costs.

## Operating principles

- Start with one vertical, one geography, and one primary language.
- Prefer observed behaviour over stated opinions.
- Treat every claim as a hypothesis with a disconfirming test.
- Separate genuine new leads from spam, suppliers, existing customers, and wrong numbers.
- Track the full chain from missed call to contacted, booked, completed, and revenue outcome.
- Do not automate a workflow until the manual version repeatedly creates value.
- Preserve caller trust: identify the business immediately and never pretend the system is human.
- Use the smallest possible dataset and delete raw personal data when it is no longer needed.

## Recommended initial position

Test three verticals on paper, then select one for live work. Good opening candidates are appliance repair, plumbing/electrical services, and vehicle repair. Avoid high-harm domains such as emergency medical, legal, or financial advice during Phase 0.

## Phase 0 workstreams

| Workstream | Output | Decision it supports |
|---|---|---|
| Vertical selection | Ranked scorecard | Where to concentrate |
| Founder interviews | Pain and workflow evidence | Whether the problem is understood |
| Call-log audit | Missed-call composition | Whether enough recoverable demand exists |
| Concierge recovery | Real callback/text experiments | Whether callers engage |
| Owner follow-through | Lead outcome tracking | Whether businesses act |
| Unit economics | Conservative contribution model | Whether the product can make money |
| Trust and risk | Failure-mode register | Whether the experiment is safe |
| Final scorecard | Go, revise, or stop | Whether Phase 1 is justified |

## Suggested 14-day execution

### Days 1–2: choose the battlefield

- Score 3–5 verticals using `01-vertical-selection.md`.
- Select one geography and one language.
- Define explicit exclusions.
- Create a list of at least 20 reachable businesses.

### Days 3–5: understand the current game

- Conduct 8–12 structured interviews.
- Request anonymized call-log exports or screen-share reviews.
- Record current callback time, owner behaviour, average job value, and missed-call causes.
- Do not pitch until the workflow has been mapped.

### Days 6–9: audit real missed calls

- Classify at least 100 missed calls across multiple businesses where possible.
- Separate new leads, existing customers, spam, suppliers, wrong numbers, and unknowns.
- Estimate how many were manually recovered and how many were lost.

### Days 10–13: run a concierge recovery experiment

- With explicit business approval, recover a controlled sample manually or through a tightly scripted operator.
- Test callback delay, introduction wording, call versus message, and question count.
- Send owners a standardized lead card with one-tap outcome choices.
- Track bookings and completed jobs, not only answered calls.

### Day 14: decide

- Complete `07-go-no-go-scorecard.md`.
- Choose one result: **GO**, **REVISE AND RETEST**, or **STOP**.
- Record the decision and evidence in `docs/decision-log.md`.

## Minimum evidence target

These are internal research targets, not universal market benchmarks:

- At least 8 completed owner interviews.
- At least 3 businesses willing to share call-log evidence.
- At least 100 missed calls classified.
- At least 20 eligible recovery attempts, subject to consent and local rules.
- At least 10 owner-rated lead outcomes.
- At least 3 observed bookings or a clearly documented reason why the sample could not reach that number.
- At least 1 business willing to pay or sign a paid pilot agreement.

Small samples are directional. Record uncertainty rather than presenting estimates as established truth.

## Stop conditions

Stop or redesign immediately when any of the following appears:

- Genuine new leads are a small fraction of missed calls.
- Customers perceive the recovery contact as spam or deceptive.
- Caller identification cannot be made trustworthy.
- Owners do not act on leads even when they are clearly qualified.
- One recovered job does not cover several months of plausible subscription cost.
- Manual support required per business makes the planned price uneconomic.
- Legal, consent, recording, or telecom constraints cannot be satisfied in the target region.

## Repository assets

- `01-vertical-selection.md` — weighted market-selection method.
- `02-founder-interview-script.md` — non-leading discovery interview.
- `03-missed-call-audit.md` — call classification and data handling.
- `04-concierge-experiment.md` — manual recovery protocol.
- `05-unit-economics.md` — conservative economic model.
- `06-risk-and-trust.md` — failure modes and safeguards.
- `07-go-no-go-scorecard.md` — final decision gate.
- `templates/` — reusable collection files.
- `scripts/phase0_report.py` — zero-dependency report generator for the CSV templates.
