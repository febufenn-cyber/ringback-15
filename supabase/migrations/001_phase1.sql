-- Ringback Phase 1: one-business reliable callback loop.
-- Apply to a dedicated Supabase project before activating a pilot business.

begin;

create table if not exists public.call_events (
  provider_event_key text primary key,
  business_id text not null,
  provider text not null check (provider in ('twilio')),
  provider_call_sid text not null,
  sequence_number integer not null default 0 check (sequence_number >= 0),
  direction text not null,
  call_status text not null,
  caller_number text not null,
  destination_number text not null,
  occurred_at timestamptz not null,
  call_duration_seconds integer,
  parent_call_sid text,
  callback_source text,
  created_at timestamptz not null default now()
);

create index if not exists call_events_business_call_idx
  on public.call_events (business_id, provider_call_sid, occurred_at desc);

create table if not exists public.callback_jobs (
  id text primary key,
  business_id text not null,
  source_call_sid text not null unique,
  caller_number text not null,
  business_number text not null,
  state text not null check (state in (
    'waiting_window', 'dispatching', 'dialing', 'ringing', 'connected',
    'qualifying', 'lead_ready', 'notified', 'no_answer', 'suppressed',
    'failed', 'cancelled'
  )),
  source_ended_at timestamptz not null,
  scheduled_at timestamptz not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  attempts integer not null default 0 check (attempts >= 0 and attempts <= 3),
  last_provider_sequence integer not null default -1 check (last_provider_sequence >= -1),
  outbound_call_sid text unique,
  service_need text check (char_length(service_need) <= 300),
  location text check (char_length(location) <= 300),
  urgency text check (char_length(urgency) <= 300),
  failure_reason text check (char_length(failure_reason) <= 300)
);

create index if not exists callback_jobs_due_idx
  on public.callback_jobs (scheduled_at)
  where state = 'waiting_window';
create index if not exists callback_jobs_business_caller_idx
  on public.callback_jobs (business_id, caller_number, created_at desc);

create table if not exists public.manual_callbacks (
  id text primary key,
  business_id text not null,
  caller_number text not null,
  occurred_at timestamptz not null,
  source text not null check (source in ('owner', 'staff', 'system')),
  created_at timestamptz not null default now()
);

create index if not exists manual_callbacks_lookup_idx
  on public.manual_callbacks (business_id, caller_number, occurred_at desc);

create table if not exists public.lead_cards (
  id text primary key,
  business_id text not null,
  callback_job_id text not null unique references public.callback_jobs(id) on delete cascade,
  caller_number text not null,
  service_need text not null check (char_length(service_need) <= 300),
  location text not null check (char_length(location) <= 300),
  urgency text not null check (char_length(urgency) <= 300),
  owner_notification_sid text,
  created_at timestamptz not null
);

create table if not exists public.callback_job_history (
  id bigint generated always as identity primary key,
  callback_job_id text not null references public.callback_jobs(id) on delete cascade,
  business_id text not null,
  from_state text,
  to_state text not null,
  provider_sequence integer not null,
  failure_reason text,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists callback_job_history_job_idx
  on public.callback_job_history (callback_job_id, id);

create or replace function public.log_callback_job_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.callback_job_history (
      callback_job_id,
      business_id,
      from_state,
      to_state,
      provider_sequence,
      failure_reason,
      snapshot
    ) values (
      new.id,
      new.business_id,
      null,
      new.state,
      new.last_provider_sequence,
      new.failure_reason,
      to_jsonb(new)
    );
  elsif old.state is distinct from new.state
     or old.last_provider_sequence is distinct from new.last_provider_sequence
     or old.outbound_call_sid is distinct from new.outbound_call_sid
     or old.failure_reason is distinct from new.failure_reason then
    insert into public.callback_job_history (
      callback_job_id,
      business_id,
      from_state,
      to_state,
      provider_sequence,
      failure_reason,
      snapshot
    ) values (
      new.id,
      new.business_id,
      old.state,
      new.state,
      new.last_provider_sequence,
      new.failure_reason,
      to_jsonb(new)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists callback_job_history_trigger on public.callback_jobs;
create trigger callback_job_history_trigger
after insert or update on public.callback_jobs
for each row execute function public.log_callback_job_history();

create or replace function public.claim_due_callback_jobs(
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

  return query
  with due as (
    select id
    from public.callback_jobs
    where state = 'waiting_window'
      and scheduled_at <= p_now
    order by scheduled_at, id
    for update skip locked
    limit p_limit
  )
  update public.callback_jobs as jobs
  set state = 'dispatching', updated_at = p_now
  from due
  where jobs.id = due.id
  returning jobs.*;
end;
$$;

alter table public.call_events enable row level security;
alter table public.callback_jobs enable row level security;
alter table public.manual_callbacks enable row level security;
alter table public.lead_cards enable row level security;
alter table public.callback_job_history enable row level security;

revoke all on public.call_events from anon, authenticated;
revoke all on public.callback_jobs from anon, authenticated;
revoke all on public.manual_callbacks from anon, authenticated;
revoke all on public.lead_cards from anon, authenticated;
revoke all on public.callback_job_history from anon, authenticated;
revoke all on function public.claim_due_callback_jobs(timestamptz, integer) from public;
grant execute on function public.claim_due_callback_jobs(timestamptz, integer) to service_role;

commit;
