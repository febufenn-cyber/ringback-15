export type OrganizationState = "trial" | "active" | "past_due" | "suspended" | "closing" | "closed";
export type OrganizationRole = "owner" | "admin" | "operator" | "viewer" | "billing";
export type MembershipState = "invited" | "active" | "revoked";
export type LocationState = "setup" | "active" | "paused" | "closed";
export type PhoneLineState = "draft" | "provisioning" | "verified" | "active" | "paused" | "failed" | "released";
export type OnboardingState =
  | "created"
  | "profile_complete"
  | "line_configured"
  | "number_verified"
  | "policy_approved"
  | "billing_ready"
  | "test_passed"
  | "active"
  | "blocked"
  | "abandoned";
export type SubscriptionStatus = "none" | "trialing" | "active" | "past_due" | "canceled" | "unpaid";
export type Capability =
  | "organization.read"
  | "organization.manage"
  | "members.read"
  | "members.manage"
  | "locations.read"
  | "locations.manage"
  | "lines.read"
  | "lines.manage"
  | "lines.activate"
  | "leads.read"
  | "leads.manage"
  | "billing.read"
  | "billing.manage"
  | "audit.read"
  | "support.manage";

export interface AuthPrincipal {
  userId: string;
  platformAdmin?: boolean;
}

export interface Organization {
  id: string;
  name: string;
  state: OrganizationState;
  defaultTimezone: string;
  retentionDays: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMembership {
  organizationId: string;
  userId: string;
  role: OrganizationRole;
  state: MembershipState;
  invitedBy: string;
  createdAt: string;
  acceptedAt?: string;
  revokedAt?: string;
}

export interface BusinessLocation {
  id: string;
  organizationId: string;
  name: string;
  timezone: string;
  serviceRegion: string;
  state: LocationState;
  approvedPolicyVersion?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PhoneLine {
  id: string;
  organizationId: string;
  locationId: string;
  inboundNumber: string;
  callbackNumber: string;
  ownerNumber: string;
  provider: "twilio";
  providerLineId?: string;
  state: PhoneLineState;
  dailyCallbackLimit: number;
  spendLimitMinor: number;
  active: boolean;
  verifiedAt?: string;
  lastHealthCheckAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OnboardingSession {
  id: string;
  organizationId: string;
  state: OnboardingState;
  completedSteps: string[];
  blockedReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlanEntitlements {
  planCode: string;
  maxLocations: number;
  maxPhoneLines: number;
  monthlyCallbacks: number;
  dailyCallbacksPerLine: number;
  feedbackRetentionDays: number;
}

export interface Subscription {
  id: string;
  organizationId: string;
  provider: "stripe" | "mock";
  providerCustomerId: string;
  providerSubscriptionId: string;
  planCode: string;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  updatedAt: string;
}

export interface BillingEvent {
  provider: string;
  providerEventId: string;
  eventType: string;
  occurredAt: string;
  payloadHash: string;
}

export interface UsageEvent {
  id: string;
  organizationId: string;
  phoneLineId?: string;
  kind: "callback_attempt" | "qualified_lead" | "owner_notification" | "booking";
  quantity: number;
  sourceId: string;
  occurredAt: string;
}

export interface AuditEvent {
  id: string;
  organizationId?: string;
  actorUserId?: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, string | number | boolean | null>;
  occurredAt: string;
}

export interface EntitlementDecision {
  allowed: boolean;
  reason: string;
  entitlements?: PlanEntitlements;
}

export interface PlatformStore {
  createOrganization(organization: Organization): Promise<void>;
  getOrganization(id: string): Promise<Organization | null>;
  saveOrganization(organization: Organization): Promise<void>;
  addMembership(membership: OrganizationMembership): Promise<void>;
  getMembership(organizationId: string, userId: string): Promise<OrganizationMembership | null>;
  listMemberships(organizationId: string): Promise<OrganizationMembership[]>;
  saveMembership(membership: OrganizationMembership): Promise<void>;
  addLocation(location: BusinessLocation): Promise<void>;
  getLocation(organizationId: string, locationId: string): Promise<BusinessLocation | null>;
  listLocations(organizationId: string): Promise<BusinessLocation[]>;
  saveLocation(location: BusinessLocation): Promise<void>;
  addPhoneLine(line: PhoneLine): Promise<void>;
  getPhoneLine(organizationId: string, lineId: string): Promise<PhoneLine | null>;
  listPhoneLines(organizationId: string): Promise<PhoneLine[]>;
  savePhoneLine(line: PhoneLine): Promise<void>;
  createOnboarding(session: OnboardingSession): Promise<void>;
  getOnboarding(organizationId: string): Promise<OnboardingSession | null>;
  saveOnboarding(session: OnboardingSession): Promise<void>;
  getSubscription(organizationId: string): Promise<Subscription | null>;
  saveSubscription(subscription: Subscription): Promise<void>;
  recordBillingEvent(event: BillingEvent): Promise<boolean>;
  recordUsage(event: UsageEvent): Promise<boolean>;
  sumUsage(organizationId: string, kind: UsageEvent["kind"], fromIso: string, toIso: string): Promise<number>;
  appendAudit(event: AuditEvent): Promise<void>;
  listAudit(organizationId: string): Promise<AuditEvent[]>;
}
