# Phase 2 — Closed Multi-Business Pilot

Phase 2 asks a harder question than “can the callback work?”:

> Can Ringback operate across a small group of real businesses without mixing identities, leaking data, exceeding pilot limits, or losing the revenue outcome after the lead is delivered?

The phase is deliberately **closed and operator-managed**. It is not public SaaS onboarding.

## Kasparov-style position analysis

The obvious move is to add more businesses by copying environment variables or deploying one Worker per customer. That appears fast but hides the most dangerous failure:

> A technically correct callback can still use the wrong business name, callback number, owner number, quota, or lead record.

Phase 2 therefore centralizes the pilot roster in Supabase while keeping every call, job, lead, and feedback operation business-scoped.

The second blind spot is uncontrolled success. A pilot that unexpectedly receives hundreds of calls can create telephony spend, complaints, and reputational damage before an operator reacts. Ringback therefore reserves an atomic daily callback slot before each outbound attempt.

The third blind spot is outcome blindness. Without owner feedback, Ringback can count conversations but cannot learn whether leads were contacted, booked, won, or worthless. Every owner lead message now includes a signed, expiring outcome link.

## Implemented pilot modes

| Mode | Behaviour |
|---|---|
| `setup` | Configuration exists; no callback jobs may be claimed |
| `allowlist_only` | Only explicitly approved test caller numbers are eligible |
| `live` | Real eligible missed callers may be contacted within the daily limit |
| `paused` | New callbacks stop immediately; historical outcomes remain accessible |
| `completed` | Pilot is closed and cannot dispatch |

There is also a global emergency stop:

```env
PILOT_GLOBAL_ACTIVE=false
```

Both the global flag and the business mode must permit contact.

## Implemented controls

### Business directory

Each pilot business has its own:

- business identity;
- inbound number;
- outbound callback number;
- owner notification number;
- blocked and allowlisted callers;
- callback delay;
- caller cooldown;
- maximum attempts;
- daily callback limit;
- timezone;
- feedback-link lifetime;
- pilot mode.

Inbound webhooks resolve the business from the called number. Voice and status callbacks resolve it from the callback job. The Worker no longer relies on one global business configuration.

### Tenant-safety controls

- Every Supabase repository query filters by `business_id`.
- The due-job claim RPC accepts a required business ID.
- Callback jobs cannot be saved through another business repository.
- Leads cannot be read or updated through another business repository.
- Owner feedback has a composite database foreign key to the matching business and lead.
- Callback and owner numbers are unique in the pilot roster.
- A callback job is rejected if it does not belong to the resolved business.

### Spend and contact controls

Before dialing:

1. manual callback suppression is checked;
2. maximum attempts are checked;
3. an atomic daily slot is reserved;
4. the call is started.

Quota reservation counts attempts rather than successful conversations. This is intentionally conservative because a failed provider request or short call may still create cost.

### Owner outcome feedback

The owner SMS includes a signed URL containing only business and lead identifiers, an expiration time, and an HMAC signature.

The feedback page supports:

- seen;
- contacted;
- booked;
- won;
- lost;
- not a lead;
- unreachable;
- optional won revenue;
- an optional private note.

The signature is bound to both the business and lead, rejects tampering, and expires automatically. No authentication cookie or public database access is used.

### Incident and pilot summary

The system records operational incidents such as:

- daily quota reached;
- callback start failure;
- feedback link failure;
- owner notification failure.

Operators can also record incidents through the protected internal endpoint.

The pilot summary reports, per business:

- current mode;
- daily callback limit and slots used today;
- total callback jobs;
- notified leads;
- owner feedback count;
- bookings;
- won jobs;
- open incidents.

## Routes

### Public provider routes

| Route | Purpose | Protection |
|---|---|---|
| `POST /webhooks/twilio/inbound-status` | Resolve business and process missed call | Twilio signature |
| `POST /webhooks/twilio/outbound-status` | Update business-scoped callback state | Twilio signature |
| `POST /voice/start` | Start deterministic qualification | Twilio signature |
| `POST /voice/service` | Capture service | Twilio signature |
| `POST /voice/location` | Capture location | Twilio signature |
| `POST /voice/urgency` | Capture urgency and deliver lead | Twilio signature |
| `GET/POST /feedback` | View and update owner outcome | Expiring HMAC link |

### Protected operator routes

| Route | Purpose |
|---|---|
| `POST /internal/dispatch-due` | Dispatch due jobs for all permitted pilot businesses |
| `POST /internal/manual-callback` | Suppress automation after owner/staff contact |
| `GET /internal/pilot/businesses` | List the closed roster |
| `POST /internal/pilot/businesses` | Create or update a pilot business |
| `POST /internal/pilot/mode` | Change one business mode |
| `POST /internal/pilot/incident` | Record an operational incident |
| `GET /internal/pilot/summary` | Review pilot health and outcomes |

All operator routes require the bearer `INTERNAL_SECRET`.

## Recommended ramp

Do not move every business directly to `live`.

### Stage A — configuration

- Create the business in `setup`.
- Verify all phone numbers and business identity.
- Confirm the owner recognizes the callback number.
- Confirm the owner SMS number.
- Set the daily limit to five or fewer.

### Stage B — allowlist

- Add staff and supervised test numbers.
- Move to `allowlist_only`.
- Replay missed-call and duplicate webhook scenarios.
- Complete at least five end-to-end calls.
- Submit feedback from every lead link.
- Test pause and global emergency stop.

### Stage C — narrow live window

- Move one business to `live`.
- Keep other businesses in `allowlist_only`.
- Run a supervised time window.
- Review every attempt the same day.
- Pause automatically or manually after the approved limit.

### Stage D — closed cohort

- Add the next business only after the previous business has no unresolved critical incident.
- Never increase both business count and daily limit on the same day.
- Preserve a rollback path to `allowlist_only` or `paused`.

## Phase 2 acceptance gates

Phase 3 is not justified until all are true:

- [ ] 3–5 businesses complete roster and allowlist testing.
- [ ] Zero wrong-business callbacks or lead notifications.
- [ ] Zero cross-business lead or feedback access.
- [ ] Zero duplicate contacts.
- [ ] Daily quotas hold under concurrent dispatch.
- [ ] Global and per-business stop controls are tested.
- [ ] At least 20 supervised live recovery attempts per business.
- [ ] At least 80% of delivered leads receive an owner outcome.
- [ ] Booking and won-job outcomes can be reconciled with the business.
- [ ] No unresolved critical incident.
- [ ] Carrier spam labelling and caller trust remain acceptable.
- [ ] Region-specific telecom, consent, privacy, and retention review is complete.

## Explicit non-goals

- public registration;
- customer-facing authentication;
- subscription billing;
- franchise hierarchies;
- a general workflow builder;
- autonomous pricing or scheduling;
- call recording;
- unrestricted retry campaigns;
- a full CRM;
- public analytics dashboards.

Those belong in later phases only after this closed pilot produces safe evidence.
