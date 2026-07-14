export type EvidenceKind =
  | "missed_call"
  | "callback_attempt"
  | "callback_connected"
  | "qualified_lead"
  | "owner_notified"
  | "owner_contacted"
  | "booking_requested"
  | "booking_created"
  | "booking_cancelled"
  | "job_completed"
  | "owner_reported_won"
  | "owner_reported_lost"
  | "invoice_issued"
  | "payment_collected"
  | "refund_issued"
  | "attribution_correction"
  | "lead_lost"
  | "cost_incurred";
export type EvidenceStrength = "estimated" | "owner_reported" | "provider_verified" | "financial_verified";
export type AttributionClass = "direct_recovery" | "assisted_recovery" | "likely_incremental" | "unattributed" | "counterfactual_unknown";
export type PartnerRole = "agency" | "referrer" | "reseller";
export type PartnerScope = "accounts.read" | "accounts.manage" | "reports.read" | "leads.read" | "commission.read";
export type CommissionState = "pending" | "approved" | "paid" | "reversed";

export interface AttributionEvent {
  id: string;
  organizationId: string;
  leadId: string;
  callId?: string;
  callbackJobId?: string;
  conversationId?: string;
  bookingId?: string;
  invoiceId?: string;
  paymentId?: string;
  kind: EvidenceKind;
  occurredAt: string;
  sourceId: string;
  sourceType: string;
  campaignId?: string;
  partnerId?: string;
  amountMinor?: number;
  currency?: string;
  strength: EvidenceStrength;
  confidence: number;
  attributionClass?: AttributionClass;
  ruleVersion: string;
  metadata: Record<string, string | number | boolean | null>;
}
export interface AcquisitionTouch {
  id: string;
  organizationId: string;
  leadId: string;
  channel: string;
  campaignId?: string;
  partnerId?: string;
  occurredAt: string;
}
export interface IdentityLink {
  id: string;
  organizationId: string;
  canonicalLeadId: string;
  linkedEntityType: "call" | "callback_job" | "conversation" | "booking" | "crm_contact" | "invoice" | "payment";
  linkedEntityId: string;
  matchMethod: "provider_id" | "normalized_phone" | "service_time_location" | "crm_mapping" | "manual";
  confidence: number;
  createdAt: string;
  actorId?: string;
}
export interface EvidenceValueBreakdown {
  estimatedMinor: number;
  ownerReportedMinor: number;
  providerVerifiedMinor: number;
  financialVerifiedMinor: number;
}
export interface AttributionReport {
  organizationId: string;
  leadId: string;
  currency: string;
  bookedMinor: number;
  invoicedMinor: number;
  collectedMinor: number;
  refundedMinor: number;
  netCollectedMinor: number;
  confidenceWeightedMinor: number;
  attributedMinor: number;
  costMinor: number;
  contributionMinor: number;
  highestStrength: EvidenceStrength;
  attributionClass: AttributionClass;
  attributionWeight: number;
  byStrength: EvidenceValueBreakdown;
  firstTouch?: AcquisitionTouch;
  lastTouch?: AcquisitionTouch;
  missingEvidence: string[];
  conflicts: string[];
  ruleVersion: string;
}
export interface CohortSummary {
  organizationCount: number;
  leadCount: number;
  currency: string;
  netCollectedMinor: number;
  attributedMinor: number;
  contributionMinor: number;
  missingOutcomeRate: number;
}
export interface Partner {
  id: string;
  name: string;
  role: PartnerRole;
  active: boolean;
  scopes: PartnerScope[];
  createdAt: string;
}
export interface PartnerAssignment {
  partnerId: string;
  organizationId: string;
  state: "active" | "revoked";
  createdAt: string;
  revokedAt?: string;
}
export interface CommissionEntry {
  id: string;
  partnerId: string;
  organizationId: string;
  leadId: string;
  sourceEventId: string;
  amountMinor: number;
  currency: string;
  rateBasisPoints: number;
  ruleVersion: string;
  state: CommissionState;
  createdAt: string;
  reversedByEventId?: string;
}
export interface CrmOutboxItem {
  id: string;
  organizationId: string;
  leadId: string;
  destination: string;
  payloadHash: string;
  mappingVersion: string;
  state: "pending" | "sent" | "failed";
  attempts: number;
  createdAt: string;
  updatedAt: string;
  remoteId?: string;
  failureReason?: string;
}
export interface AttributionStore {
  appendEvent(event: AttributionEvent): Promise<boolean>;
  listEvents(organizationId: string, leadId: string): Promise<AttributionEvent[]>;
  addTouch(touch: AcquisitionTouch): Promise<boolean>;
  listTouches(organizationId: string, leadId: string): Promise<AcquisitionTouch[]>;
  addIdentityLink(link: IdentityLink): Promise<boolean>;
  listIdentityLinks(organizationId: string, canonicalLeadId: string): Promise<IdentityLink[]>;
  addPartner(partner: Partner): Promise<void>;
  getPartner(id: string): Promise<Partner | null>;
  assignPartner(assignment: PartnerAssignment): Promise<void>;
  getAssignment(partnerId: string, organizationId: string): Promise<PartnerAssignment | null>;
  addCommission(entry: CommissionEntry): Promise<boolean>;
  getCommissionBySource(partnerId: string, sourceEventId: string): Promise<CommissionEntry | null>;
  saveCommission(entry: CommissionEntry): Promise<void>;
  listCommissions(partnerId: string): Promise<CommissionEntry[]>;
  enqueueCrm(item: CrmOutboxItem): Promise<boolean>;
  getCrmItem(id: string): Promise<CrmOutboxItem | null>;
  saveCrmItem(item: CrmOutboxItem): Promise<void>;
}
