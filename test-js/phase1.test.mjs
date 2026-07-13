import test from "node:test";
import assert from "node:assert/strict";

import { RingbackCoordinator } from "../dist/coordinator.js";
import { MemoryRepository } from "../dist/memory-repository.js";
import { evaluateMissedCall } from "../dist/policy.js";
import { InvalidJobTransitionError, transitionJob } from "../dist/state-machine.js";
import { computeTwilioSignature } from "../dist/twilio.js";
import { startQualificationTwiML } from "../dist/twiml.js";

class FakeClock {
  constructor(iso = "2026-07-13T10:00:00.000Z") {
    this.value = new Date(iso);
  }

  now() {
    return new Date(this.value);
  }

  advanceSeconds(seconds) {
    this.value = new Date(this.value.getTime() + seconds * 1000);
  }
}

class FakeTelephony {
  calls = [];
  messages = [];
  nextCallSid = "CA_OUT_1";
  onStart = null;
  messageFailures = 0;

  async startCallback(request) {
    this.calls.push(request);
    if (this.onStart) await this.onStart(request, this.nextCallSid);
    return { callSid: this.nextCallSid };
  }

  async sendLeadMessage(request) {
    this.messages.push(request);
    if (this.messageFailures > 0) {
      this.messageFailures -= 1;
      throw new Error("temporary messaging outage");
    }
    return { messageSid: `SM_${this.messages.length}` };
  }
}

function business(overrides = {}) {
  return {
    id: "business_1",
    name: "A&B <Repair>",
    inboundNumber: "+15550000001",
    callbackNumber: "+15550000002",
    ownerNumber: "+15550000003",
    publicBaseUrl: "https://ringback.example.com",
    callbackDelaySeconds: 0,
    callerCooldownMinutes: 1440,
    maxCallbackAttempts: 1,
    active: true,
    blockedCallers: new Set(),
    ...overrides,
  };
}

function inboundEvent(overrides = {}) {
  return {
    provider: "twilio",
    providerEventKey: "twilio:inbound:CA_IN_1:0:no-answer",
    providerCallSid: "CA_IN_1",
    sequenceNumber: 0,
    direction: "inbound",
    status: "no-answer",
    from: "+15551112222",
    to: "+15550000001",
    occurredAt: "2026-07-13T10:00:00.000Z",
    ...overrides,
  };
}

function outboundEvent(callSid, sequenceNumber, status) {
  return {
    provider: "twilio",
    providerEventKey: `twilio:outbound:${callSid}:${sequenceNumber}:${status}`,
    providerCallSid: callSid,
    sequenceNumber,
    direction: "outbound-api",
    status,
    from: "+15550000002",
    to: "+15551112222",
    occurredAt: new Date(Date.parse("2026-07-13T10:00:00.000Z") + sequenceNumber * 1000).toISOString(),
  };
}

async function preparedCoordinator(options = {}) {
  const repository = new MemoryRepository();
  const telephony = new FakeTelephony();
  const clock = new FakeClock();
  const coordinator = new RingbackCoordinator(
    repository,
    telephony,
    business(options.business),
    clock,
  );
  const result = await coordinator.handleInboundEvent(inboundEvent(options.event));
  assert.equal(result.createdJob, true);
  return { repository, telephony, clock, coordinator, job: result.job };
}

test("Twilio signature implementation matches the published form-encoded example", async () => {
  const form = new URLSearchParams({
    CallSid: "CA1234567890ABCDE",
    Caller: "+14158675310",
    Digits: "1234",
    From: "+14158675310",
    To: "+18005551212",
  });
  const signature = await computeTwilioSignature(
    "12345",
    "https://example.com/myapp.php?foo=1&bar=2",
    form,
  );
  assert.equal(signature, "L/OH5YylLD5NRKLltdqwSvS0BnU=");
});

test("duplicate events and multiple terminal events for one source call create one job", async () => {
  const repository = new MemoryRepository();
  const coordinator = new RingbackCoordinator(repository, new FakeTelephony(), business(), new FakeClock());
  const event = inboundEvent();

  const first = await coordinator.handleInboundEvent(event);
  const duplicate = await coordinator.handleInboundEvent(event);
  const secondTerminal = await coordinator.handleInboundEvent(
    inboundEvent({
      providerEventKey: "twilio:inbound:CA_IN_1:1:failed",
      sequenceNumber: 1,
      status: "failed",
    }),
  );

  assert.equal(first.createdJob, true);
  assert.equal(duplicate.duplicateEvent, true);
  assert.equal(secondTerminal.createdJob, false);
  assert.equal(repository.listJobs().length, 1);
});

test("manual owner callback suppresses the automated callback", async () => {
  const { coordinator, repository, telephony } = await preparedCoordinator();
  await coordinator.recordManualCallback("+15551112222", "owner");

  const results = await coordinator.dispatchDueJobs();

  assert.deepEqual(results.map((item) => item.outcome), ["suppressed"]);
  assert.equal(telephony.calls.length, 0);
  assert.equal(repository.listJobs()[0].state, "suppressed");
});

test("out-of-order and non-monotonic progress events cannot regress job state", async () => {
  const { coordinator, repository, telephony } = await preparedCoordinator();
  await coordinator.dispatchDueJobs();
  const callSid = telephony.nextCallSid;

  assert.equal(await coordinator.handleOutboundEvent(outboundEvent(callSid, 1, "ringing")), "state_ringing");
  assert.equal(await coordinator.handleOutboundEvent(outboundEvent(callSid, 0, "initiated")), "stale_provider_event");
  assert.equal(await coordinator.handleOutboundEvent(outboundEvent(callSid, 2, "in-progress")), "state_connected");
  assert.equal(
    await coordinator.handleOutboundEvent(outboundEvent(callSid, 3, "ringing")),
    "non_monotonic_state_ignored",
  );

  const job = repository.listJobs()[0];
  assert.equal(job.state, "connected");
  assert.equal(job.lastProviderSequence, 3);
});

test("qualification creates one lead and one owner message", async () => {
  const { coordinator, repository, telephony, job } = await preparedCoordinator();
  await coordinator.dispatchDueJobs();
  const callSid = telephony.nextCallSid;

  await coordinator.captureAnswer(callSid, "serviceNeed", "  leaking   washing machine  ", job.id);
  await coordinator.captureAnswer(callSid, "location", "Anna Nagar", job.id);
  const completed = await coordinator.captureAnswer(callSid, "urgency", "today", job.id);
  const repeated = await coordinator.captureAnswer(callSid, "urgency", "today", job.id);

  assert.equal(completed.state, "notified");
  assert.equal(repeated.state, "notified");
  assert.equal(repository.listLeads().length, 1);
  assert.equal(repository.listLeads()[0].serviceNeed, "leaking washing machine");
  assert.equal(telephony.messages.length, 1);
  assert.match(telephony.messages[0].body, /No price or booking was promised/);
});

test("owner notification failure leaves a recoverable lead_ready job", async () => {
  const { coordinator, repository, telephony, job } = await preparedCoordinator();
  await coordinator.dispatchDueJobs();
  const callSid = telephony.nextCallSid;
  telephony.messageFailures = 1;

  await coordinator.captureAnswer(callSid, "serviceNeed", "fridge repair", job.id);
  await coordinator.captureAnswer(callSid, "location", "Madurai", job.id);
  await assert.rejects(
    coordinator.captureAnswer(callSid, "urgency", "today", job.id),
    /temporary messaging outage/,
  );

  assert.equal(repository.listJobs()[0].state, "lead_ready");
  assert.match(repository.listJobs()[0].failureReason, /owner_notification_failed/);
  assert.equal(repository.listLeads().length, 1);

  const recovered = await coordinator.captureAnswer(callSid, "urgency", "today", job.id);
  assert.equal(recovered.state, "notified");
  assert.equal(repository.listLeads()[0].ownerNotificationSid, "SM_2");
});

test("voice webhook race binds the provider call without regressing qualification", async () => {
  const { coordinator, repository, telephony, job } = await preparedCoordinator();
  telephony.onStart = async (_request, callSid) => {
    await coordinator.beginQualification(callSid, job.id);
  };

  await coordinator.dispatchDueJobs();

  const stored = repository.listJobs()[0];
  assert.equal(stored.state, "qualifying");
  assert.equal(stored.outboundCallSid, telephony.nextCallSid);
  assert.equal(stored.attempts, 1);
});

test("eligibility rejects canceled, blocked, mismatched, and anonymous calls", () => {
  assert.equal(evaluateMissedCall(inboundEvent({ status: "canceled" }), business()).eligible, false);
  assert.equal(
    evaluateMissedCall(inboundEvent(), business({ blockedCallers: new Set(["+15551112222"]) })).reason,
    "blocked_caller",
  );
  assert.equal(
    evaluateMissedCall(inboundEvent({ to: "+15559999999" }), business()).reason,
    "destination_mismatch",
  );
  assert.equal(evaluateMissedCall(inboundEvent({ from: "anonymous" }), business()).reason, "invalid_caller");
});

test("state machine rejects backward transitions", () => {
  const job = {
    id: "cbj_1",
    businessId: "business_1",
    sourceCallSid: "CA_IN",
    callerNumber: "+15551112222",
    businessNumber: "+15550000001",
    state: "connected",
    sourceEndedAt: "2026-07-13T10:00:00.000Z",
    scheduledAt: "2026-07-13T10:00:00.000Z",
    createdAt: "2026-07-13T10:00:00.000Z",
    updatedAt: "2026-07-13T10:00:00.000Z",
    attempts: 1,
    lastProviderSequence: 2,
  };
  assert.throws(
    () => transitionJob(job, "ringing", "2026-07-13T10:00:01.000Z"),
    InvalidJobTransitionError,
  );
});

test("TwiML escapes business-controlled text", () => {
  const twiml = startQualificationTwiML("A&B <Repair>", "https://example.com/a?x=1&y=2");
  assert.match(twiml, /A&amp;B &lt;Repair&gt;/);
  assert.match(twiml, /x=1&amp;y=2/);
  assert.doesNotMatch(twiml, /A&B <Repair>/);
});
