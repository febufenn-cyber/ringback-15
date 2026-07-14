import { requireCapability } from "./authz.js";
import { evaluateEntitlement } from "./billing.js";
import { advanceOnboarding } from "./onboarding.js";
import type {
  AuditEvent,
  AuthPrincipal,
  BusinessLocation,
  OnboardingSession,
  Organization,
  OrganizationMembership,
  OrganizationRole,
  PhoneLine,
  PlatformStore,
  UsageEvent,
} from "./types.js";

const E164 = /^\+[1-9]\d{7,14}$/;

function id(prefix: string): string { return `${prefix}_${crypto.randomUUID()}`; }
function assertE164(value: string, field: string): void { if (!E164.test(value)) throw new Error(`${field}_invalid_e164`); }

export interface Clock { now(): Date; }
export class SystemClock implements Clock { now(): Date { return new Date(); } }

export class PlatformService {
  constructor(private readonly store: PlatformStore, private readonly clock: Clock = new SystemClock()) {}

  private async audit(principal: AuthPrincipal | null, organizationId: string | undefined, action: string, targetType: string, targetId: string, metadata: AuditEvent["metadata"] = {}): Promise<void> {
    const event: AuditEvent = { id: id("audit"), action, targetType, targetId, metadata, occurredAt: this.clock.now().toISOString() };
    if (organizationId) event.organizationId = organizationId;
    if (principal) event.actorUserId = principal.userId;
    await this.store.appendAudit(event);
  }

  async createOrganization(principal: AuthPrincipal, name: string, timezone = "UTC"): Promise<{ organization: Organization; onboarding: OnboardingSession }> {
    if (!name.trim()) throw new Error("organization_name_required");
    const now = this.clock.now().toISOString();
    const organization: Organization = { id: id("org"), name: name.trim().slice(0, 120), state: "trial", defaultTimezone: timezone, retentionDays: 90, createdAt: now, updatedAt: now };
    const membership: OrganizationMembership = { organizationId: organization.id, userId: principal.userId, role: "owner", state: "active", invitedBy: principal.userId, createdAt: now, acceptedAt: now };
    const onboarding: OnboardingSession = { id: id("onb"), organizationId: organization.id, state: "created", completedSteps: [], createdAt: now, updatedAt: now };
    await this.store.createOrganization(organization);
    await this.store.addMembership(membership);
    await this.store.createOnboarding(onboarding);
    await this.audit(principal, organization.id, "organization.created", "organization", organization.id);
    return { organization, onboarding };
  }

  async inviteMember(principal: AuthPrincipal, organizationId: string, userId: string, role: OrganizationRole): Promise<OrganizationMembership> {
    await requireCapability(this.store, principal, organizationId, "members.manage");
    if (role === "owner") throw new Error("owner_transfer_requires_dedicated_flow");
    const now = this.clock.now().toISOString();
    const membership: OrganizationMembership = { organizationId, userId, role, state: "invited", invitedBy: principal.userId, createdAt: now };
    await this.store.addMembership(membership);
    await this.audit(principal, organizationId, "membership.invited", "user", userId, { role });
    return membership;
  }

  async acceptMembership(principal: AuthPrincipal, organizationId: string): Promise<OrganizationMembership> {
    const membership = await this.store.getMembership(organizationId, principal.userId);
    if (!membership || membership.state !== "invited") throw new Error("invitation_not_found");
    const active: OrganizationMembership = { ...membership, state: "active", acceptedAt: this.clock.now().toISOString() };
    await this.store.saveMembership(active);
    await this.audit(principal, organizationId, "membership.accepted", "user", principal.userId);
    return active;
  }

  async addLocation(principal: AuthPrincipal, organizationId: string, input: Pick<BusinessLocation, "name" | "timezone" | "serviceRegion">): Promise<BusinessLocation> {
    await requireCapability(this.store, principal, organizationId, "locations.manage");
    const entitlement = await evaluateEntitlement(this.store, organizationId, this.clock.now().toISOString());
    if (!entitlement.allowed || !entitlement.entitlements) throw new Error(`not_entitled:${entitlement.reason}`);
    const existing = await this.store.listLocations(organizationId);
    if (existing.length >= entitlement.entitlements.maxLocations) throw new Error("location_limit_reached");
    const now = this.clock.now().toISOString();
    const location: BusinessLocation = { id: id("loc"), organizationId, name: input.name.trim().slice(0, 120), timezone: input.timezone, serviceRegion: input.serviceRegion.trim().slice(0, 200), state: "setup", createdAt: now, updatedAt: now };
    await this.store.addLocation(location);
    await this.audit(principal, organizationId, "location.created", "location", location.id);
    return location;
  }

  async addPhoneLine(principal: AuthPrincipal, organizationId: string, input: Omit<PhoneLine, "id" | "organizationId" | "provider" | "state" | "active" | "createdAt" | "updatedAt">): Promise<PhoneLine> {
    await requireCapability(this.store, principal, organizationId, "lines.manage");
    const entitlement = await evaluateEntitlement(this.store, organizationId, this.clock.now().toISOString());
    if (!entitlement.allowed || !entitlement.entitlements) throw new Error(`not_entitled:${entitlement.reason}`);
    const location = await this.store.getLocation(organizationId, input.locationId);
    if (!location) throw new Error("location_not_found");
    const lines = await this.store.listPhoneLines(organizationId);
    if (lines.length >= entitlement.entitlements.maxPhoneLines) throw new Error("phone_line_limit_reached");
    assertE164(input.inboundNumber, "inbound_number");
    assertE164(input.callbackNumber, "callback_number");
    assertE164(input.ownerNumber, "owner_number");
    if (input.inboundNumber === input.callbackNumber) throw new Error("inbound_and_callback_must_differ");
    const now = this.clock.now().toISOString();
    const line: PhoneLine = {
      ...input,
      id: id("line"),
      organizationId,
      provider: "twilio",
      state: "draft",
      active: false,
      dailyCallbackLimit: Math.min(input.dailyCallbackLimit, entitlement.entitlements.dailyCallbacksPerLine),
      createdAt: now,
      updatedAt: now,
    };
    await this.store.addPhoneLine(line);
    await this.audit(principal, organizationId, "phone_line.created", "phone_line", line.id);
    return line;
  }

  async markLineVerified(principal: AuthPrincipal, organizationId: string, lineId: string, providerLineId: string): Promise<PhoneLine> {
    await requireCapability(this.store, principal, organizationId, "lines.manage");
    const line = await this.store.getPhoneLine(organizationId, lineId);
    if (!line) throw new Error("phone_line_not_found");
    const now = this.clock.now().toISOString();
    const verified: PhoneLine = { ...line, providerLineId, state: "verified", verifiedAt: now, updatedAt: now };
    await this.store.savePhoneLine(verified);
    await this.audit(principal, organizationId, "phone_line.verified", "phone_line", lineId);
    return verified;
  }

  async activateLine(principal: AuthPrincipal, organizationId: string, lineId: string): Promise<PhoneLine> {
    await requireCapability(this.store, principal, organizationId, "lines.activate");
    const organization = await this.store.getOrganization(organizationId);
    const onboarding = await this.store.getOnboarding(organizationId);
    const line = await this.store.getPhoneLine(organizationId, lineId);
    if (!organization || !onboarding || !line) throw new Error("activation_context_missing");
    const entitlement = await evaluateEntitlement(this.store, organizationId, this.clock.now().toISOString());
    if (!entitlement.allowed) throw new Error(`not_entitled:${entitlement.reason}`);
    if (organization.state !== "active") throw new Error("organization_not_active");
    if (onboarding.state !== "active") throw new Error("onboarding_not_active");
    if (line.state !== "verified") throw new Error("line_not_verified");
    const now = this.clock.now().toISOString();
    const active: PhoneLine = { ...line, state: "active", active: true, updatedAt: now };
    await this.store.savePhoneLine(active);
    await this.audit(principal, organizationId, "phone_line.activated", "phone_line", lineId);
    return active;
  }

  async advanceOnboarding(principal: AuthPrincipal, organizationId: string, to: OnboardingSession["state"], step?: string, reason?: string): Promise<OnboardingSession> {
    await requireCapability(this.store, principal, organizationId, "organization.manage");
    const session = await this.store.getOnboarding(organizationId);
    if (!session) throw new Error("onboarding_not_found");
    const updated = advanceOnboarding(session, to, this.clock.now().toISOString(), step, reason);
    await this.store.saveOnboarding(updated);
    await this.audit(principal, organizationId, "onboarding.transitioned", "onboarding", session.id, { from: session.state, to });
    return updated;
  }

  async activateOrganization(principal: AuthPrincipal, organizationId: string): Promise<Organization> {
    await requireCapability(this.store, principal, organizationId, "organization.manage");
    const organization = await this.store.getOrganization(organizationId);
    const onboarding = await this.store.getOnboarding(organizationId);
    if (!organization || !onboarding) throw new Error("organization_not_found");
    if (onboarding.state !== "active") throw new Error("onboarding_not_active");
    const entitlement = await evaluateEntitlement(this.store, organizationId, this.clock.now().toISOString());
    if (!entitlement.allowed) throw new Error(`not_entitled:${entitlement.reason}`);
    const active: Organization = { ...organization, state: "active", updatedAt: this.clock.now().toISOString() };
    await this.store.saveOrganization(active);
    await this.audit(principal, organizationId, "organization.activated", "organization", organizationId);
    return active;
  }

  async suspendOrganization(principal: AuthPrincipal, organizationId: string, reason: string): Promise<Organization> {
    await requireCapability(this.store, principal, organizationId, "support.manage");
    const organization = await this.store.getOrganization(organizationId);
    if (!organization) throw new Error("organization_not_found");
    const now = this.clock.now().toISOString();
    const suspended: Organization = { ...organization, state: "suspended", updatedAt: now };
    await this.store.saveOrganization(suspended);
    for (const line of await this.store.listPhoneLines(organizationId)) {
      await this.store.savePhoneLine({ ...line, active: false, state: line.state === "released" ? "released" : "paused", updatedAt: now });
    }
    await this.audit(principal, organizationId, "organization.suspended", "organization", organizationId, { reason: reason.slice(0, 300) });
    return suspended;
  }

  async recordUsage(organizationId: string, event: Omit<UsageEvent, "id" | "organizationId" | "occurredAt">): Promise<boolean> {
    const usage: UsageEvent = { ...event, id: id("usage"), organizationId, occurredAt: this.clock.now().toISOString() };
    return this.store.recordUsage(usage);
  }
}
