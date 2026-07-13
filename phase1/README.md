# Phase 1 — One-Business Reliable Technical Loop

Phase 1 does not attempt to build the final AI receptionist. It builds one narrow, auditable recovery loop for one approved business:

> verified missed-call event → duplicate-safe waiting window → callback → deterministic qualification → lead card → owner outcome

The phase is successful only when this loop runs repeatedly without duplicate contact, state corruption, hidden failures, or caller confusion.

## Kasparov-style position analysis

The tempting move is to optimize the conversation. The stronger move is to secure the position first.

The largest technical risks are upstream and downstream of the voice agent:

1. **False missed-call detection** can contact a caller who was already served.
2. **Duplicate webhooks** can create multiple callback jobs.
3. **Out-of-order progress events** can move a completed job backward to ringing.
4. **Owner/manual callbacks** can collide with automation.
5. **Untrusted webhooks** can trigger calls at the attacker's expense.
6. **A successful conversation with no owner action** creates no business value.
7. **A complex streaming voice stack** can hide reliability problems behind an impressive demo.

Phase 1 therefore uses deterministic orchestration and Twilio speech gathering. Deepgram, ElevenLabs, an LLM agent, billing, multi-tenancy, and a full CRM remain out of scope.

## Implemented loop

```text
Twilio inbound terminal event
        ↓
Twilio signature verification
        ↓
provider-event idempotency check
        ↓
missed-call eligibility policy
        ↓
unique job for source CallSid
        ↓
short waiting window
        ↓
manual-callback suppression check
        ↓
atomic due-job claim
        ↓
Twilio outbound callback
        ↓
deterministic service/location/urgency capture
        ↓
lead persisted in Supabase
        ↓
lead card sent to owner by SMS
```

## Reliability invariants

These are more important than feature count:

- one source call can create at most one callback job;
- one provider event is processed at most once;
- stale progress events cannot regress state;
- due jobs are atomically claimed before dialing;
- an owner callback during the waiting window suppresses automation;
- unsupported, anonymous, blocked, mismatched, or canceled calls do not trigger recovery;
- every state change is persisted and inspectable;
- the callback identifies the business and the automated assistant immediately;
- no price, availability, or service promise is generated;
- the caller is asked only three qualification questions;
- secrets never appear in source control or logs.

## State machine

```text
waiting_window
  ├─ dispatching → dialing → ringing → connected → qualifying → lead_ready → notified
  ├─ suppressed
  ├─ cancelled
  └─ failed

busy/no-answer → no_answer
```

Terminal states never move backward. Twilio sequence numbers are stored so delayed webhook delivery cannot corrupt the job.

## Repository map

- `src/types.ts` — domain contracts.
- `src/policy.ts` — missed-call eligibility and E.164 checks.
- `src/state-machine.ts` — explicit legal transitions.
- `src/coordinator.ts` — orchestration and suppression logic.
- `src/twilio.ts` — request validation and REST gateway.
- `src/twiml.ts` — deterministic qualification prompts.
- `src/supabase-repository.ts` — persistence adapter.
- `src/worker.ts` — HTTP routes and internal controls.
- `supabase/migrations/001_phase1.sql` — schema and atomic claim RPC.
- `test-js/phase1.test.mjs` — reliability tests.

## Setup

1. Apply `supabase/migrations/001_phase1.sql` to a dedicated Supabase project.
2. Copy `.dev.vars.example` to `.dev.vars` and replace every placeholder.
3. Configure the Twilio status and voice callback URLs to the deployed Worker.
4. Keep the business inactive until the Phase 0 live-contact and regional compliance gates are satisfied.
5. Run:

```bash
npm install
npm test
npm run build
npx wrangler deploy
```

## Routes

| Route | Purpose | Protection |
|---|---|---|
| `GET /health` | deployment health | public, no sensitive data |
| `POST /webhooks/twilio/inbound-status` | normalize missed inbound call | Twilio signature |
| `POST /webhooks/twilio/outbound-status` | update callback progress | Twilio signature |
| `POST /voice/start` | introduction and service question | Twilio signature |
| `POST /voice/service` | store service need | Twilio signature |
| `POST /voice/location` | store location | Twilio signature |
| `POST /voice/urgency` | store urgency and send lead | Twilio signature |
| `POST /internal/dispatch-due` | claim and dial due jobs | bearer secret |
| `POST /internal/manual-callback` | suppress automation after owner action | bearer secret |

A Cloudflare cron invokes the same due-job dispatcher every minute.

## Phase 1 acceptance gates

Do not begin a multi-business pilot until all are true:

- [ ] 100 replayed duplicate inbound events create one job each.
- [ ] 100 replayed duplicate outbound events create no state regression.
- [ ] forced out-of-order event sequences preserve monotonic state.
- [ ] concurrent dispatcher tests create one outbound call per job.
- [ ] manual callback suppression is proven before dialing.
- [ ] invalid Twilio signatures are rejected.
- [ ] every failed dial has a visible terminal reason.
- [ ] at least 20 supervised live recovery attempts complete with zero duplicate contacts.
- [ ] caller confusion and complaint counts remain inside the Phase 0 stop conditions.
- [ ] the owner acknowledges or acts on at least 80% of delivered lead cards during the supervised test.

## Explicit non-goals

- autonomous free-form conversation;
- call recording;
- pricing or quote generation;
- emergency handling beyond stopping and directing to a human/emergency service;
- multiple businesses or self-service onboarding;
- automatic retries beyond the configured first attempt;
- calendar booking;
- revenue attribution;
- dashboards and billing.

The next phase should add multiple supervised businesses only after these invariants survive real traffic.
