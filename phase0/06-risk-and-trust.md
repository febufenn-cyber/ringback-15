# Risk and Trust Register

Ringback acts under a business's identity at a sensitive moment. Trust failures can destroy the product before model quality matters.

## Risk scale

For each risk, record:

- likelihood: 1–5;
- impact: 1–5;
- detectability: 1–5, where 5 means difficult to detect;
- owner;
- preventive control;
- detection signal;
- stop threshold;
- recovery action.

Prioritize high impact even when likelihood is uncertain.

## Critical Phase 0 risks

### Duplicate callback

**Failure:** webhook retries, two workers, or an employee and Ringback contact the caller simultaneously.

**Controls:** provider-call idempotency key, pre-attempt owner check, active-attempt lock, maximum-attempt counter, visible audit trail.

**Stop threshold:** any unexplained duplicate contact pauses the experiment until root cause is known.

### Caller distrust or spam perception

**Failure:** unfamiliar number, vague introduction, or spam-labelled caller ID causes rejection.

**Controls:** immediate business identification, branded message-first arm, approved caller ID strategy, short contact, opt-out.

### False missed-call detection

**Failure:** call was answered elsewhere, transferred, sent to voicemail intentionally, or already returned.

**Controls:** define exact provider dispositions, grace period, recheck state, owner suppression control.

### Unsafe or binding statements

**Failure:** operator or model gives a price, guarantee, diagnosis, availability, or service promise without authority.

**Controls:** allow-list statements, deterministic script, no free-form commitments, escalation.

### Sensitive-data collection

**Failure:** caller discloses health, financial, identity, or other unnecessary information.

**Controls:** data-minimizing questions, interruption script, redaction, retention limits, no broad transcript access.

### Consent and recording failure

**Failure:** calls or recordings violate local telecom, privacy, or disclosure requirements.

**Controls:** region-specific legal review before recording, recording disabled by default in research, explicit disclosure where needed, documented lawful basis and retention.

### Emergency misrouting

**Failure:** caller describes immediate danger and the recovery flow continues normally.

**Controls:** approved emergency keywords are only a backup; train operator to stop qualification, direct to local emergency help where appropriate, and alert the owner. Do not use Phase 0 in high-harm emergency verticals.

### Owner non-response

**Failure:** valid leads are collected but ignored.

**Controls:** one-tap actions, response SLA agreed before pilot, escalation reminders, measure owner follow-through separately.

### Spam and telecom reputation

**Failure:** high-frequency callbacks or poor caller ID reputation reduce answer rates or cause blocking.

**Controls:** strict caps, consent-aware contact, no repeated pursuit, number reputation monitoring, provider policy review.

### Language mismatch

**Failure:** caller cannot understand the operator or script.

**Controls:** one primary language at launch, explicit language handoff, no pretending unsupported fluency, record language demand.

### Selection and confirmation bias

**Failure:** founder recruits unusually friendly businesses or reclassifies uncertain calls as leads.

**Controls:** predefined taxonomy, retain unknown category, include negative cases, document contradictory evidence, independent review of a sample.

## Mandatory kill switch

The experiment must be stoppable at business, phone-line, and caller level. Stop immediately after:

- duplicate or repeated contact;
- serious complaint;
- regulatory uncertainty discovered during execution;
- emergency mishandling;
- unauthorized promise;
- material data exposure;
- evidence that suppression is not working.

## Phase 0 risk output

Before proceeding, produce:

- top five risks by severity;
- safeguards tested in practice;
- unresolved legal questions;
- observed complaints and confusion rate;
- incidents and root causes;
- risks accepted for Phase 1 and why.
