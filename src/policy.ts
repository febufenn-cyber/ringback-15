import type { BusinessConfig, CallProgressEvent, EligibilityDecision } from "./types.js";

const MISSED_TERMINAL_STATUSES = new Set(["no-answer", "busy", "failed"]);
const E164 = /^\+[1-9]\d{7,14}$/;

export function normalizePhoneNumber(value: string): string | null {
  const normalized = value.trim().replace(/[\s()-]/g, "");
  return E164.test(normalized) ? normalized : null;
}

export function evaluateMissedCall(
  event: CallProgressEvent,
  business: BusinessConfig,
): EligibilityDecision {
  if (!business.active) {
    return { eligible: false, reason: "business_inactive" };
  }
  if (event.direction !== "inbound") {
    return { eligible: false, reason: "not_inbound" };
  }
  if (!MISSED_TERMINAL_STATUSES.has(event.status)) {
    return { eligible: false, reason: "not_missed_terminal" };
  }

  const caller = normalizePhoneNumber(event.from);
  if (!caller) {
    return { eligible: false, reason: "invalid_caller" };
  }

  const destination = normalizePhoneNumber(event.to);
  if (!destination) {
    return { eligible: false, reason: "invalid_destination" };
  }
  if (destination !== business.inboundNumber) {
    return { eligible: false, reason: "destination_mismatch" };
  }
  if (caller === business.inboundNumber || caller === business.callbackNumber) {
    return { eligible: false, reason: "self_call" };
  }
  if (business.blockedCallers.has(caller)) {
    return { eligible: false, reason: "blocked_caller" };
  }

  return { eligible: true, reason: "eligible" };
}
