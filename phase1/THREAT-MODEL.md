# Phase 1 Threat and Failure Model

## Assets

- business reputation and caller trust;
- telephony spend;
- caller phone numbers and qualification answers;
- Twilio and Supabase credentials;
- correctness of callback-job state;
- owner attention.

## Principal threats

| Threat | Failure | Control |
|---|---|---|
| forged webhook | attacker triggers paid calls | validate every Twilio webhook signature over the exact public URL and all form fields |
| duplicate delivery | caller receives repeated callbacks | unique event key plus unique source CallSid constraint |
| out-of-order delivery | state regresses after completion | sequence guard and legal transition map |
| concurrent dispatchers | two workers dial one job | Postgres `FOR UPDATE SKIP LOCKED` claim RPC |
| owner collision | owner and automation call together | configurable waiting window and manual-callback suppression event |
| wrong destination | internal/business number is called | E.164 validation, destination match, self-call rejection, blocklist |
| caller deception | user believes AI is a human | identify the business and automated assistant in the first sentence |
| prompt overreach | system invents price or availability | deterministic prompts with three approved fields only |
| sensitive-data capture | unnecessary personal data retained | field length caps, no recording, no payment/identity questions |
| secret leakage | account compromise | environment secrets only; generic errors; no token logging |
| silent owner failure | lead exists but is ignored | delivery is a distinct state; Phase 2 must add owner acknowledgment tracking |
| runaway spend | repeated or malicious dialing | one attempt default, kill switch through business active flag, provider limits |

## Required operational controls

- separate Twilio subaccount for the pilot;
- low spend alert and hard usage cap;
- verified outbound caller ID or owned number;
- regional permission review before live use;
- emergency stop by setting the business inactive;
- daily inspection of failed, suppressed, no-answer, and duplicate events;
- deletion policy for call metadata and lead contents;
- no recordings during Phase 1.

## Known residual risks

- carrier spam labelling can still reduce callback answer rates;
- Twilio status alone may not represent every forwarding topology correctly;
- manual-callback suppression requires an owner-side signal until deeper phone integration exists;
- a one-minute cron produces variable dispatch latency;
- SMS delivery does not prove that the owner read the lead;
- built-in speech recognition quality may vary by accent, language, and noise;
- a provider message sent immediately before a database failure may be delivered twice on retry.

These risks must be measured rather than hidden by adding more AI.
