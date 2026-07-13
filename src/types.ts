export type Provider = "twilio";

export type CallStatus =
  | "queued"
  | "initiated"
  | "ringing"
  | "in-progress"
  | "completed"
  | "busy"
  | "failed"
  | "no-answer"
  | "canceled";

export type CallDirection = "inbound" | "outbound-api" | "outbound-dial" | "unknown";

export type PilotMode = "setup" | "allowlist_only" | "live" | "paused" | "completed";

export interface BusinessConfig {
  id: string;
  name: string;
  inboundNumber: string;
  callbackNumber: string;
  ownerNumber: string;
  publicBaseUrl: string;
  callbackDelaySeconds: number;
  callerCooldownMinutes: number;
  maxCallbackAttempts: number;
  active: boolean;
  blockedCallers: ReadonlySet<string>;
  pilotMode?: PilotMode;
  allowedCallers?: ReadonlySet<string>;
  dailyCallbackLimit?: number;
  feedbackTtlHours?: number;
  timezone?: string;
}

export interface PilotBusinessInput {
  id: string;
  name: string;
  inboundNumber: string;
  callbackNumber: string;
  ownerNumber: string;
  pilotMode: PilotMode;
  callbackDelaySeconds: number;
  callerCooldownMinutes: number;
  maxCallbackAttempts: number;
  dailyCallbackLimit: number;
  timezone: string;
  feedbackTtlHours: number;
  blockedCallers: string[];
  allowedCallers: string[];
}

export interface CallProgressEvent {
  provider: Provider;
  providerEventKey: string;
  providerCallSid: string;
  sequenceNumber: number;
  direction: CallDirection;
  status: CallStatus;
  from: string;
  to: string;
  occurredAt: string;
  callDurationSeconds?: number;
  parentCallSid?: string;
  callbackSource?: string;
}

export type CallbackJobState =
  | "waiting_window"
  | "dispatching"
  | "dialing"
  | "ringing"
  | "connected"
  | "qualifying"
  | "lead_ready"
  | "notified"
  | "no_answer"
  | "suppressed"
  | "failed"
  | "cancelled";

export interface CallbackJob {
  id: string;
  businessId: string;
  sourceCallSid: string;
  callerNumber: string;
  businessNumber: string;
  state: CallbackJobState;
  sourceEndedAt: string;
  scheduledAt: string;
  createdAt: string;
  updatedAt: string;
  attempts: number;
  lastProviderSequence: number;
  outboundCallSid?: string;
  serviceNeed?: string;
  location?: string;
  urgency?: string;
  failureReason?: string;
}

export interface ManualCallback {
  id: string;
  businessId: string;
  callerNumber: string;
  occurredAt: string;
  source: "owner" | "staff" | "system";
}

export interface LeadCard {
  id: string;
  businessId: string;
  callbackJobId: string;
  callerNumber: string;
  serviceNeed: string;
  location: string;
  urgency: string;
  createdAt: string;
  ownerNotificationSid?: string;
}

export type OwnerFeedbackOutcome =
  | "acknowledged"
  | "contacted"
  | "booked"
  | "won"
  | "lost"
  | "not_lead"
  | "unreachable";

export interface OwnerFeedback {
  leadCardId: string;
  businessId: string;
  outcome: OwnerFeedbackOutcome;
  submittedAt: string;
  revenueAmount?: number;
  notes?: string;
}

export type PilotIncidentSeverity = "info" | "warning" | "critical";
export type PilotIncidentStatus = "open" | "resolved";

export interface PilotIncident {
  id: string;
  businessId: string;
  severity: PilotIncidentSeverity;
  category: string;
  description: string;
  status: PilotIncidentStatus;
  occurredAt: string;
  resolvedAt?: string;
}

export interface PilotBusinessSummary {
  businessId: string;
  businessName: string;
  pilotMode: PilotMode;
  dailyCallbackLimit: number;
  callbacksToday: number;
  totalJobs: number;
  notifiedLeads: number;
  ownerFeedbackCount: number;
  bookedCount: number;
  wonCount: number;
  openIncidentCount: number;
}

export interface StartCallbackRequest {
  to: string;
  from: string;
  voiceUrl: string;
  statusCallbackUrl: string;
}

export interface StartCallbackResult {
  callSid: string;
}

export interface SendLeadRequest {
  to: string;
  from: string;
  body: string;
}

export interface SendLeadResult {
  messageSid: string;
}

export interface TelephonyGateway {
  startCallback(request: StartCallbackRequest): Promise<StartCallbackResult>;
  sendLeadMessage(request: SendLeadRequest): Promise<SendLeadResult>;
}

export interface Clock {
  now(): Date;
}

export interface Repository {
  recordCallEvent(event: CallProgressEvent): Promise<boolean>;
  getJobBySourceCall(sourceCallSid: string): Promise<CallbackJob | null>;
  createJobIfAbsent(job: CallbackJob): Promise<{ job: CallbackJob; created: boolean }>;
  getJobById(id: string): Promise<CallbackJob | null>;
  getJobByOutboundCall(outboundCallSid: string): Promise<CallbackJob | null>;
  claimDueJobs(nowIso: string, limit: number): Promise<CallbackJob[]>;
  saveJob(job: CallbackJob): Promise<void>;
  recordManualCallback(callback: ManualCallback): Promise<void>;
  hasRecentManualCallback(
    businessId: string,
    callerNumber: string,
    sinceIso: string,
  ): Promise<boolean>;
  getLeadByCallbackJob(callbackJobId: string): Promise<LeadCard | null>;
  createLeadIfAbsent(lead: LeadCard): Promise<LeadCard>;
  saveLead(lead: LeadCard): Promise<void>;
}

export interface BusinessDirectory {
  getBusinessById(id: string): Promise<BusinessConfig | null>;
  getBusinessByInboundNumber(inboundNumber: string): Promise<BusinessConfig | null>;
  getBusinessForJob(jobId: string): Promise<BusinessConfig | null>;
  listBusinesses(): Promise<BusinessConfig[]>;
  listDispatchableBusinesses(): Promise<BusinessConfig[]>;
  upsertBusiness(input: PilotBusinessInput): Promise<BusinessConfig>;
  setPilotMode(businessId: string, mode: PilotMode): Promise<BusinessConfig>;
}

export interface PilotControl {
  reserveCallbackSlot(
    businessId: string,
    usageDate: string,
    dailyLimit: number,
  ): Promise<boolean>;
  getLeadById(businessId: string, leadId: string): Promise<LeadCard | null>;
  recordOwnerFeedback(feedback: OwnerFeedback): Promise<OwnerFeedback>;
  recordIncident(incident: PilotIncident): Promise<void>;
  getPilotSummary(): Promise<PilotBusinessSummary[]>;
}

export interface FeedbackLinkFactory {
  createLink(business: BusinessConfig, lead: LeadCard, now: Date): Promise<string>;
}

export interface EligibilityDecision {
  eligible: boolean;
  reason:
    | "eligible"
    | "business_inactive"
    | "pilot_mode_blocked"
    | "caller_not_allowlisted"
    | "not_inbound"
    | "not_missed_terminal"
    | "invalid_caller"
    | "invalid_destination"
    | "destination_mismatch"
    | "self_call"
    | "blocked_caller";
}

export interface InboundHandlingResult {
  accepted: boolean;
  duplicateEvent: boolean;
  createdJob: boolean;
  reason: string;
  job?: CallbackJob;
}

export interface DispatchResult {
  jobId: string;
  outcome: "dialing" | "suppressed" | "failed";
  detail?: string;
}

export type QualificationField = "serviceNeed" | "location" | "urgency";
