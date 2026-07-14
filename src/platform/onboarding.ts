import type { OnboardingSession, OnboardingState } from "./types.js";

const ORDER: readonly OnboardingState[] = [
  "created",
  "profile_complete",
  "line_configured",
  "number_verified",
  "policy_approved",
  "billing_ready",
  "test_passed",
  "active",
];

export function canAdvanceOnboarding(from: OnboardingState, to: OnboardingState): boolean {
  if (from === to) return true;
  if (to === "blocked" || to === "abandoned") return from !== "active" && from !== "abandoned";
  if (from === "blocked") return to === "created";
  const fromIndex = ORDER.indexOf(from);
  const toIndex = ORDER.indexOf(to);
  return fromIndex >= 0 && toIndex === fromIndex + 1;
}

export function advanceOnboarding(
  session: OnboardingSession,
  to: OnboardingState,
  nowIso: string,
  step?: string,
  blockedReason?: string,
): OnboardingSession {
  if (!canAdvanceOnboarding(session.state, to)) {
    throw new Error(`illegal_onboarding_transition:${session.state}:${to}`);
  }
  const completedSteps = step && !session.completedSteps.includes(step)
    ? [...session.completedSteps, step]
    : [...session.completedSteps];
  const next: OnboardingSession = {
    ...session,
    state: to,
    completedSteps,
    updatedAt: nowIso,
  };
  if (to === "blocked") {
    if (!blockedReason?.trim()) throw new Error("blocked_onboarding_requires_reason");
    next.blockedReason = blockedReason.trim().slice(0, 300);
  } else {
    delete next.blockedReason;
  }
  return next;
}
