# Partner Access Model

## Relationship model

A partner record alone grants no customer access. Access requires:

1. an active partner;
2. an explicit active assignment to the customer organization;
3. the requested capability in the partner’s scope;
4. server-side authorization on every request.

Supported partner roles are agency, referrer and reseller. The role is descriptive; capabilities come only from scopes.

## Scopes

- `accounts.read`
- `accounts.manage`
- `reports.read`
- `leads.read`
- `commission.read`

Raw caller content, transcripts, billing ownership, live activation, attribution-rule mutation, incident override and payout approval are not granted by these scopes.

## Revocation

Revocation blocks future access immediately. Historical accounting and commission references remain for audit and dispute handling, with unnecessary personal data excluded.

## Commission rules

A commission may accrue only from collected cash that is:

- `financial_verified`;
- confidence at least 0.80;
- linked to an active partner assignment;
- processed through a versioned commission rule;
- unique for the partner and source payment event.

Refunds reverse pending commission. Paid commission requires a separate settlement adjustment rather than destructive mutation.
