import test from "node:test";
import assert from "node:assert/strict";
import { MemoryPlatformStore } from "../dist/platform/memory-store.js";
import { PlatformService } from "../dist/platform/platform-service.js";
import { processSubscriptionEvent, evaluateEntitlement } from "../dist/platform/billing.js";
import { requireCapability } from "../dist/platform/authz.js";
import { advanceOnboarding } from "../dist/platform/onboarding.js";

class Clock { constructor() { this.value = new Date("2026-07-14T06:00:00.000Z"); } now() { return new Date(this.value); } advance(days) { this.value = new Date(this.value.getTime() + days * 86400000); } }
const owner = { userId: "user_owner" };

async function subscribedContext(planCode = "starter") {
  const store = new MemoryPlatformStore();
  const clock = new Clock();
  const service = new PlatformService(store, clock);
  const { organization } = await service.createOrganization(owner, "Madurai Repair", "Asia/Kolkata");
  await processSubscriptionEvent(store, {
    provider: "stripe", providerEventId: "evt_1", eventType: "customer.subscription.updated",
    occurredAt: clock.now().toISOString(), payloadHash: "hash", organizationId: organization.id,
    subscriptionId: "sub_external", customerId: "cus_1", planCode, status: "active",
    periodStart: "2026-07-01T00:00:00.000Z", periodEnd: "2026-08-01T00:00:00.000Z", cancelAtPeriodEnd: false,
  }, clock.now().toISOString());
  return { store, clock, service, organization };
}

test("organization creator receives active owner membership and audit", async () => {
  const store = new MemoryPlatformStore();
  const service = new PlatformService(store, new Clock());
  const { organization, onboarding } = await service.createOrganization(owner, "Test Business");
  assert.equal((await store.getMembership(organization.id, owner.userId)).role, "owner");
  assert.equal(onboarding.state, "created");
  assert.equal((await store.listAudit(organization.id))[0].action, "organization.created");
});

test("viewer cannot manage members", async () => {
  const { store, service, organization } = await subscribedContext();
  const invitation = await service.inviteMember(owner, organization.id, "viewer", "viewer");
  assert.equal(invitation.state, "invited");
  await service.acceptMembership({ userId: "viewer" }, organization.id);
  await assert.rejects(requireCapability(store, { userId: "viewer" }, organization.id, "members.manage"), /capability_denied/);
});

test("billing webhook is idempotent and entitlement expires", async () => {
  const { store, clock, organization } = await subscribedContext();
  const duplicate = await processSubscriptionEvent(store, {
    provider: "stripe", providerEventId: "evt_1", eventType: "customer.subscription.updated",
    occurredAt: clock.now().toISOString(), payloadHash: "hash", organizationId: organization.id,
    subscriptionId: "sub_external", customerId: "cus_1", planCode: "starter", status: "active",
    periodStart: "2026-07-01T00:00:00.000Z", periodEnd: "2026-08-01T00:00:00.000Z", cancelAtPeriodEnd: false,
  }, clock.now().toISOString());
  assert.equal(duplicate.duplicate, true);
  assert.equal((await evaluateEntitlement(store, organization.id, clock.now().toISOString())).allowed, true);
  clock.advance(30);
  assert.equal((await evaluateEntitlement(store, organization.id, clock.now().toISOString())).reason, "subscription_period_expired");
});

test("starter plan limits locations and lines", async () => {
  const { service, organization } = await subscribedContext("starter");
  const location = await service.addLocation(owner, organization.id, { name: "Main", timezone: "Asia/Kolkata", serviceRegion: "Madurai" });
  await assert.rejects(service.addLocation(owner, organization.id, { name: "Second", timezone: "Asia/Kolkata", serviceRegion: "Chennai" }), /location_limit_reached/);
  await service.addPhoneLine(owner, organization.id, { locationId: location.id, inboundNumber: "+15550000001", callbackNumber: "+15550000002", ownerNumber: "+15550000003", dailyCallbackLimit: 999, spendLimitMinor: 10000 });
  await assert.rejects(service.addPhoneLine(owner, organization.id, { locationId: location.id, inboundNumber: "+15550000011", callbackNumber: "+15550000012", ownerNumber: "+15550000013", dailyCallbackLimit: 2, spendLimitMinor: 10000 }), /phone_line_limit_reached/);
});

test("line activation requires verified line, active onboarding, active organization, and entitlement", async () => {
  const { store, service, organization } = await subscribedContext();
  const location = await service.addLocation(owner, organization.id, { name: "Main", timezone: "Asia/Kolkata", serviceRegion: "Madurai" });
  const line = await service.addPhoneLine(owner, organization.id, { locationId: location.id, inboundNumber: "+15550000021", callbackNumber: "+15550000022", ownerNumber: "+15550000023", dailyCallbackLimit: 10, spendLimitMinor: 10000 });
  await assert.rejects(service.activateLine(owner, organization.id, line.id), /organization_not_active/);
  const states = ["profile_complete", "line_configured", "number_verified", "policy_approved", "billing_ready", "test_passed", "active"];
  for (const state of states) await service.advanceOnboarding(owner, organization.id, state, state);
  await service.activateOrganization(owner, organization.id);
  await assert.rejects(service.activateLine(owner, organization.id, line.id), /line_not_verified/);
  await service.markLineVerified(owner, organization.id, line.id, "PN_1");
  assert.equal((await service.activateLine(owner, organization.id, line.id)).active, true);
  assert.equal((await store.getPhoneLine(organization.id, line.id)).state, "active");
});

test("cross-tenant lookup and capability checks fail closed", async () => {
  const first = await subscribedContext();
  const second = await subscribedContext();
  assert.equal(await first.store.getMembership(second.organization.id, owner.userId), null);
  await assert.rejects(requireCapability(first.store, owner, second.organization.id, "organization.read"), /organization_access_denied/);
});

test("usage events are idempotent by organization, kind, and source", async () => {
  const { store, service, organization } = await subscribedContext();
  assert.equal(await service.recordUsage(organization.id, { kind: "callback_attempt", quantity: 1, sourceId: "call_1" }), true);
  assert.equal(await service.recordUsage(organization.id, { kind: "callback_attempt", quantity: 1, sourceId: "call_1" }), false);
  assert.equal(await store.sumUsage(organization.id, "callback_attempt", "2026-07-01T00:00:00.000Z", "2026-08-01T00:00:00.000Z"), 1);
});

test("suspension pauses every line and records reason", async () => {
  const { store, service, organization } = await subscribedContext();
  const location = await service.addLocation(owner, organization.id, { name: "Main", timezone: "Asia/Kolkata", serviceRegion: "Madurai" });
  await service.addPhoneLine(owner, organization.id, { locationId: location.id, inboundNumber: "+15550000031", callbackNumber: "+15550000032", ownerNumber: "+15550000033", dailyCallbackLimit: 10, spendLimitMinor: 10000 });
  const suspended = await service.suspendOrganization(owner, organization.id, "payment dispute");
  assert.equal(suspended.state, "suspended");
  assert.equal((await store.listPhoneLines(organization.id))[0].state, "paused");
  assert.match(JSON.stringify(await store.listAudit(organization.id)), /payment dispute/);
});

test("onboarding cannot skip mandatory states", () => {
  const session = { id: "onb", organizationId: "org", state: "created", completedSteps: [], createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" };
  assert.throws(() => advanceOnboarding(session, "number_verified", "2026-01-01T00:00:01Z"), /illegal_onboarding_transition/);
});
