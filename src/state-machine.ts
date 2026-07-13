import type { CallbackJob, CallbackJobState } from "./types.js";

const ALLOWED: Readonly<Record<CallbackJobState, ReadonlySet<CallbackJobState>>> = {
  waiting_window: new Set(["dispatching", "suppressed", "cancelled", "failed"]),
  dispatching: new Set(["dialing", "suppressed", "failed", "cancelled"]),
  dialing: new Set(["ringing", "connected", "no_answer", "failed", "cancelled"]),
  ringing: new Set(["connected", "no_answer", "failed", "cancelled"]),
  connected: new Set(["qualifying", "lead_ready", "no_answer", "failed", "cancelled"]),
  qualifying: new Set(["lead_ready", "failed", "cancelled"]),
  lead_ready: new Set(["notified", "failed"]),
  notified: new Set(),
  no_answer: new Set(),
  suppressed: new Set(),
  failed: new Set(),
  cancelled: new Set(),
};

export class InvalidJobTransitionError extends Error {
  constructor(from: CallbackJobState, to: CallbackJobState) {
    super(`Illegal callback job transition: ${from} -> ${to}`);
    this.name = "InvalidJobTransitionError";
  }
}

export function canTransition(from: CallbackJobState, to: CallbackJobState): boolean {
  return from === to || ALLOWED[from].has(to);
}

export function transitionJob(
  job: CallbackJob,
  to: CallbackJobState,
  nowIso: string,
  patch: Partial<CallbackJob> = {},
): CallbackJob {
  if (!canTransition(job.state, to)) {
    throw new InvalidJobTransitionError(job.state, to);
  }

  return {
    ...job,
    ...patch,
    id: job.id,
    businessId: job.businessId,
    sourceCallSid: job.sourceCallSid,
    callerNumber: job.callerNumber,
    businessNumber: job.businessNumber,
    state: to,
    updatedAt: nowIso,
  };
}

export function isTerminalState(state: CallbackJobState): boolean {
  return ALLOWED[state].size === 0;
}
