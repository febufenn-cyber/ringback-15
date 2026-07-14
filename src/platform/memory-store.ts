import type {
  AuditEvent,
  BillingEvent,
  BusinessLocation,
  OnboardingSession,
  Organization,
  OrganizationMembership,
  PhoneLine,
  PlatformStore,
  Subscription,
  UsageEvent,
} from "./types.js";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class MemoryPlatformStore implements PlatformStore {
  private organizations = new Map<string, Organization>();
  private memberships = new Map<string, OrganizationMembership>();
  private locations = new Map<string, BusinessLocation>();
  private lines = new Map<string, PhoneLine>();
  private onboarding = new Map<string, OnboardingSession>();
  private subscriptions = new Map<string, Subscription>();
  private billingEvents = new Set<string>();
  private usageEvents = new Map<string, UsageEvent>();
  private audits: AuditEvent[] = [];

  private membershipKey(org: string, user: string): string { return `${org}:${user}`; }
  private scopedKey(org: string, id: string): string { return `${org}:${id}`; }

  async createOrganization(value: Organization): Promise<void> {
    if (this.organizations.has(value.id)) throw new Error("organization_exists");
    this.organizations.set(value.id, clone(value));
  }
  async getOrganization(id: string): Promise<Organization | null> { return clone(this.organizations.get(id) ?? null); }
  async saveOrganization(value: Organization): Promise<void> {
    if (!this.organizations.has(value.id)) throw new Error("organization_not_found");
    this.organizations.set(value.id, clone(value));
  }
  async addMembership(value: OrganizationMembership): Promise<void> {
    const key = this.membershipKey(value.organizationId, value.userId);
    if (this.memberships.has(key)) throw new Error("membership_exists");
    this.memberships.set(key, clone(value));
  }
  async getMembership(org: string, user: string): Promise<OrganizationMembership | null> {
    return clone(this.memberships.get(this.membershipKey(org, user)) ?? null);
  }
  async listMemberships(org: string): Promise<OrganizationMembership[]> {
    return [...this.memberships.values()].filter((item) => item.organizationId === org).map(clone);
  }
  async saveMembership(value: OrganizationMembership): Promise<void> {
    const key = this.membershipKey(value.organizationId, value.userId);
    if (!this.memberships.has(key)) throw new Error("membership_not_found");
    this.memberships.set(key, clone(value));
  }
  async addLocation(value: BusinessLocation): Promise<void> {
    const key = this.scopedKey(value.organizationId, value.id);
    if (this.locations.has(key)) throw new Error("location_exists");
    this.locations.set(key, clone(value));
  }
  async getLocation(org: string, id: string): Promise<BusinessLocation | null> {
    return clone(this.locations.get(this.scopedKey(org, id)) ?? null);
  }
  async listLocations(org: string): Promise<BusinessLocation[]> {
    return [...this.locations.values()].filter((item) => item.organizationId === org).map(clone);
  }
  async saveLocation(value: BusinessLocation): Promise<void> {
    const key = this.scopedKey(value.organizationId, value.id);
    if (!this.locations.has(key)) throw new Error("location_not_found");
    this.locations.set(key, clone(value));
  }
  async addPhoneLine(value: PhoneLine): Promise<void> {
    const key = this.scopedKey(value.organizationId, value.id);
    if (this.lines.has(key)) throw new Error("phone_line_exists");
    for (const line of this.lines.values()) {
      if (line.inboundNumber === value.inboundNumber || line.callbackNumber === value.callbackNumber) {
        throw new Error("phone_number_already_assigned");
      }
    }
    this.lines.set(key, clone(value));
  }
  async getPhoneLine(org: string, id: string): Promise<PhoneLine | null> {
    return clone(this.lines.get(this.scopedKey(org, id)) ?? null);
  }
  async listPhoneLines(org: string): Promise<PhoneLine[]> {
    return [...this.lines.values()].filter((item) => item.organizationId === org).map(clone);
  }
  async savePhoneLine(value: PhoneLine): Promise<void> {
    const key = this.scopedKey(value.organizationId, value.id);
    if (!this.lines.has(key)) throw new Error("phone_line_not_found");
    this.lines.set(key, clone(value));
  }
  async createOnboarding(value: OnboardingSession): Promise<void> {
    if (this.onboarding.has(value.organizationId)) throw new Error("onboarding_exists");
    this.onboarding.set(value.organizationId, clone(value));
  }
  async getOnboarding(org: string): Promise<OnboardingSession | null> { return clone(this.onboarding.get(org) ?? null); }
  async saveOnboarding(value: OnboardingSession): Promise<void> { this.onboarding.set(value.organizationId, clone(value)); }
  async getSubscription(org: string): Promise<Subscription | null> { return clone(this.subscriptions.get(org) ?? null); }
  async saveSubscription(value: Subscription): Promise<void> { this.subscriptions.set(value.organizationId, clone(value)); }
  async recordBillingEvent(value: BillingEvent): Promise<boolean> {
    const key = `${value.provider}:${value.providerEventId}`;
    if (this.billingEvents.has(key)) return false;
    this.billingEvents.add(key);
    return true;
  }
  async recordUsage(value: UsageEvent): Promise<boolean> {
    const key = `${value.organizationId}:${value.kind}:${value.sourceId}`;
    if (this.usageEvents.has(key)) return false;
    this.usageEvents.set(key, clone(value));
    return true;
  }
  async sumUsage(org: string, kind: UsageEvent["kind"], fromIso: string, toIso: string): Promise<number> {
    const from = Date.parse(fromIso);
    const to = Date.parse(toIso);
    return [...this.usageEvents.values()]
      .filter((event) => event.organizationId === org && event.kind === kind)
      .filter((event) => Date.parse(event.occurredAt) >= from && Date.parse(event.occurredAt) < to)
      .reduce((sum, event) => sum + event.quantity, 0);
  }
  async appendAudit(value: AuditEvent): Promise<void> { this.audits.push(clone(value)); }
  async listAudit(org: string): Promise<AuditEvent[]> {
    return this.audits.filter((event) => event.organizationId === org).map(clone);
  }
}
