import type {
  CallbackJob,
  CallProgressEvent,
  LeadCard,
  ManualCallback,
  Repository,
} from "./types.js";

interface JobRow {
  id: string;
  business_id: string;
  source_call_sid: string;
  caller_number: string;
  business_number: string;
  state: CallbackJob["state"];
  source_ended_at: string;
  scheduled_at: string;
  created_at: string;
  updated_at: string;
  attempts: number;
  last_provider_sequence: number;
  outbound_call_sid: string | null;
  service_need: string | null;
  location: string | null;
  urgency: string | null;
  failure_reason: string | null;
}

function rowToJob(row: JobRow): CallbackJob {
  const job: CallbackJob = {
    id: row.id,
    businessId: row.business_id,
    sourceCallSid: row.source_call_sid,
    callerNumber: row.caller_number,
    businessNumber: row.business_number,
    state: row.state,
    sourceEndedAt: row.source_ended_at,
    scheduledAt: row.scheduled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    attempts: row.attempts,
    lastProviderSequence: row.last_provider_sequence,
  };
  if (row.outbound_call_sid) job.outboundCallSid = row.outbound_call_sid;
  if (row.service_need) job.serviceNeed = row.service_need;
  if (row.location) job.location = row.location;
  if (row.urgency) job.urgency = row.urgency;
  if (row.failure_reason) job.failureReason = row.failure_reason;
  return job;
}

function jobToRow(job: CallbackJob): JobRow {
  return {
    id: job.id,
    business_id: job.businessId,
    source_call_sid: job.sourceCallSid,
    caller_number: job.callerNumber,
    business_number: job.businessNumber,
    state: job.state,
    source_ended_at: job.sourceEndedAt,
    scheduled_at: job.scheduledAt,
    created_at: job.createdAt,
    updated_at: job.updatedAt,
    attempts: job.attempts,
    last_provider_sequence: job.lastProviderSequence,
    outbound_call_sid: job.outboundCallSid ?? null,
    service_need: job.serviceNeed ?? null,
    location: job.location ?? null,
    urgency: job.urgency ?? null,
    failure_reason: job.failureReason ?? null,
  };
}

export class SupabaseRepository implements Repository {
  private readonly baseUrl: string;

  constructor(
    supabaseUrl: string,
    private readonly serviceRoleKey: string,
    private readonly businessId: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.baseUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1`;
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
    prefer?: string,
  ): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("apikey", this.serviceRoleKey);
    headers.set("authorization", `Bearer ${this.serviceRoleKey}`);
    headers.set("content-type", "application/json");
    if (prefer) headers.set("prefer", prefer);

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, { ...init, headers });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Supabase request failed (${response.status}): ${text.slice(0, 400)}`);
    }
    return (text ? JSON.parse(text) : null) as T;
  }

  async recordCallEvent(event: CallProgressEvent): Promise<boolean> {
    const payload = {
      provider_event_key: event.providerEventKey,
      business_id: this.businessId,
      provider: event.provider,
      provider_call_sid: event.providerCallSid,
      sequence_number: event.sequenceNumber,
      direction: event.direction,
      call_status: event.status,
      caller_number: event.from,
      destination_number: event.to,
      occurred_at: event.occurredAt,
      call_duration_seconds: event.callDurationSeconds ?? null,
      parent_call_sid: event.parentCallSid ?? null,
      callback_source: event.callbackSource ?? null,
    };
    const rows = await this.request<Record<string, unknown>[]>(
      "/call_events?on_conflict=provider_event_key",
      { method: "POST", body: JSON.stringify(payload) },
      "resolution=ignore-duplicates,return=representation",
    );
    return rows.length > 0;
  }

  async getJobBySourceCall(sourceCallSid: string): Promise<CallbackJob | null> {
    return this.getSingleJob(`source_call_sid=eq.${encodeURIComponent(sourceCallSid)}`);
  }

  async createJobIfAbsent(job: CallbackJob): Promise<{ job: CallbackJob; created: boolean }> {
    const rows = await this.request<JobRow[]>(
      "/callback_jobs?on_conflict=source_call_sid",
      { method: "POST", body: JSON.stringify(jobToRow(job)) },
      "resolution=ignore-duplicates,return=representation",
    );
    if (rows[0]) {
      return { job: rowToJob(rows[0]), created: true };
    }
    const existing = await this.getJobBySourceCall(job.sourceCallSid);
    if (!existing) {
      throw new Error("Callback job insert was ignored but no existing row was found");
    }
    return { job: existing, created: false };
  }

  async getJobById(id: string): Promise<CallbackJob | null> {
    return this.getSingleJob(`id=eq.${encodeURIComponent(id)}`);
  }

  async getJobByOutboundCall(outboundCallSid: string): Promise<CallbackJob | null> {
    return this.getSingleJob(`outbound_call_sid=eq.${encodeURIComponent(outboundCallSid)}`);
  }

  private async getSingleJob(filter: string): Promise<CallbackJob | null> {
    const rows = await this.request<JobRow[]>(
      `/callback_jobs?select=*&${filter}&limit=1`,
      { method: "GET" },
    );
    return rows[0] ? rowToJob(rows[0]) : null;
  }

  async claimDueJobs(nowIso: string, limit: number): Promise<CallbackJob[]> {
    const rows = await this.request<JobRow[]>(
      "/rpc/claim_due_callback_jobs",
      {
        method: "POST",
        body: JSON.stringify({ p_now: nowIso, p_limit: limit }),
      },
    );
    return rows.map(rowToJob);
  }

  async saveJob(job: CallbackJob): Promise<void> {
    await this.request<JobRow[]>(
      `/callback_jobs?id=eq.${encodeURIComponent(job.id)}`,
      { method: "PATCH", body: JSON.stringify(jobToRow(job)) },
      "return=minimal",
    );
  }

  async recordManualCallback(callback: ManualCallback): Promise<void> {
    await this.request<unknown>(
      "/manual_callbacks",
      {
        method: "POST",
        body: JSON.stringify({
          id: callback.id,
          business_id: callback.businessId,
          caller_number: callback.callerNumber,
          occurred_at: callback.occurredAt,
          source: callback.source,
        }),
      },
      "return=minimal",
    );
  }

  async hasRecentManualCallback(
    businessId: string,
    callerNumber: string,
    sinceIso: string,
  ): Promise<boolean> {
    const rows = await this.request<Array<{ id: string }>>(
      `/manual_callbacks?select=id&business_id=eq.${encodeURIComponent(businessId)}` +
        `&caller_number=eq.${encodeURIComponent(callerNumber)}` +
        `&occurred_at=gte.${encodeURIComponent(sinceIso)}&limit=1`,
      { method: "GET" },
    );
    return rows.length > 0;
  }

  private leadFromRow(row: Record<string, unknown>): LeadCard {
    const lead: LeadCard = {
      id: String(row.id),
      businessId: String(row.business_id),
      callbackJobId: String(row.callback_job_id),
      callerNumber: String(row.caller_number),
      serviceNeed: String(row.service_need),
      location: String(row.location),
      urgency: String(row.urgency),
      createdAt: String(row.created_at),
    };
    if (typeof row.owner_notification_sid === "string" && row.owner_notification_sid) {
      lead.ownerNotificationSid = row.owner_notification_sid;
    }
    return lead;
  }

  private leadToRow(lead: LeadCard): Record<string, unknown> {
    return {
      id: lead.id,
      business_id: lead.businessId,
      callback_job_id: lead.callbackJobId,
      caller_number: lead.callerNumber,
      service_need: lead.serviceNeed,
      location: lead.location,
      urgency: lead.urgency,
      created_at: lead.createdAt,
      owner_notification_sid: lead.ownerNotificationSid ?? null,
    };
  }

  async getLeadByCallbackJob(callbackJobId: string): Promise<LeadCard | null> {
    const rows = await this.request<Record<string, unknown>[]>(
      `/lead_cards?select=*&callback_job_id=eq.${encodeURIComponent(callbackJobId)}&limit=1`,
      { method: "GET" },
    );
    return rows[0] ? this.leadFromRow(rows[0]) : null;
  }

  async createLeadIfAbsent(lead: LeadCard): Promise<LeadCard> {
    const rows = await this.request<Record<string, unknown>[]>(
      "/lead_cards?on_conflict=callback_job_id",
      { method: "POST", body: JSON.stringify(this.leadToRow(lead)) },
      "resolution=ignore-duplicates,return=representation",
    );
    if (rows[0]) return this.leadFromRow(rows[0]);
    const existing = await this.getLeadByCallbackJob(lead.callbackJobId);
    if (!existing) throw new Error("Lead insert was ignored but no existing lead was found");
    return existing;
  }

  async saveLead(lead: LeadCard): Promise<void> {
    await this.request<unknown>(
      `/lead_cards?callback_job_id=eq.${encodeURIComponent(lead.callbackJobId)}`,
      { method: "PATCH", body: JSON.stringify(this.leadToRow(lead)) },
      "return=minimal",
    );
  }
}
