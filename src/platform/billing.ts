import type {
  BillingEvent,
  EntitlementDecision,
  PlanEntitlements,
  PlatformStore,
  Subscription,
  SubscriptionStatus,
} from "./types.js";

export const PLANS: Readonly<Record<string, PlanEntitlements>> = {
  starter: { planCode: "starter", maxLocations: 1, maxPhoneLines: 1, monthlyCallbacks: 150, dailyCallbacksPerLine: 15, feedbackRetentionDays: 90 },
  growth: { planCode: "growth", maxLocations: 5, maxPhoneLines: 10, monthlyCallbacks: 2_000, dailyCallbacksPerLine: 100, feedbackRetentionDays: 365 },
};

export interface NormalizedSubscriptionEvent extends BillingEvent {
  organizationId: string;
  subscriptionId: string;
  customerId: string;
  planCode: string;
  status: SubscriptionStatus;
  periodStart: string;
  periodEnd: string;
  cancelAtPeriodEnd: boolean;
}

export async function processSubscriptionEvent(
  store: PlatformStore,
  event: NormalizedSubscriptionEvent,
  nowIso: string,
): Promise<{ duplicate: boolean; subscription: Subscription | null }> {
  if (!PLANS[event.planCode]) throw new Error("unknown_plan");
  const inserted = await store.recordBillingEvent(event);
  if (!inserted) return { duplicate: true, subscription: await store.getSubscription(event.organizationId) };
  const subscription: Subscription = {
    id: `sub_${event.organizationId}`,
    organizationId: event.organizationId,
    provider: event.provider === "stripe" ? "stripe" : "mock",
    providerCustomerId: event.customerId,
    providerSubscriptionId: event.subscriptionId,
    planCode: event.planCode,
    status: event.status,
    currentPeriodStart: event.periodStart,
    currentPeriodEnd: event.periodEnd,
    cancelAtPeriodEnd: event.cancelAtPeriodEnd,
    updatedAt: nowIso,
  };
  await store.saveSubscription(subscription);
  return { duplicate: false, subscription };
}

export async function evaluateEntitlement(
  store: PlatformStore,
  organizationId: string,
  nowIso: string,
): Promise<EntitlementDecision> {
  const organization = await store.getOrganization(organizationId);
  if (!organization) return { allowed: false, reason: "organization_not_found" };
  if (!["trial", "active"].includes(organization.state)) {
    return { allowed: false, reason: `organization_${organization.state}` };
  }
  const subscription = await store.getSubscription(organizationId);
  if (!subscription) return { allowed: false, reason: "subscription_missing" };
  if (!["trialing", "active"].includes(subscription.status)) {
    return { allowed: false, reason: `subscription_${subscription.status}` };
  }
  if (Date.parse(subscription.currentPeriodEnd) <= Date.parse(nowIso)) {
    return { allowed: false, reason: "subscription_period_expired" };
  }
  const entitlements = PLANS[subscription.planCode];
  if (!entitlements) return { allowed: false, reason: "plan_unavailable" };
  return { allowed: true, reason: "entitled", entitlements };
}
