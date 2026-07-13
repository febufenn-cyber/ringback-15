import { normalizePhoneNumber } from "./policy.js";
import type {
  BusinessConfig,
  BusinessDirectory,
  LeadCard,
  OwnerFeedback,
  PilotBusinessInput,
  PilotBusinessSummary,
  PilotControl,
  PilotIncident,
  PilotMode,
} from "./types.js";

interface PilotBusinessRow {
  id: string;
  name: string;
  inbound_number: string;
  callback_number: string;
  owner_number: string;
  pilot_mode: PilotMode;
  callback_delay_seconds: number;
  caller_cooldown_minutes: number;
  max_callback_attempts: number;
  daily_callback_limit: number;
  timezone: string;
  feedback_ttl_hours: number;
  blocked_callers: string[];
  allowed_callers: string[];
}

interface SummaryRow {
  business_id: string;
  business_name: string;
  pilot_mode: PilotMode;
  daily_callback_limit: number;
  callbacks_today: number;
  total_jobs: number;
  notified_leads: number;
  owner_feedback_count: number;
  booked_count: number;
  won_count: number;
  open_incident_count: number;
}

const PILOT_MODES = new Set<PilotMode>([
  "setup", "allowlist_only", "live", "paused", "completed",
]);

function boundedInteger(
  value: number,
  minimum: number,
  maximum: number,
  name: string,
): number {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
  return value;
}

function normalizedPhoneList(values: readonly string[], name: string): string[] {
  const result = new Set<string>();
  for (const value of values) {
    const normalized = normalizePhoneNumber(value);
    if (!normalized) throw new Error(`${name} contains an invalid E.164 number`);
    result.add(normalized);
  }
  return [...result];
}

export function validatePilotBusinessInput(input: PilotBusinessInput): PilotBusinessInput {
  const id = input.id.trim();
  if (!/^[A-Za-z0-9_-]{3,64}$/.test(id)) {
    throw new Error("Business id must be 3-64 letters, numbers, underscores, or hyphens");
  }
  const name = input.name.replace(/\s+/g, " ").trim();
  if (!name || name.length > 120) throw new Error("Business name must be 1-120 characters");
  if (!PILOT_MODES.has(input.pilotMode)) throw new Error("Unsupported pilot mode");

  const inboundNumber = normalizePhoneNumber(input.inboundNumber);
  const callbackNumber = normalizePhoneNumber(input.callbackNumber);
  const ownerNumber = normalizePhoneNumber(input.ownerNumber);
  if (!inboundNumber || !callbackNumber || !ownerNumber) {
    throw new Error("Business phone fields must use E.164 format");
  }
  if (inboundNumber === callbackNumber) {
    throw new Error("Inbound and callback numbers must be different");
  }

  const blockedCallers = normalizedPhoneList(input.blockedCallers, "blockedCallers");
  const allowedCallers = normalizedPhoneList(input.allowedCallers, "allowedCallers");
  const blocked = new Set(blockedCallers);
  if (allowedCallers.some((item) => blocked.has(item))) {
    throw new Error("A caller cannot be both allowed and blocked");
  }
  if (input.pilotMode === "allowlist_only" && allowedCallers.length === 0) {
    throw new Error("allowlist_only mode requires at least one allowed caller");
  }

  const timezone = input.timezone.trim();
  if (!timezone || timezone.length > 100) throw new Error("timezone is required");

  return {
    id,
    name,
    inboundNumber,
    callbackNumber,
    ownerNumber,
    pilotMode: input.pilotMode,
    callbackDelaySeconds: boundedInteger(
      input.callbackDelaySeconds, 0, 900, "callbackDelaySeconds",
    ),
    callerCooldownMinutes: boundedInteger(
      input.callerCooldownMinutes, 1, 43_200, "callerCooldownMinutes",
    ),
    maxCallbackAttempts: boundedInteger(
      input.maxCallbackAttempts, 1, 3, "maxCallbackAttempts",
    ),
    dailyCallbackLimit: boundedInteger(
      input.dailyCallbackLimit, 1, 100, "dailyCallbackLimit",
    ),
    timezone,
    feedbackTtlHours: boundedInteger(
      input.feedbackTtlHours, 1, 720, "feedbackTtlHours",
    ),
    blockedCallers,
    allowedCallers,
  };
}

function businessRow(input: PilotBusinessInput): PilotBusinessRow {
  return {
    id: input.id,
    name: input.name,
    inbound_number: input.inboundNumber,
    callback_number: input.callbackNumber,
    owner_number: input.ownerNumber,
    pilot_mode: input.pilotMode,
    callback_delay_seconds: input.callbackDelaySeconds,
    caller_cooldown_minutes: input.callerCooldownMinutes,
    max_callback_attempts: input.maxCallbackAttempts,
    daily_callback_limit: input.dailyCallbackLimit,
    timezone: input.timezone,
    feedback_ttl_hours: input.feedbackTtlHours,
    blocked_callers: input.blockedCallers,
    allowed_callers: input.allowedCallers,
  };
}

function rowToBusiness(row: PilotBusinessRow, publicBaseUrl: string): BusinessConfig {
  return {
    id: row.id,
    name: row.name,
    inboundNumber: row.inbound_number,
    callbackNumber: row.callback_number,
    ownerNumber: row.owner_number,
    publicBaseUrl,
    callbackDelaySeconds: row.callback_delay_seconds,
    callerCooldownMinutes: row.caller_cooldown_minutes,
    maxCallbackAttempts: row.max_callback_attempts,
    active: row.pilot_mode === "allowlist_only" || row.pilot_mode === "live",
    blockedCallers: new Set(row.blocked_callers ?? []),
    pilotMode: row.pilot_mode,
    allowedCallers: new Set(row.allowed_callers ?? []),
    dailyCallbackLimit: row.daily_callback_limit,
    feedbackTtlHours: row.feedback_ttl_hours,
    timezone: row.timezone,
  };
}

function rowToLead(row: Record<string, unknown>): LeadCard {
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

export class SupabasePilotStore implements BusinessDirectory, PilotControl {
  private readonly baseUrl: string;

  constructor(
    supabaseUrl: string,
    private readonly serviceRoleKey: string,
    private readonly publicBaseUrl: string,
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
      throw new Error(`Supabase pilot request failed (${response.status}): ${text.slice(0, 400)}`);
    }
    return (text ? JSON.parse(text) : null) as T;
  }

  async getBusinessById(id: string): Promise<BusinessConfig | null> {
    const rows = await this.request<PilotBusinessRow[]>(
      `/pilot_businesses?select=*&id=eq.${encodeURIComponent(id)}&limit=1`,
      { method: "GET" },
    );
    return rows[0] ? rowToBusiness(rows[0], this.publicBaseUrl) : null;
  }

  async getBusinessByInboundNumber(inboundNumber: string): Promise<BusinessConfig | null> {
    const normalized = normalizePhoneNumber(inboundNumber);
    if (!normalized) return null;
    const rows = await this.request<PilotBusinessRow[]>(
      `/pilot_businesses?select=*&inbound_number=eq.${encodeURIComponent(normalized)}&limit=1`,
      { method: "GET" },
    );
    return rows[0] ? rowToBusiness(rows[0], this.publicBaseUrl) : null;
  }

  async getBusinessForJob(jobId: string): Promise<BusinessConfig | null> {
    const rows = await this.request<Array<{ business_id: string }>>(
      `/callback_jobs?select=business_id&id=eq.${encodeURIComponent(jobId)}&limit=1`,
      { method: "GET" },
    );
    return rows[0] ? this.getBusinessById(rows[0].business_id) : null;
  }

  async listBusinesses(): Promise<BusinessConfig[]> {
    const rows = await this.request<PilotBusinessRow[]>(
      "/pilot_businesses?select=*&order=name.asc",
      { method: "GET" },
    );
    return rows.map((row) => rowToBusiness(row, this.publicBaseUrl));
  }

  async listDispatchableBusinesses(): Promise<BusinessConfig[]> {
    const rows = await this.request<PilotBusinessRow[]>(
      "/pilot_businesses?select=*&pilot_mode=in.(allowlist_only,live)&order=id.asc",
      { method: "GET" },
    );
    return rows.map((row) => rowToBusiness(row, this.publicBaseUrl));
  }

  async upsertBusiness(rawInput: PilotBusinessInput): Promise<BusinessConfig> {
    const input = validatePilotBusinessInput(rawInput);
    const rows = await this.request<PilotBusinessRow[]>(
      "/pilot_businesses?on_conflict=id",
      { method: "POST", body: JSON.stringify(businessRow(input)) },
      "resolution=merge-duplicates,return=representation",
    );
    if (!rows[0]) throw new Error("Business upsert returned no row");
    return rowToBusiness(rows[0], this.publicBaseUrl);
  }

  async setPilotMode(businessId: string, mode: PilotMode): Promise<BusinessConfig> {
    if (!PILOT_MODES.has(mode)) throw new Error("Unsupported pilot mode");
    const rows = await this.request<PilotBusinessRow[]>(
      `/pilot_businesses?id=eq.${encodeURIComponent(businessId)}`,
      { method: "PATCH", body: JSON.stringify({ pilot_mode: mode }) },
      "return=representation",
    );
    if (!rows[0]) throw new Error("Unknown pilot business");
    return rowToBusiness(rows[0], this.publicBaseUrl);
  }

  async reserveCallbackSlot(
    businessId: string,
    usageDate: string,
    dailyLimit: number,
  ): Promise<boolean> {
    return this.request<boolean>(
      "/rpc/reserve_pilot_callback_slot",
      {
        method: "POST",
        body: JSON.stringify({
          p_business_id: businessId,
          p_usage_date: usageDate,
          p_daily_limit: dailyLimit,
        }),
      },
    );
  }

  async getLeadById(businessId: string, leadId: string): Promise<LeadCard | null> {
    const rows = await this.request<Record<string, unknown>[]>(
      `/lead_cards?select=*&business_id=eq.${encodeURIComponent(businessId)}` +
        `&id=eq.${encodeURIComponent(leadId)}&limit=1`,
      { method: "GET" },
    );
    return rows[0] ? rowToLead(rows[0]) : null;
  }

  async recordOwnerFeedback(feedback: OwnerFeedback): Promise<OwnerFeedback> {
    const lead = await this.getLeadById(feedback.businessId, feedback.leadCardId);
    if (!lead) throw new Error("Lead does not belong to the supplied business");
    const payload: Record<string, unknown> = {
      lead_card_id: feedback.leadCardId,
      business_id: feedback.businessId,
      outcome: feedback.outcome,
      submitted_at: feedback.submittedAt,
      updated_at: feedback.submittedAt,
      revenue_amount: feedback.revenueAmount ?? null,
      notes: feedback.notes ?? null,
    };
    const rows = await this.request<Record<string, unknown>[]>(
      "/owner_feedback?on_conflict=lead_card_id",
      { method: "POST", body: JSON.stringify(payload) },
      "resolution=merge-duplicates,return=representation",
    );
    const row = rows[0];
    if (!row) throw new Error("Feedback upsert returned no row");
    const result: OwnerFeedback = {
      leadCardId: String(row.lead_card_id),
      businessId: String(row.business_id),
      outcome: row.outcome as OwnerFeedback["outcome"],
      submittedAt: String(row.submitted_at),
    };
    if (typeof row.revenue_amount === "number") result.revenueAmount = row.revenue_amount;
    if (typeof row.revenue_amount === "string" && row.revenue_amount) {
      result.revenueAmount = Number(row.revenue_amount);
    }
    if (typeof row.notes === "string" && row.notes) result.notes = row.notes;
    return result;
  }

  async recordIncident(incident: PilotIncident): Promise<void> {
    await this.request<unknown>(
      "/pilot_incidents",
      {
        method: "POST",
        body: JSON.stringify({
          id: incident.id,
          business_id: incident.businessId,
          severity: incident.severity,
          category: incident.category,
          description: incident.description,
          status: incident.status,
          occurred_at: incident.occurredAt,
          resolved_at: incident.resolvedAt ?? null,
        }),
      },
      "return=minimal",
    );
  }

  async getPilotSummary(): Promise<PilotBusinessSummary[]> {
    const rows = await this.request<SummaryRow[]>(
      "/pilot_business_summary?select=*&order=business_name.asc",
      { method: "GET" },
    );
    return rows.map((row) => ({
      businessId: row.business_id,
      businessName: row.business_name,
      pilotMode: row.pilot_mode,
      dailyCallbackLimit: row.daily_callback_limit,
      callbacksToday: row.callbacks_today,
      totalJobs: row.total_jobs,
      notifiedLeads: row.notified_leads,
      ownerFeedbackCount: row.owner_feedback_count,
      bookedCount: row.booked_count,
      wonCount: row.won_count,
      openIncidentCount: row.open_incident_count,
    }));
  }
}

export class MemoryPilotStore implements BusinessDirectory, PilotControl {
  private readonly businesses = new Map<string, BusinessConfig>();
  private readonly inboundIndex = new Map<string, string>();
  private readonly jobBusiness = new Map<string, string>();
  private readonly leads = new Map<string, LeadCard>();
  private readonly feedback = new Map<string, OwnerFeedback>();
  private readonly incidents: PilotIncident[] = [];
  private readonly usage = new Map<string, number>();

  constructor(initial: BusinessConfig[] = []) {
    for (const business of initial) this.putBusiness(business);
  }

  private putBusiness(business: BusinessConfig): void {
    this.businesses.set(business.id, business);
    this.inboundIndex.set(business.inboundNumber, business.id);
  }

  bindJob(jobId: string, businessId: string): void {
    this.jobBusiness.set(jobId, businessId);
  }

  seedLead(lead: LeadCard): void {
    this.leads.set(`${lead.businessId}:${lead.id}`, { ...lead });
  }

  async getBusinessById(id: string): Promise<BusinessConfig | null> {
    return this.businesses.get(id) ?? null;
  }
  async getBusinessByInboundNumber(number: string): Promise<BusinessConfig | null> {
    const id = this.inboundIndex.get(number);
    return id ? this.getBusinessById(id) : null;
  }
  async getBusinessForJob(jobId: string): Promise<BusinessConfig | null> {
    const id = this.jobBusiness.get(jobId);
    return id ? this.getBusinessById(id) : null;
  }
  async listBusinesses(): Promise<BusinessConfig[]> {
    return [...this.businesses.values()];
  }
  async listDispatchableBusinesses(): Promise<BusinessConfig[]> {
    return [...this.businesses.values()].filter((item) => item.active);
  }
  async upsertBusiness(input: PilotBusinessInput): Promise<BusinessConfig> {
    const valid = validatePilotBusinessInput(input);
    const business = rowToBusiness(businessRow(valid), "https://ringback.example.com");
    this.putBusiness(business);
    return business;
  }
  async setPilotMode(businessId: string, mode: PilotMode): Promise<BusinessConfig> {
    const existing = this.businesses.get(businessId);
    if (!existing) throw new Error("Unknown pilot business");
    const updated: BusinessConfig = {
      ...existing,
      pilotMode: mode,
      active: mode === "allowlist_only" || mode === "live",
    };
    this.putBusiness(updated);
    return updated;
  }
  async reserveCallbackSlot(
    businessId: string, usageDate: string, dailyLimit: number,
  ): Promise<boolean> {
    const key = `${businessId}:${usageDate}`;
    const current = this.usage.get(key) ?? 0;
    if (current >= dailyLimit) return false;
    this.usage.set(key, current + 1);
    return true;
  }
  async getLeadById(businessId: string, leadId: string): Promise<LeadCard | null> {
    const lead = this.leads.get(`${businessId}:${leadId}`);
    return lead ? { ...lead } : null;
  }
  async recordOwnerFeedback(value: OwnerFeedback): Promise<OwnerFeedback> {
    if (!(await this.getLeadById(value.businessId, value.leadCardId))) {
      throw new Error("Lead does not belong to the supplied business");
    }
    this.feedback.set(`${value.businessId}:${value.leadCardId}`, { ...value });
    return { ...value };
  }
  async recordIncident(incident: PilotIncident): Promise<void> {
    this.incidents.push({ ...incident });
  }
  async getPilotSummary(): Promise<PilotBusinessSummary[]> {
    return [...this.businesses.values()].map((business) => {
      const feedback = [...this.feedback.values()].filter(
        (item) => item.businessId === business.id,
      );
      return {
        businessId: business.id,
        businessName: business.name,
        pilotMode: business.pilotMode ?? (business.active ? "live" : "paused"),
        dailyCallbackLimit: business.dailyCallbackLimit ?? 50,
        callbacksToday: [...this.usage.entries()]
          .filter(([key]) => key.startsWith(`${business.id}:`))
          .reduce((sum, [, count]) => sum + count, 0),
        totalJobs: [...this.jobBusiness.values()].filter((id) => id === business.id).length,
        notifiedLeads: [...this.leads.values()].filter(
          (lead) => lead.businessId === business.id && Boolean(lead.ownerNotificationSid),
        ).length,
        ownerFeedbackCount: feedback.length,
        bookedCount: feedback.filter((item) => item.outcome === "booked").length,
        wonCount: feedback.filter((item) => item.outcome === "won").length,
        openIncidentCount: this.incidents.filter(
          (item) => item.businessId === business.id && item.status === "open",
        ).length,
      };
    });
  }

  listIncidents(): PilotIncident[] {
    return this.incidents.map((item) => ({ ...item }));
  }
  listFeedback(): OwnerFeedback[] {
    return [...this.feedback.values()].map((item) => ({ ...item }));
  }
}
