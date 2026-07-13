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

export interface EligibilityDecision {
  eligible: boolean;
  reason:
    | "eligible"
    | "business_inactive"
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
