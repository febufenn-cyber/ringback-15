-- Ringback Phase 2: closed multi-business pilot controls.
-- Apply after 001_phase1.sql. Create pilot businesses before enabling global dispatch.

begin;

create table if not exists public.pilot_businesses (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{3,64}$'),
  name text not null check (char_length(name) between 1 and 120),
  inbound_number text not null unique,
  callback_number text not null unique,
  owner_number text not null,
  pilot_mode text not null default 'setup' check (
    pilot_mode in ('setup', 'allowlist_only', 'live', 'paused', 'completed')
  ),
  callback_delay_seconds integer not null default 45 check (
    callback_delay_seconds between 0 and 900
  ),
  caller_cooldown_minutes integer not null default 1440 check (
    caller_cooldown_minutes between 1 and 43200
  ),
  max_callback_attempts integer not null default 1 check (
    max_callback_attempts between 1 and 3
  ),
  daily_callback_limit integer not null default 20 check (
    daily_callback_limit between 1 and 100
  ),
  timezone text not null default 'UTC' check (char_length(timezone) between 1 and 100),
  feedback_ttl_hours integer not null default 168 check (
    feedback_ttl_hours between 1 and 720
  ),
  blocked_callers text[] not null default '{}',
  allowed_callers text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (inbound_number <> callback_number),
  check (pilot_mode <> 'allowlist_only' or cardinality(allowed_callers) > 0)
);

create or replace function public.touch_pilot_business_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pilot_business_updated_at_trigger on public.pilot_businesses;
create trigger pilot_business_updated_at_trigger
before update on public.pilot_businesses
for each row execute function public.touch_pilot_business_updated_at();

create table if not exists public.pilot_daily_usage (
  business_id text not null references public.pilot_businesses(id) on delete cascade,
  usage_date date not null,
  callbacks_reserved integer not null default 0 check (callbacks_reserved >= 0),
  updated_at timestamptz not null default now(),
  primary key (business_id, usage_date)
);

create unique index if not exists lead_cards_id_business_uidx
  on public.lead_cards (id, business_id);

create table if not exists public.owner_feedback (
  lead_card_id text primary key,
  business_id text not null references public.pilot_businesses(id) on delete cascade,
  outcome text not null check (
    outcome in ('acknowledged', 'contacted', 'booked', 'won', 'lost', 'not_lead', 'unreachable')
  ),
  revenue_amount numeric(14,2) check (
    revenue_amount is null or (revenue_amount >= 0 and revenue_amount <= 1000000000)
  ),
  notes text check (notes is null or char_length(notes) <= 500),
  submitted_at timestamptz not null,
  updated_at timestamptz not null,
  constraint owner_feedback_business_lead_unique unique (business_id, lead_card_id),
  constraint owner_feedback_lead_business_fk
    foreign key (lead_card_id, business_id)
    references public.lead_cards(id, business_id) on delete cascade
);

create index if not exists owner_feedback_business_outcome_idx
  on public.owner_feedback (business_id, outcome, updated_at desc);

create table if not exists public.pilot_incidents (
  id text primary key,
  business_id text not null references public.pilot_businesses(id) on delete cascade,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  category text not null check (char_length(category) between 1 and 80),
  description text not null check (char_length(description) between 1 and 500),
  status text not null default 'open' check (status in ('open', 'resolved')),
  occurred_at timestamptz not null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (status = 'open' and resolved_at is null)
    or (status = 'resolved' and resolved_at is not null)
  )
);

create index if not exists pilot_incidents_business_status_idx
  on public.pilot_incidents (business_id, status, occurred_at desc);

-- Existing Phase 1 rows may predate the roster. NOT VALID preserves those rows
-- while enforcing the relationship for every new insert.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'call_events_pilot_business_fk'
  ) then
    alter table public.call_events
      add constraint call_events_pilot_business_fk
      foreign key (business_id) references public.pilot_businesses(id)
      on delete restrict not valid;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'callback_jobs_pilot_business_fk'
  ) then
    alter table public.callback_jobs
      add constraint callback_jobs_pilot_business_fk
      foreign key (business_id) references public.pilot_businesses(id)
      on delete restrict not valid;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'manual_callbacks_pilot_business_fk'
  ) then
    alter table public.manual_callbacks
      add constraint manual_callbacks_pilot_business_fk
      foreign key (business_id) references public.pilot_businesses(id)
      on delete restrict not valid;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'lead_cards_pilot_business_fk'
  ) then
    alter table public.lead_cards
      add constraint lead_cards_pilot_business_fk
      foreign key (business_id) references public.pilot_businesses(id)
      on delete restrict not valid;
  end if;
end;
$$;

drop function if exists public.claim_due_callback_jobs(timestamptz, integer);

create or replace function public.claim_due_callback_jobs(
  p_business_id text,
  p_now timestamptz,
  p_limit integer default 20
)
returns setof public.callback_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_limit < 1 or p_limit > 100 then
    raise exception 'p_limit must be between 1 and 100';
  end if;
  if not exists (
    select 1
    from public.pilot_businesses
    where id = p_business_id
      and pilot_mode in ('allowlist_only', 'live')
  ) then
    return;
  end if;

  return query
  with due as (
    select id
    from public.callback_jobs
    where business_id = p_business_id
      and state = 'waiting_window'
      and scheduled_at <= p_now
    order by scheduled_at, id
    for update skip locked
    limit p_limit
  )
  update public.callback_jobs as jobs
  set state = 'dispatching', updated_at = p_now
  from due
  where jobs.id = due.id
    and jobs.business_id = p_business_id
  returning jobs.*;
end;
$$;

create or replace function public.reserve_pilot_callback_slot(
  p_business_id text,
  p_usage_date date,
  p_daily_limit integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  if p_daily_limit < 1 or p_daily_limit > 100 then
    raise exception 'p_daily_limit must be between 1 and 100';
  end if;
  if not exists (
    select 1
    from public.pilot_businesses
    where id = p_business_id
      and pilot_mode in ('allowlist_only', 'live')
  ) then
    return false;
  end if;

  insert into public.pilot_daily_usage (
    business_id, usage_date, callbacks_reserved, updated_at
  ) values (
    p_business_id, p_usage_date, 0, now()
  )
  on conflict (business_id, usage_date) do nothing;

  update public.pilot_daily_usage
  set callbacks_reserved = callbacks_reserved + 1,
      updated_at = now()
  where business_id = p_business_id
    and usage_date = p_usage_date
    and callbacks_reserved < p_daily_limit;

  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;

create or replace view public.pilot_business_summary as
select
  business.id as business_id,
  business.name as business_name,
  business.pilot_mode,
  business.daily_callback_limit,
  coalesce(usage.callbacks_reserved, 0)::integer as callbacks_today,
  (
    select count(*)::integer
    from public.callback_jobs jobs
    where jobs.business_id = business.id
  ) as total_jobs,
  (
    select count(*)::integer
    from public.lead_cards leads
    where leads.business_id = business.id
      and leads.owner_notification_sid is not null
  ) as notified_leads,
  (
    select count(*)::integer
    from public.owner_feedback feedback
    where feedback.business_id = business.id
  ) as owner_feedback_count,
  (
    select count(*)::integer
    from public.owner_feedback feedback
    where feedback.business_id = business.id
      and feedback.outcome = 'booked'
  ) as booked_count,
  (
    select count(*)::integer
    from public.owner_feedback feedback
    where feedback.business_id = business.id
      and feedback.outcome = 'won'
  ) as won_count,
  (
    select count(*)::integer
    from public.pilot_incidents incidents
    where incidents.business_id = business.id
      and incidents.status = 'open'
  ) as open_incident_count
from public.pilot_businesses business
left join public.pilot_daily_usage usage
  on usage.business_id = business.id
 and usage.usage_date = (now() at time zone 'utc')::date;

alter table public.pilot_businesses enable row level security;
alter table public.pilot_daily_usage enable row level security;
alter table public.owner_feedback enable row level security;
alter table public.pilot_incidents enable row level security;

revoke all on public.pilot_businesses from anon, authenticated;
revoke all on public.pilot_daily_usage from anon, authenticated;
revoke all on public.owner_feedback from anon, authenticated;
revoke all on public.pilot_incidents from anon, authenticated;
revoke all on public.pilot_business_summary from anon, authenticated;

revoke all on function public.claim_due_callback_jobs(text, timestamptz, integer) from public;
revoke all on function public.reserve_pilot_callback_slot(text, date, integer) from public;
grant execute on function public.claim_due_callback_jobs(text, timestamptz, integer) to service_role;
grant execute on function public.reserve_pilot_callback_slot(text, date, integer) to service_role;
grant select on public.pilot_business_summary to service_role;

commit;
