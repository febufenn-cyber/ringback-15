-- Ringback Phase 5: append-only attribution evidence and controlled distribution.
begin;

create table if not exists public.attribution_events (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  lead_id text not null,
  call_id text,
  callback_job_id text,
  conversation_id text,
  booking_id text,
  invoice_id text,
  payment_id text,
  kind text not null check (kind in (
    'missed_call','callback_attempt','callback_connected','qualified_lead','owner_notified',
    'owner_contacted','booking_requested','booking_created','booking_cancelled','job_completed',
    'owner_reported_won','owner_reported_lost','invoice_issued','payment_collected',
    'refund_issued','attribution_correction','lead_lost','cost_incurred'
  )),
  occurred_at timestamptz not null,
  source_type text not null,
  source_id text not null,
  campaign_id text,
  partner_id text,
  amount_minor bigint check (amount_minor is null or amount_minor >= 0),
  currency text check (currency is null or char_length(currency) = 3),
  evidence_strength text not null check (evidence_strength in ('estimated','owner_reported','provider_verified','financial_verified')),
  confidence numeric(5,4) not null check (confidence >= 0 and confidence <= 1),
  attribution_class text check (attribution_class is null or attribution_class in ('direct_recovery','assisted_recovery','likely_incremental','unattributed','counterfactual_unknown')),
  rule_version text not null,
  metadata jsonb not null default '{}'::jsonb,
  ingested_at timestamptz not null default now(),
  unique (organization_id, kind, source_type, source_id),
  check ((amount_minor is null and currency is null) or (amount_minor is not null and currency is not null)),
  check (kind not in ('invoice_issued','payment_collected','refund_issued') or (evidence_strength='financial_verified' and amount_minor is not null and currency is not null))
);
create index if not exists attribution_events_lead_time_idx on public.attribution_events(organization_id, lead_id, occurred_at, id);
create index if not exists attribution_events_kind_time_idx on public.attribution_events(organization_id, kind, occurred_at desc);
create index if not exists attribution_events_campaign_idx on public.attribution_events(organization_id, campaign_id, occurred_at desc) where campaign_id is not null;

create table if not exists public.acquisition_touches (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  lead_id text not null,
  channel text not null,
  campaign_id text,
  partner_id text,
  occurred_at timestamptz not null,
  ingested_at timestamptz not null default now(),
  unique (organization_id, lead_id, channel, campaign_id, partner_id, occurred_at)
);
create index if not exists acquisition_touches_lead_idx on public.acquisition_touches(organization_id, lead_id, occurred_at, id);

create table if not exists public.identity_links (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  canonical_lead_id text not null,
  linked_entity_type text not null check (linked_entity_type in ('call','callback_job','conversation','booking','crm_contact','invoice','payment')),
  linked_entity_id text not null,
  match_method text not null check (match_method in ('provider_id','normalized_phone','service_time_location','crm_mapping','manual')),
  confidence numeric(5,4) not null check (confidence >= 0 and confidence <= 1),
  actor_id text,
  created_at timestamptz not null,
  unique (organization_id, linked_entity_type, linked_entity_id),
  check (match_method <> 'manual' or actor_id is not null)
);
create index if not exists identity_links_lead_idx on public.identity_links(organization_id, canonical_lead_id);

create table if not exists public.attribution_rule_versions (
  id text primary key,
  version integer not null check (version > 0),
  class_weights jsonb not null,
  definition jsonb not null,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (version)
);
insert into public.attribution_rule_versions(id,version,class_weights,definition,active)
values ('recovery-v1',1,'{"direct_recovery":1,"assisted_recovery":0.65,"likely_incremental":0.4,"unattributed":0,"counterfactual_unknown":0}'::jsonb,'{"financial_events_require_verified_strength":true,"mixed_currency_requires_conversion":true}'::jsonb,true)
on conflict (id) do nothing;

create table if not exists public.partners (
  id text primary key,
  name text not null check (char_length(name) between 1 and 160),
  role text not null check (role in ('agency','referrer','reseller')),
  active boolean not null default false,
  scopes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.partner_memberships (
  partner_id text not null references public.partners(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','analyst')),
  state text not null check (state in ('invited','active','revoked')),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (partner_id,user_id)
);
create table if not exists public.partner_customer_assignments (
  partner_id text not null references public.partners(id) on delete cascade,
  organization_id text not null references public.organizations(id) on delete cascade,
  state text not null check (state in ('active','revoked')),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (partner_id,organization_id),
  check ((state='active' and approved_by is not null and approved_at is not null) or state='revoked')
);
create index if not exists partner_assignments_org_idx on public.partner_customer_assignments(organization_id,state);

create table if not exists public.commission_rules (
  id text primary key,
  partner_id text not null references public.partners(id) on delete cascade,
  version integer not null check (version > 0),
  rate_basis_points integer not null check (rate_basis_points between 0 and 5000),
  minimum_confidence numeric(5,4) not null default 0.8 check (minimum_confidence >= 0 and minimum_confidence <= 1),
  active boolean not null default false,
  currency text,
  created_at timestamptz not null default now(),
  unique (partner_id,version)
);
create table if not exists public.commission_ledger (
  id text primary key,
  partner_id text not null references public.partners(id),
  organization_id text not null references public.organizations(id),
  lead_id text not null,
  source_event_id text not null references public.attribution_events(id),
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null check (char_length(currency)=3),
  rate_basis_points integer not null check (rate_basis_points between 0 and 5000),
  rule_version text not null,
  state text not null check (state in ('pending','approved','paid','reversed')),
  reversed_by_event_id text references public.attribution_events(id),
  created_at timestamptz not null,
  updated_at timestamptz not null default now(),
  unique (partner_id,source_event_id),
  check (state <> 'reversed' or reversed_by_event_id is not null)
);
create index if not exists commission_ledger_partner_idx on public.commission_ledger(partner_id,state,created_at desc);

create table if not exists public.crm_integrations (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  provider text not null,
  encrypted_secret_ref text not null,
  scopes jsonb not null default '[]'::jsonb,
  mapping_version text not null,
  state text not null check (state in ('setup','active','paused','revoked')),
  cursor_value text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,provider)
);
create table if not exists public.crm_outbox (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  lead_id text not null,
  destination text not null,
  payload_hash text not null,
  mapping_version text not null,
  state text not null check (state in ('pending','sent','failed')),
  attempts integer not null default 0 check (attempts >= 0),
  remote_id text,
  failure_reason text check (char_length(failure_reason) <= 300),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique (organization_id,destination,lead_id,mapping_version,payload_hash)
);
create index if not exists crm_outbox_pending_idx on public.crm_outbox(organization_id,state,updated_at);

create table if not exists public.experiment_exposures (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  experiment_key text not null,
  experiment_version text not null,
  subject_type text not null,
  subject_id text not null,
  variant text not null,
  metric_definition_version text not null,
  exposed_at timestamptz not null,
  unique (organization_id,experiment_key,experiment_version,subject_type,subject_id)
);

create or replace function public.reject_append_only_mutation()
returns trigger language plpgsql as $$
begin
  raise exception '% is append-only; write a correction event instead', tg_table_name;
end; $$;

drop trigger if exists attribution_events_append_only on public.attribution_events;
create trigger attribution_events_append_only before update or delete on public.attribution_events for each row execute function public.reject_append_only_mutation();
drop trigger if exists acquisition_touches_append_only on public.acquisition_touches;
create trigger acquisition_touches_append_only before update or delete on public.acquisition_touches for each row execute function public.reject_append_only_mutation();
drop trigger if exists identity_links_append_only on public.identity_links;
create trigger identity_links_append_only before update or delete on public.identity_links for each row execute function public.reject_append_only_mutation();
drop trigger if exists experiment_exposures_append_only on public.experiment_exposures;
create trigger experiment_exposures_append_only before update or delete on public.experiment_exposures for each row execute function public.reject_append_only_mutation();

create or replace function public.protect_commission_evidence()
returns trigger language plpgsql as $$
begin
  if old.partner_id is distinct from new.partner_id
     or old.organization_id is distinct from new.organization_id
     or old.lead_id is distinct from new.lead_id
     or old.source_event_id is distinct from new.source_event_id
     or old.amount_minor is distinct from new.amount_minor
     or old.currency is distinct from new.currency
     or old.rate_basis_points is distinct from new.rate_basis_points
     or old.rule_version is distinct from new.rule_version then
    raise exception 'commission financial evidence is immutable';
  end if;
  return new;
end; $$;
drop trigger if exists protect_commission_evidence_trigger on public.commission_ledger;
create trigger protect_commission_evidence_trigger before update on public.commission_ledger for each row execute function public.protect_commission_evidence();

alter table public.attribution_events enable row level security;
alter table public.acquisition_touches enable row level security;
alter table public.identity_links enable row level security;
alter table public.attribution_rule_versions enable row level security;
alter table public.partners enable row level security;
alter table public.partner_memberships enable row level security;
alter table public.partner_customer_assignments enable row level security;
alter table public.commission_rules enable row level security;
alter table public.commission_ledger enable row level security;
alter table public.crm_integrations enable row level security;
alter table public.crm_outbox enable row level security;
alter table public.experiment_exposures enable row level security;

drop policy if exists attribution_events_member_select on public.attribution_events;
create policy attribution_events_member_select on public.attribution_events for select to authenticated using (public.is_active_org_member(organization_id));
drop policy if exists acquisition_touches_member_select on public.acquisition_touches;
create policy acquisition_touches_member_select on public.acquisition_touches for select to authenticated using (public.is_active_org_member(organization_id));
drop policy if exists identity_links_member_select on public.identity_links;
create policy identity_links_member_select on public.identity_links for select to authenticated using (public.is_active_org_member(organization_id));
drop policy if exists commission_customer_select on public.commission_ledger;
create policy commission_customer_select on public.commission_ledger for select to authenticated using (public.is_active_org_member(organization_id));
drop policy if exists crm_integrations_member_select on public.crm_integrations;
create policy crm_integrations_member_select on public.crm_integrations for select to authenticated using (public.is_active_org_member(organization_id));
drop policy if exists crm_outbox_member_select on public.crm_outbox;
create policy crm_outbox_member_select on public.crm_outbox for select to authenticated using (public.is_active_org_member(organization_id));

revoke all on public.attribution_events from anon;
revoke all on public.acquisition_touches from anon;
revoke all on public.identity_links from anon;
revoke all on public.attribution_rule_versions from anon,authenticated;
revoke all on public.partners from anon,authenticated;
revoke all on public.partner_memberships from anon,authenticated;
revoke all on public.partner_customer_assignments from anon,authenticated;
revoke all on public.commission_rules from anon,authenticated;
revoke insert,update,delete on public.attribution_events from authenticated;
revoke insert,update,delete on public.acquisition_touches from authenticated;
revoke insert,update,delete on public.identity_links from authenticated;
revoke insert,update,delete on public.commission_ledger from authenticated;
revoke insert,update,delete on public.crm_integrations from authenticated;
revoke insert,update,delete on public.crm_outbox from authenticated;
revoke all on public.experiment_exposures from anon,authenticated;

commit;
