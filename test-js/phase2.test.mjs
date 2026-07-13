import test from "node:test";
import assert from "node:assert/strict";

import { RingbackCoordinator } from "../dist/coordinator.js";
import { FeedbackTokenService } from "../dist/feedback-token.js";
import { MemoryRepository } from "../dist/memory-repository.js";
import {
  MemoryPilotStore,
  validatePilotBusinessInput,
} from "../dist/pilot-store.js";
import { evaluateMissedCall } from "../dist/policy.js";

class Clock {
  constructor(iso = "2026-07-13T10:00:00.000Z") { this.value = new Date(iso); }
  now() { return new Date(this.value); }
}
class Telephony {
  calls = []; messages = []; next = 0;
  async startCallback(request) {
    this.calls.push(request);
    this.next += 1;
    return { callSid: `CA_${this.next}` };
  }
  async sendLeadMessage(request) {
    this.messages.push(request);
    return { messageSid: `SM_${this.messages.length}` };
  }
}
function biz(id, inbound, callback, overrides = {}) {
  return {
    id, name: `${id} Repair`, inboundNumber: inbound, callbackNumber: callback,
    ownerNumber: "+15559990000", publicBaseUrl: "https://ringback.example.com",
    callbackDelaySeconds: 0, callerCooldownMinutes: 60, maxCallbackAttempts: 1,
    active: true, blockedCallers: new Set(), pilotMode: "live",
    allowedCallers: new Set(), dailyCallbackLimit: 20, feedbackTtlHours: 168,
    timezone: "UTC", ...overrides,
  };
}
function event(index, business, caller = `+1555111222${index}`) {
  return {
    provider: "twilio", providerEventKey: `event_${index}`,
    providerCallSid: `CA_IN_${index}`, sequenceNumber: 0, direction: "inbound",
    status: "no-answer", from: caller, to: business.inboundNumber,
    occurredAt: "2026-07-13T10:00:00.000Z",
  };
}

test("closed pilot business input rejects unsafe roster states", () => {
  assert.throws(() => validatePilotBusinessInput({
    id: "biz_1", name: "Repair", inboundNumber: "+15550000001",
    callbackNumber: "+15550000002", ownerNumber: "+15550000003",
    pilotMode: "allowlist_only", callbackDelaySeconds: 45,
    callerCooldownMinutes: 60, maxCallbackAttempts: 1, dailyCallbackLimit: 5,
    timezone: "UTC", feedbackTtlHours: 168, blockedCallers: [], allowedCallers: [],
  }), /requires at least one allowed caller/);

  assert.throws(() => validatePilotBusinessInput({
    id: "biz_1", name: "Repair", inboundNumber: "+15550000001",
    callbackNumber: "+15550000002", ownerNumber: "+15550000003",
    pilotMode: "live", callbackDelaySeconds: 45,
    callerCooldownMinutes: 60, maxCallbackAttempts: 1, dailyCallbackLimit: 5,
    timezone: "UTC", feedbackTtlHours: 168,
    blockedCallers: ["+15551112222"], allowedCallers: ["+15551112222"],
  }), /both allowed and blocked/);
});

test("allowlist-only business contacts only explicitly approved callers", () => {
  const business = biz("b1", "+15550000001", "+15550000002", {
    pilotMode: "allowlist_only",
    allowedCallers: new Set(["+15551112222"]),
  });
  assert.equal(evaluateMissedCall(event(1, business, "+15551112222"), business).eligible, true);
  assert.equal(
    evaluateMissedCall(event(2, business, "+15551113333"), business).reason,
    "caller_not_allowlisted",
  );
});

test("daily callback limit suppresses extra jobs and records an incident", async () => {
  const business = biz("b1", "+15550000001", "+15550000002", { dailyCallbackLimit: 1 });
  const pilot = new MemoryPilotStore([business]);
  const repo = new MemoryRepository();
  const tel = new Telephony();
  const coordinator = new RingbackCoordinator(repo, tel, business, new Clock(), pilot);

  await coordinator.handleInboundEvent(event(1, business, "+15551112221"));
  await coordinator.handleInboundEvent(event(2, business, "+15551112222"));
  const results = await coordinator.dispatchDueJobs();

  assert.deepEqual(results.map((item) => item.outcome), ["dialing", "suppressed"]);
  assert.equal(tel.calls.length, 1);
  assert.equal(pilot.listIncidents().length, 1);
  assert.equal(pilot.listIncidents()[0].category, "daily_quota");
});

test("business configurations remain isolated across dispatch", async () => {
  const first = biz("first", "+15550000001", "+15550000011");
  const second = biz("second", "+15550000002", "+15550000022");
  const pilot = new MemoryPilotStore([first, second]);
  const tel = new Telephony();

  const repo1 = new MemoryRepository();
  const repo2 = new MemoryRepository();
  const c1 = new RingbackCoordinator(repo1, tel, first, new Clock(), pilot);
  const c2 = new RingbackCoordinator(repo2, tel, second, new Clock(), pilot);
  await c1.handleInboundEvent(event(1, first, "+15551112221"));
  await c2.handleInboundEvent(event(2, second, "+15551112222"));
  await c1.dispatchDueJobs();
  await c2.dispatchDueJobs();

  assert.deepEqual(tel.calls.map((item) => item.from), [
    first.callbackNumber, second.callbackNumber,
  ]);
  assert.deepEqual(tel.calls.map((item) => item.voiceUrl.includes("job=")), [true, true]);
});

test("feedback tokens reject tampering and expiry", async () => {
  const service = new FeedbackTokenService(
    "0123456789abcdef0123456789abcdef",
    "https://ringback.example.com",
    24,
  );
  const business = biz("b1", "+15550000001", "+15550000002");
  const lead = {
    id: "lead_1", businessId: "b1", callbackJobId: "job_1",
    callerNumber: "+15551112222", serviceNeed: "repair", location: "Madurai",
    urgency: "today", createdAt: "2026-07-13T10:00:00.000Z",
  };
  const now = new Date("2026-07-13T10:00:00.000Z");
  const link = new URL(await service.createLink(business, lead, now));
  const exp = Number(link.searchParams.get("exp"));
  const sig = link.searchParams.get("sig");

  assert.equal(await service.verify("b1", "lead_1", exp, sig, now), true);
  assert.equal(await service.verify("b1", "lead_tampered", exp, sig, now), false);
  assert.equal(
    await service.verify("b1", "lead_1", exp, sig, new Date("2026-07-21T10:00:01.000Z")),
    false,
  );
});

test("owner lead message contains a signed outcome link", async () => {
  const business = biz("b1", "+15550000001", "+15550000002");
  const pilot = new MemoryPilotStore([business]);
  const repo = new MemoryRepository();
  const tel = new Telephony();
  const links = new FeedbackTokenService(
    "0123456789abcdef0123456789abcdef",
    "https://ringback.example.com",
    24,
  );
  const coordinator = new RingbackCoordinator(repo, tel, business, new Clock(), pilot, links);
  const created = await coordinator.handleInboundEvent(event(1, business));
  await coordinator.dispatchDueJobs();
  const sid = tel.next ? `CA_${tel.next}` : "CA_1";
  await coordinator.captureAnswer(sid, "serviceNeed", "fridge repair", created.job.id);
  await coordinator.captureAnswer(sid, "location", "Madurai", created.job.id);
  await coordinator.captureAnswer(sid, "urgency", "today", created.job.id);

  assert.equal(tel.messages.length, 1);
  assert.match(tel.messages[0].body, /Update outcome: https:\/\/ringback\.example\.com\/feedback\?/);
  assert.match(tel.messages[0].body, /business=b1/);
});

test("owner feedback is scoped to its business and can be updated", async () => {
  const first = biz("first", "+15550000001", "+15550000011");
  const second = biz("second", "+15550000002", "+15550000022");
  const pilot = new MemoryPilotStore([first, second]);
  pilot.seedLead({
    id: "lead_1", businessId: "first", callbackJobId: "job_1",
    callerNumber: "+15551112222", serviceNeed: "repair", location: "Madurai",
    urgency: "today", createdAt: "2026-07-13T10:00:00.000Z",
  });

  await assert.rejects(pilot.recordOwnerFeedback({
    leadCardId: "lead_1", businessId: "second", outcome: "booked",
    submittedAt: "2026-07-13T11:00:00.000Z",
  }), /does not belong/);

  await pilot.recordOwnerFeedback({
    leadCardId: "lead_1", businessId: "first", outcome: "contacted",
    submittedAt: "2026-07-13T11:00:00.000Z",
  });
  await pilot.recordOwnerFeedback({
    leadCardId: "lead_1", businessId: "first", outcome: "won",
    submittedAt: "2026-07-13T12:00:00.000Z", revenueAmount: 4500,
  });
  assert.equal(pilot.listFeedback().length, 1);
  assert.equal(pilot.listFeedback()[0].outcome, "won");
  assert.equal(pilot.listFeedback()[0].revenueAmount, 4500);
});

test("paused businesses are removed from dispatchable roster", async () => {
  const business = biz("b1", "+15550000001", "+15550000002");
  const pilot = new MemoryPilotStore([business]);
  assert.equal((await pilot.listDispatchableBusinesses()).length, 1);
  await pilot.setPilotMode("b1", "paused");
  assert.equal((await pilot.listDispatchableBusinesses()).length, 0);
  assert.equal((await pilot.getBusinessById("b1")).active, false);
});
