import { evaluateMissedCall, normalizePhoneNumber } from "./policy.js";
import { canTransition, transitionJob } from "./state-machine.js";
import type {
  BusinessConfig,
  CallbackJob,
  CallProgressEvent,
  Clock,
  DispatchResult,
  InboundHandlingResult,
  LeadCard,
  ManualCallback,
  QualificationField,
  Repository,
  TelephonyGateway,
} from "./types.js";

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function cleanAnswer(value: string): string {
  return value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
}

function safeError(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 300) : "unknown_error";
}

function cooldownStart(now: Date, minutes: number): string {
  return new Date(now.getTime() - minutes * 60_000).toISOString();
}

function buildLeadMessage(business: BusinessConfig, lead: LeadCard): string {
  return [
    `NEW RINGBACK LEAD — ${business.name}`,
    `Caller: ${lead.callerNumber}`,
    `Need: ${lead.serviceNeed}`,
    `Location: ${lead.location}`,
    `Urgency: ${lead.urgency}`,
    "Reply or call the customer promptly. No price or booking was promised.",
  ].join("\n");
}

export class RingbackCoordinator {
  constructor(
    private readonly repository: Repository,
    private readonly telephony: TelephonyGateway,
    private readonly business: BusinessConfig,
    private readonly clock: Clock = new SystemClock(),
  ) {}

  async handleInboundEvent(event: CallProgressEvent): Promise<InboundHandlingResult> {
    const inserted = await this.repository.recordCallEvent(event);
    if (!inserted) {
      return {
        accepted: true,
        duplicateEvent: true,
        createdJob: false,
        reason: "duplicate_provider_event",
      };
    }

    const decision = evaluateMissedCall(event, this.business);
    if (!decision.eligible) {
      return {
        accepted: true,
        duplicateEvent: false,
        createdJob: false,
        reason: decision.reason,
      };
    }

    const callerNumber = normalizePhoneNumber(event.from);
    if (!callerNumber) {
      throw new Error("Eligibility policy returned an invalid caller");
    }

    const now = this.clock.now();
    const nowIso = now.toISOString();
    const scheduledAt = new Date(now.getTime() + this.business.callbackDelaySeconds * 1_000).toISOString();
    const job: CallbackJob = {
      id: newId("cbj"),
      businessId: this.business.id,
      sourceCallSid: event.providerCallSid,
      callerNumber,
      businessNumber: this.business.inboundNumber,
      state: "waiting_window",
      sourceEndedAt: event.occurredAt,
      scheduledAt,
      createdAt: nowIso,
      updatedAt: nowIso,
      attempts: 0,
      lastProviderSequence: -1,
    };

    const created = await this.repository.createJobIfAbsent(job);
    return {
      accepted: true,
      duplicateEvent: false,
      createdJob: created.created,
      reason: created.created ? "callback_job_created" : "source_call_already_has_job",
      job: created.job,
    };
  }

  async recordManualCallback(
    callerInput: string,
    source: ManualCallback["source"] = "owner",
  ): Promise<ManualCallback> {
    const callerNumber = normalizePhoneNumber(callerInput);
    if (!callerNumber) {
      throw new Error("Manual callback requires a valid E.164 caller number");
    }
    const callback: ManualCallback = {
      id: newId("mcb"),
      businessId: this.business.id,
      callerNumber,
      occurredAt: this.clock.now().toISOString(),
      source,
    };
    await this.repository.recordManualCallback(callback);
    return callback;
  }

  async dispatchDueJobs(limit = 20): Promise<DispatchResult[]> {
    const now = this.clock.now();
    const nowIso = now.toISOString();
    const jobs = await this.repository.claimDueJobs(nowIso, limit);
    const results: DispatchResult[] = [];

    for (const job of jobs) {
      const hasManualCallback = await this.repository.hasRecentManualCallback(
        job.businessId,
        job.callerNumber,
        cooldownStart(now, this.business.callerCooldownMinutes),
      );
      if (hasManualCallback) {
        const suppressed = transitionJob(job, "suppressed", nowIso, {
          failureReason: "manual_callback_detected",
        });
        await this.repository.saveJob(suppressed);
        results.push({ jobId: job.id, outcome: "suppressed", detail: "manual_callback_detected" });
        continue;
      }

      if (job.attempts >= this.business.maxCallbackAttempts) {
        const failed = transitionJob(job, "failed", nowIso, {
          failureReason: "maximum_attempts_reached",
        });
        await this.repository.saveJob(failed);
        results.push({ jobId: job.id, outcome: "failed", detail: "maximum_attempts_reached" });
        continue;
      }

      try {
        const started = await this.telephony.startCallback({
          to: job.callerNumber,
          from: this.business.callbackNumber,
          voiceUrl: `${this.business.publicBaseUrl}/voice/start?job=${encodeURIComponent(job.id)}`,
          statusCallbackUrl:
            `${this.business.publicBaseUrl}/webhooks/twilio/outbound-status?job=${encodeURIComponent(job.id)}`,
        });
        const latest = (await this.repository.getJobById(job.id)) ?? job;
        let dialing: CallbackJob;
        if (latest.state === "dispatching") {
          dialing = transitionJob(latest, "dialing", nowIso, {
            outboundCallSid: started.callSid,
            attempts: Math.max(latest.attempts, job.attempts + 1),
          });
        } else {
          dialing = {
            ...latest,
            outboundCallSid: latest.outboundCallSid ?? started.callSid,
            attempts: Math.max(latest.attempts, job.attempts + 1),
            updatedAt: nowIso,
          };
        }
        await this.repository.saveJob(dialing);
        results.push({ jobId: job.id, outcome: "dialing" });
      } catch (error) {
        const detail = safeError(error);
        const failed = transitionJob(job, "failed", nowIso, { failureReason: detail });
        await this.repository.saveJob(failed);
        results.push({ jobId: job.id, outcome: "failed", detail });
      }
    }

    return results;
  }

  private async resolveOutboundJob(
    outboundCallSid: string,
    jobId?: string,
  ): Promise<CallbackJob | null> {
    let job = jobId
      ? await this.repository.getJobById(jobId)
      : await this.repository.getJobByOutboundCall(outboundCallSid);
    if (!job) return null;
    if (job.outboundCallSid && job.outboundCallSid !== outboundCallSid) {
      throw new Error("Outbound CallSid does not match the callback job");
    }
    if (!job.outboundCallSid) {
      job = {
        ...job,
        outboundCallSid,
        updatedAt: this.clock.now().toISOString(),
      };
      await this.repository.saveJob(job);
    }
    return job;
  }

  async handleOutboundEvent(event: CallProgressEvent, jobId?: string): Promise<string> {
    const inserted = await this.repository.recordCallEvent(event);
    if (!inserted) {
      return "duplicate_provider_event";
    }

    const job = await this.resolveOutboundJob(event.providerCallSid, jobId);
    if (!job) {
      return "unknown_outbound_call";
    }
    if (event.sequenceNumber <= job.lastProviderSequence) {
      return "stale_provider_event";
    }

    let target = job.state;
    let failureReason = job.failureReason;
    switch (event.status) {
      case "initiated":
      case "queued":
        target = "dialing";
        break;
      case "ringing":
        target = "ringing";
        break;
      case "in-progress":
        target = "connected";
        break;
      case "busy":
      case "no-answer":
        target = "no_answer";
        failureReason = event.status;
        break;
      case "failed":
        target = "failed";
        failureReason = "provider_failed";
        break;
      case "canceled":
        target = "cancelled";
        failureReason = "provider_cancelled";
        break;
      case "completed":
        if (job.state === "lead_ready" || job.state === "notified") {
          target = job.state;
        } else {
          target = "failed";
          failureReason = "call_completed_before_lead";
        }
        break;
    }

    if (!canTransition(job.state, target)) {
      const sequenceOnly: CallbackJob = {
        ...job,
        lastProviderSequence: event.sequenceNumber,
        updatedAt: this.clock.now().toISOString(),
      };
      await this.repository.saveJob(sequenceOnly);
      return "non_monotonic_state_ignored";
    }

    const transitionPatch: Partial<CallbackJob> = {
      lastProviderSequence: event.sequenceNumber,
    };
    if (failureReason) transitionPatch.failureReason = failureReason;
    const updated = transitionJob(job, target, this.clock.now().toISOString(), transitionPatch);
    await this.repository.saveJob(updated);
    return `state_${updated.state}`;
  }

  async beginQualification(outboundCallSid: string, jobId?: string): Promise<CallbackJob> {
    let job = await this.resolveOutboundJob(outboundCallSid, jobId);
    if (!job) {
      throw new Error("No callback job exists for this outbound call");
    }
    const nowIso = this.clock.now().toISOString();

    if (job.state === "dispatching") {
      job = transitionJob(job, "dialing", nowIso);
      await this.repository.saveJob(job);
    }
    if (job.state === "dialing" || job.state === "ringing") {
      job = transitionJob(job, "connected", nowIso);
      await this.repository.saveJob(job);
    }
    if (job.state === "connected") {
      job = transitionJob(job, "qualifying", nowIso);
      await this.repository.saveJob(job);
    }
    if (!["qualifying", "lead_ready", "notified"].includes(job.state)) {
      throw new Error(`Cannot begin qualification from ${job.state}`);
    }
    return job;
  }

  private leadFromJob(job: CallbackJob, nowIso: string): LeadCard {
    if (!job.serviceNeed || !job.location || !job.urgency) {
      throw new Error("Cannot create a lead before qualification is complete");
    }
    return {
      id: newId("lead"),
      businessId: this.business.id,
      callbackJobId: job.id,
      callerNumber: job.callerNumber,
      serviceNeed: job.serviceNeed,
      location: job.location,
      urgency: job.urgency,
      createdAt: nowIso,
    };
  }

  private async notifyLead(job: CallbackJob, lead: LeadCard): Promise<CallbackJob> {
    if (lead.ownerNotificationSid) {
      const recovered = transitionJob(job, "notified", this.clock.now().toISOString());
      await this.repository.saveJob(recovered);
      return recovered;
    }

    try {
      const notification = await this.telephony.sendLeadMessage({
        to: this.business.ownerNumber,
        from: this.business.callbackNumber,
        body: buildLeadMessage(this.business, lead),
      });
      const notifiedLead: LeadCard = {
        ...lead,
        ownerNotificationSid: notification.messageSid,
      };
      await this.repository.saveLead(notifiedLead);
      const notified = transitionJob(job, "notified", this.clock.now().toISOString());
      await this.repository.saveJob(notified);
      return notified;
    } catch (error) {
      const recoverable = transitionJob(job, "lead_ready", this.clock.now().toISOString(), {
        failureReason: `owner_notification_failed:${safeError(error)}`.slice(0, 300),
      });
      await this.repository.saveJob(recoverable);
      throw error;
    }
  }

  async captureAnswer(
    outboundCallSid: string,
    field: QualificationField,
    rawValue: string,
    jobId?: string,
  ): Promise<CallbackJob> {
    let job = await this.beginQualification(outboundCallSid, jobId);
    if (job.state === "notified") {
      return job;
    }
    if (job.state === "lead_ready") {
      const existingLead =
        (await this.repository.getLeadByCallbackJob(job.id)) ??
        (await this.repository.createLeadIfAbsent(this.leadFromJob(job, this.clock.now().toISOString())));
      return this.notifyLead(job, existingLead);
    }

    const value = cleanAnswer(rawValue);
    if (!value) {
      throw new Error(`Qualification field ${field} is empty`);
    }

    if (job[field]) {
      return job;
    }

    const nowIso = this.clock.now().toISOString();
    job = {
      ...job,
      [field]: value,
      updatedAt: nowIso,
    };
    await this.repository.saveJob(job);

    if (!job.serviceNeed || !job.location || !job.urgency) {
      return job;
    }

    job = transitionJob(job, "lead_ready", nowIso);
    await this.repository.saveJob(job);
    const lead = await this.repository.createLeadIfAbsent(this.leadFromJob(job, nowIso));
    return this.notifyLead(job, lead);
  }
}
