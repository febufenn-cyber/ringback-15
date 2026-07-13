import { transitionJob } from "./state-machine.js";
import type {
  CallbackJob,
  CallProgressEvent,
  LeadCard,
  ManualCallback,
  Repository,
} from "./types.js";

function cloneJob(job: CallbackJob): CallbackJob {
  return { ...job };
}

export class MemoryRepository implements Repository {
  private readonly eventKeys = new Set<string>();
  private readonly jobs = new Map<string, CallbackJob>();
  private readonly jobIdBySource = new Map<string, string>();
  private readonly jobIdByOutbound = new Map<string, string>();
  private readonly manualCallbacks: ManualCallback[] = [];
  private readonly leads = new Map<string, LeadCard>();

  async recordCallEvent(event: CallProgressEvent): Promise<boolean> {
    if (this.eventKeys.has(event.providerEventKey)) {
      return false;
    }
    this.eventKeys.add(event.providerEventKey);
    return true;
  }

  async getJobBySourceCall(sourceCallSid: string): Promise<CallbackJob | null> {
    const id = this.jobIdBySource.get(sourceCallSid);
    return id ? cloneJob(this.jobs.get(id)!) : null;
  }

  async createJobIfAbsent(job: CallbackJob): Promise<{ job: CallbackJob; created: boolean }> {
    const existing = await this.getJobBySourceCall(job.sourceCallSid);
    if (existing) {
      return { job: existing, created: false };
    }
    this.jobs.set(job.id, cloneJob(job));
    this.jobIdBySource.set(job.sourceCallSid, job.id);
    return { job: cloneJob(job), created: true };
  }

  async getJobById(id: string): Promise<CallbackJob | null> {
    const job = this.jobs.get(id);
    return job ? cloneJob(job) : null;
  }

  async getJobByOutboundCall(outboundCallSid: string): Promise<CallbackJob | null> {
    const id = this.jobIdByOutbound.get(outboundCallSid);
    return id ? cloneJob(this.jobs.get(id)!) : null;
  }

  async claimDueJobs(nowIso: string, limit: number): Promise<CallbackJob[]> {
    const now = Date.parse(nowIso);
    const due = [...this.jobs.values()]
      .filter((job) => job.state === "waiting_window" && Date.parse(job.scheduledAt) <= now)
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
      .slice(0, limit);

    return due.map((job) => {
      const claimed = transitionJob(job, "dispatching", nowIso);
      this.jobs.set(claimed.id, cloneJob(claimed));
      return cloneJob(claimed);
    });
  }

  async saveJob(job: CallbackJob): Promise<void> {
    this.jobs.set(job.id, cloneJob(job));
    this.jobIdBySource.set(job.sourceCallSid, job.id);
    if (job.outboundCallSid) {
      this.jobIdByOutbound.set(job.outboundCallSid, job.id);
    }
  }

  async recordManualCallback(callback: ManualCallback): Promise<void> {
    this.manualCallbacks.push({ ...callback });
  }

  async hasRecentManualCallback(
    businessId: string,
    callerNumber: string,
    sinceIso: string,
  ): Promise<boolean> {
    const since = Date.parse(sinceIso);
    return this.manualCallbacks.some(
      (item) =>
        item.businessId === businessId &&
        item.callerNumber === callerNumber &&
        Date.parse(item.occurredAt) >= since,
    );
  }

  async getLeadByCallbackJob(callbackJobId: string): Promise<LeadCard | null> {
    const lead = this.leads.get(callbackJobId);
    return lead ? { ...lead } : null;
  }

  async createLeadIfAbsent(lead: LeadCard): Promise<LeadCard> {
    const existing = this.leads.get(lead.callbackJobId);
    if (existing) return { ...existing };
    this.leads.set(lead.callbackJobId, { ...lead });
    return { ...lead };
  }

  async saveLead(lead: LeadCard): Promise<void> {
    this.leads.set(lead.callbackJobId, { ...lead });
  }

  listJobs(): CallbackJob[] {
    return [...this.jobs.values()].map(cloneJob);
  }

  listLeads(): LeadCard[] {
    return [...this.leads.values()].map((lead) => ({ ...lead }));
  }

  eventCount(): number {
    return this.eventKeys.size;
  }
}
