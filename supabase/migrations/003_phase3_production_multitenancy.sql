-- Ringback Phase 3: production multi-tenancy and commercial foundation.
-- Additive migration. Existing Phase 2 pilot rows remain valid and inactive until explicitly mapped.
begin;

create table if not exists public.organizations (
  id text primary key,
  name text not null check (char_length(name) between 1 and 120),
  state text not null check (state in ('trial','active','past_due','suspended','closing','closed')),
  default_timezone text not null default 'UTC',
  retention_days integer not null default 90 check (retention_days between 1 and 3650),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.organization_memberships (
  organization_id text not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','operator','viewer','billing')),
  state text not null check (state in ('invited','active','revoked')),
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  primary key (organization_id, user_id)
);
create index if not exists organization_memberships_user_idx on public.organization_memberships(user_id, state);
create table if not exists public.business_locations (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  timezone text not null,
  service_region text not null check (char_length(service_region) <= 200),
  state text not null check (state in ('setup','active','paused','closed')),
  approved_policy_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);
create index if not exists business_locations_org_idx on public.business_locations(organization_id, state);
create table if not exists public.phone_lines (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  location_id text not null references public.business_locations(id) on delete cascade,
  inbound_number text not null unique,
  callback_number text not null unique,
  owner_number text not null,
  provider text not null check (provider in ('twilio')),
  provider_line_id text unique,
  state text not null check (state in ('draft','provisioning','verified','active','paused','failed','released')),
  daily_callback_limit integer not null check (daily_callback_limit between 1 and 10000),
  spend_limit_minor integer not null check (spend_limit_minor >= 0),
  active boolean not null default false,
  verified_at timestamptz,
  last_health_check_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  check (inbound_number <> callback_number)
);
create index if not exists phone_lines_org_idx on public.phone_lines(organization_id, location_id, state);
create table if not exists public.onboarding_sessions (
  id text primary key,
  organization_id text not null unique references public.organizations(id) on delete cascade,
  state text not null check (state in ('created','profile_complete','line_configured','number_verified','policy_approved','billing_ready','test_passed','active','blocked','abandoned')),
  completed_steps jsonb not null default '[]'::jsonb,
  blocked_reason text check (char_length(blocked_reason) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((state = 'blocked' and blocked_reason is not null) or state <> 'blocked')
);
create table if not exists public.plan_catalog (
  code text primary key,
  max_locations integer not null check (max_locations > 0),
  max_phone_lines integer not null check (max_phone_lines > 0),
  monthly_callbacks integer not null check (monthly_callbacks > 0),
  daily_callbacks_per_line integer not null check (daily_callbacks_per_line > 0),
  feedback_retention_days integer not null check (feedback_retention_days > 0),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.plan_catalog(code,max_locations,max_phone_lines,monthly_callbacks,daily_callbacks_per_line,feedback_retention_days)
values ('starter',1,1,150,15,90),('growth',5,10,2000,100,365)
on conflict (code) do update set max_locations=excluded.max_locations,max_phone_lines=excluded.max_phone_lines,monthly_callbacks=excluded.monthly_callbacks,daily_callbacks_per_line=excluded.daily_callbacks_per_line,feedback_retention_days=excluded.feedback_retention_days,updated_at=now();
create table if not exists public.subscriptions (
  id text primary key,
  organization_id text not null unique references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('stripe','mock')),
  provider_customer_id text not null,
  provider_subscription_id text not null unique,
  plan_code text not null references public.plan_catalog(code),
  status text not null check (status in ('none','trialing','active','past_due','canceled','unpaid')),
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now(),
  check (current_period_end > current_period_start)
);
create table if not exists public.billing_events (
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  occurred_at timestamptz not null,
  payload_hash text not null,
  processed_at timestamptz not null default now(),
  primary key (provider, provider_event_id)
);
create table if not exists public.usage_events (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  phone_line_id text,
  kind text not null check (kind in ('callback_attempt','qualified_lead','owner_notification','booking')),
  quantity integer not null check (quantity > 0),
  source_id text not null,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (organization_id, kind, source_id),
  foreign key (organization_id, phone_line_id) references public.phone_lines(organization_id, id)
);
create index if not exists usage_events_period_idx on public.usage_events(organization_id, kind, occurred_at);
create table if not exists public.audit_events (
  id text primary key,
  organization_id text references public.organizations(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists audit_events_org_time_idx on public.audit_events(organization_id, occurred_at desc);
alter table public.pilot_businesses add column if not exists organization_id text references public.organizations(id);
alter table public.callback_jobs add column if not exists organization_id text references public.organizations(id);
alter table public.callback_jobs add column if not exists phone_line_id text;
alter table public.call_events add column if not exists organization_id text references public.organizations(id);
alter table public.lead_cards add column if not exists organization_id text references public.organizations(id);
create index if not exists callback_jobs_org_idx on public.callback_jobs(organization_id, created_at desc);
create index if not exists lead_cards_org_idx on public.lead_cards(organization_id, created_at desc);
create or replace function public.is_active_org_member(p_organization_id text)
returns boolean language sql stable security definer set search_path=public as $$
  select exists (select 1 from public.organization_memberships m where m.organization_id=p_organization_id and m.user_id=auth.uid() and m.state='active');
$$;
create or replace function public.org_role(p_organization_id text)
returns text language sql stable security definer set search_path=public as $$
  select m.role from public.organization_memberships m where m.organization_id=p_organization_id and m.user_id=auth.uid() and m.state='active' limit 1;
$$;
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.business_locations enable row level security;
alter table public.phone_lines enable row level security;
alter table public.onboarding_sessions enable row level security;
alter table public.plan_catalog enable row level security;
alter table public.subscriptions enable row level security;
alter table public.billing_events enable row level security;
alter table public.usage_events enable row level security;
alter table public.audit_events enable row level security;
revoke all on public.billing_events from anon, authenticated;
revoke all on public.audit_events from anon, authenticated;
revoke all on public.usage_events from anon, authenticated;
drop policy if exists organizations_member_select on public.organizations;
create policy organizations_member_select on public.organizations for select to authenticated using (public.is_active_org_member(id));
drop policy if exists memberships_member_select on public.organization_memberships;
create policy memberships_member_select on public.organization_memberships for select to authenticated using (public.is_active_org_member(organization_id));
drop policy if exists locations_member_select on public.business_locations;
create policy locations_member_select on public.business_locations for select to authenticated using (public.is_active_org_member(organization_id));
drop policy if exists phone_lines_member_select on public.phone_lines;
create policy phone_lines_member_select on public.phone_lines for select to authenticated using (public.is_active_org_member(organization_id));
drop policy if exists onboarding_member_select on public.onboarding_sessions;
create policy onboarding_member_select on public.onboarding_sessions for select to authenticated using (public.is_active_org_member(organization_id));
drop policy if exists subscriptions_member_select on public.subscriptions;
create policy subscriptions_member_select on public.subscriptions for select to authenticated using (public.is_active_org_member(organization_id));
drop policy if exists plan_catalog_authenticated_select on public.plan_catalog;
create policy plan_catalog_authenticated_select on public.plan_catalog for select to authenticated using (active);
revoke insert, update, delete on public.organizations from anon, authenticated;
revoke insert, update, delete on public.organization_memberships from anon, authenticated;
revoke insert, update, delete on public.business_locations from anon, authenticated;
revoke insert, update, delete on public.phone_lines from anon, authenticated;
revoke insert, update, delete on public.onboarding_sessions from anon, authenticated;
revoke insert, update, delete on public.subscriptions from anon, authenticated;
commit;
