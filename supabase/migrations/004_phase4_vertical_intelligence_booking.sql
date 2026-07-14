-- Ringback Phase 4: versioned vertical intelligence and conflict-safe booking.
begin;
create table if not exists public.safety_policies (
  id text not null, organization_id text not null references public.organizations(id) on delete cascade,
  version integer not null check (version > 0), emergency_terms jsonb not null default '[]'::jsonb,
  prohibited_promise_terms jsonb not null default '[]'::jsonb, prohibited_fields jsonb not null default '[]'::jsonb,
  max_answer_length integer not null default 300 check (max_answer_length between 20 and 2000),
  created_at timestamptz not null default now(), primary key (organization_id, id), unique (organization_id, id, version)
);
create table if not exists public.vertical_playbooks (
  id text not null, organization_id text not null references public.organizations(id) on delete cascade,
  vertical text not null, version integer not null check (version > 0), status text not null check (status in ('draft','approved','retired')),
  start_node_id text not null, graph jsonb not null, locales jsonb not null, safety_policy_id text not null,
  created_at timestamptz not null default now(), approved_at timestamptz,
  primary key (organization_id, id), unique (organization_id, vertical, version),
  foreign key (organization_id, safety_policy_id) references public.safety_policies(organization_id, id),
  check ((status='approved' and approved_at is not null) or status<>'approved')
);
create index if not exists vertical_playbooks_lookup_idx on public.vertical_playbooks(organization_id, vertical, status, version desc);
create or replace function public.protect_approved_playbook() returns trigger language plpgsql as $$
begin
  if old.status='approved' and to_jsonb(old) is distinct from to_jsonb(new) then raise exception 'approved playbooks are immutable; create a new version'; end if;
  return new;
end; $$;
drop trigger if exists protect_approved_playbook_trigger on public.vertical_playbooks;
create trigger protect_approved_playbook_trigger before update or delete on public.vertical_playbooks for each row execute function public.protect_approved_playbook();
create table if not exists public.conversation_sessions (
  id text primary key, organization_id text not null references public.organizations(id) on delete cascade,
  lead_id text not null, playbook_version_id text not null, locale text not null, current_node_id text not null,
  state text not null check (state in ('running','awaiting_answer','awaiting_booking','handoff','completed','failed')),
  answers jsonb not null default '{}'::jsonb, flags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null, updated_at timestamptz not null,
  foreign key (organization_id, playbook_version_id) references public.vertical_playbooks(organization_id, id), unique (organization_id, id)
);
create index if not exists conversation_sessions_lead_idx on public.conversation_sessions(organization_id, lead_id, created_at desc);
create table if not exists public.booking_resources (
  id text not null, organization_id text not null references public.organizations(id) on delete cascade,
  name text not null, provider text not null check (provider in ('internal','google_calendar','microsoft_graph','mock')),
  active boolean not null default false, created_at timestamptz not null default now(), primary key (organization_id, id)
);
create table if not exists public.booking_slots (
  id text not null, organization_id text not null references public.organizations(id) on delete cascade, resource_id text not null,
  starts_at timestamptz not null, ends_at timestamptz not null, capacity integer not null default 1 check (capacity between 1 and 100),
  created_at timestamptz not null default now(), primary key (organization_id, id),
  foreign key (organization_id, resource_id) references public.booking_resources(organization_id, id), check (ends_at > starts_at)
);
create index if not exists booking_slots_time_idx on public.booking_slots(organization_id, resource_id, starts_at);
create table if not exists public.booking_holds (
  id text not null, organization_id text not null references public.organizations(id) on delete cascade,
  session_id text not null, slot_id text not null, state text not null check (state in ('held','confirmed','expired','cancelled','failed')),
  expires_at timestamptz not null, provider_booking_id text, created_at timestamptz not null, updated_at timestamptz not null,
  primary key (organization_id, id), foreign key (organization_id, session_id) references public.conversation_sessions(organization_id, id),
  foreign key (organization_id, slot_id) references public.booking_slots(organization_id, id), unique (organization_id, provider_booking_id)
);
create index if not exists booking_holds_slot_idx on public.booking_holds(organization_id, slot_id, state, expires_at);
create or replace function public.reserve_booking_hold(p_id text,p_organization_id text,p_session_id text,p_slot_id text,p_expires_at timestamptz,p_now timestamptz)
returns public.booking_holds language plpgsql security definer set search_path=public as $$
declare v_slot public.booking_slots; v_active integer; v_hold public.booking_holds;
begin
  select * into v_slot from public.booking_slots where organization_id=p_organization_id and id=p_slot_id for update;
  if not found then raise exception 'slot_not_found'; end if;
  if p_expires_at <= p_now then raise exception 'hold_expiry_must_be_future'; end if;
  select count(*) into v_active from public.booking_holds where organization_id=p_organization_id and slot_id=p_slot_id and (state='confirmed' or (state='held' and expires_at>p_now));
  if v_active >= v_slot.capacity then raise exception 'slot_unavailable'; end if;
  insert into public.booking_holds(id,organization_id,session_id,slot_id,state,expires_at,created_at,updated_at)
  values(p_id,p_organization_id,p_session_id,p_slot_id,'held',p_expires_at,p_now,p_now) returning * into v_hold;
  return v_hold;
end; $$;
revoke all on function public.reserve_booking_hold(text,text,text,text,timestamptz,timestamptz) from public;
grant execute on function public.reserve_booking_hold(text,text,text,text,timestamptz,timestamptz) to service_role;
alter table public.lead_cards add column if not exists conversation_session_id text;
alter table public.lead_cards add column if not exists playbook_version_id text;
alter table public.safety_policies enable row level security;
alter table public.vertical_playbooks enable row level security;
alter table public.conversation_sessions enable row level security;
alter table public.booking_resources enable row level security;
alter table public.booking_slots enable row level security;
alter table public.booking_holds enable row level security;
drop policy if exists safety_policies_member_select on public.safety_policies;
create policy safety_policies_member_select on public.safety_policies for select to authenticated using (public.is_active_org_member(organization_id));
drop policy if exists playbooks_member_select on public.vertical_playbooks;
create policy playbooks_member_select on public.vertical_playbooks for select to authenticated using (public.is_active_org_member(organization_id));
drop policy if exists sessions_member_select on public.conversation_sessions;
create policy sessions_member_select on public.conversation_sessions for select to authenticated using (public.is_active_org_member(organization_id));
drop policy if exists booking_resources_member_select on public.booking_resources;
create policy booking_resources_member_select on public.booking_resources for select to authenticated using (public.is_active_org_member(organization_id));
drop policy if exists booking_slots_member_select on public.booking_slots;
create policy booking_slots_member_select on public.booking_slots for select to authenticated using (public.is_active_org_member(organization_id));
drop policy if exists booking_holds_member_select on public.booking_holds;
create policy booking_holds_member_select on public.booking_holds for select to authenticated using (public.is_active_org_member(organization_id));
revoke insert,update,delete on public.safety_policies from anon,authenticated;
revoke insert,update,delete on public.vertical_playbooks from anon,authenticated;
revoke insert,update,delete on public.conversation_sessions from anon,authenticated;
revoke insert,update,delete on public.booking_resources from anon,authenticated;
revoke insert,update,delete on public.booking_slots from anon,authenticated;
revoke insert,update,delete on public.booking_holds from anon,authenticated;
commit;
